// Utilitários compartilhados pelos dois sites (cliente e gestão)
const TF = (() => {
  const KEY = window.TF_KEY || 'tf_session';
  const session = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const save = (s) => localStorage.setItem(KEY, JSON.stringify(s));
  const clear = () => localStorage.removeItem(KEY);

  const T = {
    session, save, clear,
    esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    money: (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    fmtDate: (d) => d.split('-').reverse().join('/'),
    STATUS: { pending: 'Aguardando', preparing: 'Em preparo', ready: 'Pronto', delivered: 'Entregue', cancelled: 'Cancelado', confirmed: 'Confirmada', completed: 'Concluída' },
    toast(msg, err) {
      const box = document.getElementById('toast');
      const d = document.createElement('div');
      d.textContent = msg; if (err) d.className = 'err';
      box.appendChild(d); setTimeout(() => d.remove(), 3500);
    },
    async api(path, { method = 'GET', body } = {}) {
      const s = session();
      const res = await fetch(`/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(s ? { Authorization: `Bearer ${s.token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = res.status === 204 ? null : await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401 && s) { clear(); T.onExpired && T.onExpired(); }
        const det = data?.error?.details;
        throw new Error((data?.error?.message || 'Erro inesperado') + (det ? `: ${det.map((x) => x.mensagem).join('; ')}` : ''));
      }
      return data;
    },
  };
  return T;
})();
