'use strict';
// ── Story campaign: five multi-room dungeons ──────────────────
// Each dungeon is a set of rooms on a grid (gx,gy). A room is a normal
// engine map; the dungeon layer (js/dungeon.js + game.js) handles the
// room-to-room transitions, a shared key pool, shutter/locked doors and
// the mid-dungeon relic that gates the path to the exit.
//
// Zelda-style structure: from a hub you quickly REACH the exit branch but
// find it walled off by the dungeon's relic-gate (bramble / flame / iron /
// dark / chasm). The relic itself lies down a separate branch behind
// key-fetch loops (find a key, backtrack to a locked door) and shutter
// puzzles. You get the relic ~70% in, then BACKTRACK through old rooms to
// clear the gate and reach the exit. Length/difficulty escalate D1 (~3 min,
// 12 rooms, 1 key) -> D5 (~10 min, 20 rooms, 3 keys).
//
// Room map legend (border is wall; doorways punched at edge centres):
//   # wall  . floor  s switch  b block  h heavy  u bush  f fire  p pit
//   T wall-torch  k key  o coin  C chest  x exit stairs  @ player start
// A relic-gate is a FULL wall of its hazard across the room's middle column
// so it cannot be walked around — you must have the relic to pass.
//
// Door types per side: open | shutter (opens when THIS room is solved)
//   | lock (needs a key). A missing side is solid wall.

const ITEMS = {
  sword:    { name: "GUARD'S BLADE",   desc: 'CUTS THROUGH BUSHES AND BRAMBLE.' },
  shield:   { name: "WARDEN'S SHIELD", desc: 'WALK UNBURNED THROUGH FLAMES.' },
  glove:    { name: 'TITAN GLOVE',     desc: 'PUSHES HEAVY IRON BLOCKS.' },
  lantern:  { name: 'PALE LANTERN',    desc: 'LIGHTS THE DARKEST VAULTS.' },
  boots:    { name: 'STRIDER BOOTS',   desc: 'STRIDE ACROSS OPEN CHASMS.' },
  map:      { name: 'DUNGEON MAP',      desc: 'THE HALLS UNFOLD IN YOUR MIND.' },
  sunstone: { name: 'SUNSTONE',        desc: 'THE HEART OF THE KEEP, ABLAZE ONCE MORE.' },
};

// short room builders keep the data readable
function R(gx, gy, map, doors, extra) {
  return Object.assign({ gx, gy, map, doors: doors || {} }, extra || {});
}

