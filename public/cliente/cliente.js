const { api, esc, money, fmtDate, STATUS, toast, session, save, clear } = TF;
const $ = (s) => document.querySelector(s);
const app = $('#app'); const nav = $('#nav');
let view = 'menu'; let cart = {}; let menu = []; let resId = '';
TF.onExpired = () => { toast('Sessão expirada. Entre novamente.', true); go(); };

nav.onclick = (e) => {
  if (e.target.dataset.v) go(e.target.dataset.v);
  if (e.target.id === 'out') { clear(); cart = {}; go('menu'); }
};

function renderNav() {
  const s = session();
  nav.innerHTML = s
    ? ['menu:Cardápio', 'reservas:Reservas', 'pedidos:Meus pedidos'].map((t) => { const [v, l] = t.split(':'); return `<a data-v="${v}" class="${view === v ? 'on' : ''}">${l}</a>`; }).join('')
      + `<span class="who">Olá, ${esc(s.user.name.split(' ')[0])}</span><button class="btn small ghost" id="out">Sair</button>`
    : '';
}

function go(v) {
  if (v) view = v;
  renderNav();
  if (!session()) return renderAuth('login');
  const fn = { menu: viewMenu, reservas: viewReservas, pedidos: viewPedidos }[view];
  fn().catch((e) => toast(e.message, true));
}

function renderAuth(mode) {
  const login = mode === 'login';
  app.onclick = null;
  app.innerHTML = `
    <section class="hero"><h1>Bem-vindo ao <span>TechFood</span></h1>
      <p>Reserve sua mesa às sextas, sábados e domingos e adiante o seu pedido.</p></section>
    <section class="card narrow"><h2>${login ? 'Entrar' : 'Criar conta'}</h2>
      <form id="f">
        ${login ? '' : '<label>Nome<input name="name" required minlength="2"></label>'}
        <label>E-mail<input name="email" type="email" required></label>
        <label>Senha<input name="password" type="password" required minlength="6"></label>
        <button class="btn full">${login ? 'Entrar' : 'Cadastrar'}</button>
      </form>
      <p><a href="#" id="sw">${login ? 'Ainda não tenho conta' : 'Já tenho conta'}</a></p>
      <p class="hint">Demo: cliente@techfood.com / cliente123</p>
    </section>`;
  $('#sw').onclick = (e) => { e.preventDefault(); renderAuth(login ? 'register' : 'login'); };
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    try {
      save(await api(`/auth/${login ? 'login' : 'register'}`, { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }));
      go('menu');
    } catch (err) { toast(err.message, true); }
  };
}

/* ---------- Cardápio + compra antecipada ---------- */
async function viewMenu() {
  menu = await api('/menu');
  const reservas = (await api('/reservations')).filter((r) => r.status === 'confirmed');
  const cats = [...new Set(menu.map((m) => m.category))];
  app.innerHTML = `<div class="split"><div>
    ${cats.map((c) => `<h2>${esc(c)}</h2><div class="grid">${menu.filter((m) => m.category === c).map((m) => `
      <article class="card item"><h3>${esc(m.name)}</h3><p class="muted">${esc(m.description)}</p>
        <div class="row"><b>${money(m.price)}</b><button class="btn small y" data-add="${m.id}">Adicionar</button></div></article>`).join('')}</div>`).join('')}
    </div><aside class="card cart" id="cart"></aside></div>`;

  const drawCart = () => {
    const lines = Object.entries(cart).map(([id, q]) => ({ ...menu.find((m) => m.id === +id), q }));
    const total = lines.reduce((s, l) => s + l.price * l.q, 0);
    $('#cart').innerHTML = `<h2>Seu pedido</h2>
      ${lines.length ? lines.map((l) => `<div class="line"><span>${esc(l.name)}</span><span class="qty">
        <button data-dec="${l.id}">−</button> ${l.q} <button data-add="${l.id}">+</button></span></div>`).join('') : '<p class="muted">Carrinho vazio.</p>'}
      <p class="row"><b>Total</b><b>${money(total)}</b></p>
      <label>Compra antecipada (opcional)
        <select id="res"><option value="">Sem reserva — consumo no local</option>
          ${reservas.map((r) => `<option value="${r.id}" ${String(r.id) === String(resId) ? 'selected' : ''}>${fmtDate(r.date)} ${r.time} — Mesa ${r.table_number}</option>`).join('')}
        </select></label>
      <button class="btn full" id="send" ${lines.length ? '' : 'disabled'}>Finalizar pedido</button>`;
    $('#res').onchange = (e) => { resId = e.target.value; };
  };
  app.onclick = async (e) => {
    const t = e.target;
    if (t.dataset.add) cart[t.dataset.add] = (cart[t.dataset.add] || 0) + 1;
    else if (t.dataset.dec) { cart[t.dataset.dec]--; if (cart[t.dataset.dec] <= 0) delete cart[t.dataset.dec]; }
    else if (t.id === 'send') {
      try {
        await api('/orders', { method: 'POST', body: { items: Object.entries(cart).map(([menuItemId, quantity]) => ({ menuItemId: +menuItemId, quantity })), reservationId: resId ? +resId : undefined } });
        cart = {}; resId = ''; toast('Pedido enviado! 🍽️'); return go('pedidos');
      } catch (err) { return toast(err.message, true); }
    } else return;
    drawCart();
  };
  drawCart();
}

