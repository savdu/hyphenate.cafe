import { h, render, modal, timeOf } from './dom.js';
import { activities, activityById, poseText } from './activities.js';
import { store } from './store.js';
import * as guest from './guest.js';

/* -------------------------------------------------------------------------
   The room.

   A banner, a wrapping grid of figures, floorboards, and a log of what
   everyone's up to. The homepage scene is a fixed drawing with seven figures
   nailed to fixed columns; this one has to hold however many people actually
   turn up, on a phone, so the figures flow instead.

   The figures stay inside the page's content column. The ceiling and floor
   deliberately don't — they're tiled well past the screen and clipped, so
   the room has no visible left and right walls. A decorative banner still
   must never make the page scroll sideways, which is the constraint the
   tiling and the clipping are both there to satisfy.
   ------------------------------------------------------------------------- */

/* The ceiling and floor run off both edges of the screen, so the room reads
   as a room you're standing in rather than a strip in the middle of a page.

   Rather than measure the viewport and re-tile on resize, the lines are just
   built long enough to overflow anything you could hold in one hand, and the
   CSS clips them. No listeners, nothing to keep in sync, and one fewer thing
   to go wrong on a phone that rotates mid-service. 120 columns is roughly
   940px of Menlo — comfortably past the widest phone, and past the 34em
   column this page is capped at on a laptop. */
const ROOM_COLS = 120;

const tile = unit => unit.repeat(Math.ceil(ROOM_COLS / unit.length)).slice(0, ROOM_COLS);

const BANNER = [
  tile(' * . ✿ . * . * . ✿ . * . ✿ .'),
  tile(' . * . * . ✿ . * . * . ✿ . *'),
];

/* No `|` end caps any more — they were the edges of a floor that stopped.
   A floor that continues past the screen shouldn't have visible ends. */
const FLOOR = [
  tile('==+'),
  tile(' -- ---'),
  tile('  ✿    ✿ ♥     ✿  ✿ ♥    ✿ ✿'),
].join('\n');

const EMOJI = ['✿', '☆', '♥', '♫', '☺︎', '✈︎'];

/* How much of the conversation to show. The drivers already hand back a
   recent window; this is the smaller slice that actually gets drawn, so an
   afternoon of chat doesn't turn into an afternoon of DOM under the room. */
const LOG_LINES = 40;

/* One timer for every pose on the page — the room's figures, the onboarding
   tiles, and whatever a modal is showing. Each element re-reads its own text
   on the tick and nothing else is touched, so a grid never rebuilds under a
   thumb and the scroll position survives.

   The map is keyed by element and pruned as elements leave the DOM, which is
   what keeps modals honest: an activity grid inside a closed modal drops out
   on the next tick instead of being updated forever. When the last pose goes,
   so does the timer. */
let tick = 0;
let timer = null;
const poses = new Map();   // element -> activity

function startClock() {
  if (timer) return;
  timer = setInterval(() => {
    tick++;
    for (const [el, activity] of poses) {
      if (el.isConnected) el.textContent = poseText(activity, tick);
      else poses.delete(el);
    }
    for (const el of document.querySelectorAll('[data-banner]')) {
      el.textContent = BANNER[tick % BANNER.length];
    }
    if (!poses.size) stopClock();
  }, 1000);
}

function stopClock() {
  clearInterval(timer);
  timer = null;
}

function poseNode(activity, cls = 'g-pose') {
  const el = h(`pre.${cls}`, {}, poseText(activity, tick));
  poses.set(el, activity);
  startClock();
  return el;
}

/* --- pickers -------------------------------------------------------------- */

/* Shared by onboarding and by "change what you're up to" — the same grid of
   animated tiles either way, so picking feels identical in both places. */
