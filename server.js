'use strict';
const express = require('express'), multer = require('multer'), QR = require('qrcode'), cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit'), nodemailer = require('nodemailer'), Database = require('better-sqlite3');
const crypto = require('crypto'), fs = require('fs'), path = require('path');

const PORT = +process.env.PORT || 3100;
const BASE = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const PROD = process.env.NODE_ENV === 'production';
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(path.join(DATA, 'uploads'), { recursive: true });

// Key that encrypts senders' optional contact details at rest.
const keyFile = path.join(DATA, 'secret.key');
if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
const KEY = Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'hex');

const mailer = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
const db = new Database(path.join(DATA, 'qsb.db'));
db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON');
db.exec(`
create table if not exists meta(k text primary key, v text);
create table if not exists users(id integer primary key, name text not null, role_label text not null default 'Staff', email text not null unique, is_admin integer not null default 0, active integer not null default 1);
create table if not exists login_tokens(token text primary key, user_id integer not null, expires integer not null);
create table if not exists sessions(sid text primary key, user_id integer not null, expires integer not null);
create table if not exists submissions(id integer primary key, code_hash text not null unique, recipient_id integer not null references users(id), body text not null, contact_enc text, place text, status text not null default 'new', created_at integer not null, seen_at integer);
create table if not exists attachments(id integer primary key, submission_id integer not null references submissions(id) on delete cascade, name text not null, mime text not null, size integer not null, path text not null);
create table if not exists messages(id integer primary key, submission_id integer not null references submissions(id) on delete cascade, from_reader integer not null, body text not null, created_at integer not null);
create index if not exists sub_rec on submissions(recipient_id, status);
`);

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const rnd = n => crypto.randomBytes(n).toString('base64url');
const enc = t => { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', KEY, iv); const b = Buffer.concat([c.update(t, 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), b]).toString('base64'); };
const dec = s => { const b = Buffer.from(s, 'base64'), d = crypto.createDecipheriv('aes-256-gcm', KEY, b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'); };
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const part = () => Array.from(crypto.randomBytes(5), b => ALPHA[b % ALPHA.length]).join('');
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const THEME_IDS = ['teal', 'ocean', 'amber', 'slate', 'forest', 'plum'], TPL_IDS = ['workplace', 'school', 'clinic', 'community'];
const look = () => { try { const a = JSON.parse(db.prepare("select v from meta where k='look'").get().v); return { theme: THEME_IDS.includes(a.theme) ? a.theme : 'teal', template: TPL_IDS.includes(a.template) ? a.template : 'workplace' }; } catch { return { theme: 'teal', template: 'workplace' }; } };
const orgName = () => (db.prepare("select v from meta where k='org'").get() || {}).v || '';
const hasUsers = () => db.prepare('select count(*) n from users').get().n > 0;
const clean = (s, n) => String(s || '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);

async function notify(to, subject, text) {
  if (!to) return;
  if (!mailer) { console.log(`[email not configured] to=${to}\n  ${subject}\n  ${text}\n`); return; }
  try { await mailer.sendMail({ from: process.env.MAIL_FROM || 'Suggestion box <no-reply@localhost>', to, subject, text }); }
  catch (e) { console.error('email failed:', e.message); }
}
// Contact is an email -> email it. Phone numbers need an SMS provider (not wired yet).
async function notifyContact(contactEnc, subject, text) {
  if (!contactEnc) return;
  const c = dec(contactEnc);
  if (c.includes('@')) return notify(c, subject, text);
  console.log(`[sms not configured] would text ${c}: ${text}`);
}
function loginLink(uid, minutes) {
  const t = rnd(32);
  db.prepare('insert into login_tokens values(?,?,?)').run(sha(t), uid, Date.now() + minutes * 60e3);
  return `${BASE}/auth?token=${t}`;
}
function startSession(res, uid) {
  const sid = rnd(32), ms = 30 * 864e5;
  db.prepare('insert into sessions values(?,?,?)').run(sha(sid), uid, Date.now() + ms);
  res.cookie('sid', sid, { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: ms });
}

const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((q, s, n) => {
  s.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; media-src 'self' blob:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
  n();
});
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

const limit = (windowMin, max) => rateLimit({ windowMs: windowMin * 60e3, limit: max, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Wait a little and try again.' } });
const auth = (req, res, next) => {
  if (req.method !== 'GET' && !String(req.headers['content-type'] || '').includes('application/json')) return res.status(415).json({ error: 'JSON only' });
  const sid = req.cookies.sid;
  const u = sid && db.prepare('select u.* from sessions s join users u on u.id=s.user_id where s.sid=? and s.expires>? and u.active=1').get(sha(sid), Date.now());
  if (!u) return res.status(401).json({ error: 'Sign in to continue.' });
  req.user = u; next();
};
const adminOnly = (req, res, next) => req.user.is_admin ? next() : res.status(403).json({ error: 'Admins only.' });

// ---------- Public: send ----------
app.get('/api/public', (q, s) => {
  const people = db.prepare('select id, name, role_label role from users where active=1 order by id').all();
  s.json({ setup: hasUsers(), org: orgName(), people, look: look() });
});

const ALLOW = /^(image\/(png|jpeg|gif|webp|heic)|audio\/|video\/|application\/pdf$|text\/plain$|application\/(msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)))/;
const up = multer({
  storage: multer.diskStorage({ destination: path.join(DATA, 'uploads'), filename: (q, f, cb) => cb(null, rnd(18)) }),
  limits: { fileSize: 25 * 1024 * 1024, files: 4 },
  fileFilter: (q, f, cb) => ALLOW.test(f.mimetype) ? cb(null, true) : cb(new Error('type'))
});

app.post('/api/submit', limit(60, 20), up.array('files', 4), async (req, res) => {
  const b = req.body || {}, files = req.files || [];
  const drop = () => files.forEach(f => fs.rm(f.path, () => {}));
  const body = clean(b.body, 5000);
  const to = db.prepare('select * from users where id=? and active=1').get(+b.recipient_id);
  if (!to) { drop(); return res.status(400).json({ error: 'Pick who should read it.' }); }
  if (!body && !files.length) { drop(); return res.status(400).json({ error: 'Write a message or attach something.' }); }
  const code = `QSB-${part()}-${part()}`, contact = clean(b.contact, 120);
  db.transaction(() => {
    const id = db.prepare('insert into submissions(code_hash,recipient_id,body,contact_enc,place,created_at) values(?,?,?,?,?,?)')
      .run(sha(normCode(code)), to.id, body || '(no text, see attachments)', contact ? enc(contact) : null, clean(b.loc, 60) || null, Date.now()).lastInsertRowid;
    const ins = db.prepare('insert into attachments(submission_id,name,mime,size,path) values(?,?,?,?,?)');
    for (const f of files) ins.run(id, clean(path.basename(f.originalname), 80) || 'file', f.mimetype, f.size, f.filename);
  })();
  notify(to.email, 'New suggestion for you', `Someone sent you a suggestion.\nOpen your inbox: ${loginLink(to.id, 1440)}\n(The message itself is not sent by email.)`);
  res.json({ code });
});

// ---------- Public: status and reply (by tracking code) ----------
const findByCode = code => {
  const n = normCode(code);
  return n.length < 10 ? null : db.prepare('select s.*, u.name uname, u.role_label urole, u.email uemail, u.id uid from submissions s join users u on u.id=s.recipient_id where s.code_hash=?').get(sha(n));
};
app.post('/api/track', limit(15, 40), (req, res) => {
  const s = findByCode((req.body || {}).code);
  if (!s) return res.status(404).json({ error: 'No suggestion matches that code.' });
  const messages = db.prepare('select from_reader, body, created_at from messages where submission_id=? order by id').all(s.id);
  res.json({ to: s.uname, role: s.urole, sent_at: s.created_at, seen_at: s.seen_at, replied: messages.some(m => m.from_reader), done: s.status === 'done', messages });
});
app.post('/api/track/reply', limit(15, 20), (req, res) => {
  const b = req.body || {}, s = findByCode(b.code), body = clean(b.body, 3000);
  if (!s) return res.status(404).json({ error: 'No suggestion matches that code.' });
  if (!body) return res.status(400).json({ error: 'Write a reply first.' });
  db.prepare('insert into messages(submission_id,from_reader,body,created_at) values(?,0,?,?)').run(s.id, body, Date.now());
  db.prepare("update submissions set status='new' where id=?").run(s.id);
  notify(s.uemail, 'New reply on a suggestion', `The sender replied.\nOpen your inbox: ${loginLink(s.uid, 1440)}`);
  res.json({ ok: true });
});

// ---------- Sign in (magic link, no passwords) ----------
app.post('/api/login', limit(15, 10), async (req, res) => {
  const email = clean((req.body || {}).email, 120).toLowerCase();
  const u = db.prepare('select * from users where email=? and active=1').get(email);
  let dev;
  if (u) {
    const link = loginLink(u.id, 30);
    await notify(u.email, 'Your sign-in link', `Sign in to the suggestion box:\n${link}\nThis link works once and expires in 30 minutes.`);
    if (!mailer && !PROD) dev = link;
  }
  res.json({ ok: true, dev });
});
app.post('/api/auth', limit(15, 20), (req, res) => {
  const t = db.prepare('select * from login_tokens where token=? and expires>?').get(sha(clean((req.body || {}).token, 80)), Date.now());
  if (!t) return res.status(400).json({ error: 'This link has expired or was already used. Request a new one.' });
  db.prepare('delete from login_tokens where token=?').run(t.token);
  startSession(res, t.user_id);
  res.json({ ok: true });
});
app.post('/api/logout', (req, res) => {
  if (req.cookies.sid) db.prepare('delete from sessions where sid=?').run(sha(req.cookies.sid));
  res.clearCookie('sid'); res.json({ ok: true });
});
app.get('/auth', (q, s) => s.sendFile(path.join(__dirname, 'public', 'auth.html')));

// First run: the first person becomes the admin.
app.post('/api/setup', limit(15, 10), (req, res) => {
  if (hasUsers()) return res.status(409).json({ error: 'Already set up.' });
  const b = req.body || {}, org = clean(b.org, 80), name = clean(b.name, 80), email = clean(b.email, 120).toLowerCase();
  if (!org || !name || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Fill in all three fields with a valid email.' });
  const uid = db.prepare("insert into users(name,role_label,email,is_admin) values(?,?,?,1)").run(name, clean(b.role, 60) || 'Admin', email).lastInsertRowid;
  db.prepare("insert into meta values('org',?)").run(org);
  startSession(res, uid); res.json({ ok: true });
});

// ---------- Reader ----------
app.get('/api/me', auth, (req, res) => res.json({ id: req.user.id, name: req.user.name, role: req.user.role_label, admin: !!req.user.is_admin, org: orgName(), look: look() }));
app.get('/api/people', auth, (req, res) => res.json(db.prepare('select id, name, role_label role from users where active=1 and id<>? order by id').all(req.user.id)));
app.get('/api/inbox', auth, (req, res) => {
  const tab = ['new', 'replied', 'done'].includes(req.query.tab) ? req.query.tab : 'new';
  const rows = db.prepare(`select s.id, substr(s.body,1,160) snippet, s.created_at, s.seen_at, s.place,
    (select count(*) from attachments a where a.submission_id=s.id and a.mime like 'audio/%') audio,
    (select count(*) from attachments a where a.submission_id=s.id and a.mime not like 'audio/%') files
    from submissions s where s.recipient_id=? and s.status=? order by s.created_at desc limit 200`).all(req.user.id, tab);
  const counts = Object.fromEntries(db.prepare('select status, count(*) n from submissions where recipient_id=? group by status').all(req.user.id).map(r => [r.status, r.n]));
  res.json({ rows, counts });
});
const mine = (req, res) => {
  const s = db.prepare('select * from submissions where id=? and recipient_id=?').get(+req.params.id, req.user.id);
  if (!s) res.status(404).json({ error: 'Not found.' });
  return s;
};
app.get('/api/s/:id', auth, (req, res) => {
  const s = mine(req, res); if (!s) return;
  if (!s.seen_at) db.prepare('update submissions set seen_at=? where id=?').run(Date.now(), s.id);
  res.json({
    id: s.id, body: s.body, place: s.place, created_at: s.created_at, status: s.status, can_reply_to_sender: !!s.contact_enc,
    attachments: db.prepare('select id, name, mime, size from attachments where submission_id=?').all(s.id),
    messages: db.prepare('select from_reader, body, created_at from messages where submission_id=? order by id').all(s.id)
  });
});
app.get('/api/file/:id', auth, (req, res) => {
  const a = db.prepare('select a.* from attachments a join submissions s on s.id=a.submission_id where a.id=? and s.recipient_id=?').get(+req.params.id, req.user.id);
  if (!a) return res.status(404).json({ error: 'Not found.' });
  const media = /^(image|audio|video)\//.test(a.mime);
  res.set({ 'Content-Type': a.mime, 'Content-Security-Policy': 'sandbox', 'Content-Disposition': `${media ? 'inline' : 'attachment'}; filename="${a.name.replace(/[^\w.\- ]/g, '_')}"` });
  res.sendFile(path.resolve(DATA, 'uploads', a.path));
});
app.post('/api/s/:id/reply', auth, (req, res) => {
  const s = mine(req, res); if (!s) return;
  const body = clean((req.body || {}).body, 3000);
  if (!body) return res.status(400).json({ error: 'Write a reply first.' });
  db.prepare('insert into messages(submission_id,from_reader,body,created_at) values(?,1,?,?)').run(s.id, body, Date.now());
  db.prepare("update submissions set status='replied' where id=?").run(s.id);
  notifyContact(s.contact_enc, 'You have a reply to your suggestion', `Someone replied to your suggestion.\nOpen ${BASE}/track and enter your tracking code to read it.`);
  res.json({ ok: true });
});
app.post('/api/s/:id/done', auth, (req, res) => { const s = mine(req, res); if (!s) return; db.prepare("update submissions set status='done' where id=?").run(s.id); res.json({ ok: true }); });
app.post('/api/s/:id/forward', auth, (req, res) => {
  const s = mine(req, res); if (!s) return;
  const to = db.prepare('select * from users where id=? and active=1 and id<>?').get(+(req.body || {}).user_id, req.user.id);
  if (!to) return res.status(400).json({ error: 'Pick someone to forward to.' });
  db.prepare("update submissions set recipient_id=?, status='new', seen_at=null where id=?").run(to.id, s.id);
  notify(to.email, 'A suggestion was forwarded to you', `Open your inbox: ${loginLink(to.id, 1440)}`);
  res.json({ ok: true });
});

// ---------- Admin ----------
const people = () => db.prepare('select id, name, role_label role, email, is_admin admin, active from users order by id').all();
app.get('/api/admin/people', auth, adminOnly, (q, s) => s.json(people()));
app.post('/api/admin/people', auth, adminOnly, (req, res) => {
  const b = req.body || {}, name = clean(b.name, 80), email = clean(b.email, 120).toLowerCase();
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a name and a valid email.' });
  try { db.prepare('insert into users(name,role_label,email) values(?,?,?)').run(name, clean(b.role, 60) || 'Staff', email); }
  catch { return res.status(409).json({ error: 'That email is already added.' }); }
  res.json(people());
});
app.post('/api/admin/people/:id/active', auth, adminOnly, (req, res) => {
  const id = +req.params.id; if (id === req.user.id) return res.status(400).json({ error: 'You cannot remove yourself.' });
  db.prepare('update users set active=? where id=?').run((req.body || {}).active ? 1 : 0, id);
  if (!(req.body || {}).active) db.prepare('delete from sessions where user_id=?').run(id);
  res.json(people());
});
app.post('/api/admin/people/:id/link', auth, adminOnly, (req, res) => {
  const u = db.prepare('select * from users where id=? and active=1').get(+req.params.id);
  u ? res.json({ link: loginLink(u.id, 1440) }) : res.status(404).json({ error: 'Not found.' });
});
app.post('/api/admin/appearance', auth, adminOnly, (req, res) => {
  const b = req.body || {};
  if (!THEME_IDS.includes(b.theme) || !TPL_IDS.includes(b.template)) return res.status(400).json({ error: 'Pick a theme and a template.' });
  db.prepare("insert into meta values('look', ?) on conflict(k) do update set v=excluded.v").run(JSON.stringify({ theme: b.theme, template: b.template }));
  res.json({ look: look() });
});
app.get('/api/admin/qr.svg', auth, adminOnly, async (req, res) => {
  const loc = clean(req.query.loc, 60);
  res.type('image/svg+xml').send(await QR.toString(`${BASE}/${loc ? '?loc=' + encodeURIComponent(loc) : ''}`, { type: 'svg', margin: 1, width: 360 }));
});

app.use((e, q, s, n) => {
  if (e instanceof multer.MulterError) return s.status(400).json({ error: e.code === 'LIMIT_FILE_SIZE' ? 'A file is larger than 25 MB.' : 'Too many files. The limit is 4.' });
  if (e.type === 'entity.parse.failed') return s.status(400).json({ error: 'Bad request.' });
  if (e.message === 'type') return s.status(400).json({ error: 'That file type is not allowed.' });
  console.error(e); s.status(500).json({ error: 'Something went wrong. Try again.' });
});
setInterval(() => { const t = Date.now(); db.prepare('delete from login_tokens where expires<?').run(t); db.prepare('delete from sessions where expires<?').run(t); }, 36e5).unref();
app.listen(PORT, () => console.log(`Suggestion box running at ${BASE}  (open ${BASE}/admin to set up)`));
