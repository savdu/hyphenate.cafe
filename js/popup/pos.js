import { store } from './store.js';
// import { config } from './config.js';
import { fmt, lineTotal, orderSubtotal, orderTotal } from './money.js';
import { h, render, modal } from './dom.js';
// import { venmoNote } from './venmo.js';

/* -------------------------------------------------------------------------
   POS. Tap items, adjust, then confirm to drop the ticket into the queue.

   This build assumes everyone here is a friend and money shows up without
   the app tracking or prompting for it — the Venmo reminder text is
   commented out below, not deleted. To bring it back: restore the two
   imports above and the reminder line in the confirm modal.
   ------------------------------------------------------------------------- */

let menu = { sections: [], tipOptions: [] };
let orders = [];
let cart = newCart();
let els = {};

function newCart() {
  return { name: '', lines: [], discount: 0, tip: 0 };
}

const uid = () => Math.random().toString(36).slice(2, 9);

const subtotal = () => orderSubtotal(cart);
const total = () => orderTotal(cart);

function nextNumber() {
  const highest = orders.reduce((m, o) => Math.max(m, o.number || 0), 0);
  return highest + 1;
}

/* --- adding to the cart --------------------------------------------------- */

function addLine(item, { mods = [], note = '', qty = 1 } = {}) {
  /* Fold into an identical existing line so the ticket stays readable */
  const key = l =>
    `${l.itemId}|${(l.mods || []).map(m => m.name).sort().join(',')}|${l.note || ''}`;
  const candidate = { itemId: item.id, mods, note };
  const existing = cart.lines.find(l => key(l) === key(candidate));

  if (existing) existing.qty += qty;
  else cart.lines.push({ uid: uid(), itemId: item.id, name: item.name, price: item.price, qty, mods, note });

  drawCart();
}

async function openItemModal(item, line = null) {
  const chosen = new Set((line?.mods || []).map(m => m.name));

  const result = await modal(done => {
    const noteInput = h('input', {
      type: 'text', value: line?.note || '', placeholder: 'no ice…'
    });

    const modToggles = (item.mods || []).map(m => {
      const box = h('input', {
        type: 'checkbox',
        checked: chosen.has(m.name),
        onchange: e => e.target.checked ? chosen.add(m.name) : chosen.delete(m.name)
      });
      return h('label.mod-toggle', {}, box,
        m.name, m.price ? h('span.muted', {}, ` +${fmt(m.price)}`) : null);
    });

    return h('div.stack', {},
      h('div.row-between', {},
        h('strong', {}, item.name),
        h('span.muted', {}, fmt(item.price))
      ),
      modToggles.length ? h('div', {}, modToggles) : h('div.muted.small', {}, 'no preset options'),
      h('label.field', {}, h('span', {}, 'note'), noteInput),
      h('div.row', { style: 'justify-content:flex-end;margin-top:.5em' },
        h('button', { onclick: () => done(null) }, 'cancel'),
        h('button.primary', {
          onclick: () => done({
            mods: (item.mods || []).filter(m => chosen.has(m.name))
                                   .map(m => ({ name: m.name, price: m.price })),
            note: noteInput.value.trim()
          })
        }, line ? 'save' : 'add')
      )
    );
  });

  if (!result) return;

  if (line) {
    line.mods = result.mods;
    line.note = result.note;
    drawCart();
  } else {
    addLine(item, result);
  }
}

function tapItem(item) {
  if (item.soldOut) return;
  if ((item.mods || []).length) openItemModal(item);
  else addLine(item);
}

/* --- checkout ------------------------------------------------------------- */

async function checkout() {
  if (!cart.lines.length) return;

  const order = {
    id: `o_${Date.now()}_${uid()}`,
    number: nextNumber(),
    name: cart.name.trim(),
    createdAt: Date.now(),
    lines: cart.lines.map(l => ({ ...l })),
    discount: cart.discount,
    tip: 0,
    /* The "tip" here isn't money — see the customer-facing modal below.
       Monetary tip presets are hidden, not deleted, same as payment method
       right below; `tip` (cents) stays reserved for that if it ever comes back. */
    tipChoice: null,
    status: 'queued',
    /* Only Venmo, no tip — this is a home cafe, not a full POS. Payment is
       marked separately, from the "collect" button on the orders tab, once
       it actually lands. Tip presets and other payment methods (cash, comp)
       are hidden, not deleted — see the commented block below to bring them
       back if that ever changes. */
    payment: { method: 'venmo', paid: false, paidAt: null }
  };

  const confirmed = await modal(done => {
    const due = subtotal();
    // const note = venmoNote(order);

    return h('div.stack', {},
      h('div.center.stack', {},
        h('div.muted.small', {}, `order #${order.number}${order.name ? ` · ${order.name}` : ''}`),
        h('div.amount-due', {}, fmt(due))
      ),
      // h('p.small.muted', {}, `have them scan the venmo QR at the register (@${config.venmoUsername}) — note: “${note}”`),
      h('hr'),
      h('div.row', { style: 'justify-content:space-between;margin-top:.5em' },
        h('button', { onclick: () => done(false) }, 'back'),
        h('button.primary', { onclick: () => done(true) }, 'confirm')
      )

      /* ---------------------------------------------------------------
         Tip + payment-method picker (venmo / cash / comp / other) —
         hidden for now, this is a home cafe and everything's Venmo.
         To bring back: restore the tip buttons + method buttons here,
         and drive `order.tip` / `order.payment.method` from them again.
         --------------------------------------------------------------- */
    );
  });

  if (!confirmed) return;

  order.tipChoice = await pickTip();

  await store.putOrder(order);
  cart = newCart();
  drawCart();
  drawName();
}

