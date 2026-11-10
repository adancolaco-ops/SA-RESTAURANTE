const { api, esc, money, fmtDate, STATUS, toast, session, save, clear } = TF;
const $ = (s) => document.querySelector(s);
const app = $('#app'); const nav = $('#nav');
const TABS = [
  ['pedidos', 'Pedidos', ['admin', 'employee']],
  ['reservas', 'Reservas', ['admin', 'employee']],
  ['cardapio', 'Cardápio', ['admin']],
  ['usuarios', 'Usuários', ['admin']],
  ['financeiro', 'Financeiro', ['admin', 'employee']],
];
let view = 'pedidos'; let timer; let fStatus = ''; let fDate = '';
TF.onExpired = () => { toast('Sessão expirada.', true); go(); };

nav.onclick = (e) => {
  if (e.target.dataset.v) go(e.target.dataset.v);
  if (e.target.id === 'out') { clear(); go(); }
};

function go(v) {
  clearInterval(timer);
  if (v) view = v;
  const s = session();
  if (!s) { nav.innerHTML = ''; return renderLogin(); }
  const tabs = TABS.filter((t) => t[2].includes(s.user.role));
  if (!tabs.some((t) => t[0] === view)) view = tabs[0][0];
  nav.innerHTML = tabs.map(([v2, l]) => `<a data-v="${v2}" class="${view === v2 ? 'on' : ''}">${l}</a>`).join('')
    + `<span class="who">${esc(s.user.name)} · ${s.user.role === 'admin' ? 'Administrador' : 'Funcionário'}</span><button class="btn small ghost" id="out">Sair</button>`;
  ({ pedidos: viewPedidos, reservas: viewReservas, cardapio: viewCardapio, usuarios: viewUsuarios, financeiro: viewFinanceiro })[view]()
    .catch((e) => toast(e.message, true));
}

