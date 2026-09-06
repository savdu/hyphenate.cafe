# CLAUDE.md — hyphenate.cafe

Project-specific context. See `/Users/savannahdu/workspace/CLAUDE.md` for
workspace-wide conventions (this is a personal/learning project — prefer
clear explanations over jargon).

## What this is

Two things sharing one repo:

1. **The concept site** (`index.html`, `js/scene/`, `js/story/`) — an ASCII-art
   interactive homepage for a cafe/wine-bar/third-space concept called
   `-hyphenate`. Clickable figures launch small forward/back navigable
   storylines. This part is stable; not actively being extended right now.

2. **The `popup` branch** (`menu.html`, `admin.html`, `checkin.html`,
   `js/popup/`, `data/`, `POPUP.md`) — real day-of tooling for an actual
   one-day apartment popup: a public menu, a POS, an order tracker, and a
   guest-facing check-in room that borrows the concept site's figures.
   **Read `POPUP.md` first** —
   it's the operational runbook (setup checklist, Firebase walkthrough,
   day-of instructions, and a list of features deliberately left out of
   scope). This CLAUDE.md is the architecture/why; POPUP.md is the how-to.

No build step anywhere. Everything is static HTML/CSS/vanilla-JS ES modules,
deployed via GitHub Pages (`CNAME` → hyphenate.cafe). What's in the repo is
exactly what serves — confirmed live that GitHub Pages also resolves
extensionless URLs (`hyphenate.cafe/menu` works, no `.html` needed).

## Styling conventions

Atom One Light palette (CSS custom properties in `:root`), Menlo monospace,
`font-size: small` for body copy. `css/main.css` is the concept site;
`css/popup.css` is a separate sheet for the popup pages — same palette,
bigger tap targets since admin.html runs on a phone/iPad all day. Form
inputs are pinned to `font-size: 16px` specifically (not `small`) to avoid
iOS Safari's auto-zoom-on-focus below that threshold.

## `js/popup/` architecture

- **`store.js`** — the only thing every popup page talks to for data. One
  API (`getMenu`/`saveMenu`/`onMenu`, `getOrders`/`putOrder`/`deleteOrder`/
  `onOrders`), two swappable backends:
  - `drivers/local.js` — localStorage + BroadcastChannel, zero setup,
    single-device only.
  - `drivers/firebase.js` — Firestore, live sync across devices, loaded
    only when `config.js`'s `firebase` object is set. Falls back to local
    automatically if cloud init throws (`driver.degraded = true`).
  - `data/menu.json` is only ever the **seed** — first-load default, never
    overwritten automatically after that. The live menu lives in whichever
    driver is active.
- **`config.js`** — the one file meant to be hand-edited: Venmo handle,
  admin passcode, tip presets (currently unused, see below), Firebase
  credentials, `eventId` (Firestore namespace).
- **`money.js`** — all money as integer cents. `orderSubtotal`/`orderTotal`
  are the shared formulas; don't reintroduce per-file duplicates of them.
- **`dom.js`** — tiny `h()`/`render()` hyperscript helpers and a `modal()`
  promise-based dialog. No framework.
- **pages**: `menu-page.js` (public, read-only), `pos.js` (cart + checkout),
  `orders.js` (fulfillment queue), `menu-editor.js` (live menu editing),
  `report.js` (day tally). `admin.js` is the passcode gate + tab shell that
  mounts all four of the admin-only ones lazily on first tab click.
- **check-in room** (`checkin.html`): `checkin.js` is the controller — three
  states in order, door code → onboarding → room. `activities.js` is the
  roster of poses, `guest.js` is identity + the write actions, `room.js`
  renders the floor and the guest sheets. Guests are a third collection in
  the store alongside menu and orders (`getGuests`/`putGuest`/`deleteGuest`/
  `onGuests`), implemented in both drivers the same way. No Firestore rules
  change was needed — the existing rule already matches
  `events/{eventId}/{document=**}`.

## Design decisions that aren't obvious from the code alone

- **No QR codes, no NFC.** Originally built with dynamic per-order Venmo
  QR codes and an NFC-tag-to-customer-phone flow (`pay.html`, since
  deleted). The user has a printer and prints a **static** Venmo QR to
  post at the register instead — the app's job is just to show the exact
  amount + a suggested note, nothing more. Don't reintroduce QR generation
  without checking this is still true.
