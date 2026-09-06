/* -------------------------------------------------------------------------
   Firebase driver — live sync across every device that opens the page.

   Loaded only when config.firebase is filled in. The SDK comes from Google's
   CDN as an ES module, so the first load needs internet; after that Firestore
   keeps a local cache and queues writes made while offline.
   ------------------------------------------------------------------------- */

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

export async function createFirebaseDriver({ eventId, seedMenu, firebaseConfig }) {
  const { initializeApp } = await import(`${SDK}/firebase-app.js`);
  const {
    initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
    doc, collection, getDoc, getDocs, setDoc, deleteDoc, onSnapshot
  } = await import(`${SDK}/firebase-firestore.js`);

  const app = initializeApp(firebaseConfig);

  /* Offline cache, shared across tabs. If the browser refuses it we still run,
     just without the cache. */
  let db;
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
  } catch (err) {
    console.warn('[store] offline cache unavailable, continuing online-only', err);
    const { getFirestore } = await import(`${SDK}/firebase-firestore.js`);
    db = getFirestore(app);
  }

  const menuRef = doc(db, 'events', eventId, 'config', 'menu');
  const ordersRef = collection(db, 'events', eventId, 'orders');
  const guestsRef = collection(db, 'events', eventId, 'guests');

  return {
    mode: 'cloud',

    async ready() {
      /* Publish the committed menu.json the very first time this event runs,
         so an empty Firestore does not show customers a blank menu. */
      const snap = await getDoc(menuRef);
      if (!snap.exists() && seedMenu) await setDoc(menuRef, seedMenu);
    },

    async getMenu() {
      const snap = await getDoc(menuRef);
      return snap.exists() ? snap.data() : seedMenu;
    },

    async saveMenu(menu) {
      await setDoc(menuRef, menu);
    },

    onMenu(cb) {
      return onSnapshot(
        menuRef,
        snap => cb(snap.exists() ? snap.data() : seedMenu),
        err => console.error('[store] menu listener dropped', err)
      );
    },

    async getOrders() {
      const snap = await getDocs(ordersRef);
      return snap.docs.map(d => d.data());
    },

    async putOrder(order) {
      await setDoc(doc(ordersRef, order.id), order);
    },

    async deleteOrder(id) {
      await deleteDoc(doc(ordersRef, id));
    },

    onOrders(cb) {
      return onSnapshot(
        ordersRef,
        snap => cb(snap.docs.map(d => d.data())),
        err => console.error('[store] orders listener dropped', err)
      );
    },

    async getGuests() {
      const snap = await getDocs(guestsRef);
      return snap.docs.map(d => d.data());
    },

    async putGuest(guest) {
      await setDoc(doc(guestsRef, guest.id), guest);
    },

    async deleteGuest(id) {
      await deleteDoc(doc(guestsRef, id));
    },

    onGuests(cb) {
      return onSnapshot(
        guestsRef,
        snap => cb(snap.docs.map(d => d.data())),
        err => console.error('[store] guests listener dropped', err)
      );
    }
  };
}
