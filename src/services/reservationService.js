const repo = require('../repositories');
const { AppError } = require('../utils/errors');

const SLOTS = ['12:00', '13:00', '14:00', '15:00', '19:00', '20:00', '21:00', '22:00'];
const isStaff = (u) => u.role === 'admin' || u.role === 'employee';

function checkDate(date) {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) throw new AppError(400, 'Data inválida');
  if (![5, 6, 0].includes(d.getDay())) throw new AppError(400, 'Reservas somente às sextas, sábados e domingos');
  if (date < new Date().toLocaleDateString('sv-SE')) throw new AppError(400, 'Não é possível reservar em data passada');
}

exports.availability = ({ date, people }) => {
  checkDate(date);
  return SLOTS.map((time) => ({ time, freeTables: repo.reservations.freeCount(date, time, people) }));
};

exports.create = (user, { date, time, people }) => {
  checkDate(date);
  if (!SLOTS.includes(time)) throw new AppError(400, `Horário inválido. Opções: ${SLOTS.join(', ')}`);
  const table = repo.reservations.freeTable(date, time, people);
  if (!table) throw new AppError(409, 'Não há mesas disponíveis nesse horário para esse número de pessoas');
  const id = repo.reservations.create({ userId: user.id, tableId: table.id, date, time, people });
  return repo.reservations.get(id);
};

exports.list = (user, { date }) => repo.reservations.list({ userId: isStaff(user) ? undefined : user.id, date });

exports.setStatus = (user, id, status) => {
  const r = repo.reservations.get(id);
  if (!r) throw new AppError(404, 'Reserva não encontrada');
  if (!isStaff(user)) {
    if (r.user_id !== user.id) throw new AppError(403, 'Acesso negado');
    if (status !== 'cancelled') throw new AppError(403, 'Clientes só podem cancelar reservas');
  }
  repo.reservations.setStatus(id, status);
  return repo.reservations.get(id);
};