// ── reusable room interiors (9x7; door cols/inner cells kept clear) ──
const _ST    = ['##T###T##', '#.......#', '#.o...o.#', '#...@...#', '#.......#', '#.o...o.#', '#########']; // start @ (3,4)
const _HALL  = ['##T###T##', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#########'];
const _COIN  = ['##T###T##', '#.......#', '#.o...o.#', '#.......#', '#.o...o.#', '#.......#', '#########'];
const _P2    = ['#########', '#.s...s.#', '#.......#', '#.b...b.#', '#.......#', '#.......#', '#########']; // 2 blocks -> 2 switches
const _P4    = ['#########', '#.ss.ss.#', '#.bb.bb.#', '#.......#', '#.......#', '#.......#', '#########']; // 4 blocks, one push each
const _KEY   = ['##T###T##', '#...k...#', '#.......#', '#.o...o.#', '#.......#', '#.......#', '#########']; // key (1,4)
const _CHEST = ['##T###T##', '#.......#', '#...C...#', '#.......#', '#.......#', '#.......#', '#########']; // chest (2,4)
const _BUSHV = ['#########', '#...u...#', '#...u...#', '#...u...#', '#...u...#', '#...u...#', '#########']; // bramble wall col4
const _FIREV = ['#########', '#...f...#', '#...f...#', '#...f...#', '#...f...#', '#...f...#', '#########']; // flame wall col4
const _PITV  = ['#########', '#...p...#', '#...p...#', '#...p...#', '#...p...#', '#...p...#', '#########']; // chasm wall col4
const _HEAVY = ['#########', '#...s...#', '#.......#', '#...h...#', '#.......#', '#.......#', '#########']; // heavy -> switch (needs glove)
const _PITS  = ['#########', '#.p...p.#', '#.......#', '#...p...#', '#.......#', '#.p...p.#', '#########']; // scattered chasms
const _BOSS  = ['##T###T##', '#.......#', '#.......#', '#...x...#', '#.......#', '#.......#', '#########']; // exit (3,4)
const _BOSSC = ['##T###T##', '#.......#', '#...C...#', '#.......#', '#...x...#', '#.......#', '#########']; // chest (2,4) + exit (4,4)
// 11x9 grand hall (bigger room), coins scattered, door inner cells clear
const _HALL11 = ['###T###T###', '#.........#', '#..o...o..#', '#.........#', '#....o....#', '#.........#', '#..o...o..#', '#.........#', '###########'];

const DUNGEONS = [
  // ══ D1 · THE SUNKEN HALLS · SWORD · 12 rooms · 1 key · bramble-gated exit ══
  // Hub east = the exit, walled by bramble (need SWORD). Sword is north,
  // behind a locked door whose key sits west past a push puzzle. Backtrack.
  {
    id: 'd1', name: 'THE SUNKEN HALLS',
    tagline: 'EVERY DELVE BEGINS WITH A SINGLE STEP.',
    item: 'sword', prior: [],
    start: { room: 'r1', r: 3, c: 4 }, goal: 'r6',
    intro: "RAIN HAMMERS THE RUINS OF KING ALARIC'S KEEP. FAR BELOW, THE SUNSTONE STILL BURNS. YOU ARE THE ONLY ONE FOOL ENOUGH TO GO GET IT.",
    outro: "THE DROWNED GUARD'S BLADE IS YOURS, AND THE FIRST HALL LIES CONQUERED BEHIND YOU.",
    rooms: {
      r1: R(2, 4, _ST, { n: 'open' }, { intro: 'THE HALLS REMEMBER FOOTSTEPS. CLIMB NORTH.' }),
      r2: R(2, 3, _HALL, { s: 'open', w: 'open', e: 'open', n: 'lock' }, { intro: 'FOUR WAYS. THE NORTH DOOR IS LOCKED; THE EAST IS CHOKED WITH BRAMBLE.' }),
      r3: R(1, 3, _P2, { e: 'open', w: 'open', n: 'shutter' }, { intro: 'PUSH BOTH STONES ONTO THE SEALS TO OPEN THE WAY NORTH.' }),
      rM: R(0, 3, _CHEST, { e: 'open' }, { chest: { item: 'map' }, intro: 'A CARTOGRAPHER DIED CLUTCHING THIS.' }),
      rK: R(1, 2, _KEY, { s: 'open' }),
      r5: R(3, 3, _BUSHV, { w: 'open', e: 'open' }, { intro: 'THE EXIT LIES JUST BEYOND — BUT BRAMBLE BARS IT. YOU NEED A BLADE.' }),
      r6: R(4, 3, _BOSS, { w: 'open' }, { boss: true }),
      r7: R(2, 2, _COIN, { s: 'lock', n: 'open' }),
      r8: R(2, 1, _P2, { s: 'open', e: 'open', n: 'shutter' }),
      rC: R(3, 1, _COIN, { w: 'open' }),
      r9: R(2, 0, _HALL, { s: 'open', w: 'open' }),
      rB: R(1, 0, _CHEST, { e: 'open' }, { chest: { item: 'sword' }, intro: "THE DROWNED GUARD'S BLADE. NOW — BACK TO THE BRAMBLE." }),
    },
  },

  // ══ D2 · THE ASHEN GALLERIES · SHIELD · 13 rooms · 2 keys · flame-gated exit ══
  {
    id: 'd2', name: 'THE ASHEN GALLERIES',
    tagline: 'THE FLOOD NEVER REACHED HERE. FIRE DID.',
    item: 'shield', prior: ['sword'],
    start: { room: 'r1', r: 3, c: 4 }, goal: 'r6',
    intro: 'GAS FROM THE DEEP VENTS HAS KEPT THESE GALLERIES ALIGHT FOR A HUNDRED YEARS. THE HEAT LEANS AGAINST THE DOORS.',
    outro: "THE WARDEN'S SHIELD HUMS WITH BANKED HEAT. THE GALLERIES ARE ASHES BEHIND YOU.",
    rooms: {
      r1: R(2, 5, _ST, { n: 'open' }),
      r2: R(2, 4, _HALL, { s: 'open', w: 'open', e: 'open', n: 'lock' }, { intro: 'THE EAST HALL BURNS. THE SHIELD LIES PAST TWO LOCKS.' }),
      r3: R(1, 4, _P2, { e: 'open', w: 'open', n: 'shutter' }),
      rC: R(0, 4, _COIN, { e: 'open' }),
      rA: R(1, 3, _KEY, { s: 'open' }),
      r5: R(3, 4, _FIREV, { w: 'open', e: 'open' }, { intro: 'A WALL OF FLAME GUARDS THE EXIT. RAISE A SHIELD AND WALK ON.' }),
      r6: R(4, 4, _BOSS, { w: 'open' }, { boss: true }),
      r7: R(2, 3, _HALL, { s: 'lock', e: 'open', n: 'open' }),
      r8: R(3, 3, _P4, { w: 'open', e: 'open', n: 'shutter' }),
      rB: R(3, 2, _KEY, { s: 'open' }),
      rM: R(4, 3, _CHEST, { w: 'open' }, { chest: { item: 'map' } }),
      r9: R(2, 2, _HALL, { s: 'open', n: 'lock' }),
      r10: R(2, 1, _CHEST, { s: 'lock' }, { chest: { item: 'shield' }, intro: "THE WARDEN'S SHIELD. NOW FACE THE FLAMES." }),
    },
  },

  // ══ D3 · THE IRON VAULTS · GLOVE · 14 rooms · 2 keys · heavy-sealed exit ══
  {
    id: 'd3', name: 'THE IRON VAULTS',
    tagline: 'WHAT THE KING VALUED, HE MADE TOO HEAVY TO STEAL.',
    item: 'glove', prior: ['sword', 'shield'],
    start: { room: 'r1', r: 3, c: 4 }, goal: 'r6',
    intro: 'THE VAULTS ARE IRON TO THE CORE. NOTHING HERE MOVES FOR A BARE HAND.',
    outro: 'THE TITAN GLOVE SWALLOWS YOUR ARM TO THE ELBOW. IRON GROANS AND OBEYS.',
    rooms: {
      r1: R(2, 5, _ST, { n: 'open' }),
      r2: R(2, 4, _HALL, { s: 'open', w: 'open', e: 'open', n: 'lock' }),
      r3: R(1, 4, _P2, { e: 'open', w: 'open', n: 'shutter' }),
      rC: R(0, 4, _HALL11, { e: 'open' }),
      rA: R(1, 3, _KEY, { s: 'open' }),
      r5: R(3, 4, _HEAVY, { w: 'open', e: 'shutter' }, { intro: 'AN IRON SEAL BARS THE EXIT. IT WANTS A HEAVY STONE ON ITS PLATE — AND A HAND STRONG ENOUGH TO PUSH ONE.' }),
      r6: R(4, 4, _BOSS, { w: 'open' }, { boss: true }),
      r7: R(2, 3, _HALL, { s: 'lock', n: 'open' }),
      r8: R(2, 2, _P4, { s: 'open', n: 'shutter' }),
      r9: R(2, 1, _HALL, { s: 'open', w: 'open', e: 'open', n: 'lock' }),
      r10: R(1, 1, _P2, { e: 'open', n: 'shutter' }),
      rB: R(1, 0, _KEY, { s: 'open' }),
      rM: R(3, 1, _CHEST, { w: 'open' }, { chest: { item: 'map' } }),
      r11: R(2, 0, _CHEST, { s: 'lock' }, { chest: { item: 'glove' }, intro: 'THE TITAN GLOVE. NOW MOVE THAT SEAL.' }),
    },
  },

  // ══ D4 · THE LIGHTLESS DEEP · LANTERN · 18 rooms · 2 keys · dark-veiled exit ══
  {
    id: 'd4', name: 'THE LIGHTLESS DEEP',
    tagline: 'THE SUN HAS NEVER ONCE TOUCHED THIS PLACE.',
    item: 'lantern', prior: ['sword', 'shield', 'glove'],
    start: { room: 'r1', r: 3, c: 4 }, goal: 'rX',
    intro: 'THE TORCHES END HERE. WHAT LIES DEEPER HAS NEVER BEEN SEEN, ONLY FELT.',
    outro: 'THE PALE LANTERN BURNS WITHOUT OIL OR FLAME. THE DARK PEELS BACK, AND YOU WALK ON.',
    rooms: {
      r1: R(2, 5, _ST, { n: 'open' }),
      r2: R(2, 4, _HALL, { s: 'open', w: 'open', e: 'open', n: 'lock' }),
      r3: R(1, 4, _P2, { e: 'open', w: 'open', n: 'shutter' }),
      rC: R(0, 4, _HALL11, { e: 'open' }),
      rA: R(1, 3, _KEY, { s: 'open' }),
      r5: R(3, 4, _HALL, { w: 'open', e: 'open' }, { dark: true, intro: 'EAST IS PITCH BLACK. YOU CANNOT SEE A SEAL, LET ALONE SOLVE ONE. FIND A LIGHT.' }),
      r6: R(4, 4, _P2, { w: 'open', e: 'shutter' }, { dark: true }),
      r6b: R(5, 4, _COIN, { w: 'open', e: 'open' }, { dark: true }),
      rX: R(6, 4, _BOSS, { w: 'open' }, { boss: true, dark: true }),
      r7: R(2, 3, _HALL, { s: 'lock', n: 'open', e: 'open' }),
      rD: R(3, 3, _COIN, { w: 'open' }),
      r8: R(2, 2, _P4, { s: 'open', n: 'shutter' }),
      r9: R(2, 1, _HALL, { s: 'open', w: 'open', e: 'open', n: 'lock' }),
      r10: R(1, 1, _P2, { e: 'open', n: 'shutter' }),
      rB: R(1, 0, _KEY, { s: 'open' }),
      rM: R(3, 1, _CHEST, { w: 'open', e: 'open' }, { chest: { item: 'map' } }),
      rE: R(4, 1, _COIN, { w: 'open' }),
      r11: R(2, 0, _CHEST, { s: 'lock' }, { chest: { item: 'lantern' }, intro: 'THE PALE LANTERN. THE DARK NO LONGER OWNS THE DEEP.' }),
    },
  },

  // ══ D5 · THE ABYSSAL DESCENT · BOOTS · 20 rooms · 3 keys · chasm-gated exit ══
  {
    id: 'd5', name: 'THE ABYSSAL DESCENT',
    tagline: 'THE SUNSTONE WAITS WHERE THE FLOOR RUNS OUT.',
    item: 'boots', prior: ['sword', 'shield', 'glove', 'lantern'],
    start: { room: 'r1', r: 3, c: 4 }, goal: 'rX',
    intro: "THE KEEP'S HEART LIES BELOW A THROAT OF CHASMS. ONE MISSTEP IS A LONG WAY DOWN.",
    outro: 'THE SUNSTONE RISES INTO YOUR HANDS, WARM AS A SUMMER YOU NEVER LIVED TO SEE. STONE BY STONE THE KEEP BEGINS TO GLOW. THE DELVE IS COMPLETE.',
    rooms: {
      r1: R(2, 5, _ST, { n: 'open' }),
      r2: R(2, 4, _HALL, { s: 'open', w: 'open', e: 'open', n: 'lock' }, { intro: 'THREE LOCKS GUARD THE DESCENT. THE EXIT EAST ENDS IN A CHASM.' }),
      r3: R(1, 4, _P2, { e: 'open', w: 'shutter' }),
      rA: R(0, 4, _KEY, { e: 'open' }),
      r5: R(3, 4, _PITV, { w: 'open', e: 'open' }, { intro: 'A CHASM WITHOUT A BRIDGE SWALLOWS THE EXIT HALL. ONLY STRIDER BOOTS CROSS IT.' }),
      r6: R(4, 4, _PITS, { w: 'open', e: 'open' }),
      r6b: R(5, 4, _PITS, { w: 'open', e: 'open' }),
      rX: R(6, 4, _BOSSC, { w: 'open' }, { boss: true, chest: { item: 'sunstone' } }),
      r7: R(2, 3, _COIN, { s: 'lock', n: 'open', e: 'open' }),
      rD: R(3, 3, _HALL11, { w: 'open' }),
      r8: R(2, 2, _HALL, { s: 'open', w: 'open', e: 'open', n: 'lock' }),
      r9: R(1, 2, _P4, { e: 'open', w: 'shutter' }),
      rB: R(0, 2, _KEY, { e: 'open' }),
      rM: R(3, 2, _CHEST, { w: 'open', e: 'open' }, { chest: { item: 'map' } }),
      rE: R(4, 2, _COIN, { w: 'open' }),
      r11: R(2, 1, _HALL, { s: 'open', w: 'open', e: 'open', n: 'lock' }),
      r12: R(1, 1, _P2, { e: 'open', n: 'shutter' }),
      rC: R(1, 0, _KEY, { s: 'open' }),
      rF: R(3, 1, _COIN, { w: 'open' }),
      r13: R(2, 0, _CHEST, { s: 'lock' }, { chest: { item: 'boots' }, intro: 'THE STRIDER BOOTS. NOW — BACK TO THE CHASM.' }),
    },
  },
];

// 30x15 isolated development arena. It is intentionally not part of
// DUNGEONS, so story unlocks, completion records and rewards never see it.
function buildTestMap() {
  const w = 30, h = 15;
  const g = Array.from({ length: h }, (_, r) =>
    Array.from({ length: w }, (_, c) => (r === 0 || r === h - 1 || c === 0 || c === w - 1) ? '#' : '.'));
  const put = (r, c, ch) => { g[r][c] = ch; };
  for (let r = 1; r < h - 1; r++) {
    if (r !== 4 && r !== 10) { put(r, 10, '#'); put(r, 20, '#'); }
  }
  put(2, 2, '@'); put(2, 4, 'o'); put(2, 6, 'k'); put(3, 3, 'b');
  put(3, 6, 's'); put(5, 3, 'h'); put(5, 6, 's'); put(7, 3, 'b');
  put(7, 5, 'p'); put(9, 3, 'c'); put(11, 5, 'd'); put(12, 7, 'x');
  for (let c = 12; c <= 18; c += 2) put(2, c, 'u');
  for (let c = 12; c <= 18; c += 2) put(5, c, 'f');
  for (let c = 12; c <= 18; c += 2) put(8, c, 'p');
  put(11, 12, 'C'); put(11, 15, 'o'); put(11, 18, 'k');
  put(0, 13, 'T'); put(0, 17, 'T');
  for (let c = 22; c <= 27; c++) put(7, c, '#');
  put(7, 24, '.'); put(7, 27, '.');
  for (let r = 2; r <= 5; r++) put(r, 25, r === 4 ? '.' : '#');
  return g.map(row => row.join(''));
}

const TEST_DUNGEON = {
  id: 'test-ground', name: 'TEST DUNGEON', map: buildTestMap(),
  chest: { item: 'sword' },
  zones: [
    { c: 2, r: 1, text: 'PUZZLES' },
    { c: 12, r: 1, text: 'HAZARDS + RELICS' },
    { c: 22, r: 1, text: 'COMBAT' },
    { c: 22, r: 9, text: 'DART LANE' },
  ],
  darkZones: [{ c: 11, r: 9, w: 9, h: 4 }],
  enemies: [
    { id: 'skeleton-a', type: 'skeleton', r: 3, c: 22 },
    { id: 'skeleton-b', type: 'skeleton', r: 5, c: 27 },
    { id: 'dart-a', type: 'dart', r: 10, c: 23 },
    { id: 'dart-b', type: 'dart', r: 12, c: 27 },
  ],
};
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
function roomCount(dun) { return Object.keys(dun.rooms).length; }

if (typeof module !== 'undefined') {
  module.exports = { DUNGEONS, TEST_DUNGEON, ITEMS, allDungeons, getDungeon, nextDungeon, isDungeonUnlocked, roomCount };
}
if (typeof window !== 'undefined') {
  window.DUNGEONS = DUNGEONS; window.TEST_DUNGEON = TEST_DUNGEON; window.ITEMS = ITEMS;
  window.allDungeons = allDungeons; window.getDungeon = getDungeon;
  window.nextDungeon = nextDungeon; window.isDungeonUnlocked = isDungeonUnlocked;
  window.roomCount = roomCount;
}
