# running the popup

Everything for day-of operations lives on this `popup` branch. Two pages:

- **`menu.html`** — public menu. Linked from the homepage.
- **`admin.html`** — POS, order tracker, menu editor, day report. Passcode-gated, not indexed.

Data model and every trade-off are documented as comments in the code itself
(`js/popup/store.js`, `js/popup/venmo.js` especially) — this file is the
checklist, not a repeat of that.

## 1. before the day — 15 minutes

1. **Venmo.** Print your Venmo QR code (Venmo app → your profile → the QR
   icon → save/share the image) and post it at wherever checkout happens.
   That QR is static — it opens your profile, nothing more — so the app
   never generates or displays one; it just shows the cashier the exact
   amount and a note to ask the customer to add. Open `js/popup/config.js`
   and set `venmoUsername` (no `@`) so that reminder text is accurate.
2. **Passcode.** Change `adminPasscode` from `hyphen` to something your co-host
   will remember. This is not real security — see the comment in that file —
   just enough to keep a curious guest off the register.
3. **Menu.** Either edit `data/menu.json` directly and commit it, or open
   `admin.html` → Menu tab and build it there (works without touching a
   file — see §3 below on how that reaches the public page).
4. **Decide on sync now, not day-of** — see §2.
5. Push this branch and deploy it (see §4) *before* the popup, then treat
   `admin.html` as the live register from then on.

## 2. local-only vs. live sync — pick one

The register works fully either way. The difference is whether two phones
(you + your co-host) see the same queue.

**Local-only (default, zero setup).** Data lives in that one browser's
`localStorage`. Fine if one person runs the whole register from one device.
Two tabs on the *same* phone/laptop do stay in sync with each other.

**Live sync (recommended if two of you are working the register).**
Free Firebase project, ~10 minutes, once:

1. [console.firebase.google.com](https://console.firebase.google.com) →
   Add project (name doesn't matter, e.g. `hyphenate-popup`) → skip
   Analytics.
2. Build → Firestore Database → Create database → **production mode** → pick
   any region.
3. Rules tab, replace with:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /events/{eventId}/{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
   This means anyone with the project ID can read/write your one event's
   data — acceptable for a one-day popup with an unguessable `eventId`, not
   acceptable to leave running long-term. Wide open is intentional here: a
   locked-down rule set needs auth, and auth is more setup than a day of
   apartment popup service justifies.
4. Project settings (gear icon) → your apps → **Web app** (`</>`) → register
   it → copy the `firebaseConfig` object it gives you.
5. Paste that object into `js/popup/config.js` as the `firebase` value
   (uncomment the block already there).
6. Optionally change `eventId` from `popup-01` to something less guessable,
   since anyone who finds it can read/edit your live orders.

Reload `admin.html` — the status strip at the top should read "synced live".

## 3. changing the menu without redeploying

This was the actual ask, so to be explicit about what "flexible" means here:

- **With live sync on:** edit on the Menu tab of `admin.html`, on *any*
  device. Every open `menu.html` and every register updates within about a
  second. No git, no redeploy, mid-service is fine.
- **Local-only:** edits on the Menu tab save to that device only. Use
  **export menu.json** on the Menu tab to download the file, then either
  commit it as the new `data/menu.json` baseline and redeploy (the
  original ask's "push to main" flow, just with an easier source file), or
  **import menu.json** it into another device's local storage.

Either way, `data/menu.json` is only ever the *seed* — the first thing a
fresh browser or fresh Firestore project loads before any edits are made,
never overwritten automatically afterward. Editing it by hand still works,
it just doesn't propagate live.

## 4. deploying

Same as today: this repo is GitHub Pages via the `CNAME` file, serving
whatever's on `main`. Two options for the popup itself:

- Merge `popup` → `main` and push — `hyphenate.cafe/menu.html` and
  `/admin.html` go live alongside the existing site.
- Or push the `popup` branch and use GitHub Pages' branch selector to
  serve `popup` directly for the day, without touching `main`. Cleaner if
  you'd rather not merge popup-only admin tooling into the permanent site
  history — revert the Pages source back to `main` after.

Either way: **no build step.** Every file here is static HTML/CSS/JS: what's
in the repo is exactly what serves.

## 5. taking payment

Payment runs off the printed Venmo QR from §1, not anything the app draws —
you have a printer, so a static sign beats a generated code. At checkout on
`admin.html`, the charge screen shows the exact amount due and a suggested
note (order number + customer name) for the cashier to read out — "that'll
be $12.50, note it '-hyphenate #7 · Jane' so I can find it." Same pattern
on the order tracker's "collect" button for orders that were queued unpaid.
There's no dynamic QR, no NFC tag, and no per-order link anywhere — one
printed sign, reused all day.

## 6. day-of runbook

- Keep `admin.html` open on the phone/tablet running the register. Tap
  through the passcode gate once — it stays unlocked for that browser tab's
  session.
- **POS tab:** tap items → adjust mods/notes/qty → charge → shows the amount
  due and Venmo note → take payment or queue it for later → order drops
  into the tracker.
- **orders tab:** three lanes — making / ready / picked up — plus an unpaid
  total at the top so nothing gets forgotten. "collect" on any ticket
  reopens that order's amount + note.
- **report tab:** running gross, tips, breakdown by payment method, and a
  best-sellers table. Print it at the end of the day (browser print — it's
  formatted for that) as your own record.
- If wifi drops: local-only mode doesn't care (never touched the network).
  Live-sync mode queues writes and catches up once the connection is back —
  don't force-refresh mid-outage or you'll wait on that catch-up.

## alternates & extras considered, not built

Things a cafe owner would ask for, that felt out of scope for a one-day
apartment popup — noted here rather than silently dropped:

- **Real Venmo webhook confirmation.** Venmo has no public API for personal
  accounts; there's no way to *verify* a payment landed, only to prompt for
  one. Every POS at this scale (Square included, for cash) ultimately
  relies on the operator's eyes confirming payment — this app matches that,
  it doesn't shortcut it.
- **Texted/emailed receipts.** Would mean integrating something like
  Twilio for SMS — real setup cost, real ongoing cost, for a one-day
  apartment popup. Explicitly out of scope.
- **NFC tag / customer-facing dynamic payment page.** Explored and dropped:
  the natural version needs the customer's *own* phone to look up their
  order live (so it only works with Firebase sync, adds a whole extra
  page, and still isn't as simple as a QR sign your printer already
  handles). The printed static QR in §5 does the same job with zero code.
- **Multi-event / historical reports.** `eventId` in config exists so this
  could run again for a second popup without data bleeding into the old
  one, but there's no cross-event dashboard — one popup's worth of state is
  all this was built for.
- **Guest-facing order status page** ("your order is ready!") — skipped for
  scope; the ready/picked-up lanes on the tracker cover it operationally
  from your side, and it's a small enough apartment that calling names
  works.
