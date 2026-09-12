import { h, render } from './dom.js';
import { store } from './store.js';
import { activityById, poseText } from './activities.js';
import { activityGrid, emojiPicker, mountRoom } from './room.js';
import * as guest from './guest.js';

/* -------------------------------------------------------------------------
   check in — the page controller.

   Three states, in order: the door, onboarding, the room. A phone that has
   already been through all three lands straight in the room, which is the
   common case once the popup is actually running — you check in once and
   spend the rest of the afternoon looking at everyone else.
   ------------------------------------------------------------------------- */

const root = document.getElementById('checkin-root');

let unmountRoom = null;

const leaveRoom = () => { unmountRoom?.(); unmountRoom = null; };

/* --- the door ------------------------------------------------------------- */

function showDoor() {
  leaveRoom();
  const input = h('input', {
    type: 'text', placeholder: 'password', autocomplete: 'off',
    autocapitalize: 'none', autocorrect: 'off'
  });
  const error = h('p.small', { style: 'color:var(--color-red)' });

  render(root, h('div.stack.center.door', {},
    // h('p', {}, 'come on in'),
    h('p.muted.small', {}, "neither ---- nor there"),
    h('form.stack', {
      onsubmit: e => {
        e.preventDefault();
        if (guest.tryUnlock(input.value)) showOnboarding();
        else {
          render(error, "that's not it — check the card by the door");
          input.select();
        }
      }
    },
      input,
      h('button.primary', { type: 'submit', style: 'width:100%' }, 'come in')
    ),
    error
  ));
  input.focus();
}

/* --- onboarding ----------------------------------------------------------- */

function showOnboarding() {
  leaveRoom();
  const previous = guest.lastProfile();
  let picked = previous.activity && activityById(previous.activity).id === previous.activity
    ? previous.activity
    : null;

  /* Step one: what are you doing. Nothing else on screen — it's the question
     the whole page is really asking. */
  const stepActivity = () => {
    render(root, h('div.stack', {},
      h('p.center', {}, 'what are you up to?'),
      activityGrid(picked, id => { picked = id; stepDetails(); })
    ));
  };

  /* Step two: who you are, with a live preview of exactly what the room will
     show — the figure is the point, so you should see it before committing. */
  const stepDetails = () => {
    let emoji = previous.emoji || '';
    const activity = activityById(picked);

    const name = h('input', {
      type: 'text', value: previous.name || '', maxLength: guest.NAME_MAX,
      placeholder: 'your name', autocomplete: 'given-name'
    });

    const previewEmoji = h('div.g-emoji', {}, emoji);
    const preview = h('div.guest.preview', {},
      previewEmoji,
      h('pre.g-pose', {}, poseText(activity, 0)),
      h('div.g-name', {}, previous.name || 'you'),
      h('div.g-act.muted', {}, activity.label)
    );
    name.addEventListener('input', () => {
      render(preview.querySelector('.g-name'), name.value.trim() || 'you');
    });

    const error = h('p.small.center', { style: 'color:var(--color-red)' });

    render(root, h('form.stack', {
      /* The write behind this can take a moment on bad wifi — up to the
         store's cloud deadline before it gives up and goes local. Without
         feedback the button just sits there looking untapped, so a guest
         taps again, or reloads, and neither helps. Say what's happening. */
      onsubmit: async e => {
        e.preventDefault();
        if (!name.value.trim()) {
          render(error, 'what is your name?');
          name.focus();
          return;
        }
        const button = e.target.querySelector('button[type=submit]');
        const label = button.textContent;
        button.disabled = true;
        button.textContent = 'checking you in…';
        render(error, '');
        try {
          await guest.join({ name: name.value, emoji, activity: picked });
          showRoom();   /* replaces this form, so the button never comes back */
        } catch (err) {
          console.error('[checkin] could not check in', err);
          button.disabled = false;
          button.textContent = label;
          render(error, "couldn't reach the room — tap to try again");
        }
      }
    },
      h('p.center', {}, 'and who are you?'),
      h('div.center', {}, preview),
      h('label.field', {}, h('span', {}, 'name'), name),
      h('label.field', {}, h('span', {}, 'hat (optional)'),
        emojiPicker(emoji, v => { emoji = v; render(previewEmoji, v); })),
      error,
      h('div.row-between', {},
        h('button', { type: 'button', onclick: stepActivity }, '← back'),
        h('button.primary', { type: 'submit' }, 'check in')
      )
    ));
  };

  stepActivity();
}

/* --- the room ------------------------------------------------------------- */

function showRoom() {
  leaveRoom();
  /* Marks us as recently active. The only presence write that isn't a
     deliberate action — see the note in guest.js about why there's no timer. */
  guest.touch();
  unmountRoom = mountRoom(root, { onLeft: showOnboarding });
}

/* --- boot ----------------------------------------------------------------- */

/* Guests never see "synced live" — it's noise when it's working. They only
   hear from us when the room can't sync, because then an empty-looking room
   is a bug, not an early arrival. */
store.mode().then(mode => {
  if (mode === 'cloud') return;
  const strip = document.getElementById('checkin-status');
  if (!strip) return;
  render(strip,
    h('span.dot.degraded', {}, '●'),
    " this room isn't syncing — you may be the only one in it. ",
    /* Reloading is the recovery, so offer it rather than leaving a guest to
       work out that a hard refresh is the trick. It has to be a reload: the
       driver is built once and cached, and every live subscription on the
       page is bound to that instance, so retrying in place would mean
       rebuilding all of them. A reload does it in one line and can't leave
       half the page wired to a dead driver. */
    h('button.ghost.tiny', { onclick: () => location.reload() }, 'try again')
  );
});

if (!guest.isUnlocked()) showDoor();
else if (!guest.myId()) showOnboarding();
else showRoom();
