import { store } from './store.js';
import { config } from './config.js';

/* -------------------------------------------------------------------------
   Who am I.

   The entire identity model is a random id in localStorage. No accounts, no
   auth, nothing to sign up for — this is a room in someone's apartment, and
   the door code is what keeps it honest. One consequence worth knowing: your
   figure lives on the phone you checked in with. Same phone, you're still
   you; a different phone or a cleared browser, and you're someone new.

   Everything here is namespaced by eventId to match how the drivers store
   their data, so a future popup starts with an empty room and nobody
   inherits a stale figure from this one.
   ------------------------------------------------------------------------- */

export const NAME_MAX = 16;   // keeps the ASCII grid from being pulled apart
export const NOTE_MAX = 60;
export const STALE_MS = 90 * 60 * 1000;

const key = k => `hyphenate:checkin:${config.eventId}:${k}`;

const read = (k, fallback) => {
  try {
    const raw = localStorage.getItem(key(k));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;   // Safari private mode, or a value we can't parse
  }
};

const write = (k, value) => {
  try { localStorage.setItem(key(k), JSON.stringify(value)); } catch { /* full or blocked */ }
};

const uid = () => `g-${Math.random().toString(36).slice(2, 8)}`;

/* --- the door ------------------------------------------------------------ */

export const isUnlocked = () => read('unlocked', false) === true;

export function tryUnlock(attempt) {
  const ok = String(attempt).trim().toLowerCase() === String(config.checkinCode).toLowerCase();
  if (ok) write('unlocked', true);
  return ok;
}

/* --- me ------------------------------------------------------------------ */

/* Last thing we wrote (or saw) for ourselves. Kept locally because writes are
   whole-document — we need the full record to save a one-field change. */
let mine = read('guest', null);

export const myId = () => mine?.id || null;
export const myGuest = () => mine;

/* Prefill for someone who headed out and came back, or whose record was
   removed while they were away. Cheap kindness: they don't retype anything. */
export const lastProfile = () => read('profile', { name: '', emoji: '', activity: null });

/* Reconcile with what the room actually shows. If our record is gone from the
   room — we headed out on another tab, or the host removed us — drop the
   local copy so the page falls back to onboarding instead of rendering a
   figure nobody else can see. */
export function adoptFromRoom(guests) {
  if (!mine) return false;
  const found = guests.find(g => g.id === mine.id);
  if (found) { mine = found; write('guest', mine); return false; }
  mine = null;
  localStorage.removeItem(key('guest'));
  return true;   // caller should send them back to onboarding
}

const save = async () => {
  write('guest', mine);
  write('profile', { name: mine.name, emoji: mine.emoji, activity: mine.activity });
  await store.putGuest(mine);
};

export async function join({ name, emoji, activity }) {
  const now = Date.now();
  mine = {
    id: uid(),
    name: String(name).trim().slice(0, NAME_MAX),
    activity,
    emoji: emoji || '',
    note: '',
    joinedAt: now,
    noteAt: 0,
    lastSeen: now,
  };
  await save();
  return mine;
}

export async function setActivity(activity) {
  if (!mine) return;
  mine = { ...mine, activity, lastSeen: Date.now() };
  await save();
}

export async function setNote(note) {
  if (!mine) return;
  const text = String(note).trim().slice(0, NOTE_MAX);
  const now = Date.now();
  /* noteAt orders the "what's happening" log, so it only moves when the note
     actually changes — re-saving the same words shouldn't jump the queue. */
  mine = { ...mine, note: text, noteAt: text && text !== mine.note ? now : mine.noteAt, lastSeen: now };
  await save();
}

export async function setDetails({ name, emoji }) {
  if (!mine) return;
  mine = {
    ...mine,
    name: String(name).trim().slice(0, NAME_MAX),
    emoji: emoji || '',
    lastSeen: Date.now(),
  };
  await save();
}

/* Called once when the page opens. This is the whole presence mechanism —
   there is deliberately no heartbeat on a timer, because every write fans out
   as a billed read to every phone watching the room, and a 60-second poll
   across a full room would burn the Firestore free tier in an afternoon.
   Staleness is worked out on each device from lastSeen instead. */
export async function touch() {
  if (!mine) return;
  mine = { ...mine, lastSeen: Date.now() };
  await save();
}

export async function headOut() {
  if (!mine) return;
  const id = mine.id;
  mine = null;
  localStorage.removeItem(key('guest'));
  await store.deleteGuest(id);
}

export const isStale = guest => Date.now() - (guest.lastSeen || 0) > STALE_MS;
