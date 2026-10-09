(async () => {
  const root = $('#root');
  let me; try { me = await api('/api/me'); } catch (e) { return login(e.status === 401 ? '' : e.message); }
  useLook(me.look);
  let tab = 'new', sel = null, menuOpen = false, counts = {};
  const list = h('div', { class: 'list' }), detail = h('div', { class: 'detail' }), side = h('nav', { class: 'side', 'aria-label': 'Folders' });
  const app = h('div', { class: 'app' }, side, list, detail); root.replaceChildren(app);
  const TABS = [['new', 'New', 'inbox'], ['replied', 'Replied', 'reply'], ['done', 'Done', 'check']];
  const EMPTY = { new: 'No new suggestions.', replied: 'You have not replied to anything yet.', done: 'Nothing is marked done yet.' };
  const placeholder = () => detail.replaceChildren(h('div', { class: 'empty' }, icon('inbox'), h('b', {}, 'Select a message'), h('span', { class: 'm' }, 'Pick one from the list to read it and reply.')));
  const close = () => { sel = null; app.classList.remove('has-detail'); placeholder(); refresh(); };
  function drawSide() {
    side.className = 'side' + (menuOpen ? ' open' : '');
    side.replaceChildren(
      h('div', { class: 'who' }, h('b', {}, me.org), h('span', { class: 'm' }, me.name + ' · ' + me.role)),
      ...TABS.map(([k, label, ic]) => h('button', { class: 'nav', 'aria-current': k === tab, onclick: () => { tab = k; menuOpen = false; close(); } }, icon(ic), label, h('span', { class: 'cnt' }, counts[k] || ''))),
      h('button', { class: 'nav menu', 'aria-expanded': menuOpen, onclick: () => { menuOpen = !menuOpen; drawSide(); } }, icon('sliders'), 'Menu'),
      h('div', { class: 'sub' },
        ...(me.admin ? [h('a', { class: 'nav', href: '/admin' }, icon('plus'), 'Setup'), h('a', { class: 'nav', href: '/settings' }, icon('sliders'), 'Settings')] : []),
        h('a', { class: 'nav', href: '/about' }, icon('help'), 'Help and about'),
        h('button', { class: 'nav', onclick: async () => { await api('/api/logout', { method: 'POST' }); location.reload(); } }, icon('out'), 'Sign out'),
        h('span', { class: 'm credit' }, 'Built in Uganda by BrytMa Tech Uganda')));
  }
  const item = r => h('button', { class: 'item', 'aria-current': r.id === sel, onclick: () => open(r.id) },
    h('span', { class: 'm' }, when(r.created_at) + (r.place ? ' · ' + r.place : '')),
    h('b', {}, r.snippet.split('\n')[0].slice(0, 90)),
    h('span', {}, !r.seen_at ? h('span', { class: 't n' }, icon('bell'), 'New') : h('span', { class: 't p' }, icon('eye'), 'Seen'), ' ',
      r.audio ? h('span', { class: 't p' }, icon('mic'), 'Voice') : null, ' ', r.files ? h('span', { class: 't p' }, icon('clip'), r.files) : null));
  async function refresh() {
    let data;
    try { data = await api('/api/inbox?tab=' + tab); }
    catch (e) { if (e.status === 401) return location.reload(); list.replaceChildren(h('p', { class: 'm item' }, 'Could not load your inbox.'), h('button', { class: 'o auto', onclick: refresh }, 'Try again')); return; }
    counts = data.counts; drawSide();
    list.replaceChildren(h('h2', {}, TABS.find(t => t[0] === tab)[1]),
      ...(data.rows.length ? data.rows.map(item) : [h('div', { class: 'empty' }, h('span', {}, EMPTY[tab]),
        tab === 'new' && me.admin ? h('a', { class: 'o auto', href: '/admin' }, icon('qr'), 'Print your QR code') : null)]));
  }
  async function open(id) {
    sel = id; app.classList.add('has-detail'); window.scrollTo(0, 0);
    let d;
    try { d = await api('/api/s/' + id); }
    catch (e) { detail.replaceChildren(h('button', { class: 'o back', onclick: close }, 'Back to list'), h('p', { class: 'err' }, e.message)); return; }
    refresh();
    const err = h('p', { class: 'err', role: 'alert' }), reply = h('textarea', { id: 'rep', rows: 3, maxlength: 3000, placeholder: d.can_reply_to_sender ? 'Write a reply. The sender is notified.' : 'Write a reply. The sender sees it when they check their code.' });
    const act = fn => async () => { err.textContent = ''; try { await fn(); } catch (e) { err.textContent = e.message; } };
    const fwd = h('select', { 'aria-label': 'Forward to', hidden: true }), fgo = h('button', { class: 'o auto', hidden: true }, 'Forward now');
    const att = d.attachments.map(a => { const u = '/api/file/' + a.id;
      return a.mime.startsWith('audio/') ? h('audio', { controls: true, src: u, preload: 'none' }) :
        a.mime.startsWith('video/') ? h('video', { controls: true, src: u, preload: 'none', class: 'media' }) :
        a.mime.startsWith('image/') ? h('a', { href: u, target: '_blank', rel: 'noopener' }, h('img', { src: u, alt: a.name, class: 'media' })) :
        h('a', { class: 'o auto', href: u, download: a.name }, icon('clip'), a.name); });
    detail.replaceChildren(
      h('button', { class: 'o back', onclick: close }, 'Back to list'),
      h('h1', {}, d.body.split('\n')[0].slice(0, 120)),
      h('p', { class: 'm' }, 'Sent ' + when(d.created_at) + (d.place ? ' · ' + d.place : '') + ' · ' + (d.can_reply_to_sender ? 'Sender can be notified' : 'Anonymous')),
      d.body.includes('\n') || d.body.length > 120 ? h('p', { class: 'msg' }, d.body) : null,
      att.length ? h('div', { class: 'col gap' }, att) : null,
      ...d.messages.map(m => h('div', { class: 'bubble' + (m.from_reader ? ' me' : '') }, h('p', { class: 'm' }, (m.from_reader ? 'Your reply' : 'Sender') + ' · ' + when(m.created_at)), h('p', { class: 'msg' }, m.body))),
      h('label', { class: 'l', for: 'rep' }, 'Your reply'), reply, err,
      h('div', { class: 'col gap' },
        h('button', { class: 'b', onclick: act(async () => { await api(`/api/s/${id}/reply`, { method: 'POST', body: { body: reply.value } }); open(id); }) }, icon('send'), 'Send reply'),
        h('div', { class: 'chips' },
          h('button', { class: 'o auto', onclick: act(async () => { if (!fwd.options.length) (await api('/api/people')).forEach(p => fwd.append(h('option', { value: p.id }, p.name + ' · ' + p.role))); fwd.hidden = fgo.hidden = false; }) }, icon('up'), 'Forward'),
          h('button', { class: 'o auto', onclick: act(async () => { await api(`/api/s/${id}/done`, { method: 'POST' }); close(); }) }, icon('check'), 'Mark done')),
        fwd, fgo),
      h('p', { class: 'm' }, "The sender's contact details stay hidden from you."));
    fgo.onclick = act(async () => { await api(`/api/s/${id}/forward`, { method: 'POST', body: { user_id: fwd.value } }); close(); });
  }
  placeholder(); drawSide(); refresh();
  function login(msg) {
    const err = h('p', { class: 'err', role: 'alert' }, msg), email = h('input', { type: 'email', id: 'em', autocomplete: 'email', placeholder: 'you@example.com' }), out = h('div', { class: 'col gap' });
    root.replaceChildren(h('main', { class: 'wrap' }, h('h1', {}, 'Sign in to your inbox'), h('p', { class: 'm' }, 'We email you a link. No password.'),
      h('form', { class: 'col gap2', onsubmit: async e => { e.preventDefault(); err.textContent = '';
        try { const r = await api('/api/login', { method: 'POST', body: { email: email.value } });
          out.replaceChildren(h('div', { class: 'c ok' }, icon('check'), h('p', {}, 'If that email is on the team, a sign-in link is on its way.')), r.dev ? h('a', { class: 'o', href: r.dev }, 'Dev mode: open sign-in link') : null); }
        catch (x) { err.textContent = x.message; } } },
        h('label', { class: 'l', for: 'em' }, 'Work email'), email, h('button', { class: 'b', type: 'submit' }, icon('send'), 'Email me a sign-in link'), err), out));
  }
})();
