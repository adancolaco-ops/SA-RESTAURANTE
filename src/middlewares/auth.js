const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');
const { AppError } = require('../utils/errors');

exports.authenticate = (req, res, next) => {
  const [type, token] = (req.headers.authorization || '').split(' ');
  if (type !== 'Bearer' || !token) return next(new AppError(401, 'Token não informado'));
  try {
    const p = jwt.verify(token, jwtSecret);
    req.user = { id: Number(p.sub), role: p.role, name: p.name };
    next();
  } catch {
    next(new AppError(401, 'Token inválido ou expirado'));
  }
};

exports.authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new AppError(403, 'Acesso negado para este perfil'));
