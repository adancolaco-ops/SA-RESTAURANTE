const repo = require('../repositories');

const money = (n) => Math.round(n * 100) / 100;

exports.addExpense = ({ description, amount }, user) => ({ id: repo.finance.addExpense(description, amount, user.id) });

exports.summary = () => {
  const t = repo.finance.totals();
  return {
    income: money(t.income),
    expenses: money(t.expenses),
    commissions: money(t.commissions),
    profit: money(t.income - t.expenses - t.commissions),
    byWaiter: repo.finance.byWaiter(),
    recent: repo.finance.recent(),
  };
};

exports.myCommissions = (user) => {
  const items = repo.finance.commissionsOf(user.id);
  return { total: money(items.reduce((s, i) => s + i.amount, 0)), items };
};