export function activityGrid(selectedId, onPick) {
  return h('div.activity-grid', {},
    activities.map(a =>
      /* type=button matters: these sit inside the onboarding <form>, and a
         button with no type defaults to submit — tapping a pose would check
         you straight in, name unvalidated. */
      h('button.activity-tile', {
        type: 'button',
        'aria-pressed': String(a.id === selectedId),
        onclick: () => onPick(a.id)
      },
        poseNode(a, 'g-pose'),
        h('span.a-label', {}, a.label)
      )
    )
  );
}

/* A fixed set, deliberately — no free-text field. Anything typed into one is
   a second thing to moderate, and half of what people would paste doesn't
   render in Menlo next to the ASCII anyway. */
export function emojiPicker(current, onPick) {
  const row = h('div.emoji-row', {},
    h('button.emoji-opt', {
      type: 'button',
      'aria-pressed': String(!current), onclick: () => { onPick(''); redraw(''); }
    }, '—'),
    EMOJI.map(e =>
      h('button.emoji-opt', {
        type: 'button',
        'aria-pressed': String(e === current),
        onclick: () => { onPick(e); redraw(e); }
      }, e)
    )
  );

  /* The picker owns its own pressed state so a tap lights up immediately,
     without the caller having to re-render the whole form. */
  function redraw(picked) {
    [...row.children].forEach(btn =>
      btn.setAttribute('aria-pressed', String(btn.textContent === (picked || '—')))
    );
  }

  return row;
}

async function pickActivity(currentId) {
  return modal(done =>
    h('div.stack', {},
      h('strong', {}, 'what are you up to?'),
      activityGrid(currentId, id => done(id)),
      h('div.right', {}, h('button', { onclick: () => done(null) }, 'never mind'))
    )
  );
}

/* Replaced by the composer above the log — saying something in the room now
   sets the note above your figure and posts to the conversation in one go,
   so there's nothing left for a note-editing dialog to do. Kept in case a
   quieter "just set my status, don't post it" ever turns out to be wanted.

async function editNote(current) {
  return modal(done => {
    const input = h('input', {
      type: 'text', value: current || '', maxLength: guest.NOTE_MAX,
      placeholder: 'currently reading martyr…'
    });
    const submit = () => done(input.value);
    return h('form.stack', { onsubmit: e => { e.preventDefault(); submit(); } },
      h('strong', {}, 'what are you up to, in words?'),
      h('div.muted.small', {}, `everyone in the room sees this. ${guest.NOTE_MAX} characters.`),
      input,
      h('div.row-between', {},
        h('button', { type: 'button', onclick: () => done(null) }, 'never mind'),
        h('div.row', {},
          current ? h('button.danger', { type: 'button', onclick: () => done('') }, 'clear') : null,
          h('button.primary', { type: 'submit' }, 'save')
        )
      )
    );
  });
}
*/

/* Editing your name and customization after check-in is deliberately gone —
   you set both on the way in, and the room is a shorter menu without it.

   To bring it back: uncomment this function, uncomment its button in the
   sheet below, and add its branch back to the chain in openGuest —

       } else if (chosen === 'details') {
         const details = await editDetails(g);
         if (details) await guest.setDetails(details);

   `guest.setDetails()` is still exported and untouched, so nothing else
   needs to change.

async function editDetails(me) {
  return modal(done => {
    let emoji = me.emoji || '';
    const name = h('input', {
      type: 'text', value: me.name, maxLength: guest.NAME_MAX, placeholder: 'your name'
    });
    const submit = () => {
      if (!name.value.trim()) return;
      done({ name: name.value, emoji });
    };
    return h('form.stack', { onsubmit: e => { e.preventDefault(); submit(); } },
      h('strong', {}, 'your name & customization'),
      name,
      emojiPicker(emoji, v => { emoji = v; }),
      h('div.row-between', {},
        h('button', { type: 'button', onclick: () => done(null) }, 'never mind'),
        h('button.primary', { type: 'submit' }, 'save')
      )
    );
  });
}
*/

/* --- the guest sheet ------------------------------------------------------ */

