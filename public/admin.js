(async () => {
  const root = $('#root'); const pub = await api('/api/public');
  if (!pub.setup) return setup();
  let me; try { me = await api('/api/me'); } catch { location.href = '/inbox'; return; }
  if (!me.admin) { root.replaceChildren(h('p', {}, 'Only admins can open setup. '), h('a', { href: '/inbox' }, 'Back to inbox')); return; }
  useLook(me.look);
  const err = h('p', { class: 'err', role: 'alert' }), rows = h('div', { class: 'col' });
  const name = h('input', { type: 'text', 'aria-label': 'Full name', placeholder: 'Full name', maxlength: 80 }),
    role = h('input', { type: 'text', 'aria-label': 'Title', placeholder: 'Title, e.g. MD', maxlength: 60 }),
    email = h('input', { type: 'email', 'aria-label': 'Email', placeholder: 'Email', maxlength: 120 });
  const act = fn => async () => { err.textContent = ''; try { await fn(); } catch (e) { err.textContent = e.message; } };
  const draw = list => rows.replaceChildren(...list.map(p => {
    const link = h('button', { class: 'o', onclick: act(async () => { const r = await api(`/api/admin/people/${p.id}/link`, { method: 'POST' }); await copyText(r.link, link, 'Sign-in link'); }) }, icon('copy'), h('span', {}, 'Sign-in link'));
    return h('div', { class: 'row' }, h('span', { class: 'ib' }, icon('user')),
      h('div', { class: 'x' }, h('b', {}, p.name + (p.admin ? ' (admin)' : '') + (p.active ? '' : ' (removed)')), h('span', { class: 'm' }, p.role + ' · ' + p.email)),
      h('div', { class: 'acts' }, p.active ? link : null,
        p.admin ? null : h('button', { class: 'o', onclick: act(async () => draw(await api(`/api/admin/people/${p.id}/active`, { method: 'POST', body: { active: !p.active } }))) }, p.active ? 'Remove' : 'Restore')));
  }));
  draw(await api('/api/admin/people'));
  const qrSrc = '/api/admin/qr.svg', url = location.origin + '/';
  const step = (n, title, sub, ...body) => h('section', { class: 'c col gap2' }, h('h2', { class: 'step' }, h('span', { class: 'num' }, n), title), sub ? h('p', { class: 'm' }, sub) : null, ...body);
  const cl = h('button', { class: 'o auto', onclick: () => copyText(url, cl, 'Copy link') }, icon('copy'), h('span', {}, 'Copy link'));
  root.replaceChildren(topbar(me, 'setup'),
    h('div', { class: 'col' }, h('h1', {}, 'Set up in 3 steps'), h('p', { class: 'm' }, 'Readers get an email link to their inbox. No passwords.')),
    step('1', 'Who can receive suggestions?', 'These names appear on the send page.', rows,
      h('form', { class: 'col gap', onsubmit: async e => { e.preventDefault(); err.textContent = ''; try { draw(await api('/api/admin/people', { method: 'POST', body: { name: name.value, role: role.value, email: email.value } })); name.value = role.value = email.value = ''; name.focus(); } catch (x) { err.textContent = x.message; } } },
        h('b', {}, 'Add a person'), h('div', { class: 'fgrid' }, name, role, email, h('button', { class: 'o', type: 'submit' }, icon('plus'), 'Add')), err),
      h('p', { class: 'm' }, 'No email set up on the server yet? Use "Sign-in link" to give someone their link directly.')),
    step('2', 'Print your QR code', 'Stick it where people can scan it.', h('div', { class: 'qrcard' }, h('img', { src: qrSrc, alt: 'QR code for the send page' }),
      h('div', { class: 'col gap' }, h('p', { class: 'm' }, url), h('button', { class: 'b auto', onclick: () => window.print() }, icon('printer'), 'Print poster'), cl))),
    step('3', 'Test it', 'Scan the code with your phone and send a test suggestion.', h('a', { class: 'o auto', href: '/', target: '_blank' }, icon('send'), 'Open the send page')),
    h('div', { id: 'poster' }, h('h1', {}, me.org), h('p', {}, 'Scan to send a suggestion'), h('img', { src: qrSrc, alt: '' }), h('p', {}, url)));
  function setup() {
    const err = h('p', { class: 'err', role: 'alert' }), f = {};
    const field = (k, label, type, ph) => [h('label', { class: 'l', for: k }, label), f[k] = h('input', { type, id: k, placeholder: ph, maxlength: 120 })];
    root.replaceChildren(h('form', { class: 'col gap2', onsubmit: async e => { e.preventDefault(); err.textContent = '';
      try { await api('/api/setup', { method: 'POST', body: { org: f.org.value, name: f.name.value, email: f.email.value, role: f.role.value } }); location.reload(); }
      catch (x) { err.textContent = x.message; } } },
      h('h1', {}, 'Set up your suggestion box'), h('p', { class: 'm' }, 'You become the admin.'),
      ...field('org', 'Organisation name', 'text', 'e.g. Acme Ltd'), ...field('name', 'Your name', 'text', 'Full name'), ...field('role', 'Your title', 'text', 'e.g. Managing Director'), ...field('email', 'Your email', 'email', 'you@example.com'),
      err, h('button', { class: 'b', type: 'submit' }, icon('check'), 'Create suggestion box')));
  }
})();
