import { figures } from '../scene/figures.js';

/* -------------------------------------------------------------------------
   What you can be doing in the room.

   The homepage cast is imported rather than copied — js/scene/figures.js
   stays the single source of truth for those seven poses, and the concept
   site keeps rendering them exactly as it always has. Here they're just
   re-labelled: the homepage names them by who they are ("hula girl"), the
   room names them by what you're doing, because that's what a guest is
   actually picking.

   "reading" exists only in the room — nobody on the homepage is holding a
   book. Same two-frame {face, body} shape as figures.js so one renderer
   handles both, and built mostly from glyphs the scene already uses, which
   is the cheapest way to be sure they render in Menlo on an iPhone.

   The list is deliberately short: four things, so the choice is quick on a
   phone at the door rather than a menu to read. Everything cut is kept in
   the commented block at the bottom — restoring one is uncommenting it.
   ------------------------------------------------------------------------- */

/* ids are set by hand and never derived from the label — a guest doc stores
   the id, so renaming "grind mode" to something funnier later must not strand
   whoever is currently checked in as it. */
const homepage = (id, figureId, label) => ({ id, label, frames: figures[figureId].frames });

export const activities = [
  homepage('chilling', 7, 'just chilling'),
  homepage('waving', 4, 'looking for a friend'),
  {
    id: 'reading',
    label: 'reading',
    frames: [
      { face: '(◠_◠)', body: '/[≡]\\' },
      { face: '(◠ᵕ◠)', body: '/[≡]\\' },
    ],
  },
  homepage('gossip', 1, 'catching up on the gossip'),

  /* --- cut, kept for easy restoring -------------------------------------
     These worked and are only out because four choices read better on a
     phone than eleven. Anyone still checked in under one of these ids falls
     back to the first activity above, so putting one back mid-event is safe.

  homepage('zoned-out', 6, 'zoned out'),
  homepage('grind', 5, 'grind mode'),
  homepage('together', 2, 'here with someone'),
  homepage('caffeinated', 3, 'third coffee of the day'),
  {
    // The open mouth is the same ﹃ the zoned-out figure uses, with happier
    // eyes — and the sandwich in hand gets shorter between frames.
    id: 'eating',
    label: 'eating something good',
    frames: [
      { face: '(ᵕ﹃ᵕ)', body: '/[=]\\' },
      { face: '(ᵕ﹃ᵕ)', body: '/[-]\\' },
    ],
  },
  {
    id: 'wine',
    label: 'wine-ing',
    frames: [
      { face: '(ˊᵕˋ)', body: '\\ Y /' },
      { face: '(ˊ▽ˋ)', body: '\\ Y /' },
    ],
  },
  {
    // Words coming out. The frames are different widths on purpose; poseText
    // pads them to a common box so the figure doesn't jitter.
    id: 'talking',
    label: 'deep in conversation',
    frames: [
      { face: '(•◡•)~', body: '/|\\' },
      { face: '(•◡•)~~', body: '/|\\' },
    ],
  },
  ------------------------------------------------------------------------ */
];

export const activityById = id => activities.find(a => a.id === id) || activities[0];

/* Both frames centred inside one fixed-size box.

   The box is measured across BOTH frames, not each one, because frames can
   differ in width and a box that resized every second would make the whole
   figure twitch sideways.

   Inside the box each line is centred rather than left-aligned. That matters:
   a body like '\|/' is three characters under a six-character face, and
   padding it on the right alone left it visibly hanging off to one side —
   the shoulders didn't sit under the head.

   The two kinds of space in the homepage art are not the same thing, and
   that's the whole trick here. LEADING spaces are load-bearing animation —
   the waving figure raises its arm by shifting its face one column between
   frames. TRAILING spaces are just leftovers from the fixed scene on the
   homepage, where every figure was padded out to sit in its column; here
   they only make a line look wider than it is, which is what left the
   waving figure's shoulders a full character off from its head.

   So: drop the trailing padding, then shift each ROW — faces as a group,
   bodies as a group — by one constant amount. Shifting per row rather than
   per line is what keeps the animation intact: every frame of the body
   moves by the same amount, so the torso holds still at one column while
   only the arm changes around it. */
const stripEnd = s => s.replace(/\s+$/, '');

export function poseText(activity, tick) {
  const faces = activity.frames.map(f => stripEnd(f.face));
  const bodies = activity.frames.map(f => stripEnd(f.body));

  const faceW = Math.max(...faces.map(s => s.length));
  const bodyW = Math.max(...bodies.map(s => s.length));
  const width = Math.max(faceW, bodyW);

  const shift = w => ' '.repeat(Math.floor((width - w) / 2));
  const i = tick % activity.frames.length;

  /* padEnd to a constant width so the box never resizes between frames —
     it's centred as a block, and a box that breathed would make the whole
     figure twitch sideways once a second. */
  return [
    (shift(faceW) + faces[i]).padEnd(width),
    (shift(bodyW) + bodies[i]).padEnd(width),
  ].join('\n');
}
