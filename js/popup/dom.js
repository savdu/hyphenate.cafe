/* Tiny DOM helpers. No framework — the whole app is a few hundred lines. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* h('div.cart-line', {onclick}, child, child) */
export function h(spec, props = {}, ...children) {
  const [tag, ...classes] = spec.split('.');
  const node = document.createElement(tag || 'div');
  if (classes.length) node.className = classes.join(' ');

  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = [node.className, v].filter(Boolean).join(' ');
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k in node && k !== 'list' && k !== 'type') node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }

  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const clear = node => { while (node.firstChild) node.removeChild(node.firstChild); };

export function render(node, ...children) {
  clear(node);
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

/* A modal that resolves when it closes. Returns whatever close() is given. */
export function modal(buildContent) {
  return new Promise(resolve => {
    let settled = false;
    const done = value => {
      if (settled) return;
      settled = true;
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onKey = e => { if (e.key === 'Escape') done(null); };

    const box = h('div.modal');
    const backdrop = h('div.modal-backdrop', {
      onclick: e => { if (e.target === backdrop) done(null); }
    }, box);

    render(box, buildContent(done));
    document.body.append(backdrop);
    document.addEventListener('keydown', onKey);
    box.querySelector('input, select, textarea, button')?.focus();
  });
}

export const timeOf = ts =>
  new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const minutesSince = ts => Math.floor((Date.now() - ts) / 60000);
