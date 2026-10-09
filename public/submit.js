(async () => {
  const app = $('#app'); let data;
  try { data = await api('/api/public'); } catch { app.textContent = 'Cannot reach the server. Check your connection.'; return; }
  $('#org').replaceChildren(icon('shield'), data.org || 'Suggestion box');
  $('#ld')?.remove(); useLook(data.look); const T = TEMPLATES[(data.look || {}).template] || TEMPLATES.workplace;
  if (!data.setup) { app.append(h('p', {}, 'This suggestion box is not set up yet. '), h('a', { href: '/admin' }, 'Set it up')); return; }
  const place = new URLSearchParams(location.search).get('loc') || '';
  const MAX = 25 * 1024 * 1024; let files = [], rec = null, timer = null;
  const err = h('p', { class: 'err', role: 'alert' }), chips = h('div', { class: 'chips' });
  const msg = h('textarea', { id: 'msg', rows: 4, maxlength: 5000, placeholder: T.ph });
  const contact = h('input', { type: 'text', id: 'contact', maxlength: 120, placeholder: 'Email or phone number', autocomplete: 'off' });
  const draw = () => chips.replaceChildren(...files.map((f, i) => h('span', { class: 't p chip' },
    icon(f.type.startsWith('audio/') ? 'mic' : f.type.startsWith('video/') ? 'video' : 'clip'), f.name.slice(0, 28),
    h('button', { type: 'button', 'aria-label': 'Remove ' + f.name, onclick: () => { files.splice(i, 1); draw(); } }, '×'))));
  const add = list => { err.textContent = ''; for (const f of list) { if (f.size > MAX) err.textContent = f.name + ' is larger than 25 MB.'; else if (files.length < 4) files.push(f); else err.textContent = 'You can attach up to 4 files.'; } draw(); };
  const pick = h('input', { type: 'file', multiple: true, hidden: true, onchange: () => { add([...pick.files]); pick.value = ''; } });
  const vid = h('input', { type: 'file', accept: 'video/*', capture: 'user', hidden: true, onchange: () => { add([...vid.files]); vid.value = ''; } });
  const vlabel = h('span', {}, 'Voice');
  const vbtn = h('button', { type: 'button', class: 'o tl', onclick: async () => {
    if (rec) { rec.stop(); return; }
    if (!window.MediaRecorder || !navigator.mediaDevices) { err.textContent = 'Recording is not supported here. Attach an audio file instead.'; return; }
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { err.textContent = 'Microphone blocked. Allow it in your browser, or attach an audio file.'; return; }
    const parts = []; rec = new MediaRecorder(stream);
    rec.ondataavailable = e => parts.push(e.data);
    rec.onstop = () => { clearTimeout(timer); stream.getTracks().forEach(t => t.stop()); const type = (rec.mimeType || 'audio/webm').split(';')[0]; rec = null; vlabel.textContent = 'Voice'; vbtn.classList.remove('rec'); add([new File(parts, 'voice-note.' + (type.includes('mp4') ? 'm4a' : 'webm'), { type })]); };
    rec.start(); vlabel.textContent = 'Stop'; vbtn.classList.add('rec'); timer = setTimeout(() => rec && rec.stop(), 180000);
  } }, icon('mic'), vlabel);
  const send = h('button', { class: 'b', type: 'submit' }, icon('send'), h('span', {}, T.btn));
  const form = h('form', { class: 'col gap2', novalidate: true, onsubmit: async e => {
    e.preventDefault(); err.textContent = '';
    const to = form.querySelector('input[name=to]:checked'), body = msg.value.trim();
    if (!to) { err.textContent = 'Pick who should read it.'; return; }
    if (!body && !files.length) { err.textContent = 'Write a message or attach something.'; return; }
    const fd = new FormData(); fd.set('recipient_id', to.value); fd.set('body', body); fd.set('contact', contact.value.trim()); fd.set('loc', place);
    files.forEach(f => fd.append('files', f, f.name)); send.disabled = true;
    try { const r = await api('/api/submit', { method: 'POST', body: fd }); sessionStorage.setItem('qsb', r.code); done(r.code, to.closest('label').querySelector('b').textContent); }
    catch (x) { err.textContent = x.message; send.disabled = false; }
  } },
    h('h1', {}, T.title), T.intro ? h('p', { class: 'm' }, T.intro) : null,
    h('div', { class: 'col gap' }, h('b', {}, '1. ' + T.who), ...data.people.map(p => h('label', { class: 'c rc' }, h('input', { type: 'radio', name: 'to', value: p.id }), h('span', { class: 'ib' }, icon('user')), h('span', { class: 'grow' }, h('b', {}, p.name), ' ', h('span', { class: 'm' }, p.role)), h('span', { class: 'tick' }, icon('check'))))),
    h('div', { class: 'col gap' }, h('label', { class: 'l', for: 'msg' }, '2. ' + T.msg), msg,
      h('div', { class: 'grid3' }, h('button', { type: 'button', class: 'o tl', onclick: () => pick.click() }, icon('clip'), 'Attach'), vbtn, h('button', { type: 'button', class: 'o tl', onclick: () => vid.click() }, icon('video'), 'Video')), chips, pick, vid),
    h('div', { class: 'col gap' }, h('label', { class: 'l', for: 'contact' }, '3. ' + T.reply + ' ', h('span', { class: 'm' }, 'Optional')), contact,
      h('p', { class: 'm' }, 'Only used to notify you. The reader never sees it.')),
    err, send);
  app.append(form);
  function done(code, who) {
    const copy = h('button', { class: 'o', type: 'button', onclick: () => copyText(code, copy, 'Copy code') }, icon('copy'), h('span', {}, 'Copy code'));
    app.replaceChildren(
      h('div', { class: 'c ok' }, h('span', { class: 'ib on' }, icon('check')), h('div', {}, h('b', {}, 'Sent to ' + who), h('p', { class: 'm' }, 'Nothing else is needed from you.'))),
      h('div', { class: 'c' }, h('p', { class: 'm' }, 'Your code. Save it to check for replies.'), h('p', { class: 'code' }, code), copy),
      h('a', { class: 'b', href: '/track' }, icon('eye'), 'Check status'));
  }
})();