async function openGuest(g, isMe, refresh, onLeft) {
  const activity = activityById(g.activity);

  const chosen = await modal(done =>
    h('div.stack.center', {},
      g.emoji ? h('div.g-emoji.big', {}, g.emoji) : null,
      poseNode(activity, 'g-pose big'),
      /* Wrapped in a block: the pose is an inline-block <pre>, so a bare
         inline <strong> next to it sits on the same line as the figure's
         feet instead of underneath it. */
      h('div', {}, h('strong', {}, g.name)),
      h('div.muted', {}, activity.label),
      g.note ? h('div.g-said', {}, `“${g.note}”`) : null,
      h('div.muted.small', {}, `here since ${timeOf(g.joinedAt)}`),
      h('hr'),
      isMe
        ? h('div.sheet-actions', {},
            h('button', { onclick: () => done('activity') }, 'change what you\'re up to'),
            /* h('button', { onclick: () => done('details') }, 'name & customization'), */
            h('button.danger', { onclick: () => done('leave') }, 'head out'),
            h('button.ghost', { onclick: () => done(null) }, 'close')
          )
        /* Other people's sheets are read-only in this phase. This is exactly
           where "say hi" and "nudge" land next. */
        : h('div.stack', {},
            h('div.muted.small', {}, 'the Internet is not a replacement for human interaction. say hi in person!'),
            h('button', { onclick: () => done(null) }, 'close')
          )
    )
  );

  if (chosen === 'activity') {
    const id = await pickActivity(g.activity);
    if (id) await guest.setActivity(id);
  } else if (chosen === 'leave') {
    const sure = await modal(done =>
      h('div.stack', {},
        h('strong', {}, 'head out?'),
        h('div.muted.small', {}, 'your figure leaves the room. you can check back in any time.'),
        h('div.row-between', {},
          h('button', { onclick: () => done(false) }, 'stay'),
          h('button.danger', { onclick: () => done(true) }, 'head out')
        )
      )
    );
    if (sure) { await guest.headOut(); onLeft(); return; }
  }
  refresh();
}

/* --- mount ---------------------------------------------------------------- */

