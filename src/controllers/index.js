// Camada de controle: traduz HTTP <-> serviços.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const handlers = (obj) => Object.fromEntries(Object.entries(obj).map(([k, f]) => [k, wrap(f)]));

const auth = require('../services/authService');
const users = require('../services/userService');
const menu = require('../services/menuService');
const reservations = require('../services/reservationService');
const orders = require('../services/orderService');
const finance = require('../services/financeService');

module.exports = {
  auth: handlers({
    register: async (req, res) => res.status(201).json(await auth.register(req.body)),
    login: async (req, res) => res.json(await auth.login(req.body)),
    me: async (req, res) => res.json(users.get(req.user.id)),
  }),
  users: handlers({
    list: async (req, res) => res.json(users.list()),
    create: async (req, res) => res.status(201).json(await users.create(req.body)),
    update: async (req, res) => res.json(users.update(req.params.id, req.body, req.user)),
  }),
  menu: handlers({
    list: async (req, res) => res.json(menu.list(false)),
    listAll: async (req, res) => res.json(menu.list(true)),
    create: async (req, res) => res.status(201).json(menu.create(req.body)),
    update: async (req, res) => res.json(menu.update(req.params.id, req.body)),
    remove: async (req, res) => { menu.remove(req.params.id); res.status(204).end(); },
  }),
  reservations: handlers({
    availability: async (req, res) => res.json(reservations.availability(req.query)),
    list: async (req, res) => res.json(reservations.list(req.user, req.query)),
    create: async (req, res) => res.status(201).json(reservations.create(req.user, req.body)),
    setStatus: async (req, res) => res.json(reservations.setStatus(req.user, req.params.id, req.body.status)),
  }),
  orders: handlers({
    list: async (req, res) => res.json(orders.list(req.user, req.query)),
    get: async (req, res) => res.json(orders.get(req.user, req.params.id)),
    create: async (req, res) => res.status(201).json(orders.create(req.user, req.body)),
    setStatus: async (req, res) => res.json(orders.setStatus(req.user, req.params.id, req.body.status)),
    pay: async (req, res) => res.json(orders.pay(req.user, req.params.id)),
  }),
  finance: handlers({
    summary: async (req, res) => res.json(finance.summary()),
    addExpense: async (req, res) => res.status(201).json(finance.addExpense(req.body, req.user)),
    myCommissions: async (req, res) => res.json(finance.myCommissions(req.user)),
  }),
};
