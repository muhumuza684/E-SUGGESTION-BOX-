(() => {
  const app = $('#app'); let code = '';
  api('/api/public').then(d => { useLook(d.look); $('#org').replaceChildren(icon('shield'), d.org || 'Suggestion box'); }).catch(() => {});
  const err = h('p', { class: 'err', role: 'alert' });
  const input = h('input', { type: 'text', id: 'code', placeholder: 'QSB-XXXXX-XXXXX', autocomplete: 'off', autocapitalize: 'characters', value: sessionStorage.getItem('qsb') || '' });
  async function load(c) {
    err.textContent = '';
    try { const d = await api('/api/track', { method: 'POST', body: { code: c } }); code = c; sessionStorage.setItem('qsb', c); show(d); }
    catch (e) { err.textContent = e.status === 404 ? 'No suggestion matches that code. Check it and try again.' : e.message; }
  }
  const form = h('form', { class: 'col gap2', onsubmit: e => { e.preventDefault(); load(input.value); } },
    h('h1', {}, 'Check status'), h('label', { class: 'l', for: 'code' }, 'Your tracking code'), input,
    h('button', { class: 'b', type: 'submit' }, icon('eye'), h('span', {}, 'Check status')), err);
  app.append(form);
  if (input.value) load(input.value);
  const step = (ic, title, sub, on) => h('div', { class: 'row' }, h('span', { class: 'ib' + (on ? ' on' : '') }, icon(ic)), h('div', { class: 'col grow' }, h('b', {}, title), h('span', { class: 'm' }, sub)), on ? icon('check') : null);
  function show(d) {
    const reply = h('textarea', { id: 'r', rows: 3, maxlength: 3000, placeholder: 'Reply back' });
    const e2 = h('p', { class: 'err', role: 'alert' });
    const send = h('button', { class: 'b', type: 'submit' }, icon('send'), h('span', {}, 'Send reply'));
    app.replaceChildren(
      h('div', { class: 'c ok' }, h('span', { class: 'ib on' }, icon('check')), h('div', {}, h('b', {}, 'Sent to ' + d.to), h('p', { class: 'm' }, d.role + ' · ' + when(d.sent_at)))),
      h('div', { class: 'c' }, step('send', 'Sent', when(d.sent_at), true), step('eye', 'Seen', d.seen_at ? when(d.seen_at) : 'Not opened yet', !!d.seen_at),
        step('reply', 'Replied', d.replied ? 'You have a reply' : 'No reply yet', d.replied), step('check', 'Closed', d.done ? 'Done' : 'Still open', d.done)),
      ...d.messages.map(m => h('div', { class: 'c' + (m.from_reader ? ' ok' : '') }, h('p', { class: 'm' }, (m.from_reader ? 'Reply from ' + d.to : 'You') + ' · ' + when(m.created_at)), h('p', { class: 'msg' }, m.body))),
      h('form', { class: 'col gap', onsubmit: async e => { e.preventDefault(); e2.textContent = ''; send.disabled = true;
        try { await api('/api/track/reply', { method: 'POST', body: { code, body: reply.value } }); load(code); } catch (x) { e2.textContent = x.message; send.disabled = false; } } },
        h('label', { class: 'l', for: 'r' }, 'Reply back'), reply, e2, send),
      h('button', { class: 'o', onclick: () => { sessionStorage.removeItem('qsb'); location.reload(); } }, 'Check another code'));
  }
})();
