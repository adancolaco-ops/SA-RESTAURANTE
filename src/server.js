const path = require('path');
const express = require('express');
const cors = require('cors');
const { port, corsOrigins } = require('./config');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const { AppError } = require('./utils/errors');

const app = express();

app.use(cors({
  origin: (origin, cb) => (!origin || corsOrigins.includes(origin) ? cb(null, true) : cb(new AppError(403, 'Origem não permitida pelo CORS'))),
}));
app.use(express.json({ limit: '100kb' }));

app.use('/api', routes);
app.use('/api', (req, res, next) => next(new AppError(404, 'Rota não encontrada')));

// Front-ends estáticos: "/" = Site Cliente | "/gestao" = Site Gestão
const pub = path.join(__dirname, '..', 'public');
app.use('/shared', express.static(path.join(pub, 'shared')));
app.use('/gestao', express.static(path.join(pub, 'gestao')));
app.use(express.static(path.join(pub, 'cliente')));

app.use(errorHandler);

app.listen(port, () => {
  console.log(`TechFood rodando!\n  Site Cliente: http://localhost:${port}\n  Site Gestão:  http://localhost:${port}/gestao\n  API:          http://localhost:${port}/api`);
});
