# running the popup

Everything for day-of operations lives on this `popup` branch. Three pages:

- **`menu.html`** — public menu. Linked from the homepage.
- **`admin.html`** — POS, order tracker, menu editor, day report. Passcode-gated, not indexed.
- **`checkin.html`** — the guest-facing room: attendees check in as an ASCII
  figure and see everyone else who's there. Door-code gated. See §7.

Data model and every trade-off are documented as comments in the code itself
(`js/popup/store.js`, `js/popup/pos.js` especially) — this file is the
checklist, not a repeat of that. See `CLAUDE.md` at the repo root for the
fuller architecture write-up.

## 1. before the day — 10 minutes

1. **Sync.** Firebase is already set up and live (see §2) — you don't need
   to do anything here unless it's a fresh browser/device that's never
   opened `admin.html` before, in which case just open it once and confirm
   the status strip at the top reads **"synced live"**.
2. **Passcodes.** Two of them, both in `js/popup/config.js`, both still at
   their defaults:
   - `adminPasscode` (`hyphen`) — change it to something your co-host will
     remember. Keeps a curious guest off the register.
   - `checkinCode` (`here`) — the door code for the check-in room (§7). This
     one gets *shared*, so pick something you're happy writing on a card and
     leaving by the door.

   Neither is real security — see the comments in that file — and both are
   readable in the page source. That's fine for an apartment popup.
3. **`eventId`.** Done — it's now `20260912_hyphenate` in
   `js/popup/config.js`, no longer the guessable `popup-01`. The Firestore
   rules are wide open (anyone with the ID can read/write), so this is the
   only thing actually gating your live data. See §2.

   Two things to know if you ever change it again. It namespaces *everything*
   — menu, orders, and the check-in room — so a fresh id starts with an empty
   menu and re-seeds from `data/menu.json`. And that's why `data/menu.json`
   now holds your real menu rather than the original placeholder items: the
   menu you'd built under `popup-01` was copied into it first, so the new
   namespace seeded itself correctly. Do the same copy before any future
   change, or you'll serve guests the seed. The old `popup-01` data is still
   in Firestore, untouched.
4. **Menu.** Open `admin.html` → Menu tab and build it there. Since sync is
   live, this reaches `menu.html` and the POS on every device within about
   a second — see §3.
5. Push this branch and deploy it (see §4) *before* the popup, then treat
   `admin.html` as the live register from then on.

## 2. sync — Firebase, already live

Every device that opens `admin.html` sees the same menu and the same order
queue in real time — that's what "synced live" in the status strip means.
This was set up once already; the notes below are for reference (a second
popup, a fresh Firebase project, or troubleshooting), not something you need
to redo.

**How it was set up:**

