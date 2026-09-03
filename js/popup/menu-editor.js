import { store } from './store.js';
import { toCents, fmt } from './money.js';
import { h, render, modal } from './dom.js';

/* -------------------------------------------------------------------------
   Menu editor — the answer to "the menu may keep changing up to the day of."

   Edits here call store.saveMenu(), which either writes localStorage (this
   device only — use Export/Import to move it) or Firestore (every device
   sees it within a second, no redeploy, no git). Either way menu.html and
   the POS pick it up live via store.onMenu().
   ------------------------------------------------------------------------- */

let menu = { sections: [] };
let els = {};
let dirty = false;

const uid = prefix => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

function markDirty() {
  dirty = true;
  els.saveHint.textContent = 'unsaved changes';
  els.saveHint.style.color = 'var(--color-orange)';
}

async function persist() {
  await store.saveMenu(menu);
  dirty = false;
  els.saveHint.textContent = 'saved';
  els.saveHint.style.color = 'var(--color-green)';
}

/* --- item editing ---------------------------------------------------------- */

async function editItem(section, item) {
  const isNew = !item;
  const draft = item
    ? JSON.parse(JSON.stringify(item))
    : { id: uid('i'), name: '', price: 0, ingredients: '', note: '', tags: [], soldOut: false, mods: [] };

  const result = await modal(done => {
    const nameInput = h('input', { type: 'text', value: draft.name, placeholder: 'oat cortado' });
    const priceInput = h('input', { type: 'number', step: '0.25', min: '0', value: (draft.price / 100).toFixed(2) });
    const ingInput = h('input', { type: 'text', value: draft.ingredients, placeholder: 'espresso, oat milk' });
    const noteInput = h('input', { type: 'text', value: draft.note, placeholder: 'optional flavor note' });
    const tagsInput = h('input', { type: 'text', value: (draft.tags || []).join(', '), placeholder: 'vegan, gluten' });
    const soldOutBox = h('input', { type: 'checkbox', checked: !!draft.soldOut });

    let mods = draft.mods ? draft.mods.map(m => ({ ...m })) : [];
    const modsList = h('div.stack');

    const drawMods = () => {
      render(modsList, mods.map((m, i) => h('div.row', {},
        h('input.grow', {
          type: 'text', value: m.name, placeholder: 'extra shot',
          oninput: e => { m.name = e.target.value; }
        }),
        h('input', {
          type: 'number', step: '0.25', style: 'width:5.5em',
          value: (m.price / 100).toFixed(2),
          oninput: e => { m.price = toCents(e.target.value); }
        }),
        h('button.ghost.tiny.danger', { onclick: () => { mods.splice(i, 1); drawMods(); } }, '✕')
      )),
      h('button.tiny', { onclick: () => { mods.push({ id: uid('m'), name: '', price: 0 }); drawMods(); } }, '+ add-on')
      );
    };
    drawMods();

    return h('div.stack', {},
      h('strong', {}, isNew ? 'new item' : 'edit item'),
      h('label.field', {}, h('span', {}, 'name'), nameInput),
      h('label.field', {}, h('span', {}, 'price'), priceInput),
      h('label.field', {}, h('span', {}, 'ingredients'), ingInput),
      h('label.field', {}, h('span', {}, 'note'), noteInput),
      h('label.field', {}, h('span', {}, 'tags (comma separated)'), tagsInput),
      h('label.mod-toggle', {}, soldOutBox, '86 — sold out today'),
      h('div', {}, h('span.muted.small', {}, 'add-ons'), modsList),
      h('div.row-between', { style: 'margin-top:.5em' },
        isNew ? h('span') : h('button.danger', { onclick: () => done({ deleted: true }) }, 'delete item'),
        h('div.row', {},
          h('button', { onclick: () => done(null) }, 'cancel'),
          h('button.primary', {
            onclick: () => done({
              item: {
                id: draft.id,
                name: nameInput.value.trim() || 'untitled',
                price: toCents(priceInput.value),
                ingredients: ingInput.value.trim(),
                note: noteInput.value.trim(),
                tags: tagsInput.value.split(',').map(t => t.trim()).filter(Boolean),
                soldOut: soldOutBox.checked,
                mods: mods.filter(m => m.name.trim()).map(m => ({ ...m, name: m.name.trim() }))
              }
            })
          }, 'save')
        )
      )
    );
  });

  if (!result) return;

  if (result.deleted) {
    section.items = section.items.filter(i => i.id !== draft.id);
  } else if (isNew) {
    section.items.push(result.item);
  } else {
    Object.assign(item, result.item);
  }
  markDirty();
  drawSections();
  await persist();
}

