/* Money is handled in integer cents everywhere. Floats and prices do not mix. */

export const toCents = dollars => {
  const n = Number(dollars);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

export const fmt = cents => {
  const n = Math.round(cents || 0);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
};

export const lineTotal = line => {
  const mods = (line.mods || []).reduce((s, m) => s + (m.price || 0), 0);
  return (line.price + mods) * line.qty;
};

export const orderSubtotal = order =>
  (order.lines || []).reduce((s, l) => s + lineTotal(l), 0);

export const orderTotal = order =>
  Math.max(0, orderSubtotal(order) - (order.discount || 0) + (order.tip || 0));