1. [console.firebase.google.com](https://console.firebase.google.com) →
   Add project → skip Analytics.
2. Build → Firestore Database → Create database → production mode → any
   region.
3. Rules tab, set to:
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
   Anyone who knows your project's `eventId` can read/write that event's
   data — acceptable for a one-day popup with an unguessable `eventId`
   (see §1.3), not acceptable to leave running long-term. Wide open is
   intentional: a locked-down rule set needs auth, which is more setup than
   a day of apartment popup service justifies.
4. Project settings (gear icon) → your apps → **Web app** (`</>`) → register
   it → copy the `firebaseConfig` object into `js/popup/config.js` as the
   `firebase` value.

**If Firebase ever fails to initialize** (bad config, project deleted, no
internet on first load), the app automatically falls back to local-only
mode for that device — data lives in that browser's `localStorage` instead,
silently, so a sync problem never takes the register down mid-service. The
status strip will say so if it happens. There's no user-facing export/import
UI for moving data off local-only mode right now (it exists in
`menu-editor.js`, commented out, not deleted) — if you ever need it back,
that's where to look.

## 3. changing the menu, live

Edit on the Menu tab of `admin.html`, on *any* device. Every open
`menu.html` and every register picks it up within about a second — no git,
no redeploy, mid-service is fine. Also editable there: sold-out toggles,
morning/evening tags (informational badges shown on the public menu — they
don't restrict what's orderable in the POS; an item tagged "morning" is
still tappable all day), and the **customer tip options** list used by the
tip-choice screen (see §5).

`data/menu.json` is only ever the *seed* — the first thing a fresh browser
or fresh Firestore project loads before any edits are made, never
overwritten automatically afterward. Editing it by hand and redeploying
still works, it just doesn't propagate live to devices already running.

## 4. deploying

Same as today: this repo is GitHub Pages via the `CNAME` file, serving
whatever's on `main`. Two options for the popup itself:

- Merge `popup` → `main` and push — `hyphenate.cafe/menu` and `/admin` go
  live alongside the existing site (GitHub Pages resolves both with and
  without `.html`).
- Or push the `popup` branch and use GitHub Pages' branch selector to serve
  `popup` directly for the day, without touching `main`. Cleaner if you'd
  rather not merge popup-only admin tooling into the permanent site
  history — revert the Pages source back to `main` after.

Either way: **no build step.** Every file here is static HTML/CSS/JS: what's
in the repo is exactly what serves.

## 5. taking payment, and the tip

This is a friends-only home cafe, so the app doesn't track or confirm
payment at all — it assumes the money shows up. There's no "unpaid" status
and no "collect" step; once an order is confirmed, it just goes straight to
the tracker. (This is a deliberate simplification, not a missing feature —
if that assumption ever stops holding, `pos.js`, `orders.js`, and
`report.js` each have the original payment-confirmation UI intact in
comments, with a note on exactly what to uncomment.)

What confirming an order actually does, on the POS tab:

1. Tap items, adjust mods/notes/qty, tap **confirm $X** — shows the order
   number, name, and total for a last look, with **back** to keep editing.
2. Tap **confirm** again → a *second* modal opens, this one meant to be
   turned toward the customer: **"leave us a tip?"** with big buttons for
   whatever's in the tip options list (default: compliment, handshake, a
   funny story) plus a quiet "no thanks." Whatever they pick — or skip —
   gets saved on the order and shown on its ticket in the tracker.
3. The order drops into the queue.

However you actually collect money (Venmo, cash, whatever you two work out
in person) is entirely off-app now — nothing here prompts for it or a
method. `js/popup/venmo.js` and the `venmoUsername` config value are
currently unused by the live UI (part of the same hidden payment-confirmation
feature) — safe to ignore unless that comes back.

## 6. day-of runbook

- Keep `admin.html` open on the phone/tablet running the register. Tap
  through the passcode gate once — it stays unlocked for that browser tab's
  session.
- **POS tab:** tap items → adjust mods/notes/qty → confirm → hand the screen
  over for the customer's tip pick (§5) → order drops into the tracker.
- **orders tab:** three lanes — making / ready / picked up. Tap through
  status as you go; delete a ticket if it was a mistake.
- **report tab:** running order count and gross, a best-sellers table, and a
  tally of tips collected (by which playful option was picked, not money).
  There's no on-screen print button right now (commented out, not deleted,
  in `report.js`) — a screenshot of the tab covers the same need.
- If wifi drops: Firestore queues writes locally and catches up once the
  connection is back — don't force-refresh mid-outage or you'll wait on
  that catch-up. Worst case, the automatic local-only fallback from §2
  keeps the register usable on that one device until it reconnects.

## 7. the check-in room

`checkin.html`, linked from the homepage under the menu link and from the
bottom of the menu. It's the homepage's ASCII cafe, populated by the people
actually in your apartment: a guest picks what they're up to, gets a figure,
and stands in a room with everyone else who's checked in.

**What you need to do:** write the `checkinCode` (§1.2) on a card and put it
by the door. That's it — there's nothing to run and nothing to watch.

**What a guest does:**

