const repo = require('../repositories');
const { waiterRate } = require('../config');
const { AppError } = require('../utils/errors');

const FLOW = { pending: ['preparing', 'cancelled'], preparing: ['ready', 'cancelled'], ready: ['delivered'], delivered: [], cancelled: [] };
const isStaff = (u) => u.role === 'admin' || u.role === 'employee';
const money = (n) => Math.round(n * 100) / 100;

const get = (user, id) => {
  const o = repo.orders.get(id);
  if (!o) throw new AppError(404, 'Pedido não encontrado');
  if (!isStaff(user) && o.client_id !== user.id) throw new AppError(403, 'Acesso negado');
  return o;
};
exports.get = get;

exports.create = (user, { items, reservationId, clientId }) => {
  const staff = isStaff(user);
  const ownerId = staff ? clientId || null : user.id;
  const waiterId = user.role === 'employee' ? user.id : null;

  if (reservationId) {
    const rv = repo.reservations.get(reservationId);
    if (!rv || rv.status === 'cancelled' || (!staff && rv.user_id !== user.id)) throw new AppError(400, 'Reserva inválida');
  }
  const lines = items.map(({ menuItemId, quantity }) => {
    const m = repo.menu.get(menuItemId);
    if (!m || !m.available) throw new AppError(400, `Item ${menuItemId} indisponível`);
    return { menuItemId, name: m.name, quantity, unitPrice: m.price };
  });
  const total = money(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
  const id = repo.orders.create({ clientId: ownerId, waiterId, reservationId: reservationId || null, total }, lines);
  return repo.orders.get(id);
};

exports.list = (user, { status }) => repo.orders.list({ clientId: isStaff(user) ? undefined : user.id, status });

exports.setStatus = (user, id, status) => {
  const o = get(user, id);
  if (!isStaff(user) && !(status === 'cancelled' && o.status === 'pending')) {
    throw new AppError(403, 'Clientes só podem cancelar pedidos ainda não iniciados');
  }
  if (!FLOW[o.status].includes(status)) throw new AppError(409, `Não é possível mudar de "${o.status}" para "${status}"`);
  if (status === 'cancelled' && o.paid_at) throw new AppError(409, 'Pedido já pago não pode ser cancelado');
  // O garçom que assume o pedido é quem recebe os 10%
  const waiterId = user.role === 'employee' ? user.id : null;
  repo.orders.setStatus(id, status, waiterId, waiterRate);
  return repo.orders.get(id);
};

exports.pay = (user, id) => {
  const o = get(user, id);
  if (o.paid_at) throw new AppError(409, 'Pedido já foi pago');
  if (o.status === 'cancelled') throw new AppError(409, 'Pedido cancelado não pode ser pago');
  repo.orders.pay(id, user.role === 'employee' ? user.id : null, waiterRate);
  return repo.orders.get(id);
};