export function mountRoom(root, { onLeft }) {
  let guests = [];
  let messages = [];

  const grid = h('div.room-grid');
  const log = h('div.stack');
  const count = h('div.muted.small.center');

  /* The composer sits outside `log` — and above it — so that redrawing the
     log, which happens every time anyone in the room says anything, can't
     blow away what you're halfway through typing or drop the keyboard on a
     phone. Being above also means it never moves as the conversation grows. */
  const sayInput = h('input.say-input', {
    type: 'text', maxLength: guest.NOTE_MAX, autocomplete: 'off',
    placeholder: 'say something to the room…'
  });

  const composer = h('form.composer', {
    onsubmit: async e => {
      e.preventDefault();
      const text = sayInput.value;
      if (!text.trim()) return;
      /* Cleared before the write, not after: on a slow connection the wait is
         long enough to double-send into, and it reappears in the log anyway. */
      sayInput.value = '';
      await guest.say(text);
    }
  },
    sayInput,
    h('button.primary', { type: 'submit' }, 'say')
  );

  const view = h('div.room', {},
    h('pre.room-banner', { 'data-banner': true }, BANNER[tick % BANNER.length]),
    grid,
    h('pre.room-floor', {}, FLOOR),
    count,
    h('hr'),
    h('div.stack', {},
      h('div.muted.small', {}, "what's happening"),
      composer,
      log
    )
  );

  const draw = () => {
    const meId = guest.myId();
    /* Me first so I can always find myself, then by arrival. Anyone who's
       gone quiet for 90 minutes sinks to the bottom rather than vanishing —
       they might just be deep in a conversation. */
    const sorted = [...guests].sort((a, b) => {
      if (a.id === meId) return -1;
      if (b.id === meId) return 1;
      const stale = guest.isStale(a) - guest.isStale(b);
      return stale || a.joinedAt - b.joinedAt;
    });

    render(grid, sorted.map(g => {
      const isMe = g.id === meId;
      const activity = activityById(g.activity);
      return h('button.guest', {
        'data-me': String(isMe),
        'data-stale': String(guest.isStale(g)),
        onclick: () => openGuest(g, isMe, draw, onLeft)
      },
        g.note ? h('div.g-note', {}, g.note) : null,
        h('div.g-emoji', {}, g.emoji || ''),
        poseNode(activity, 'g-pose'),
        h('div.g-name', {}, isMe ? `${g.name} (you)` : g.name),
        h('div.g-act.muted', {}, activity.label)
      );
    }));

    render(count, guests.length === 1
      ? "you're the first one here"
      : `${guests.length} in the room`);
  };

  /* Newest first, directly under the box you type in. Messages arrive
     oldest-first from the store, so take the most recent window and flip it.
     slice() copies, so the reverse can't disturb the stored order. */
  const drawLog = () => {
    const recent = messages.slice(-LOG_LINES).reverse();
    render(log, recent.length
      ? recent.map(m => h('div.log-line', {},
          h('span.who', {}, m.name),
          ' ',
          h('span.said', {}, m.text),
          h('span.muted.small', {}, ` ${timeOf(m.at)}`)
        ))
      : h('div.muted.small', {}, 'nobody has said anything yet — you could be first'));
  };

  render(root, view);

  /* Only evict once we've actually seen ourselves in the room at least once.
     Without this, a first snapshot that lands before our own write does —
     the orders are queued on the same driver promise, so today it happens to
     arrive second, but nothing enforces that — would read as "your record is
     gone" and bounce a properly checked-in guest back to onboarding. */
  let sawMe = false;
  let off = null;

  const apply = list => {
    guests = list;
    const id = guest.myId();

    if (id && list.some(g => g.id === id)) {
      sawMe = true;
      guest.adoptFromRoom(list);      // refresh our cached copy from the room
    } else if (sawMe) {
      /* We were in the room and now we're not — headed out on another tab, or
         removed. adoptFromRoom drops the local record; then stop pretending. */
      guest.adoptFromRoom(list);
      off?.();
      offMessages?.();
      onLeft();
      return;
    }

    draw();
  };

  off = store.onGuests(apply);

  const applyMessages = list => { messages = list; drawLog(); };
  const offMessages = store.onMessages(applyMessages);

  /* Coming back to a phone that was asleep.

     iOS Safari freezes a page the moment you switch apps or lock the screen,
     and the live connection under it does not always come back on its own —
     Firestore's multi-tab coordination is particularly unreliable there. The
     symptom is a room that looks right until you pull-to-refresh, which is
     not something a guest should have to know to do. So on the way back in,
     read the room once directly.

     Only after a real absence: this costs a read per guest and per message in
     the window, and charging for that every time someone glances at another
     app and back would add up across an afternoon. A quick flick away changes
     nothing worth paying for. */
  const AWAY_ENOUGH = 5000;
  let hiddenAt = 0;

  const resync = async () => {
    try {
      const [freshGuests, freshMessages] = await Promise.all([
        store.getGuests(), store.getMessages()
      ]);
      applyMessages(freshMessages);
      apply(freshGuests);   // last: it can unmount us if we're no longer here
    } catch (err) {
      console.warn('[room] could not re-read the room on wake', err);
    }
  };

  const onVisibility = () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > AWAY_ENOUGH) resync();
    hiddenAt = 0;
  };

  /* bfcache: iOS restores back/forward navigations from a frozen snapshot,
     where every timer and socket is already dead on arrival. */
  const onPageShow = e => { if (e.persisted) resync(); };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pageshow', onPageShow);

  return () => {
    off?.();
    offMessages?.();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pageshow', onPageShow);
  };
}
