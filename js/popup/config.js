/* -------------------------------------------------------------------------
   popup config — edit this file, not the code.
   ------------------------------------------------------------------------- */

export const config = {
  /* Payment is via a static Venmo QR code you print and post at the
     register — see POPUP.md. venmoUsername (no leading @) is shown on the
     checkout/collect screens so the cashier can confirm the customer is
     scanning the right sign; it doesn't generate any link or QR itself. */
  venmoUsername: 'your-venmo-handle',

  /* Passcode for admin.html. This hides the admin UI from casual snooping.
     It is NOT real security — anyone can read it in the page source.
     For a one-day apartment popup that is fine. */
  adminPasscode: 'hyphen',

  /* Suggested tip percentages on the checkout screen. [] hides tipping. */
  tipPresets: [0, 10, 15, 20],

  /* Door code for checkin.html — post it on a card at the door. Same deal as
     adminPasscode: it's a doorman, not security. It exists so the room fills
     with people who are actually in your apartment, rather than anyone who
     stumbles onto hyphenate.cafe/checkin. Entered once per phone. */
  checkinCode: 'here',

  /* Prices in data/menu.json are tax-inclusive — keep the number on the
     menu the number people pay. A popup out of your apartment is not a
     registered retail operation, so there is no separate tax calculation
     to wire up here. */

  /* ---------------------------------------------------------------------
     SYNC. Live sync across phones via Firestore — set up per POPUP.md §2.
     Set to null to fall back to local-only (single device).
     --------------------------------------------------------------------- */
  firebase: {
    apiKey: 'AIzaSyBDgbGxEoq3pQJm0d2iU4b8rEc0MGsJVHM',
    authDomain: 'hyphenate-cafe.firebaseapp.com',
    projectId: 'hyphenate-cafe',
    storageBucket: 'hyphenate-cafe.firebasestorage.app',
    messagingSenderId: '1045036108152',
    appId: '1:1045036108152:web:f1b18406c839edff9a208d'
  },

  /* Namespace for the data, in case you run a second popup later.

     This namespaces EVERYTHING — menu, orders, and the check-in room.
     Changing it points the app at a new namespace, which seeds itself from
     data/menu.json — but only for as long as that namespace is empty. So
     pull the live menu down into data/menu.json BEFORE changing this, every
     time; CLAUDE.md has the read command and the re-seed steps.

     'popup-01' is the previous namespace. It still holds live data and was
     being edited as recently as 2026-09-06 — it is not a throwaway. */
  eventId: '20260912_hyphenate'
};
