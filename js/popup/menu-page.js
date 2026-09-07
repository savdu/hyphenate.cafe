import { store, itemDescription, isItemHidden } from './store.js';
import { fmt } from './money.js';
import { h, render } from './dom.js';

/* Public menu. Read-only, live: when the menu is edited on admin.html this
   page updates in place (instantly with cloud sync, on reload without it). */

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

store.onMenu(draw);
