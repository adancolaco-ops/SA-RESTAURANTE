const { AppError } = require('../utils/errors');

module.exports = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message }));
    return next(new AppError(400, 'Dados inválidos', details));
  }
  req[source] = result.data;
  next();
};
