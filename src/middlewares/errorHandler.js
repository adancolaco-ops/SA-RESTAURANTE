const { AppError } = require('../utils/errors');

// Formato padrão: { error: { status, message, details? } }
module.exports = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  let status = 500;
  let message = 'Erro interno do servidor';
  let details;

  if (err instanceof AppError) {
    ({ status, message, details } = err);
  } else if (err.type === 'entity.parse.failed') {
    status = 400; message = 'JSON inválido';
  } else if (String(err.code || '').startsWith('SQLITE_CONSTRAINT')) {
    status = 409; message = 'Conflito de dados (registro duplicado ou em uso)';
  } else {
    console.error(err);
  }
  res.status(status).json({ error: { status, message, details } });
};
