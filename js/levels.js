'use strict';
// ── Story campaign: five multi-room dungeons ──────────────────
// Each dungeon is a set of rooms on a grid (gx,gy). A room is a normal
// engine map; the dungeon layer (js/dungeon.js + game.js) handles the
// room-to-room transitions, a shared key pool, shutter/locked doors and
// the mid-dungeon relic that gates the path to the boss room.
//
// Room map legend (9x7, border is wall; doorways are punched at edge
// centres by the engine wherever a door is declared):
//   # wall  . floor  s switch  b block  B block-on-switch  h heavy
//   u bush  f fire   p pit  c crack  d in-room locked door
//   k key   o coin   C chest  x exit stairs  @ player start
//
// Door types per side: open | shutter (opens when THIS room is solved)
//   | lock (needs a key). A missing side is solid wall.

const ITEMS = {
  sword:    { name: "GUARD'S BLADE",   desc: 'CUTS THROUGH BUSHES AND BRAMBLE.' },
  shield:   { name: "WARDEN'S SHIELD", desc: 'WALK UNBURNED THROUGH FLAMES.' },
  glove:    { name: 'TITAN GLOVE',     desc: 'PUSHES HEAVY IRON BLOCKS.' },
  lantern:  { name: 'PALE LANTERN',    desc: 'LIGHTS THE DARKEST VAULTS.' },
  boots:    { name: 'STRIDER BOOTS',   desc: 'STRIDE ACROSS OPEN CHASMS.' },
  sunstone: { name: 'SUNSTONE',        desc: 'THE HEART OF THE KEEP, ABLAZE ONCE MORE.' },
};

// short room builders keep the data readable
function R(gx, gy, map, doors, extra) {
  return Object.assign({ gx, gy, map, doors: doors || {} }, extra || {});
}