/* Hand the screen to the customer for this one. Big tappable options, no
   "back" — if they don't want to pick one, tapping outside or Escape skips
   it (modal() resolves null either way). Options come from the menu object
   so they're editable on the Menu tab, live, same as everything else there. */
async function pickTip() {
  const options = menu.tipOptions || [];
  if (!options.length) return null;

  return modal(done =>
    h('div.stack', {},
      h('div.center.stack', {},
        h('div.muted.small', {}, 'for the customer'),
        h('strong', {}, 'leave us a tip?')
      ),
      h('div.stack', { style: 'margin-top:.5em' },
        options.map(opt =>
          h('button.primary', { style: 'width:100%;padding:.9em', onclick: () => done(opt) }, opt))
      ),
      h('div.row', { style: 'justify-content:center;margin-top:.75em' },
        h('button.ghost.tiny', { onclick: () => done(null) }, 'no thanks')
      )
    )
  );
}

/* --- rendering ------------------------------------------------------------ */

function drawGrid() {
  const sections = (menu.sections || []).map(section => {
    const items = section.items || [];
    if (!items.length) return null;
    return h('div', {},
      h('h3.muted', { style: 'margin:.75em 0 .35em' }, section.name),
      h('div.pos-grid', {}, items.map(item =>
        h('button.pos-tile', {
          'data-sold-out': String(!!item.soldOut),
          disabled: !!item.soldOut,
          onclick: () => tapItem(item)
        },
          h('span.t-name', {}, item.name),
          h('span.t-price', {}, item.soldOut ? '86' : fmt(item.price))
        )
      ))
    );
  }).filter(Boolean);

  render(els.grid, sections.length ? sections
    : h('p.muted', {}, 'no menu items yet — add some on the Menu tab'));
}

function drawCart() {
  const lines = cart.lines.map(line => {
    const item = findItem(line.itemId);
    return h('div.cart-line', {},
      h('div.row-between', {},
        h('span.grow', {}, `${line.name}`),
        h('span.qty', {},
          h('button.tiny', { onclick: () => { line.qty--; if (line.qty <= 0) removeLine(line); else drawCart(); } }, '−'),
          h('span', {}, String(line.qty)),
          h('button.tiny', { onclick: () => { line.qty++; drawCart(); } }, '+')
        ),
        h('span.nowrap', { style: 'width:4.5em;text-align:right' }, fmt(lineTotal(line)))
      ),
      line.mods?.length ? h('div.mods', {}, line.mods.map(m => m.name).join(' · ')) : null,
      line.note ? h('div.lnote', {}, `“${line.note}”`) : null,
      h('div.row.small', {},
        item ? h('button.ghost.tiny', { onclick: () => openItemModal(item, line) }, 'edit') : null,
        h('button.ghost.tiny.danger', { onclick: () => removeLine(line) }, 'remove')
      )
    );
  });

  const sub = subtotal();
  const due = total();

  render(els.cart,
    lines.length ? lines : h('p.muted', {}, 'nothing rung up yet'),
    lines.length ? h('div.totals.stack', {},
      h('div.row-between', {}, h('span.muted', {}, 'subtotal'), h('span', {}, fmt(sub))),
      cart.discount ? h('div.row-between', {},
        h('span.muted', {}, 'discount'), h('span', {}, `−${fmt(cart.discount)}`)) : null,
      h('div.row-between.grand', {}, h('span', {}, 'total'), h('span', {}, fmt(due)))
    ) : null
  );

  els.charge.disabled = !lines.length;
  els.charge.textContent = lines.length ? `confirm ${fmt(due)}` : 'confirm';
  els.clear.disabled = !lines.length && !cart.name;
}

function drawName() {
  els.name.value = cart.name;
}

function removeLine(line) {
  cart.lines = cart.lines.filter(l => l !== line);
  drawCart();
}

function findItem(id) {
  for (const s of menu.sections || []) {
    const found = (s.items || []).find(i => i.id === id);
    if (found) return found;
  }
  return null;
}

/* --- mount ---------------------------------------------------------------- */

export function mountPos(root) {
  els = {};
  els.name = h('input', {
    type: 'text', placeholder: 'customer name', autocomplete: 'off',
    oninput: e => { cart.name = e.target.value; els.clear.disabled = !cart.lines.length && !cart.name; }
  });
  els.grid = h('div');
  els.cart = h('div');
  els.charge = h('button.primary', { disabled: true, onclick: checkout }, 'confirm');
  els.clear = h('button.danger', {
    disabled: true,
    onclick: () => {
      if (cart.lines.length && !confirm('Clear this order?')) return;
      cart = newCart();
      drawCart();
      drawName();
    }
  }, 'clear');

  render(root,
    h('label.field', {}, h('span', {}, 'who is this for'), els.name),
    els.grid,
    h('hr'),
    els.cart,
    h('div.row', { style: 'justify-content:space-between;margin-top:1em' },
      els.clear,
      els.charge
    )
  );

  drawGrid();
  drawCart();

  store.onMenu(m => { menu = m || { sections: [], tipOptions: [] }; drawGrid(); drawCart(); });
  store.onOrders(list => { orders = list || []; });
}
