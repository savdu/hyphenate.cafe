import { store, itemDescription, isItemHidden } from './store.js';
import { fmt } from './money.js';
import { h, render } from './dom.js';

/* Public menu. Read-only, live: when the menu is edited on admin.html this
   page updates in place (instantly with cloud sync, on reload without it).

   The first paint deliberately does NOT wait for the store. data/menu.json is
   a static file on this origin, so it needs no Firebase and no network beyond
   the one that served the page — it renders immediately, and the live menu
   replaces it a moment later.

   This matters because the failure that actually bites is a hang, not an
   error. A refused request is caught and falls back in a tenth of a second;
   a request that is accepted and never answered — flaky wifi, a captive
   portal, a bad cell handoff — leaves the driver promise pending forever,
   so a subscriber alone would sit on "loading the menu…" until the guest
   thought to hard-refresh. A guest standing at the counter should never see
   that. Worst case now they see the committed menu instead of the live one. */

const root = document.getElementById('menu-root');
const stamp = document.getElementById('menu-stamp');

function timeTag(item) {
  if (item.morning && item.evening) return 'all day';
  if (item.morning) return 'morning only';
  if (item.evening) return 'evening only';
  return null;
}

function itemNode(item) {
  const description = itemDescription(item);

  return h('div.menu-item', { class: item.soldOut ? 'sold-out' : '' },
    h('div.line', {},
      h('span.name', {}, item.name),
      h('span.badge', {}, timeTag(item)),
      h('span.leader'),
      h('span.price.nowrap', {}, fmt(item.price))
    ),
    description && h('div.description.small', {}, description)
  );
}

function sectionNode(section) {
  /* Hidden items (see store.js) are off the public menu entirely, not just
     unbadged. */
  const items = (section.items || []).filter(item => !isItemHidden(item));
  if (!items.length) return null;
  return h('section.menu-section', {},
    h('h2', {}, section.name),
    items.map(itemNode)
  );
}

function draw(menu) {
  const sections = (menu?.sections || []).map(sectionNode).filter(Boolean);

  render(root, sections.length
    ? sections
    : h('p.muted.center', {}, 'the menu is being set up — check back in a minute'));

  if (menu?.updated) {
    const when = new Date(menu.updated);
    render(stamp, `menu as of ${when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
  } else {
    render(stamp, '');
  }
}

let liveMenuArrived = false;

store.onMenu(menu => { liveMenuArrived = true; draw(menu); });

/* Whichever wins, the live menu wins — the seed must never paint over it if
   the fetch happens to resolve second. */
fetch('data/menu.json', { cache: 'no-store' })
  .then(res => res.json())
  .then(seed => { if (!liveMenuArrived) draw(seed); })
  .catch(() => { /* the store is still coming; leave the loading line up */ });
