const path = require('path');
const port = Number(process.env.PORT) || 3000;

module.exports = {
  port,
  jwtSecret: process.env.JWT_SECRET || 'techfood-dev-secret-troque-em-producao',
  jwtExpires: process.env.JWT_EXPIRES || '2h',
  corsOrigins: (process.env.CORS_ORIGINS || `http://localhost:${port},http://127.0.0.1:${port}`).split(','),
  dbFile: process.env.DB_FILE || path.join(__dirname, '..', 'techfood.db'),
  waiterRate: 0.1, // 10% do garçom
};