1. Enters the door code. Asked once per phone, then remembered.
2. Picks what they're up to from four poses: just chilling, looking for a
   friend, reading, catching up on the gossip. Three come straight from the
   homepage; reading is new. Seven more were built and are commented out at
   the bottom of `js/popup/activities.js` — uncommenting one puts it back,
   safely, even mid-event.
3. Types a name and optionally picks a customization — one of six symbols
   that floats above their figure — with a live preview before committing.
   There's no free-text emoji field: it's a fixed set, so there's nothing
   to moderate and nothing that fails to render next to the ASCII.
4. Lands in the room, which works like a small chat room. There's a box
   under *what's happening*: type into it and what you say does two things at
   once — it becomes the note floating above your figure, and it joins the
   conversation below. The log keeps everything said, oldest at the top and
   newest against the box; your figure shows only your latest.
5. Tapping their own figure is now just for changing what they're up to, or
   heading out. Name and customization are set once, on the way in.

Tapping *someone else's* figure just shows their details — messaging between
guests is the next phase, not built yet.

**Things worth knowing:**

- **Identity is the phone.** A random id in that browser's storage is the
  whole model — no accounts. Same phone, same figure; a different phone or a
  cleared browser means a new figure. Someone who heads out and comes back
  gets their name and customization prefilled.
- **Nobody is auto-removed.** A figure stays until its owner taps "head out".
  Anyone who hasn't touched the page in 90 minutes fades and sinks to the
  bottom of the room rather than disappearing — they might just be talking to
  someone. The whole room resets when `eventId` changes.
- **There is no moderation tool.** If someone puts something rude in a note,
  there's no button for you to remove it — the door code is the only control.
  Adding a Room tab to admin would be small if you ever want it (see
  CLAUDE.md); it just wasn't worth building for a friends-only day.
- **If sync is down**, guests see a line saying the room isn't syncing, so an
  empty room reads as a fault rather than as being early.
- **Coming back to a sleeping phone.** iOS freezes a page when you switch
  apps or lock the screen, and the live connection doesn't always wake with
  it. The room re-reads itself whenever you return after more than a few
  seconds away, so nobody has to know to pull-to-refresh.

## alternates & extras considered, not built

Things a cafe owner would ask for, that felt out of scope for a one-day
apartment popup — noted here rather than silently dropped:

- **Real Venmo webhook confirmation.** Venmo has no public API for personal
  accounts; there's no way to *verify* a payment landed, only to prompt for
  one — and this build doesn't even prompt anymore (§5). Every POS at this
  scale ultimately relies on the operator's judgment; this one just says so
  plainly instead of faking a confirmation step.
- **Texted/emailed receipts.** Would mean integrating something like
  Twilio for SMS — real setup cost, real ongoing cost, for a one-day
  apartment popup. Explicitly out of scope.
- **NFC tag / QR codes / customer-facing dynamic payment page.** Explored
  and dropped early on. Now moot — see §5, payment collection is fully
  off-app.
- **Multi-event / historical reports.** `eventId` in config exists so this
  could run again for a second popup without data bleeding into the old
  one, but there's no cross-event dashboard — one popup's worth of state is
  all this was built for.
- **Guest-facing order status page** ("your order is ready!") — skipped for
  scope; the ready/picked-up lanes on the tracker cover it operationally
  from your side, and it's a small enough apartment that calling names
  works.
- **Guest-to-guest messaging in the check-in room.** Direct chat, nudging
  someone's figure, and an evening wine-tasting signup are all deliberately
  the *next* phase — §7 ships onboarding, the room, changing your activity,
  and public notes. The guest sheet is where the first two would go. Note the
  live menu already advertises "wine tasting — INQUIRE FOR SCHEDULE", so a
  signup has a real job waiting for it.

- **Monetary tips / payment-method breakdown.** Built once, then
  deliberately simplified away for a friends-only event — see §5 and the
  commented-out blocks in `pos.js`/`orders.js`/`report.js` if it's ever
  worth reviving.
