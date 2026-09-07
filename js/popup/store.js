import { config } from './config.js';
import { createLocalDriver } from './drivers/local.js';

/* -------------------------------------------------------------------------
   store — one API, two backends.

   Everything else in the app talks to this and never knows or cares whether
   the data is sitting in localStorage or in Firestore. Swapping drivers is a
   config change, not a rewrite.
   ------------------------------------------------------------------------- */

const EMPTY_MENU = { version: 1, updated: null, sections: [], tipOptions: [] };

/* Messages only ever accumulate, so both drivers cap how much they keep —
   this is that cap, owned in one place so it can't drift between them. */
const MESSAGE_WINDOW = 60;

/* ingredients/note/tags used to be three separate, overlapping fields on a
   menu item — folded into one `description` field. Items saved before that
   change still carry the old fields under their old names until reopened
   and saved in the editor, so stitch those together rather than showing
   nothing. Shared by the editor and the public menu so the fallback can't
   drift between the two. */
export const itemDescription = item =>
  item.description || [item.ingredients, item.note].filter(Boolean).join(' — ');

/* Neither box checked means the item isn't being offered right now — kept
   in the menu data, just not shown. One place to ask, so every screen that
   reads a menu item agrees on what "hidden" means. */
export const isItemHidden = item => !item.morning && !item.evening;

async function loadSeedMenu() {
  try {
    const res = await fetch('data/menu.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[store] could not load data/menu.json', err);
    return EMPTY_MENU;
  }
}

let driverPromise = null;

async function buildDriver() {
  const seedMenu = await loadSeedMenu();
  const eventId = config.eventId || 'popup';

  if (config.firebase) {
    try {
      const { createFirebaseDriver } = await import('./drivers/firebase.js');
      const driver = await createFirebaseDriver({
        eventId, seedMenu, firebaseConfig: config.firebase, messageWindow: MESSAGE_WINDOW
      });
      await driver.ready();
      return driver;
    } catch (err) {
      /* Never let a sync failure take down the register mid-service. */
      console.error('[store] cloud sync failed, falling back to this device only', err);
      const driver = createLocalDriver({ eventId, seedMenu, messageWindow: MESSAGE_WINDOW });
      await driver.ready();
      driver.degraded = true;
      return driver;
    }
  }

  const driver = createLocalDriver({ eventId, seedMenu, messageWindow: MESSAGE_WINDOW });
  await driver.ready();
  return driver;
}

const get = () => (driverPromise ??= buildDriver());

/* -------------------------------------------------------------------------
   Only hand a subscriber data that is actually different from what it last
   saw.

   Firestore re-sends the whole document whenever a listener reconnects, and
   a tab waking back up counts as a reconnect — so pages were tearing down
   and rebuilding their DOM for changes that never happened. The menu should
   redraw when the menu is edited, and not otherwise.

   These payloads are a few KB and arrive a handful of times an hour, so
   comparing them as JSON is cheap and keeps the drivers free of bookkeeping.
   ------------------------------------------------------------------------- */
function distinct(cb) {
  let last;
  return value => {
    const key = JSON.stringify(value ?? null);
    if (key === last) return;
    last = key;
    cb(value);
  };
}

/* Subscribe before the driver resolves; we wire it up once it does. */
function subscribe(method, cb) {
  const deliver = distinct(cb);
  let off = null, cancelled = false;
  get().then(d => { if (!cancelled) off = d[method](deliver); });
  return () => { cancelled = true; off?.(); };
}

export const store = {
  ready: () => get(),

  async mode() {
    const d = await get();
    return d.degraded ? 'degraded' : d.mode;
  },

  async getMenu() { return (await get()).getMenu(); },

  async saveMenu(menu) {
    menu.updated = new Date().toISOString();
    return (await get()).saveMenu(menu);
  },

  onMenu(cb) { return subscribe('onMenu', cb); },

  async getOrders() { return (await get()).getOrders(); },
  async putOrder(order) { return (await get()).putOrder(order); },
  async deleteOrder(id) { return (await get()).deleteOrder(id); },

  onOrders(cb) { return subscribe('onOrders', cb); },

  /* Guests — who is checked in to the room right now. Same shape as orders. */
  async getGuests() { return (await get()).getGuests(); },
  async putGuest(guest) { return (await get()).putGuest(guest); },
  async deleteGuest(id) { return (await get()).deleteGuest(id); },

  onGuests(cb) { return subscribe('onGuests', cb); },

  /* Messages — what the room has been saying. Unlike menu, orders and guests,
     this collection only grows, so both drivers hand back a recent window
     rather than everything. Always oldest-first. */
  async getMessages() { return (await get()).getMessages(); },
  async postMessage(message) { return (await get()).postMessage(message); },

  onMessages(cb) { return subscribe('onMessages', cb); }
};