- **Payment tracking is commented out, not deleted**, in `pos.js`,
  `orders.js`, and `report.js`. This is a friends-only home cafe — money is
  assumed to show up without the app confirming/tracking it. No "UNPAID"
  status, no "collect" button, no payment-method breakdown. Every order
  still carries `payment: {method:'venmo', paid:false, paidAt:null}` in
  the data model (untouched) so this is a straightforward uncomment if
  that assumption ever stops holding. Same pattern for monetary tip
  presets and the cash/comp/other payment-method picker — search each file
  for the block comments explaining exactly what to restore.
- **"Tip" is not money.** The `pickTip()` step in `pos.js` shows a *second*,
  customer-facing modal after the admin confirms an order — big buttons for
  playful non-monetary options (default: compliment / handshake / a funny
  story), stored as `order.tipChoice` (string). The options list itself
  lives on the menu object (`menu.tipOptions`), editable live from the Menu
  tab in admin, synced the same way menu items are. The numeric `order.tip`
  field (cents) is a separate, still-hidden concept — don't conflate them.
- **Morning/evening tags are informational only.** `item.morning` /
  `item.evening` on a menu item render as badges on the public menu but
  **do not gate what's orderable** in the POS grid — confirmed explicitly
  (an item tagged "morning" must still be tappable/orderable in the
  evening, e.g. iced tea). Don't add filtering logic tying these to POS
  availability without checking this is still wanted.
- **Firestore security rules are wide open** (`allow read, write: if true`)
  by design for a one-day popup — see POPUP.md §2 for the reasoning and the
  exact rules text. `eventId` in config.js is the only thing gating access;
  it is now `20260912_hyphenate` rather than the guessable `popup-01`.

- **`eventId` namespaces the menu, not just orders.** Changing it points the
  app at an empty namespace, which the Firebase driver then seeds from
  `data/menu.json` — but **only while that namespace is empty**. Once it holds
  a `config/menu` document, editing `data/menu.json` does nothing to it. So
  the copy has to happen before the switch: pull the live menu down into
  `data/menu.json`, then move `eventId`.

  Done twice now. The second time (2026-09-06) the `eventId` change had been
  left uncommitted, so the deployed site went on writing to `popup-01` and the
  real menu kept being edited there — `popup-01` is no longer the untouched
  original this file used to claim it was. Re-seeding `20260912_hyphenate`
  from the freshly pulled `data/menu.json` meant deleting its existing
  `config/menu` document and then loading the app from a *local* server, since
  that namespace had already been seeded with an older menu and the deployed
  site serves `main`'s older `data/menu.json`.

  There is no export button — the Export/Import block in `menu-editor.js` is
  commented out. Pulling the live menu down is a plain REST read:
  `GET https://firestore.googleapis.com/v1/projects/hyphenate-cafe/databases/(default)/documents/events/<eventId>/config/menu?key=<apiKey>`
  returns Firestore's typed encoding (`{"integerValue": "500"}`), so the values
  have to be unwrapped before the result is a usable `data/menu.json`.

- **The check-in room reuses the homepage cast by import.**
  `js/popup/activities.js` imports `figures` from `js/scene/figures.js` and
  re-labels them by *activity* rather than identity — the concept site stays
  the single source of truth and renders exactly as before. Room-only poses
  (currently just "reading") live in `activities.js`; don't add them to
  `figures.js` or they'll turn up on the homepage.

- **Presence is written on actions only — never on a timer.** Every guest
  write fans out as one billed Firestore read to every phone watching the
  room, so a heartbeat poll is quietly expensive: at ~40 guests a 60-second
  heartbeat is roughly 100k reads *per hour* against a 50k/day free tier.
  `lastSeen` is therefore only written when someone actually does something,
  and "stepped out" is computed client-side from it (`STALE_MS`, 90 min).
  Don't add a heartbeat without doing that arithmetic again.

- **Buttons built by `h()` inside a `<form>` need an explicit
  `type: 'button'`.** A button with no type defaults to submit. This bit
  once already: tapping a customization emoji during check-in submitted the
  onboarding form and checked the guest straight in, skipping name
  validation. The activity tiles and emoji options both set it now.

- **The room re-reads itself on wake, and that costs reads.** iOS Safari
  freezes a backgrounded page and its Firestore socket does not reliably
  come back, which shows up as a room that looks stale until you reload —
  the exact thing a guest won't think to do. `mountRoom` listens for
  `visibilitychange` and for a `persisted` `pageshow` (bfcache) and re-reads
  the room directly. It deliberately skips absences under 5 seconds, because
  each re-read bills a Firestore read per guest and a quick glance at
  another app isn't worth paying for. Note this was never reproduced in
  headless Chromium — not on the local driver, not on live Firestore, not
  across two devices — so it is a fix aimed at the one environment that
  could not be tested here.