const DUNGEONS = [
  // ══ D1 · THE SUNKEN HALLS · grants SWORD, bushes gate the boss ══
  {
    id: 'd1', name: 'THE SUNKEN HALLS',
    tagline: 'EVERY DELVE BEGINS WITH A SINGLE STEP.',
    item: 'sword', prior: [],
    start: { room: 'r1', r: 3, c: 2 }, goal: 'r10',
    intro: "RAIN HAMMERS THE RUINS OF KING ALARIC'S KEEP. FAR BELOW, THE SUNSTONE STILL BURNS. YOU ARE THE ONLY ONE FOOL ENOUGH TO GO GET IT.",
    outro: 'THE DROWNED GUARD\'S BLADE IS YOURS, AND THE FIRST HALL LIES CONQUERED BEHIND YOU.',
    rooms: {
      r1: R(0, 3, [
        '#########',
        '#.......#',
        '#.o...o.#',
        '#.@.....#',
        '#.......#',
        '#.o...o.#',
        '#########',
      ], { e: 'open' }, { intro: 'THE HALLS REMEMBER FOOTSTEPS. WALK EAST.' }),
      r2: R(1, 3, [
        '#########',
        '#.......#',
        '#.......#',
        '#.......#',
        '#.......#',
        '#.......#',
        '#########',
      ], { w: 'open', e: 'lock', n: 'open' }, { intro: 'THE EAST DOOR IS LOCKED. A KEY MUST BE NEAR.' }),
      rK: R(1, 2, [
        '#########',
        '#.......#',
        '#...k...#',
        '#.......#',
        '#..o.o..#',
        '#.......#',
        '#########',
      ], { s: 'open' }),
      r3: R(2, 3, [
        '#########',
        '#.......#',
        '#..o.o..#',
        '#.......#',
        '#..o.o..#',
        '#.......#',
        '#########',
      ], { w: 'open', e: 'open' }),
      r4: R(3, 3, [
        '#########',
        '#..s.s..#',
        '#.......#',
        '#..b.b..#',
        '#.......#',
        '#.......#',
        '#########',
      ], { w: 'open', n: 'shutter' }, { intro: 'PUSH BOTH STONES ONTO THE SEALS TO OPEN THE WAY.' }),
      r5: R(3, 2, [
        '#########',
        '#.s...s.#',
        '#.......#',
        '#.b...b.#',
        '#.......#',
        '#.......#',
        '#########',
      ], { s: 'open', n: 'shutter' }),
      r6: R(3, 1, [
        '#########',
        '#.ss.ss.#',
        '#.bb.bb.#',
        '#.......#',
        '#.......#',
        '#.......#',
        '#########',
      ], { s: 'open', n: 'shutter' }),
      r7: R(3, 0, [
        '#########',
        '#.......#',
        '#...C...#',
        '#.......#',
        '#.......#',
        '#.......#',
        '#########',
      ], { s: 'open', e: 'open' }, { chest: { item: 'sword' } }),
      r8: R(4, 0, [
        '#########',
        '#.......#',
        '#.......#',
        '#.......#',
        '#uuuuuuu#',
        '#.......#',
        '#########',
      ], { w: 'open', s: 'open' }, { intro: 'BRAMBLE BARS THE WAY. YOUR NEW BLADE HUNGERS.' }),
      r9: R(4, 1, [
        '#########',
        '#.......#',
        '#.u...u.#',
        '#.......#',
        '#.u...u.#',
        '#.......#',
        '#########',
      ], { n: 'open', s: 'open' }),
      r10: R(4, 2, [
        '#########',
        '#.......#',
        '#.......#',
        '#...x...#',
        '#.......#',
        '#.......#',
        '#########',
      ], { n: 'open' }, { boss: true }),
    },
  },

  // ══ D2 · THE ASHEN GALLERIES · grants SHIELD, fire gates the boss ══
  {
    id: 'd2', name: 'THE ASHEN GALLERIES',
    tagline: 'THE FLOOD NEVER REACHED HERE. FIRE DID.',
    item: 'shield', prior: ['sword'],
    start: { room: 'r1', r: 3, c: 2 }, goal: 'r10',
    intro: 'GAS FROM THE DEEP VENTS HAS KEPT THESE GALLERIES ALIGHT FOR A HUNDRED YEARS. THE HEAT LEANS AGAINST THE DOORS.',
    outro: 'THE WARDEN\'S SHIELD HUMS WITH BANKED HEAT. THE GALLERIES ARE ASHES BEHIND YOU.',
    rooms: {
      r1: R(0, 3, ['#########', '#.......#', '#.o...o.#', '#.@.....#', '#.......#', '#.o...o.#', '#########'], { e: 'open' },
        { intro: 'EMBER-LIGHT FLICKERS DOWN THE EAST HALL.' }),
      r2: R(1, 3, ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#########'], { w: 'open', e: 'lock', n: 'open' }),
      rK: R(1, 2, ['#########', '#.......#', '#...k...#', '#.......#', '#..o.o..#', '#.......#', '#########'], { s: 'open' }),
      r3: R(2, 3, ['#########', '#.......#', '#.......#', '#uuuuuuu#', '#.......#', '#..o.o..#', '#########'], { w: 'open', e: 'open' },
        { intro: 'BRAMBLE STILL GROWS IN THE ASH. CUT IT DOWN.' }),
      r4: R(3, 3, ['#########', '#..s.s..#', '#.......#', '#..b.b..#', '#.......#', '#.......#', '#########'], { w: 'open', n: 'shutter' }),
      r5: R(3, 2, ['#########', '#.s...s.#', '#.......#', '#.b...b.#', '#.......#', '#.......#', '#########'], { s: 'open', n: 'shutter' }),
      r6: R(3, 1, ['#########', '#.ss.ss.#', '#.bb.bb.#', '#.......#', '#.......#', '#.......#', '#########'], { s: 'open', n: 'shutter' }),
      r7: R(3, 0, ['#########', '#.......#', '#...C...#', '#.......#', '#.......#', '#.......#', '#########'], { s: 'open', e: 'open' },
        { chest: { item: 'shield' } }),
      r8: R(4, 0, ['#########', '#.......#', '#.......#', '#.......#', '#fffffff#', '#.......#', '#########'], { w: 'open', s: 'open' },
        { intro: 'A WALL OF FLAME. RAISE THE SHIELD AND WALK ON.' }),
      r9: R(4, 1, ['#########', '#.......#', '#.f...f.#', '#.......#', '#.f...f.#', '#.......#', '#########'], { n: 'open', s: 'open' }),
      r10: R(4, 2, ['#########', '#.......#', '#.......#', '#...x...#', '#.......#', '#.......#', '#########'], { n: 'open' }, { boss: true }),
    },
  },

  // ══ D3 · THE IRON VAULTS · grants GLOVE, a heavy seal gates the boss ══
  {
    id: 'd3', name: 'THE IRON VAULTS',
    tagline: 'WHAT THE KING VALUED, HE MADE TOO HEAVY TO STEAL.',
    item: 'glove', prior: ['sword', 'shield'],
    start: { room: 'r1', r: 3, c: 2 }, goal: 'r10',
    intro: 'THE VAULTS ARE IRON TO THE CORE. NOTHING HERE MOVES FOR A BARE HAND.',
    outro: 'THE TITAN GLOVE SWALLOWS YOUR ARM TO THE ELBOW. IRON GROANS AND OBEYS.',
    rooms: {
      r1: R(0, 3, ['#########', '#.......#', '#.o...o.#', '#.@.....#', '#.......#', '#.o...o.#', '#########'], { e: 'open' }),
      r2: R(1, 3, ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#########'], { w: 'open', e: 'lock', n: 'open' }),
      rK: R(1, 2, ['#########', '#.......#', '#...k...#', '#.......#', '#..o.o..#', '#.......#', '#########'], { s: 'open' }),
      r3: R(2, 3, ['#########', '#.......#', '#.......#', '#uuuuuuu#', '#.......#', '#..o.o..#', '#########'], { w: 'open', e: 'open' }),
      r4: R(3, 3, ['#########', '#..s.s..#', '#.......#', '#..b.b..#', '#.......#', '#.......#', '#########'], { w: 'open', n: 'shutter' }),
      r5: R(3, 2, ['#########', '#.ss.ss.#', '#.bb.bb.#', '#.......#', '#.......#', '#.......#', '#########'], { s: 'open', n: 'shutter' }),
      r6: R(3, 1, ['#########', '#.ss.ss.#', '#.bb.bb.#', '#.......#', '#.......#', '#.......#', '#########'], { s: 'open', n: 'shutter' }),
      r7: R(3, 0, ['#########', '#.......#', '#...C...#', '#.......#', '#.......#', '#.......#', '#########'], { s: 'open', e: 'open' },
        { chest: { item: 'glove' } }),
      r8: R(4, 0, ['#########', '#...s...#', '#.......#', '#...h...#', '#.......#', '#.......#', '#########'], { w: 'open', s: 'shutter' },
        { intro: 'THE SEAL WANTS IRON. ONLY THE GLOVE CAN GIVE IT.' }),
      r9: R(4, 1, ['#########', '#.......#', '#..o.o..#', '#.......#', '#..o.o..#', '#.......#', '#########'], { n: 'open', s: 'open' }),
      r10: R(4, 2, ['#########', '#.......#', '#.......#', '#...x...#', '#.......#', '#.......#', '#########'], { n: 'open' }, { boss: true }),
    },
  },

  // ══ D4 · THE LIGHTLESS DEEP · grants LANTERN, darkness veils the boss ══
  {
    id: 'd4', name: 'THE LIGHTLESS DEEP',
    tagline: 'THE SUN HAS NEVER ONCE TOUCHED THIS PLACE.',
    item: 'lantern', prior: ['sword', 'shield', 'glove'],
    start: { room: 'r1', r: 3, c: 2 }, goal: 'r10',
    intro: 'THE TORCHES END HERE. WHAT LIES DEEPER HAS NEVER BEEN SEEN, ONLY FELT.',
    outro: 'THE PALE LANTERN BURNS WITHOUT OIL OR FLAME. THE DARK PEELS BACK, AND YOU WALK ON.',
    rooms: {
      r1: R(0, 3, ['#########', '#.......#', '#.o...o.#', '#.@.....#', '#.......#', '#.o...o.#', '#########'], { e: 'open' }),
      r2: R(1, 3, ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#########'], { w: 'open', e: 'lock', n: 'open' }),
      rK: R(1, 2, ['#########', '#.......#', '#...k...#', '#.......#', '#..o.o..#', '#.......#', '#########'], { s: 'open' }),
      r3: R(2, 3, ['#########', '#.......#', '#.......#', '#uuuuuuu#', '#.......#', '#..o.o..#', '#########'], { w: 'open', e: 'open' }),
      r4: R(3, 3, ['#########', '#..s.s..#', '#.......#', '#..b.b..#', '#.......#', '#.......#', '#########'], { w: 'open', n: 'shutter' }),
      r5: R(3, 2, ['#########', '#.s...s.#', '#.......#', '#.b...b.#', '#.......#', '#.......#', '#########'], { s: 'open', n: 'shutter' }),
      r6: R(3, 1, ['#########', '#.ss.ss.#', '#.bb.bb.#', '#.......#', '#.......#', '#.......#', '#########'], { s: 'open', n: 'shutter' }),
      r7: R(3, 0, ['#########', '#.......#', '#...C...#', '#.......#', '#.......#', '#.......#', '#########'], { s: 'open', e: 'open' },
        { chest: { item: 'lantern' } }),
      r8: R(4, 0, ['#########', '#..s.s..#', '#.......#', '#..b.b..#', '#.......#', '#.......#', '#########'], { w: 'open', s: 'shutter' },
        { dark: true, intro: 'PITCH BLACK. THE LANTERN\'S CIRCLE IS THE WHOLE WORLD NOW.' }),
      r9: R(4, 1, ['#########', '#.......#', '#.o...o.#', '#.......#', '#.o...o.#', '#.......#', '#########'], { n: 'open', s: 'open' }, { dark: true }),
      r10: R(4, 2, ['#########', '#.......#', '#.......#', '#...x...#', '#.......#', '#.......#', '#########'], { n: 'open' }, { boss: true, dark: true }),
    },
  },

  // ══ D5 · THE ABYSSAL DESCENT · grants BOOTS, chasms gate the SUNSTONE ══
  {
    id: 'd5', name: 'THE ABYSSAL DESCENT',
    tagline: 'THE SUNSTONE WAITS WHERE THE FLOOR RUNS OUT.',
    item: 'boots', prior: ['sword', 'shield', 'glove', 'lantern'],
    start: { room: 'r1', r: 3, c: 2 }, goal: 'r10',
    intro: 'THE KEEP\'S HEART LIES BELOW A THROAT OF CHASMS. ONE MISSTEP IS A LONG WAY DOWN.',
    outro: 'THE SUNSTONE RISES INTO YOUR HANDS, WARM AS A SUMMER YOU NEVER LIVED TO SEE. STONE BY STONE, THE KEEP BEGINS TO GLOW. THE DELVE IS COMPLETE.',
    rooms: {
      r1: R(0, 3, ['#########', '#.......#', '#.o...o.#', '#.@.....#', '#.......#', '#.o...o.#', '#########'], { e: 'open' }),
      r2: R(1, 3, ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#########'], { w: 'open', e: 'lock', n: 'open' }),
      rK: R(1, 2, ['#########', '#.......#', '#...k...#', '#.......#', '#..o.o..#', '#.......#', '#########'], { s: 'open' }),
      r3: R(2, 3, ['#########', '#.......#', '#.b.p...#', '#.......#', '#...p.b.#', '#.......#', '#########'], { w: 'open', e: 'open' },
        { intro: 'MIND THE CHASMS. STONE FILLS THEM, IF YOU HAVE STONE TO SPARE.' }),
      r4: R(3, 3, ['#########', '#..s.s..#', '#.......#', '#..b.b..#', '#.......#', '#.......#', '#########'], { w: 'open', n: 'shutter' }),
      r5: R(3, 2, ['#########', '#.s...s.#', '#.......#', '#.b...b.#', '#.......#', '#.......#', '#########'], { s: 'open', n: 'shutter' }),
      r6: R(3, 1, ['#########', '#.ss.ss.#', '#.bb.bb.#', '#.......#', '#.......#', '#.......#', '#########'], { s: 'open', n: 'shutter' }),
      r7: R(3, 0, ['#########', '#.......#', '#...C...#', '#.......#', '#.......#', '#.......#', '#########'], { s: 'open', e: 'open' },
        { chest: { item: 'boots' } }),
      r8: R(4, 0, ['#########', '#.......#', '#.......#', '#.......#', '#ppppppp#', '#.......#', '#########'], { w: 'open', s: 'open' },
        { intro: 'A CHASM WITHOUT A BRIDGE. THE STRIDER BOOTS WILL CARRY YOU.' }),
      r9: R(4, 1, ['#########', '#.......#', '#.p...p.#', '#.......#', '#.p...p.#', '#.......#', '#########'], { n: 'open', s: 'open' }),
      r10: R(4, 2, ['#########', '#.......#', '#...C...#', '#.......#', '#...x...#', '#.......#', '#########'], { n: 'open' },
        { boss: true, chest: { item: 'sunstone' } }),
    },
  },
];

// ── helpers ───────────────────────────────────────────────────
function allDungeons() { return DUNGEONS; }
function getDungeon(id) { return DUNGEONS.find(d => d.id === id) || null; }
function dungeonIndex(id) { return DUNGEONS.findIndex(d => d.id === id); }
function nextDungeon(id) { const i = dungeonIndex(id); return i >= 0 && i < DUNGEONS.length - 1 ? DUNGEONS[i + 1] : null; }
function isDungeonUnlocked(id, save) {
  if (save.devOn && save.devOn()) return true;
  const i = dungeonIndex(id);
  if (i <= 0) return true;
  return save.isDungeonDone(DUNGEONS[i - 1].id);
}
// count the linear "distance" of the item room for the 70%-through feel
function roomCount(dun) { return Object.keys(dun.rooms).length; }

if (typeof module !== 'undefined') {
  module.exports = { DUNGEONS, ITEMS, allDungeons, getDungeon, nextDungeon, isDungeonUnlocked, roomCount };
}
if (typeof window !== 'undefined') {
  window.DUNGEONS = DUNGEONS; window.ITEMS = ITEMS;
  window.allDungeons = allDungeons; window.getDungeon = getDungeon;
  window.nextDungeon = nextDungeon; window.isDungeonUnlocked = isDungeonUnlocked;
  window.roomCount = roomCount;
}
