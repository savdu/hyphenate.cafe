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

2. **The `popup` branch** (`menu.html`, `admin.html`, `js/popup/`, `data/`,
   `POPUP.md`) — real day-of tooling for an actual one-day apartment popup:
   a public menu, a POS, and an order tracker. **Read `POPUP.md` first** —
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
  it's still the default `popup-01` (guessable) as of the last session.
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
- Still using default/placeholder values worth changing before the actual
  event: `adminPasscode: 'hyphen'` and `eventId: 'popup-01'` in
  `js/popup/config.js`.
