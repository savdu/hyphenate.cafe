import { store } from './store.js';
import { fmt, lineTotal, orderTotal } from './money.js';
import { h, render } from './dom.js';

/* Day report — a running tally, not just a receipt printer. Cafe owners want
   to know what to restock and what to 86 next time, not just the cash total. */

let orders = [];

function computeItemCounts() {
  const counts = new Map();
  for (const o of orders) {
    for (const l of o.lines) {
      const cur = counts.get(l.name) || { qty: 0, revenue: 0 };
      cur.qty += l.qty;
      cur.revenue += lineTotal(l);
      counts.set(l.name, cur);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1].qty - a[1].qty);
}

function computeTipCounts() {
  const counts = new Map();
  for (const o of orders) {
    if (!o.tipChoice) continue;
    counts.set(o.tipChoice, (counts.get(o.tipChoice) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function draw(root) {
  const live = orders.filter(o => o.status !== 'void');
  const revenue = live.reduce((s, o) => s + orderTotal(o), 0);
  const tips = live.reduce((s, o) => s + (o.tip || 0), 0);
  // const unpaid = live.filter(o => !o.payment.paid && o.payment.method !== 'comp');
  // const byMethod = new Map();
  // for (const o of live) {
  //   if (!o.payment.paid) continue;
  //   byMethod.set(o.payment.method, (byMethod.get(o.payment.method) || 0) + orderTotal(o));
  // }

  const itemCounts = computeItemCounts();
  const tipCounts = computeTipCounts();

  render(root,
    h('div.stack', {},
      h('div.row-between', {},
        h('span', {}, 'orders'), h('span', {}, String(live.length))),
      h('div.row-between', {},
        h('span', {}, 'gross'), h('strong', {}, fmt(revenue))),
      // h('div.row-between', {},
      //   h('span.muted', {}, 'of which tips'), h('span', {}, fmt(tips)))
      // unpaid.length ? h('div.row-between', { style: 'color:var(--color-red)' },
      //   h('span', {}, 'still unpaid'), h('span', {}, `${unpaid.length} · ${fmt(unpaid.reduce((s, o) => s + orderTotal(o), 0))}`)) : null
    ),
    // h('hr'),
    // h('h3', { style: 'margin-bottom:.5em' }, 'collected by method'),
    // byMethod.size
    //   ? h('table.report', {},
    //       [...byMethod.entries()].map(([m, cents]) => h('tr', {},
    //         h('td', {}, m), h('td.n', {}, fmt(cents))))
    //     )
    //   : h('p.muted.small', {}, 'nothing collected yet'),
    h('hr'),
    h('h3', { style: 'margin-bottom:.5em' }, 'items sold'),
    itemCounts.length
      ? h('table.report', {},
          h('tr', {}, h('th', {}, 'item'), h('th.n', {}, 'qty'), h('th.n', {}, 'revenue')),
          itemCounts.map(([name, c]) => h('tr', {},
            h('td', {}, name), h('td.n', {}, String(c.qty)), h('td.n', {}, fmt(c.revenue))))
        )
      : h('p.muted.small', {}, 'no sales yet'),
    h('hr'),
    h('h3', { style: 'margin-bottom:.5em' }, 'tips collected'),
    tipCounts.length
      ? h('table.report', {},
          tipCounts.map(([choice, n]) => h('tr', {},
            h('td', {}, choice), h('td.n', {}, String(n))))
        )
      : h('p.muted.small', {}, 'none yet'),
    // h('div.row.no-print', { style: 'margin-top:1em' },
    //   h('button', { onclick: () => window.print() }, 'print report')
    // )
  );
}

export function mountReport(root) {
  store.onOrders(list => { orders = list || []; draw(root); });
}