function renderLogin() {
  app.onclick = null; app.onchange = null;
  app.innerHTML = `<section class="hero"><h1>TechFood <span>Gestão</span></h1><p>Área exclusiva para funcionários e administradores.</p></section>
    <section class="card narrow"><h2>Entrar</h2><form id="f">
      <label>E-mail<input name="email" type="email" required></label>
      <label>Senha<input name="password" type="password" required></label>
      <button class="btn full">Entrar</button></form>
      <p class="hint">Admin: admin@techfood.com / admin123<br>Garçom: garcom@techfood.com / garcom123</p></section>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api('/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      if (r.user.role === 'client') return toast('Acesso restrito a funcionários. Use o site do cliente.', true);
      save(r); go();
    } catch (err) { toast(err.message, true); }
  };
}

/* ---------- Pedidos ---------- */
const NEXT = { pending: ['preparing', 'Iniciar preparo'], preparing: ['ready', 'Marcar pronto'], ready: ['delivered', 'Marcar entregue'] };

async function viewPedidos() {
  app.onchange = (e) => { if (e.target.id === 'fs') { fStatus = e.target.value; load(); } };
  app.innerHTML = `<div class="row"><h2>Pedidos</h2><span>
    <select id="fs" style="width:auto;display:inline-block">${['', 'pending', 'preparing', 'ready', 'delivered', 'cancelled'].map((s) => `<option value="${s}" ${s === fStatus ? 'selected' : ''}>${s ? STATUS[s] : 'Todos'}</option>`).join('')}</select>
    <button class="btn small y" data-act="refresh">Atualizar</button></span></div><div class="list" id="list"></div>`;
  async function load() {
    const orders = await api(`/orders${fStatus ? `?status=${fStatus}` : ''}`);
    $('#list').innerHTML = orders.length ? orders.map((o) => `<div class="card">
      <div class="row"><b>#${o.id} · ${esc(o.client_name || 'Balcão')}</b><span>
        <span class="chip ${o.status === 'cancelled' ? 'bad' : o.status === 'delivered' ? 'ok' : ''}">${STATUS[o.status]}</span>
        ${o.paid_at ? '<span class="chip ok">Pago</span>' : '<span class="chip red">A pagar</span>'}
        ${o.reservation_id ? '<span class="chip">Antecipado</span>' : ''}</span></div>
      ${o.items.map((i) => `<div class="line"><span>${i.quantity}× ${esc(i.name)}</span><span>${money(i.quantity * i.unit_price)}</span></div>`).join('')}
      <div class="row" style="margin-top:10px"><span><b>${money(o.total)}</b> <span class="muted">· Garçom: ${esc(o.waiter_name || '—')}</span></span><span>
        ${NEXT[o.status] ? `<button class="btn small" data-act="status" data-id="${o.id}" data-to="${NEXT[o.status][0]}">${NEXT[o.status][1]}</button>` : ''}
        ${!o.paid_at && o.status !== 'cancelled' ? `<button class="btn small y" data-act="pay" data-id="${o.id}">Registrar pagamento</button>` : ''}
        ${['pending', 'preparing'].includes(o.status) && !o.paid_at ? `<button class="btn small ghost" data-act="status" data-id="${o.id}" data-to="cancelled">Cancelar</button>` : ''}</span></div></div>`).join('')
      : '<p class="muted">Nenhum pedido.</p>';
  }
  app.onclick = async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    try {
      if (b.dataset.act === 'status') await api(`/orders/${b.dataset.id}/status`, { method: 'PATCH', body: { status: b.dataset.to } });
      if (b.dataset.act === 'pay') { await api(`/orders/${b.dataset.id}/pay`, { method: 'POST' }); toast('Pagamento registrado'); }
      await load();
    } catch (err) { toast(err.message, true); }
  };
  await load();
  timer = setInterval(() => load().catch(() => {}), 15000);
}

/* ---------- Reservas ---------- */
async function viewReservas() {
  const load = async () => {
    const rs = await api(`/reservations${fDate ? `?date=${fDate}` : ''}`);
    $('#rows').innerHTML = rs.length ? rs.map((r) => `<tr><td>${fmtDate(r.date)}</td><td>${r.time}</td><td>${esc(r.user_name)}</td><td>Mesa ${r.table_number}</td><td>${r.people}</td>
      <td><span class="chip ${r.status === 'cancelled' ? 'bad' : r.status === 'completed' ? 'ok' : ''}">${STATUS[r.status]}</span></td>
      <td>${r.status === 'confirmed' ? `<button class="btn small" data-id="${r.id}" data-to="completed">Concluir</button> <button class="btn small ghost" data-id="${r.id}" data-to="cancelled">Cancelar</button>` : ''}</td></tr>`).join('')
      : '<tr><td colspan="7" class="muted">Nenhuma reserva.</td></tr>';
  };
  app.innerHTML = `<div class="row"><h2>Reservas</h2><label style="margin:0">Filtrar por data<input type="date" id="fd" value="${fDate}"></label></div>
    <table><thead><tr><th>Data</th><th>Hora</th><th>Cliente</th><th>Mesa</th><th>Pessoas</th><th>Status</th><th></th></tr></thead><tbody id="rows"></tbody></table>`;
  app.onchange = (e) => { if (e.target.id === 'fd') { fDate = e.target.value; load(); } };
  app.onclick = async (e) => {
    const b = e.target.closest('[data-to]'); if (!b) return;
    try { await api(`/reservations/${b.dataset.id}/status`, { method: 'PATCH', body: { status: b.dataset.to } }); await load(); } catch (err) { toast(err.message, true); }
  };
  await load();
}

/* ---------- Cardápio (admin) ---------- */
async function viewCardapio() {
  const load = async () => {
    const items = await api('/menu/all');
    $('#rows').innerHTML = items.map((m) => `<tr><td>${esc(m.name)}<br><small class="muted">${esc(m.description)}</small></td><td>${esc(m.category)}</td><td>${money(m.price)}</td>
      <td><span class="chip ${m.available ? 'ok' : 'bad'}">${m.available ? 'Disponível' : 'Indisponível'}</span></td>
      <td><button class="btn small y" data-tog="${m.id}" data-v="${m.available ? 0 : 1}">${m.available ? 'Pausar' : 'Ativar'}</button>
      <button class="btn small ghost" data-del="${m.id}">Excluir</button></td></tr>`).join('');
  };
  app.innerHTML = `<h2>Cardápio</h2><form class="card form-inline" id="f">
      <label>Nome<input name="name" required></label><label>Descrição<input name="description"></label>
      <label>Categoria<input name="category" required></label><label>Preço (R$)<input name="price" type="number" step="0.01" min="0.01" required></label>
      <button class="btn">Adicionar</button></form>
    <table><thead><tr><th>Item</th><th>Categoria</th><th>Preço</th><th>Status</th><th></th></tr></thead><tbody id="rows"></tbody></table>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    try { await api('/menu', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); toast('Item adicionado'); await load(); } catch (err) { toast(err.message, true); }
  };
  app.onclick = async (e) => {
    const t = e.target;
    try {
      if (t.dataset.tog) await api(`/menu/${t.dataset.tog}`, { method: 'PATCH', body: { available: t.dataset.v === '1' } });
      else if (t.dataset.del) { if (!confirm('Excluir este item?')) return; await api(`/menu/${t.dataset.del}`, { method: 'DELETE' }); }
      else return;
      await load();
    } catch (err) { toast(err.message, true); }
  };
  await load();
}

