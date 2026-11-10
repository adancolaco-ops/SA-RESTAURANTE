// Camada de persistência: único lugar com SQL.
const db = require('../database/db');

const patch = (table, id, fields, allowed) => {
  const keys = Object.keys(fields).filter((k) => allowed.includes(k) && fields[k] !== undefined);
  if (!keys.length) return;
  const vals = keys.map((k) => (typeof fields[k] === 'boolean' ? Number(fields[k]) : fields[k]));
  db.prepare(`UPDATE ${table} SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`).run(...vals, id);
};

const USER_COLS = 'id,name,email,role,active,created_at';

exports.users = {
  findByEmail: (e) => db.prepare('SELECT * FROM users WHERE email=?').get(e),
  findById: (id) => db.prepare(`SELECT ${USER_COLS} FROM users WHERE id=?`).get(id),
  list: () => db.prepare(`SELECT ${USER_COLS} FROM users ORDER BY id`).all(),
  create: (u) => db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)')
    .run(u.name, u.email, u.passwordHash, u.role).lastInsertRowid,
  update: (id, f) => patch('users', id, f, ['name', 'role', 'active']),
};

exports.menu = {
  list: (all) => db.prepare(`SELECT * FROM menu_items ${all ? '' : 'WHERE available=1'} ORDER BY category,name`).all(),
  get: (id) => db.prepare('SELECT * FROM menu_items WHERE id=?').get(id),
  create: (m) => db.prepare('INSERT INTO menu_items(name,description,price,category,available) VALUES(?,?,?,?,?)')
    .run(m.name, m.description, m.price, m.category, Number(m.available)).lastInsertRowid,
  update: (id, f) => patch('menu_items', id, f, ['name', 'description', 'price', 'category', 'available']),
  remove: (id) => db.prepare('DELETE FROM menu_items WHERE id=?').run(id).changes,
};

const FREE = "id NOT IN (SELECT table_id FROM reservations WHERE date=? AND time=? AND status!='cancelled')";
const RES_SQL = `SELECT r.*, u.name AS user_name, t.number AS table_number, t.seats
  FROM reservations r JOIN users u ON u.id=r.user_id JOIN dining_tables t ON t.id=r.table_id`;

exports.reservations = {
  freeTable: (date, time, people) => db.prepare(`SELECT * FROM dining_tables WHERE seats>=? AND ${FREE} ORDER BY seats,number LIMIT 1`).get(people, date, time),
  freeCount: (date, time, people) => db.prepare(`SELECT COUNT(*) c FROM dining_tables WHERE seats>=? AND ${FREE}`).get(people, date, time).c,
  create: (r) => db.prepare('INSERT INTO reservations(user_id,table_id,date,time,people) VALUES(?,?,?,?,?)')
    .run(r.userId, r.tableId, r.date, r.time, r.people).lastInsertRowid,
  get: (id) => db.prepare(`${RES_SQL} WHERE r.id=?`).get(id),
  list: ({ userId, date } = {}) => {
    const w = []; const p = [];
    if (userId) { w.push('r.user_id=?'); p.push(userId); }
    if (date) { w.push('r.date=?'); p.push(date); }
    return db.prepare(`${RES_SQL} ${w.length ? `WHERE ${w.join(' AND ')}` : ''} ORDER BY r.date,r.time`).all(...p);
  },
  setStatus: (id, status) => db.prepare('UPDATE reservations SET status=? WHERE id=?').run(status, id),
};

const ORD_SQL = `SELECT o.*, c.name AS client_name, w.name AS waiter_name FROM orders o
  LEFT JOIN users c ON c.id=o.client_id LEFT JOIN users w ON w.id=o.waiter_id`;
const withItems = (o) => o && { ...o, items: db.prepare('SELECT menu_item_id,name,quantity,unit_price FROM order_items WHERE order_id=?').all(o.id) };

// Gera a comissão (10%) quando o pedido está pago E tem garçom responsável.
const settle = (id, rate) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(id);
  if (o.paid_at && o.waiter_id && !db.prepare('SELECT 1 FROM commissions WHERE order_id=?').get(id)) {
    const amount = Math.round(o.total * rate * 100) / 100;
    db.prepare('INSERT INTO commissions(order_id,waiter_id,amount) VALUES(?,?,?)').run(id, o.waiter_id, amount);
  }
};

exports.orders = {
  create: (o, lines) => db.transaction(() => {
    const id = db.prepare('INSERT INTO orders(client_id,waiter_id,reservation_id,total) VALUES(?,?,?,?)')
      .run(o.clientId, o.waiterId, o.reservationId, o.total).lastInsertRowid;
    const ins = db.prepare('INSERT INTO order_items(order_id,menu_item_id,name,quantity,unit_price) VALUES(?,?,?,?,?)');
    lines.forEach((l) => ins.run(id, l.menuItemId, l.name, l.quantity, l.unitPrice));
    return id;
  })(),
  get: (id) => withItems(db.prepare(`${ORD_SQL} WHERE o.id=?`).get(id)),
  list: ({ clientId, status } = {}) => {
    const w = []; const p = [];
    if (clientId) { w.push('o.client_id=?'); p.push(clientId); }
    if (status) { w.push('o.status=?'); p.push(status); }
    return db.prepare(`${ORD_SQL} ${w.length ? `WHERE ${w.join(' AND ')}` : ''} ORDER BY o.id DESC`).all(...p).map(withItems);
  },
  setStatus: (id, status, waiterId, rate) => db.transaction(() => {
    db.prepare('UPDATE orders SET status=?, waiter_id=COALESCE(waiter_id,?) WHERE id=?').run(status, waiterId ?? null, id);
    settle(id, rate);
  })(),
  pay: (id, waiterId, rate) => db.transaction(() => {
    db.prepare('UPDATE orders SET paid_at=CURRENT_TIMESTAMP, waiter_id=COALESCE(waiter_id,?) WHERE id=?').run(waiterId ?? null, id);
    const { total } = db.prepare('SELECT total FROM orders WHERE id=?').get(id);
    db.prepare("INSERT INTO finance_entries(type,description,amount,order_id) VALUES('income',?,?,?)").run(`Venda - pedido #${id}`, total, id);
    settle(id, rate);
  })(),
};

const sum = (sql) => db.prepare(sql).get().v;
exports.finance = {
  addExpense: (description, amount, by) => db.prepare("INSERT INTO finance_entries(type,description,amount,created_by) VALUES('expense',?,?,?)")
    .run(description, amount, by).lastInsertRowid,
  totals: () => ({
    income: sum("SELECT COALESCE(SUM(amount),0) v FROM finance_entries WHERE type='income'"),
    expenses: sum("SELECT COALESCE(SUM(amount),0) v FROM finance_entries WHERE type='expense'"),
    commissions: sum('SELECT COALESCE(SUM(amount),0) v FROM commissions'),
  }),
  byWaiter: () => db.prepare(`SELECT u.id, u.name, COUNT(*) orders, SUM(c.amount) total
    FROM commissions c JOIN users u ON u.id=c.waiter_id GROUP BY u.id ORDER BY total DESC`).all(),
  recent: () => db.prepare('SELECT * FROM finance_entries ORDER BY id DESC LIMIT 20').all(),
  commissionsOf: (waiterId) => db.prepare('SELECT order_id, amount, created_at FROM commissions WHERE waiter_id=? ORDER BY id DESC').all(waiterId),
};
