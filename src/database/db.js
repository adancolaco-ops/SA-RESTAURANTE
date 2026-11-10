const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { dbFile } = require('../config');

const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','employee','client')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS dining_tables(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number INTEGER NOT NULL UNIQUE,
  seats INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS menu_items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price REAL NOT NULL,
  category TEXT NOT NULL,
  available INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS reservations(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  table_id INTEGER NOT NULL REFERENCES dining_tables(id),
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  people INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','completed','cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER REFERENCES users(id),
  waiter_id INTEGER REFERENCES users(id),
  reservation_id INTEGER REFERENCES reservations(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','preparing','ready','delivered','cancelled')),
  total REAL NOT NULL,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS commissions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id),
  waiter_id INTEGER NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS finance_entries(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('income','expense')),
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  order_id INTEGER REFERENCES orders(id),
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

// Dados iniciais (apenas no primeiro uso)
if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
  const addUser = db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)');
  addUser.run('Administrador', 'admin@techfood.com', bcrypt.hashSync('admin123', 10), 'admin');
  addUser.run('Carlos Garçom', 'garcom@techfood.com', bcrypt.hashSync('garcom123', 10), 'employee');
  addUser.run('Cliente Demo', 'cliente@techfood.com', bcrypt.hashSync('cliente123', 10), 'client');

  const addTable = db.prepare('INSERT INTO dining_tables(number,seats) VALUES(?,?)');
  [[1, 2], [2, 2], [3, 4], [4, 4], [5, 6], [6, 8]].forEach((t) => addTable.run(...t));

  const addItem = db.prepare('INSERT INTO menu_items(name,description,price,category) VALUES(?,?,?,?)');
  [
    ['Bit Burger', 'Pão brioche, blend 160g, cheddar e molho da casa', 32.9, 'Lanches'],
    ['Byte Chicken', 'Frango empanado crocante com maionese de ervas', 29.9, 'Lanches'],
    ['Pizza Pixel', 'Pizza individual de mussarela e tomate', 38.0, 'Pratos'],
    ['Massa Matrix', 'Espaguete ao sugo com manjericão', 34.5, 'Pratos'],
    ['Batata Chip', 'Porção de batatas rústicas com páprica', 18.0, 'Porções'],
    ['Nuggets Nano', 'Porção com 10 unidades e molho barbecue', 21.0, 'Porções'],
    ['Suco Server', 'Laranja ou limão, 400ml', 9.0, 'Bebidas'],
    ['Refri Reboot', 'Lata 350ml', 7.0, 'Bebidas'],
    ['Brownie Binário', 'Brownie com sorvete de creme', 16.0, 'Sobremesas'],
  ].forEach((i) => addItem.run(...i));
}

module.exports = db;
