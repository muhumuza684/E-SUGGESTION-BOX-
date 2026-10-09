(async () => {
  const root = $('#root');
  let me, pub; try { [me, pub] = await Promise.all([api('/api/me'), api('/api/public')]); } catch { location.href = '/inbox'; return; }
  if (!me.admin) { root.replaceChildren(h('p', {}, 'Only admins can open settings. '), h('a', { href: '/inbox' }, 'Back to inbox')); return; }
  useLook(me.look);
  let saved = { ...me.look }, sel = { ...me.look }, view = 'send';
  const people = pub.people.slice(0, 3);
  const status = h('p', { role: 'status' }), err = h('p', { class: 'err', role: 'alert' });
  const apply = h('button', { class: 'b', disabled: true }, icon('check'), h('span', {}, 'Apply'));
  const reset = h('button', { class: 'o', disabled: true }, 'Undo');
  const pvBox = h('div', { class: 'col gap' });
  const swatch = id => { const w = h('span', { class: 'sw' }, h('span'), h('span'), h('span')); const c = THEMES[id].c; [0, 4, 2].forEach((k, n) => { w.children[n].style.background = c[k]; }); return w; };
  const radio = (group, id, label, sub, extra) => h('label', { class: 'c rc' }, h('input', { type: 'radio', name: group, value: id, checked: (group === 'theme' ? sel.theme : sel.template) === id, onchange: () => { sel[group] = id; refresh(); } }),
    extra, h('span', { class: 'grow col' }, h('b', {}, label), sub ? h('span', { class: 'm' }, sub) : null), h('span', { class: 'tick' }, icon('check')));
  const dirty = () => sel.theme !== saved.theme || sel.template !== saved.template;
  function preview() {
    const t = TEMPLATES[sel.template], box = h('div', { class: 'pv', inert: true });
    paint(box, sel.theme);
    if (view === 'send') {
      const row = (n, on) => h('div', { class: 'c rc' + (on ? ' sel' : '') }, h('span', { class: 'ib' }, icon('user')), h('span', { class: 'grow' }, h('b', {}, n.name), ' ', h('span', { class: 'm' }, n.role)), h('span', { class: 'tick' }, icon('check')));
      box.append(h('p', { class: 'brand' }, icon('shield'), me.org), h('h1', {}, t.title), ...(t.intro ? [h('p', { class: 'm' }, t.intro)] : []),
        h('b', {}, '1. ' + t.who), ...(people.length ? people.map((n, i) => row(n, i === 0)) : [row({ name: 'Managing Director', role: 'MD' }, true)]),
        h('b', {}, '2. ' + t.msg), h('div', { class: 'c m' }, t.ph),
        h('div', { class: 'grid3' }, h('span', { class: 'o tl' }, icon('clip'), 'Attach'), h('span', { class: 'o tl' }, icon('mic'), 'Voice'), h('span', { class: 'o tl' }, icon('video'), 'Video')),
        h('b', {}, '3. ' + t.reply + ' '), h('span', { class: 'b' }, icon('send'), t.btn));
    } else {
      const nav = (ic, l, on) => h('span', { class: 'nav', 'aria-current': !!on }, icon(ic), l);
      box.append(h('div', { class: 'mini' }, h('div', { class: 'side' }, h('b', {}, me.org), nav('inbox', 'New', 1), nav('reply', 'Replied'), nav('check', 'Done')),
        h('div', { class: 'main' }, h('b', {}, 'Gate lighting is too dim at night'), h('span', {}, h('span', { class: 't n' }, icon('bell'), 'New'), ' ', h('span', { class: 't p' }, icon('mic'), 'Voice')),
          h('p', { class: 'm' }, 'The lights near the main gate go off early.'), h('span', { class: 'b' }, icon('send'), 'Send reply'), h('span', { class: 'o' }, icon('check'), 'Mark done'))));
    }
    return box;
  }
  function refresh() {
    pvBox.replaceChildren(h('div', { class: 'seg' }, ...[['send', 'Send page'], ['inbox', 'Reader inbox']].map(([k, l]) => h('button', { class: 'o auto', 'aria-pressed': view === k, onclick: () => { view = k; refresh(); } }, l))), preview());
    apply.disabled = reset.disabled = !dirty();
    status.textContent = dirty() ? 'Previewing ' + THEMES[sel.theme].name + ' with the ' + TEMPLATES[sel.template].name + ' template. Not applied yet.' : 'Live now: ' + THEMES[saved.theme].name + ', ' + TEMPLATES[saved.template].name + ' template.';
  }
  apply.onclick = async () => {
    err.textContent = ''; apply.disabled = true;
    try { const r = await api('/api/admin/appearance', { method: 'POST', body: sel }); saved = { ...r.look }; sel = { ...r.look }; useLook(r.look); refresh(); status.textContent = 'Applied. ' + status.textContent; }
    catch (e) { err.textContent = e.message; apply.disabled = false; }
  };
  reset.onclick = () => { sel = { ...saved }; root.querySelectorAll('input[type=radio]').forEach(i => { i.checked = i.value === sel[i.name]; }); refresh(); };
  root.replaceChildren(topbar(me, 'settings'),
    h('div', { class: 'col' }, h('h1', {}, 'Appearance'), h('p', { class: 'm' }, 'Pick a look and see it first. Nothing changes for your readers until you press Apply.')),
    h('div', { class: 'sgrid' },
      h('div', { class: 'col gap2' },
        h('div', { class: 'col gap', role: 'radiogroup', 'aria-label': 'Theme' }, h('h2', {}, 'Theme'), h('div', { class: 'opts' }, ...Object.entries(THEMES).map(([id, t]) => radio('theme', id, t.name, '', swatch(id))))),
        h('div', { class: 'col gap', role: 'radiogroup', 'aria-label': 'Template' }, h('h2', {}, 'Template'), h('p', { class: 'm' }, 'Sets the wording on your send page.'), h('div', { class: 'opts t2' }, ...Object.entries(TEMPLATES).map(([id, t]) => radio('template', id, t.name, t.about))))),
      h('div', { class: 'col gap' }, h('h2', {}, 'Preview'), pvBox, h('a', { class: 'o auto', href: '/', target: '_blank' }, icon('eye'), 'Open the live send page'))),
    h('div', { class: 'bar' }, h('div', { class: 'grow' }, status, err), reset, apply));
  refresh();
})();
