const router = require('express').Router();
const c = require('../controllers');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const s = require('../schemas');

const staff = authorize('admin', 'employee');
const admin = authorize('admin');
const idp = validate(s.idParam, 'params');

// Autenticação
router.post('/auth/register', validate(s.registerSchema), c.auth.register);
router.post('/auth/login', validate(s.loginSchema), c.auth.login);
router.get('/auth/me', authenticate, c.auth.me);

// Usuários (admin)
router.get('/users', authenticate, admin, c.users.list);
router.post('/users', authenticate, admin, validate(s.userCreateSchema), c.users.create);
router.patch('/users/:id', authenticate, admin, idp, validate(s.userUpdateSchema), c.users.update);

// Cardápio
router.get('/menu', c.menu.list);
router.get('/menu/all', authenticate, staff, c.menu.listAll);
router.post('/menu', authenticate, admin, validate(s.menuSchema), c.menu.create);
router.patch('/menu/:id', authenticate, admin, idp, validate(s.menuUpdateSchema), c.menu.update);
router.delete('/menu/:id', authenticate, admin, idp, c.menu.remove);

// Reservas
router.get('/reservations/availability', authenticate, validate(s.availabilityQuery, 'query'), c.reservations.availability);
router.get('/reservations', authenticate, validate(s.reservationListQuery, 'query'), c.reservations.list);
router.post('/reservations', authenticate, validate(s.reservationSchema), c.reservations.create);
router.patch('/reservations/:id/status', authenticate, idp, validate(s.reservationStatusSchema), c.reservations.setStatus);

// Pedidos
router.get('/orders', authenticate, validate(s.orderListQuery, 'query'), c.orders.list);
router.get('/orders/:id', authenticate, idp, c.orders.get);
router.post('/orders', authenticate, validate(s.orderSchema), c.orders.create);
router.patch('/orders/:id/status', authenticate, idp, validate(s.orderStatusSchema), c.orders.setStatus);
router.post('/orders/:id/pay', authenticate, idp, c.orders.pay);

// Financeiro
router.get('/finance/summary', authenticate, admin, c.finance.summary);
router.post('/finance/expenses', authenticate, admin, validate(s.expenseSchema), c.finance.addExpense);
router.get('/finance/my-commissions', authenticate, staff, c.finance.myCommissions);

module.exports = router;
