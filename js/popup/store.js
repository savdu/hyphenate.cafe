import { config } from './config.js';
import { createLocalDriver } from './drivers/local.js';

/* -------------------------------------------------------------------------
   store — one API, two backends.

   Everything else in the app talks to this and never knows or cares whether
   the data is sitting in localStorage or in Firestore. Swapping drivers is a
   config change, not a rewrite.
   ------------------------------------------------------------------------- */

const EMPTY_MENU = { version: 1, updated: null, sections: [], tipOptions: [] };

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
        eventId, seedMenu, firebaseConfig: config.firebase
      });
      await driver.ready();
      return driver;
    } catch (err) {
      /* Never let a sync failure take down the register mid-service. */
      console.error('[store] cloud sync failed, falling back to this device only', err);
      const driver = createLocalDriver({ eventId, seedMenu });
      await driver.ready();
      driver.degraded = true;
      return driver;
    }
  }

  const driver = createLocalDriver({ eventId, seedMenu });
  await driver.ready();
  return driver;
}

const get = () => (driverPromise ??= buildDriver());

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

  /* Subscribe before the driver resolves; we wire it up once it does. */
  onMenu(cb) {
    let off = null, cancelled = false;
    get().then(d => { if (!cancelled) off = d.onMenu(cb); });
    return () => { cancelled = true; off?.(); };
  },

  async getOrders() { return (await get()).getOrders(); },
  async putOrder(order) { return (await get()).putOrder(order); },
  async deleteOrder(id) { return (await get()).deleteOrder(id); },

  onOrders(cb) {
    let off = null, cancelled = false;
    get().then(d => { if (!cancelled) off = d.onOrders(cb); });
    return () => { cancelled = true; off?.(); };
  },

  /* Guests — who is checked in to the room right now. Same shape as orders. */
  async getGuests() { return (await get()).getGuests(); },
  async putGuest(guest) { return (await get()).putGuest(guest); },
  async deleteGuest(id) { return (await get()).deleteGuest(id); },

  onGuests(cb) {
    let off = null, cancelled = false;
    get().then(d => { if (!cancelled) off = d.onGuests(cb); });
    return () => { cancelled = true; off?.(); };
  }
};
