$('#go').onclick = async () => {
  try { await api('/api/auth', { method: 'POST', body: { token: new URLSearchParams(location.search).get('token') } }); location.href = '/inbox'; }
  catch (e) { $('#e').textContent = e.message; }
};
