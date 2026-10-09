// End-to-end smoke test: starts the server on a temp database and walks the whole flow.
const { spawn } = require('child_process'), assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const PORT = 4000 + Math.floor(Math.random() * 900), B = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'qsb-'));
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, DATA_DIR: DATA, BASE_URL: B }, stdio: 'ignore' });
const call = (p, body, cookie, method = 'POST') => fetch(B + p, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(body || {}) });
const get = (p, cookie) => fetch(B + p, { headers: cookie ? { Cookie: cookie } : {} });
const token = link => link.split('token=')[1];
let n = 0;
const check = async (name, fn) => { await fn(); n++; console.log('  ok  ' + name); };

(async () => {
  for (let i = 0; ; i++) { try { await fetch(B + '/api/public'); break; } catch { if (i > 60) throw new Error('server did not start'); await new Promise(r => setTimeout(r, 200)); } }
  let ann, bob, code;
  await check('fresh install is not set up', async () => assert.equal((await (await get('/api/public')).json()).setup, false));
  await check('first run creates the admin and signs them in', async () => {
    const r = await call('/api/setup', { org: 'Acme', name: 'Ann', email: 'ann@acme.test', role: 'MD' });
    assert.equal(r.status, 200); ann = r.headers.get('set-cookie').split(';')[0];
  });
  await check('setup cannot be run twice', async () => assert.equal((await call('/api/setup', { org: 'x', name: 'x', email: 'x@x.co' })).status, 409));
  await check('admin adds a reader, duplicates are refused', async () => {
    assert.equal((await call('/api/admin/people', { name: 'Bob', role: 'Manager', email: 'bob@acme.test' }, ann)).status, 200);
    assert.equal((await call('/api/admin/people', { name: 'Bob', role: 'Manager', email: 'bob@acme.test' }, ann)).status, 409);
  });
  await check('reader signs in with a one-time link', async () => {
    const { link } = await (await call('/api/admin/people/2/link', {}, ann)).json();
    const r = await call('/api/auth', { token: token(link) }); assert.equal(r.status, 200); bob = r.headers.get('set-cookie').split(';')[0];
    assert.equal((await call('/api/auth', { token: token(link) })).status, 400, 'link must work once');
  });
  await check('anyone can send a suggestion with a file', async () => {
    const fd = new FormData(); fd.set('recipient_id', '2'); fd.set('body', 'Gate lighting is too dim'); fd.set('contact', 's@x.co');
    fd.append('files', new Blob(['hello'], { type: 'text/plain' }), 'note.txt');
    const r = await fetch(B + '/api/submit', { method: 'POST', body: fd }); assert.equal(r.status, 200); code = (await r.json()).code; assert.match(code, /^QSB-/);
  });
  await check('bad file type, empty message and unknown reader are refused', async () => {
    const f1 = new FormData(); f1.set('recipient_id', '2'); f1.set('body', 'x'); f1.append('files', new Blob(['x'], { type: 'application/x-msdownload' }), 'a.exe');
    assert.equal((await fetch(B + '/api/submit', { method: 'POST', body: f1 })).status, 400);
    const f2 = new FormData(); f2.set('recipient_id', '2'); assert.equal((await fetch(B + '/api/submit', { method: 'POST', body: f2 })).status, 400);
    const f3 = new FormData(); f3.set('recipient_id', '99'); f3.set('body', 'x'); assert.equal((await fetch(B + '/api/submit', { method: 'POST', body: f3 })).status, 400);
  });
  await check('sender sees Sent, not yet Seen', async () => { const t = await (await call('/api/track', { code })).json(); assert.equal(t.seen_at, null); assert.equal(t.replied, false); });
  await check('only the addressed reader can open it and its file', async () => {
    const list = await (await get('/api/inbox?tab=new', bob)).json(); assert.equal(list.rows.length, 1);
    const d = await (await get('/api/s/1', bob)).json(); assert.equal(d.attachments.length, 1);
    assert.equal((await get('/api/s/1', ann)).status, 404);
    assert.equal((await get('/api/file/' + d.attachments[0].id, bob)).status, 200);
    assert.equal((await get('/api/file/' + d.attachments[0].id, ann)).status, 404);
  });
  await check('sender sees Seen after the reader opens it', async () => assert.ok((await (await call('/api/track', { code })).json()).seen_at));
  await check('reply, then sender replies back, which reopens it', async () => {
    assert.equal((await call('/api/s/1/reply', { body: 'We will fix it' }, bob)).status, 200);
    let t = await (await call('/api/track', { code: code.toLowerCase() })).json(); assert.equal(t.replied, true); assert.equal(t.messages[0].body, 'We will fix it');
    assert.equal((await call('/api/track/reply', { code, body: 'Thanks' })).status, 200);
    assert.equal((await (await get('/api/inbox?tab=new', bob)).json()).rows.length, 1);
  });
  await check('forward to another reader, then mark done', async () => {
    assert.equal((await call('/api/s/1/forward', { user_id: 1 }, bob)).status, 200);
    assert.equal((await get('/api/s/1', bob)).status, 404);
    assert.equal((await call('/api/s/1/done', {}, ann)).status, 200);
    assert.equal((await (await call('/api/track', { code })).json()).done, true);
  });
  await check('themes and templates: validated, admin only, applied publicly', async () => {
    assert.equal((await call('/api/admin/appearance', { theme: 'nope', template: 'school' }, ann)).status, 400);
    assert.equal((await call('/api/admin/appearance', { theme: 'ocean', template: 'school' })).status, 401);
    assert.equal((await call('/api/admin/appearance', { theme: 'ocean', template: 'school' }, bob)).status, 403);
    assert.equal((await call('/api/admin/appearance', { theme: 'ocean', template: 'school' }, ann)).status, 200);
    assert.deepEqual((await (await get('/api/public')).json()).look, { theme: 'ocean', template: 'school' });
  });
  await check('wrong code and non-JSON writes are rejected', async () => {
    assert.equal((await call('/api/track', { code: 'QSB-AAAAA-BBBBB' })).status, 404);
    assert.equal((await fetch(B + '/api/s/1/done', { method: 'POST', headers: { Cookie: ann }, body: 'x' })).status, 415);
  });
  console.log(`\nAll ${n} checks passed.`);
})().then(() => cleanup(0), e => { console.error('\nFAILED:', e.message); cleanup(1); });
function cleanup(code) { const done = () => { try { fs.rmSync(DATA, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch {} process.exit(code); }; if (srv.exitCode !== null) return done(); srv.once('exit', done); srv.kill(); setTimeout(done, 5000).unref(); }
