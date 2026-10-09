const FONTS = {
  sans: '"DM Sans",system-ui,"Segoe UI",Roboto,sans-serif',
  serif: 'Georgia,"Times New Roman",serif',
  round: 'ui-rounded,"Trebuchet MS","Segoe UI",sans-serif'
};
// c = [primary, ink, background, tint, soft, soft text, deep, line, muted text]
const THEMES = {
  teal:   { name: 'Teal',   font: 'sans',  r: 12, c: ['#0E7C66', '#0F2A24', '#EEF2F0', '#E6F2EE', '#D8EEE8', '#064D3F', '#1E4A3F', '#D5DEDA', '#4A635C'] },
  ocean:  { name: 'Ocean',  font: 'sans',  r: 8,  c: ['#1B5FAA', '#0E2238', '#EEF3F8', '#E3EDF8', '#D6E4F4', '#0F3B6B', '#1E4C80', '#D3DEEA', '#4A5F75'] },
  amber:  { name: 'Amber',  font: 'serif', r: 6,  c: ['#A8480C', '#2B1710', '#F8F1EC', '#FBEADF', '#F6DCCB', '#6B2A08', '#7A3512', '#E6D6CB', '#6B5446'] },
  slate:  { name: 'Slate',  font: 'sans',  r: 4,  c: ['#3D4A5C', '#161B22', '#F1F2F4', '#E8EAEE', '#DDE1E7', '#2A3440', '#2F3947', '#D8DBE0', '#565E6B'] },
  forest: { name: 'Forest', font: 'round', r: 16, c: ['#2F6B2F', '#14261A', '#F0F4EE', '#E5EFE2', '#D6E7D1', '#1F4A22', '#265228', '#D6DFD2', '#4C6050'] },
  plum:   { name: 'Plum',   font: 'sans',  r: 14, c: ['#7A2E6E', '#2A1428', '#F5EFF4', '#F0E3EE', '#E8D3E4', '#55204C', '#5F2455', '#E0D3DE', '#6A5568'] }
};
const TEMPLATES = {
  workplace: { name: 'Workplace', about: 'Staff suggestions to leaders', title: 'Send a suggestion', intro: '', who: 'Who should read it?', msg: 'Your message', ph: 'Write here, or use the buttons below', reply: 'Want a reply?', btn: 'Send suggestion' },
  school:    { name: 'School', about: 'Students, parents and teachers', title: 'Share an idea or concern', intro: 'Tell us what is working and what is not. You can stay anonymous.', who: 'Who should hear it?', msg: 'What do you want to say?', ph: 'Write here, or use the buttons below', reply: 'Want an answer?', btn: 'Send' },
  clinic:    { name: 'Clinic', about: 'Patient and visitor feedback', title: 'Share your feedback', intro: 'Your feedback helps us improve care. You can stay anonymous.', who: 'Who should read it?', msg: 'Your feedback', ph: 'Tell us what went well or what we should fix', reply: 'Want a reply?', btn: 'Send feedback' },
  community: { name: 'Community', about: 'Members to leaders', title: 'Speak to your leaders', intro: 'Your voice matters. Send a message to the right person.', who: 'Who do you want to reach?', msg: 'Your message', ph: 'Write here, or use the buttons below', reply: 'Want a reply?', btn: 'Send message' }
};
function paint(el, id) {
  const t = THEMES[id] || THEMES.teal, [p, i, b, ti, s, si, d, l, m] = t.c, S = el.style;
  S.setProperty('--teal', p); S.setProperty('--ink', i); S.setProperty('--bg', b); S.setProperty('--tint', ti);
  S.setProperty('--soft', s); S.setProperty('--soft-ink', si); S.setProperty('--deep', d); S.setProperty('--line', l); S.setProperty('--mut', m);
  S.setProperty('--r', t.r + 'px'); S.setProperty('--r2', Math.max(t.r - 2, 4) + 'px'); S.setProperty('--font', FONTS[t.font]);
}
function useLook(look) {
  if (!look) return;
  paint(document.documentElement, look.theme);
  try { localStorage.setItem('qsb-look', JSON.stringify(look)); } catch {}
}
try { const c = JSON.parse(localStorage.getItem('qsb-look')); if (c) paint(document.documentElement, c.theme); } catch {}
