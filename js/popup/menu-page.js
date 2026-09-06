import { store } from './store.js';
import { fmt } from './money.js';
import { h, render } from './dom.js';

/* Public menu. Read-only, live: when the menu is edited on admin.html this
   page updates in place (instantly with cloud sync, on reload without it). */

const root = document.getElementById('menu-root');
const stamp = document.getElementById('menu-stamp');

function itemNode(item) {
  const timeTag = item.morning ? 'morning only' : item.evening ? 'evening only' : null;

  return h('div.menu-item', { class: item.soldOut ? 'sold-out' : '' },
    h('div.line', {},
      h('span.name', {}, item.name),
      timeTag && h('span.badge', {}, timeTag),
      h('span.leader'),
      h('span.price.nowrap', {}, fmt(item.price))
    ),
    item.ingredients && h('div.ingredients.small', {}, item.ingredients),
    item.note && h('div.note.small', {}, item.note)
  );
}

function sectionNode(section) {
  const items = section.items || [];
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
