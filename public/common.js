const $ = (s, r = document) => r.querySelector(s);
const h = (t, a = {}, ...k) => {
  const e = document.createElement(t);
  for (const [n, v] of Object.entries(a)) {
    if (n === 'class') e.className = v;
    else if (n.startsWith('on')) e.addEventListener(n.slice(2), v);
    else if (n.startsWith('aria-') && typeof v === 'boolean') e.setAttribute(n, String(v));
    else if (v !== false && v != null) e.setAttribute(n, v === true ? '' : v);
  }
  for (const c of k.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
const IC = {
  clip: '<path d="m21 12-8.5 8.5a5.5 5.5 0 0 1-8-8L13 4a3.7 3.7 0 0 1 5.3 5.3L9.8 17.8a1.8 1.8 0 0 1-2.6-2.6L15 7.5"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
  video: '<rect x="2" y="6" width="13" height="12" rx="2"/><path d="m22 8-7 4 7 4z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  reply: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v3"/>',
  up: '<path d="M7 17 17 7M8 7h9v9"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  printer: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2"/><rect x="6" y="14" width="12" height="7"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10 21a2 2 0 0 0 4 0"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.7-2.5 2-2.5 3.5M12 17h.01"/>',
  qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v1"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  sliders: '<path d="M4 6h10M20 6h0M4 12h4M14 12h6M4 18h12M20 18h0"/><circle cx="17" cy="6" r="2"/><circle cx="11" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'
};
const icon = n => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'i'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = IC[n]; return s;
};
async function api(p, o = {}) {
  const init = o.body instanceof FormData ? o : { ...o, headers: { 'Content-Type': 'application/json' }, body: o.body && JSON.stringify(o.body) };
  const r = await fetch(p, init);
  let j = {}; try { j = await r.json(); } catch {}
  if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong. Try again.'), { status: r.status });
  return j;
}
const when = t => new Date(t).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const copyText = async (t, btn, label) => {
  try { await navigator.clipboard.writeText(t); const old = btn.lastChild.textContent; btn.lastChild.textContent = 'Copied'; setTimeout(() => btn.lastChild.textContent = label || old, 1500); }
  catch { prompt('Copy this:', t); }
};

// replaceChildren with null or array arguments would print "null" or "[object ...]"; drop empties and flatten.
const _rc = Element.prototype.replaceChildren;
Element.prototype.replaceChildren = function (...a) { return _rc.apply(this, a.flat().filter(x => x != null && x !== false)); };

// Branding footer on every page except the inbox, which carries its own credit in the sidebar.
if (!document.body.hasAttribute('data-nofoot')) document.body.append(h('footer', { class: 'foot' },
  h('p', {}, 'Built in Uganda by ', h('b', {}, 'BrytMa Tech Uganda')),
  h('p', {}, h('a', { href: '/about' }, 'About'), ' · ', h('a', { href: '/about#support' }, 'Support'))));

// Top bar shared by the admin pages.
function topbar(me, cur) {
  const link = (href, label, key) => h('a', { href, 'aria-current': cur === key ? 'page' : null }, label);
  return h('header', { class: 'top' }, h('b', {}, me.org),
    h('nav', { 'aria-label': 'Main' }, link('/inbox', 'Inbox', 'inbox'), link('/admin', 'Setup', 'setup'), link('/settings', 'Settings', 'settings'), link('/about', 'Help', 'about')));
}
