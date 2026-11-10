const repo = require('../repositories');
const { AppError } = require('../utils/errors');

exports.list = (all) => repo.menu.list(all);

const get = (id) => {
  const m = repo.menu.get(id);
  if (!m) throw new AppError(404, 'Item não encontrado');
  return m;
};

exports.create = (data) => repo.menu.get(repo.menu.create(data));
exports.update = (id, data) => { get(id); repo.menu.update(id, data); return repo.menu.get(id); };
exports.remove = (id) => { get(id); repo.menu.remove(id); };