/* ---------- Reservas ---------- */
async function viewReservas() {
  const mine = await api('/reservations');
  app.innerHTML = `<h2>Reservar mesa</h2>
    <p class="muted">Atendemos às <b>sextas, sábados e domingos</b>.</p>
    <section class="card"><div class="form-inline">
      <label>Data<input type="date" id="date" min="${new Date().toLocaleDateString('sv-SE')}"></label>
      <label>Pessoas<select id="people">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<option ${n === 2 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <button class="btn" id="check">Ver horários</button></div><div class="slots" id="slots"></div></section>
    <h2>Minhas reservas</h2><div class="list">${mine.length ? mine.map((r) => `
      <div class="card row"><span><b>${fmtDate(r.date)} às ${r.time}</b> — Mesa ${r.table_number} (${r.people} pessoa${r.people > 1 ? 's' : ''})</span>
      <span><span class="chip ${r.status === 'cancelled' ? 'bad' : 'ok'}">${STATUS[r.status]}</span>
      ${r.status === 'confirmed' ? `<button class="btn small ghost" data-cancel="${r.id}">Cancelar</button>` : ''}</span></div>`).join('') : '<p class="muted">Nenhuma reserva ainda.</p>'}</div>`;

  const loadSlots = async () => {
    const date = $('#date').value; if (!date) return toast('Escolha uma data', true);
    const slots = await api(`/reservations/availability?date=${date}&people=${$('#people').value}`);
    $('#slots').innerHTML = slots.map((s) => `<button class="btn small ${s.freeTables ? 'y' : ''}" ${s.freeTables ? '' : 'disabled'} data-time="${s.time}">${s.time}</button>`).join('');
  };
  app.onclick = async (e) => {
    const t = e.target;
    try {
      if (t.id === 'check') await loadSlots();
      else if (t.dataset.time) {
        await api('/reservations', { method: 'POST', body: { date: $('#date').value, time: t.dataset.time, people: +$('#people').value } });
        toast('Reserva confirmada! ✅'); viewReservas();
      } else if (t.dataset.cancel) {
        await api(`/reservations/${t.dataset.cancel}/status`, { method: 'PATCH', body: { status: 'cancelled' } });
        viewReservas();
      }
    } catch (err) { toast(err.message, true); }
  };
}

/* ---------- Pedidos ---------- */
async function viewPedidos() {
  const orders = await api('/orders');
  app.innerHTML = `<h2>Meus pedidos</h2><div class="list">${orders.length ? orders.map((o) => `
    <div class="card"><div class="row"><b>Pedido #${o.id}</b>
      <span><span class="chip ${o.status === 'cancelled' ? 'bad' : o.status === 'delivered' ? 'ok' : ''}">${STATUS[o.status]}</span>
      ${o.paid_at ? '<span class="chip ok">Pago</span>' : '<span class="chip red">A pagar</span>'}</span></div>
      ${o.items.map((i) => `<div class="line"><span>${i.quantity}× ${esc(i.name)}</span><span>${money(i.quantity * i.unit_price)}</span></div>`).join('')}
      <div class="row" style="margin-top:10px"><b>Total ${money(o.total)}</b><span>
        ${!o.paid_at && o.status !== 'cancelled' ? `<button class="btn small" data-pay="${o.id}">Pagar</button>` : ''}
        ${o.status === 'pending' ? `<button class="btn small ghost" data-cancel="${o.id}">Cancelar</button>` : ''}</span></div>
      ${o.waiter_name ? `<p class="muted">Atendido por ${esc(o.waiter_name)}</p>` : ''}</div>`).join('') : '<p class="muted">Você ainda não fez pedidos.</p>'}</div>`;
  app.onclick = async (e) => {
    const t = e.target;
    try {
      if (t.dataset.pay) { if (!confirm('Confirmar pagamento (simulado)?')) return; await api(`/orders/${t.dataset.pay}/pay`, { method: 'POST' }); toast('Pagamento registrado 💳'); }
      else if (t.dataset.cancel) await api(`/orders/${t.dataset.cancel}/status`, { method: 'PATCH', body: { status: 'cancelled' } });
      else return;
      viewPedidos();
    } catch (err) { toast(err.message, true); }
  };
}

go();
