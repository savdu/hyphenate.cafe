import { store } from './store.js';
// import { config } from './config.js';
import { fmt, orderTotal } from './money.js';
import { h, render, timeOf, minutesSince, modal } from './dom.js';
// import { venmoNote } from './venmo.js';

/* -------------------------------------------------------------------------
   Order tracker.

   Payment confirmation (unpaid/collect/method) is commented out below, not
   deleted — this build assumes everyone here is a friend and money shows up
   without the app tracking it. To bring collection tracking back: restore
   the two imports above, the collect() function, its "collect" button in
   ticketNode's actions, and the paid/unpaid line + unpaid summary in draw().
   ------------------------------------------------------------------------- */

const STALE_MINUTES = 10;
let orders = [];
let showDone = false;
let els = {};
let tick = null;

const byNewest = (a, b) => b.createdAt - a.createdAt;
const byOldest = (a, b) => a.createdAt - b.createdAt;

async function patch(order, changes) {
  await store.putOrder({ ...order, ...changes });
}

// async function collect(order) {
//   const due = orderTotal(order);
//
//   const paid = await modal(done => h('div.center.stack', {},
//     h('div.muted.small', {}, `order #${order.number}${order.name ? ` · ${order.name}` : ''}`),
//     h('div.amount-due', {}, fmt(due)),
//     h('p.small.muted', {}, `have them scan the venmo QR at the register (@${config.venmoUsername}) — note: “${venmoNote(order)}”`),
//     h('div.row', { style: 'justify-content:center;margin-top:.5em' },
//       h('button', { onclick: () => done(null) }, 'close'),
//       h('button.primary', { onclick: () => done(true) }, 'mark paid ✓')
//     )
//   ));
//
//   if (paid) {
//     await patch(order, { payment: { ...order.payment, paid: true, paidAt: Date.now() } });
//   }
// }

function ticketNode(order) {
  const mins = minutesSince(order.createdAt);
  const stale = order.status === 'queued' && mins >= STALE_MINUTES;
  const due = orderTotal(order);

  const items = order.lines.map(l => h('li', {},
    `${l.qty}× ${l.name}`,
    l.mods?.length ? h('span.mods', {}, ` · ${l.mods.map(m => m.name).join(' · ')}`) : null,
    l.note ? h('span.lnote', {}, ` “${l.note}”`) : null
  ));

  const actions = [];
  if (order.status === 'queued') {
    actions.push(h('button', { onclick: () => patch(order, { status: 'ready' }) }, 'ready ✓'));
  } else if (order.status === 'ready') {
    actions.push(h('button.primary', { onclick: () => patch(order, { status: 'done' }) }, 'picked up ✓'));
    actions.push(h('button.ghost.tiny', { onclick: () => patch(order, { status: 'queued' }) }, '↩ back to queue'));
  } else {
    actions.push(h('button.ghost.tiny', { onclick: () => patch(order, { status: 'ready' }) }, '↩ reopen'));
  }

  // if (!order.payment.paid) {
  //   actions.push(h('button', { onclick: () => collect(order) }, 'collect'));
  // }

  return h('div.ticket', { 'data-status': order.status },
    h('div.row-between', {},
      h('span', {},
        h('span.num', {}, `#${order.number}`), ' ',
        h('span.who', {}, order.name || 'no name')
      ),
      h('span.small.muted', {},
        timeOf(order.createdAt), ' · ',
        h('span', { class: stale ? 'stale' : '' }, `${mins}m`)
      )
    ),
    h('ul', {}, items),
    h('div.row-between', {},
      h('span.small', {},
        // h('span', { class: order.payment.paid ? 'paid' : 'unpaid' },
        //   order.payment.paid ? `paid · ${order.payment.method}` : `UNPAID · ${order.payment.method}`),
        // ' · ',
        fmt(due)
      ),
      h('button.ghost.tiny.danger', {
        onclick: async () => {
          if (confirm(`Delete order #${order.number}? This cannot be undone.`)) {
            await store.deleteOrder(order.id);
          }
        }
      }, 'delete')
    ),
    h('div.row', { style: 'flex-wrap:wrap;margin-top:.4em' }, actions)
  );
}

function group(title, list, accent) {
  if (!list.length) return null;
  return h('div', { style: 'margin-bottom:1.25em' },
    h('h3', { style: `color:${accent};margin-bottom:.5em` }, `${title} (${list.length})`),
    list.map(ticketNode)
  );
}

function draw() {
  const queued = orders.filter(o => o.status === 'queued').sort(byOldest);
  const ready = orders.filter(o => o.status === 'ready').sort(byOldest);
  const done = orders.filter(o => o.status === 'done').sort(byNewest);
  // const unpaid = orders.filter(o => !o.payment.paid && o.payment.method !== 'comp');

  render(els.summary,
    h('div.row-between.small', {},
      h('span.muted', {}, `${orders.length} orders today`)
      // unpaid.length
      //   ? h('span', { style: 'color:var(--color-red)' }, `${unpaid.length} unpaid · ${fmt(unpaid.reduce((s, o) => s + orderTotal(o), 0))}`)
      //   : h('span', { style: 'color:var(--color-green)' }, 'all settled')
    )
  );

  els.toggle.textContent = showDone ? 'hide picked up' : `show picked up (${done.length})`;

  render(els.list,
    orders.length
      ? [
          group('making', queued, 'var(--color-orange)'),
          group('ready for pickup', ready, 'var(--color-green)'),
          showDone ? group('picked up', done, 'var(--color-muted)') : null
        ].filter(Boolean)
      : h('p.muted', {}, 'no orders yet')
  );
}

export function mountOrders(root) {
  els = {};
  els.summary = h('div');
  els.list = h('div');
  els.toggle = h('button.ghost.tiny', {
    onclick: () => { showDone = !showDone; draw(); }
  }, 'show picked up');

  render(root,
    els.summary,
    h('div.row', { style: 'justify-content:flex-end;margin:.5em 0' }, els.toggle),
    els.list
  );

  store.onOrders(list => { orders = list || []; draw(); });

  /* Re-render once a minute so the "12m" ages tick up on their own */
  clearInterval(tick);
  tick = setInterval(draw, 60000);
}