/* ---------- Usuários (admin) ---------- */
async function viewUsuarios() {
  const me = session().user.id;
  const ROLES = { admin: 'Administrador', employee: 'Funcionário', client: 'Cliente' };
  const load = async () => {
    const us = await api('/users');
    $('#rows').innerHTML = us.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td>
      <td><select data-role="${u.id}" ${u.id === me ? 'disabled' : ''}>${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
      <td><span class="chip ${u.active ? 'ok' : 'bad'}">${u.active ? 'Ativo' : 'Inativo'}</span></td>
      <td>${u.id === me ? '' : `<button class="btn small ghost" data-act="${u.id}" data-v="${u.active ? 0 : 1}">${u.active ? 'Desativar' : 'Reativar'}</button>`}</td></tr>`).join('');
  };
  app.innerHTML = `<h2>Usuários</h2><form class="card form-inline" id="f">
      <label>Nome<input name="name" required></label><label>E-mail<input name="email" type="email" required></label>
      <label>Senha<input name="password" type="password" minlength="6" required></label>
      <label>Perfil<select name="role"><option value="employee">Funcionário</option><option value="admin">Administrador</option><option value="client">Cliente</option></select></label>
      <button class="btn">Criar usuário</button></form>
    <table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th></th></tr></thead><tbody id="rows"></tbody></table>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    try { await api('/users', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); toast('Usuário criado'); await load(); } catch (err) { toast(err.message, true); }
  };
  app.onchange = async (e) => {
    if (!e.target.dataset.role) return;
    try { await api(`/users/${e.target.dataset.role}`, { method: 'PATCH', body: { role: e.target.value } }); toast('Perfil atualizado'); } catch (err) { toast(err.message, true); load(); }
  };
  app.onclick = async (e) => {
    const t = e.target; if (!t.dataset.act) return;
    try { await api(`/users/${t.dataset.act}`, { method: 'PATCH', body: { active: t.dataset.v === '1' } }); await load(); } catch (err) { toast(err.message, true); }
  };
  await load();
}

/* ---------- Financeiro ---------- */
async function viewFinanceiro() {
  app.onchange = null;
  if (session().user.role === 'employee') {
    const r = await api('/finance/my-commissions');
    app.innerHTML = `<h2>Minhas comissões</h2><div class="kpis"><div class="card kpi"><span class="muted">Total acumulado (10%)</span><b>${money(r.total)}</b></div></div>
      <table><thead><tr><th>Pedido</th><th>Valor</th><th>Data</th></tr></thead><tbody>${r.items.map((i) => `<tr><td>#${i.order_id}</td><td>${money(i.amount)}</td><td>${esc(i.created_at)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Sem comissões ainda.</td></tr>'}</tbody></table>`;
    app.onclick = null; return;
  }
  const s = await api('/finance/summary');
  app.innerHTML = `<h2>Financeiro</h2><div class="kpis">
      <div class="card kpi"><span class="muted">Vendas</span><b>${money(s.income)}</b></div>
      <div class="card kpi r"><span class="muted">Compra de alimentos</span><b>${money(s.expenses)}</b></div>
      <div class="card kpi r"><span class="muted">Comissões dos garçons (10%)</span><b>${money(s.commissions)}</b></div>
      <div class="card kpi"><span class="muted">Lucro líquido</span><b>${money(s.profit)}</b></div></div>
    <h3>Registrar compra de alimentos</h3><form class="card form-inline" id="f">
      <label>Descrição<input name="description" required minlength="3"></label><label>Valor (R$)<input name="amount" type="number" step="0.01" min="0.01" required></label>
      <button class="btn">Registrar</button></form>
    <h3>Comissões por garçom</h3><table><thead><tr><th>Garçom</th><th>Pedidos</th><th>Total</th></tr></thead><tbody>
      ${s.byWaiter.map((w) => `<tr><td>${esc(w.name)}</td><td>${w.orders}</td><td>${money(w.total)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Sem comissões ainda.</td></tr>'}</tbody></table>
    <h3>Últimos lançamentos</h3><table><thead><tr><th>Tipo</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>
      ${s.recent.map((r) => `<tr><td><span class="chip ${r.type === 'income' ? 'ok' : 'bad'}">${r.type === 'income' ? 'Entrada' : 'Saída'}</span></td><td>${esc(r.description)}</td><td>${money(r.amount)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Sem lançamentos.</td></tr>'}</tbody></table>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    try { await api('/finance/expenses', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Compra registrada'); viewFinanceiro(); } catch (err) { toast(err.message, true); }
  };
  app.onclick = null;
}

go();
