/* -------------------------------------------------------------------------
   Local driver — localStorage only.

   Everything works, but the data lives on ONE device. Two tabs on the same
   device stay in sync (BroadcastChannel + the storage event); two phones
   do not. Use the Menu tab's Export/Import to move a menu between devices.
   ------------------------------------------------------------------------- */

const KEY = ns => `hyphenate:${ns}`;

const read = (ns, fallback) => {
  try {
    const raw = localStorage.getItem(KEY(ns));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const write = (ns, value) => {
  try {
    localStorage.setItem(KEY(ns), JSON.stringify(value));
    return true;
  } catch (err) {
    console.error('[store] could not save — is storage full or blocked?', err);
    return false;
  }
};

export function createLocalDriver({ eventId, seedMenu }) {
  const menuNs = `${eventId}:menu`;
  const ordersNs = `${eventId}:orders`;

  const menuSubs = new Set();
  const orderSubs = new Set();

  /* Cross-tab notification on the same device */
  let channel = null;
  try {
    channel = new BroadcastChannel(`hyphenate:${eventId}`);
    channel.onmessage = e => {
      if (e.data === 'menu') menuSubs.forEach(cb => cb(read(menuNs, seedMenu)));
      if (e.data === 'orders') orderSubs.forEach(cb => cb(read(ordersNs, [])));
    };
  } catch {
    /* Safari private mode and friends — fall back to the storage event only */
  }

  window.addEventListener('storage', e => {
    if (e.key === KEY(menuNs)) menuSubs.forEach(cb => cb(read(menuNs, seedMenu)));
    if (e.key === KEY(ordersNs)) orderSubs.forEach(cb => cb(read(ordersNs, [])));
  });

  const announce = what => {
    try { channel?.postMessage(what); } catch { /* channel closed */ }
  };

  return {
    mode: 'local',

    async ready() {
      /* Seed the menu from data/menu.json the first time we ever run */
      if (read(menuNs, null) === null && seedMenu) write(menuNs, seedMenu);
    },

    async getMenu() {
      return read(menuNs, seedMenu);
    },

    async saveMenu(menu) {
      write(menuNs, menu);
      menuSubs.forEach(cb => cb(menu));
      announce('menu');
    },

    onMenu(cb) {
      menuSubs.add(cb);
      cb(read(menuNs, seedMenu));
      return () => menuSubs.delete(cb);
    },

    async getOrders() {
      return read(ordersNs, []);
    },

    async putOrder(order) {
      const orders = read(ordersNs, []);
      const i = orders.findIndex(o => o.id === order.id);
      if (i === -1) orders.push(order);
      else orders[i] = order;
      write(ordersNs, orders);
      orderSubs.forEach(cb => cb(orders));
      announce('orders');
    },

    async deleteOrder(id) {
      const orders = read(ordersNs, []).filter(o => o.id !== id);
      write(ordersNs, orders);
      orderSubs.forEach(cb => cb(orders));
      announce('orders');
    },

    onOrders(cb) {
      orderSubs.add(cb);
      cb(read(ordersNs, []));
      return () => orderSubs.delete(cb);
    }
  };
}
