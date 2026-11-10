const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpires } = require('../config');
const repo = require('../repositories');
const { AppError } = require('../utils/errors');

const sign = (u) => jwt.sign({ sub: String(u.id), role: u.role, name: u.name }, jwtSecret, { expiresIn: jwtExpires });

exports.register = async ({ name, email, password }) => {
  if (repo.users.findByEmail(email)) throw new AppError(409, 'E-mail já cadastrado');
  const id = repo.users.create({ name, email, role: 'client', passwordHash: await bcrypt.hash(password, 10) });
  const user = repo.users.findById(id);
  return { token: sign(user), user };
};

exports.login = async ({ email, password }) => {
  const found = repo.users.findByEmail(email);
  if (!found || !found.active || !(await bcrypt.compare(password, found.password_hash))) {
    throw new AppError(401, 'E-mail ou senha inválidos');
  }
  const { password_hash: _omit, ...user } = found;
  return { token: sign(user), user };
};