async function toggleSoldOut(item) {
  item.soldOut = !item.soldOut;
  markDirty();
  drawSections();
  await persist();
}

/* --- section editing -------------------------------------------------------- */

async function renameSection(section) {
  const name = prompt('Section name', section.name);
  if (name === null) return;
  section.name = name.trim() || section.name;
  markDirty();
  drawSections();
  await persist();
}

async function addSection() {
  const name = prompt('New section name', '');
  if (!name || !name.trim()) return;
  menu.sections.push({ id: uid('s'), name: name.trim(), items: [] });
  markDirty();
  drawSections();
  await persist();
}

async function deleteSection(section) {
  if (section.items.length && !confirm(`Delete "${section.name}" and its ${section.items.length} item(s)?`)) return;
  menu.sections = menu.sections.filter(s => s !== section);
  markDirty();
  drawSections();
  await persist();
}

async function move(list, item, dir) {
  const i = list.indexOf(item);
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  markDirty();
  drawSections();
  await persist();
}

/* --- rendering --------------------------------------------------------------- */

function itemRow(section, item) {
  return h('div.row-between', { style: 'padding:.35em 0;border-top:1px dotted var(--color-rule)' },
    h('span.grow', { style: item.soldOut ? 'opacity:.5;text-decoration:line-through' : '' },
      `${item.name} — ${fmt(item.price)}`),
    h('div.row', {},
      h('button.ghost.tiny', { onclick: () => move(section.items, item, -1) }, '↑'),
      h('button.ghost.tiny', { onclick: () => move(section.items, item, 1) }, '↓'),
      h('button.tiny', { onclick: () => toggleSoldOut(item) }, item.soldOut ? 'un-86' : '86'),
      h('button.tiny', { onclick: () => editItem(section, item) }, 'edit')
    )
  );
}

function sectionBlock(section) {
  return h('div', { style: 'margin-bottom:1.25em' },
    h('div.row-between', {},
      h('h3', {}, section.name),
      h('div.row', {},
        h('button.ghost.tiny', { onclick: () => move(menu.sections, section, -1) }, '↑'),
        h('button.ghost.tiny', { onclick: () => move(menu.sections, section, 1) }, '↓'),
        h('button.ghost.tiny', { onclick: () => renameSection(section) }, 'rename'),
        h('button.ghost.tiny.danger', { onclick: () => deleteSection(section) }, 'delete')
      )
    ),
    section.items.map(item => itemRow(section, item)),
    h('button.tiny', { style: 'margin-top:.4em', onclick: () => editItem(section, null) }, '+ add item')
  );
}

function drawSections() {
  render(els.sections,
    menu.sections.map(sectionBlock),
    h('button', { style: 'margin-top:.5em', onclick: addSection }, '+ add section')
  );
}

/* --- import / export --------------------------------------------------------- */

function exportJson() {
  const blob = new Blob([JSON.stringify(menu, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: 'menu.json' });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importJson(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.sections)) throw new Error('missing "sections" array');
    if (!confirm('Replace the current menu with this file?')) return;
    menu = parsed;
    drawSections();
    markDirty();
    await persist();
  } catch (err) {
    alert(`Could not import: ${err.message}`);
  }
}

/* --- mount ------------------------------------------------------------------- */

export function mountMenuEditor(root) {
  els = {};
  els.sections = h('div');
  els.saveHint = h('span.small', {}, '');
  const fileInput = h('input', {
    type: 'file', accept: 'application/json', style: 'display:none',
    onchange: e => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; }
  });

  render(root,
    h('div.row-between', {},
      h('p.small.muted', {}, 'changes save automatically and reach the public menu ',
        h('span', { id: 'sync-scope' }, '')),
      els.saveHint
    ),
    els.sections,
    h('hr'),
    h('div.row', {},
      h('button', { onclick: exportJson }, 'export menu.json'),
      h('button', { onclick: () => fileInput.click() }, 'import menu.json'),
      fileInput
    ),
    h('p.small.muted', {}, 'export gives you a file you can commit to data/menu.json as the new baseline, or hand to another device running local-only mode.')
  );

  store.onMenu(m => {
    if (dirty) return; // don't clobber an in-progress edit if another tab just saved
    menu = m || { sections: [] };
    drawSections();
  });

  store.mode().then(mode => {
    const scope = document.getElementById('sync-scope');
    if (!scope) return;
    scope.textContent = mode === 'cloud'
      ? '(live, on every device)'
      : '(on this device — use export/import to share)';
  });
}
