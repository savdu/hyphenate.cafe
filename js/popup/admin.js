import { config } from './config.js';
import { store } from './store.js';
import { h, render, $ } from './dom.js';
import { mountPos } from './pos.js';
import { mountOrders } from './orders.js';
import { mountMenuEditor } from './menu-editor.js';
import { mountReport } from './report.js';

/* -------------------------------------------------------------------------
   admin.js — passcode gate + tab shell for POS / orders / menu / report.
   The passcode is trivial to bypass by reading source; it exists to keep
   the register off a phone that gets picked up by a browsing guest, not to
   secure anything. See config.js.
   ------------------------------------------------------------------------- */

const SESSION_KEY = 'hyphenate:admin-unlocked';

const TABS = [
  { id: 'pos', label: 'POS', mount: mountPos },
  { id: 'orders', label: 'orders', mount: mountOrders },
  { id: 'menu', label: 'menu', mount: mountMenuEditor },
  { id: 'report', label: 'report', mount: mountReport }
];

function gate() {
  const app = $('#admin-app');
  const gateBox = $('#admin-gate');
  const unlocked = sessionStorage.getItem(SESSION_KEY) === '1'
    || !config.adminPasscode;

  if (unlocked) {
    gateBox.hidden = true;
    app.hidden = false;
    boot();
    return;
  }

  gateBox.hidden = false;
  app.hidden = true;

  const input = $('#admin-passcode');
  const form = $('#admin-gate-form');
  const error = $('#admin-gate-error');

  form.onsubmit = e => {
    e.preventDefault();
    if (input.value === config.adminPasscode) {
      sessionStorage.setItem(SESSION_KEY, '1');
      gate();
    } else {
      error.textContent = 'wrong passcode';
      input.select();
    }
  };
  input.focus();
}

function statusStrip() {
  const el = $('#status-strip');
  store.mode().then(mode => {
    const label = { cloud: 'synced live', local: 'this device only', degraded: 'sync failed — local only' }[mode] || mode;
    render(el, h('span', { class: `dot ${mode === 'cloud' ? '' : mode}` }, '●'), ` ${label}`);
  });
}

function boot() {
  statusStrip();

  const panels = {};
  const tabBar = h('div.tabs', {}, TABS.map((t, i) => h('button', {
    role: 'tab',
    'aria-selected': String(i === 0),
    onclick: () => selectTab(t.id)
  }, t.label)));

  const panelHost = h('div');
  render($('#admin-tabs'), tabBar);
  render($('#admin-panels'), panelHost);

  for (const t of TABS) {
    panels[t.id] = h('div', { hidden: t.id !== TABS[0].id });
    panelHost.append(panels[t.id]);
  }

  let mounted = new Set();

  function selectTab(id) {
    for (const btn of tabBar.children) {
      btn.setAttribute('aria-selected', String(btn.textContent === TABS.find(t => t.id === id).label));
    }
    for (const t of TABS) panels[t.id].hidden = t.id !== id;
    if (!mounted.has(id)) {
      const tab = TABS.find(t => t.id === id);
      tab.mount(panels[id]);
      mounted.add(id);
    }
  }

  TABS[0].mount(panels[TABS[0].id]);
  mounted.add(TABS[0].id);
}

gate();