- **Pose art distinguishes leading from trailing spaces.** `poseText` in
  `activities.js` strips trailing spaces before centring, but never leading
  ones. The homepage figures encode animation in their leading spaces — the
  waving figure raises its arm by shifting its face a column — while their
  trailing spaces are only padding from the fixed homepage scene, where each
  figure sat in a fixed column. Treating both alike left the waving figure's
  shoulders a character off from its head. Faces and bodies are each shifted
  by one constant amount per pose, not per frame, so the torso holds one
  column while the arm moves around it.

- **Name and customization are set at check-in and not editable after.**
  The sheet in the room offers activity, note, and head out — nothing else.
  `editDetails` and its branch are commented out in `room.js` with restore
  instructions, and `guest.setDetails()` is still exported and working. The
  customization set is fixed (no free-text emoji): one less thing to
  moderate, and one less way to get a glyph that won't render in Menlo.

- **The activity list is four, with seven more commented out.**
  `js/popup/activities.js` keeps the cut poses in a comment block rather
  than deleting them, same convention as the payment code. `activityById`
  falls back to the first activity, so a guest still checked in under a
  retired id renders as "just chilling" rather than breaking — which is what
  makes restoring one mid-event safe.

- **There is no moderation tool for the room.** A guest's name and note are
  whatever they type, and only the door code stands in front of that. An
  admin Room tab (a list plus `deleteGuest`, mirroring the orders tab) is
  the obvious first addition; the data model already supports it. Left out
  deliberately for a friends-only day, not overlooked.
- **`config.js` currently holds live Firebase credentials** for a real
  project (`hyphenate-cafe`). The API key itself isn't a secret (normal for
  client-side Firebase), but treat the project as live/real, not a fixture
  — don't write test data into it without cleaning up after (see next
  section for the pattern used to avoid this).

## Testing this project

No test suite. Verification in this project has been: spin up
`python3 -m http.server 8080` from the repo root, then drive it with
Playwright (Chromium for logic/flow checks, WebKit + an iPad viewport/UA
for Safari-specific checks — auto-zoom-on-focus, `:has()`, `BroadcastChannel`
support, touch-tap interaction). Scratch driver scripts for this don't live
in the repo; they were written ad hoc in a scratchpad directory per session.

**Playwright may not actually be runnable.** As of the check-in session this
machine had only Node v14 (Playwright needs 18+) and no reachable package
index, so neither `npm` nor `pip` could install it. The browsers it cached
are still there and still fine, at
`~/Library/Caches/ms-playwright/chromium-1140/…/Chromium`. The way around it
was a ~180-line stdlib-only Chrome DevTools Protocol client (launch headless
with `--remote-debugging-port`, hand-roll the WebSocket frames, then drive
everything through `Runtime.evaluate` and `Page.captureScreenshot`). Two
things that cost time and would again: use a per-run debugging port and
profile, or a browser left over from a crashed run gets reused and silently
carries its `localStorage` into the next one; and the WebKit build in that
cache is a `Playwright.app` that needs Playwright's own driver, so
**Safari-specific checks were not possible that session** — the CSS added
for the room (`-webkit-line-clamp`, `overflow-wrap: anywhere`, flex `gap`)
is unverified on real Safari.

**Because `config.js` normally points at the real Firebase project**, any
test that touches `admin.html` end-to-end will write to live data unless
you first temporarily blank out the `firebase` block (swap it for
`firebase: null`, exercise the flow against local-only mode, then restore
the original config.js byte-for-byte — diff against a backup to confirm).
Don't skip the restore step.

## Current state (as of the last session)

- `popup` branch is pushed to `origin/popup` and has been merged/pushed to
  `main` once already (fast-forward, no conflicts) — GitHub Pages serves
  from `main`. Further popup work should continue on the `popup` branch and
  get merged to `main` again when ready for the next deploy.
- `eventId` is `20260912_hyphenate` on `popup`, and `data/menu.json` holds the
  real menu, re-pulled from the live project on 2026-09-06 — 12 items (cold
  brew, pour over, egg sandwich, parfair bar, sofia's choice…). Both that
  namespace and `popup-01` now serve exactly that menu. **`main` is still on
  `eventId: 'popup-01'`**, so the deployed site keeps reading and writing
  there until `popup` is merged.
- Still at their defaults in `js/popup/config.js`, both worth changing before
  the event: `adminPasscode: 'hyphen'`. `checkinCode` is now `here`.
- The check-in room ships onboarding, the room, changing your activity, and
  public notes. Guest-to-guest messaging, nudges, and the wine-tasting signup
  are the intended next phase — see POPUP.md §7.
