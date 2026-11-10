const bcrypt = require('bcryptjs');
const repo = require('../repositories');
const { AppError } = require('../utils/errors');

exports.list = () => repo.users.list();

exports.get = (id) => {
  const u = repo.users.findById(id);
  if (!u) throw new AppError(404, 'Usuário não encontrado');
  return u;
};

exports.create = async ({ name, email, password, role }) => {
  if (repo.users.findByEmail(email)) throw new AppError(409, 'E-mail já cadastrado');
  const id = repo.users.create({ name, email, role, passwordHash: await bcrypt.hash(password, 10) });
  return repo.users.findById(id);
};

exports.update = (id, data, actor) => {
  exports.get(id);
  if (id === actor.id && (data.active === false || (data.role && data.role !== 'admin'))) {
    throw new AppError(400, 'Você não pode desativar nem rebaixar a si mesmo');
  }
  repo.users.update(id, data);
  return repo.users.findById(id);
};
