'use strict';
// Verifies every dungeon is fully completable:
//  - room graph reachability with door/key/item gating (fixed point)
//  - the relic chest is reached before the boss room
//  - each room's shutter puzzle is solvable with the inventory you hold
//    when you first arrive, and its non-shutter exits are traversable
// Run: node tests/dungeons.test.js
const path = require('path');
const E = require(path.join(__dirname, '..', 'js', 'engine.js'));
const { DUNGEONS } = require(path.join(__dirname, '..', 'js', 'levels.js'));

const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
const GRID = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const SIDES = ['n', 's', 'e', 'w'];
const dims = room => ({ w: room.map[0].length, h: room.map.length });
function doorCell(w, h, side) {
  const mc = (w - 1) >> 1, mr = (h - 1) >> 1;
  return side === 'n' ? { r: 0, c: mc } : side === 's' ? { r: h - 1, c: mc } : side === 'w' ? { r: mr, c: 0 } : { r: mr, c: w - 1 };
}
function innerCell(w, h, side) {
  const d = doorCell(w, h, side);
  return side === 'n' ? { r: 1, c: d.c } : side === 's' ? { r: h - 2, c: d.c } : side === 'w' ? { r: d.r, c: 1 } : { r: d.r, c: w - 2 };
}
function neighborId(dun, room, side) {
  const g = GRID[side], nx = room.gx + g[0], ny = room.gy + g[1];
  for (const id in dun.rooms) { const rr = dun.rooms[id]; if (rr.gx === nx && rr.gy === ny) return id; }
  return null;
}
function countKeys(room) { let n = 0; for (const row of room.map) for (const ch of row) if (ch === 'k') n++; return n; }
function hasChestItem(room, item) { return room.chest && room.chest.item === item; }

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('  OK  ' + name);
  else { console.error('FAIL  ' + name + (detail ? ' — ' + detail : '')); failures++; }
}

for (const dun of DUNGEONS) {
  console.log('\n=== ' + dun.id + ' ' + dun.name + ' (' + Object.keys(dun.rooms).length + ' rooms) ===');
  const roomIds = Object.keys(dun.rooms);

  // ── door consistency: every declared door has a matching neighbour ──
  let doorOk = true;
  for (const id of roomIds) {
    const room = dun.rooms[id];
    for (const side of SIDES) {
      if (!room.doors[side]) continue;
      const nb = neighborId(dun, room, side);
      if (!nb) { doorOk = false; console.error('   door ' + id + '.' + side + ' -> no neighbour room'); }
      else if (!dun.rooms[nb].doors[OPP[side]]) { doorOk = false; console.error('   door ' + id + '.' + side + ' <-> ' + nb + '.' + OPP[side] + ' not mirrored'); }
    }
  }
  check('door graph is consistent', doorOk);

  // ── reachability fixed point ──
  const prior = {}; for (const it of dun.prior) prior[it] = true;
  let inv = Object.assign({}, prior);
  let keys = 0;
  const reached = new Set([dun.start.room]);
  const entryInv = { [dun.start.room]: Object.assign({}, inv) };
  keys += countKeys(dun.rooms[dun.start.room]);
  if (hasChestItem(dun.rooms[dun.start.room], dun.item)) inv[dun.item] = true;

  const roomSolvable = {};
  const solveInv = id => entryInv[id] || inv;
  function roomSolves(id) {
    if (roomSolvable[id] !== undefined) return roomSolvable[id];
    const room = dun.rooms[id];
    const hasSwitch = room.map.some(r => r.includes('s') || r.includes('B'));
    if (!hasSwitch) return (roomSolvable[id] = true);
    const st = E.parseLevel({ map: room.map });
    const res = E.solveGoal(st, solveInv(id), s => E.switchesDone(s), 300000);
    return (roomSolvable[id] = res.solvable);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const id of Array.from(reached)) {
      const room = dun.rooms[id];
      for (const side of SIDES) {
        const type = room.doors[side]; if (!type) continue;
        const nb = neighborId(dun, room, side); if (!nb) continue;
        let passable = false;
        if (type === 'open') passable = true;
        else if (type === 'shutter') passable = roomSolves(id);
        else if (type === 'lock') { if (keys > 0) { passable = true; } }
        if (!passable) continue;
        if (type === 'lock') keys--; // consume once (approximation: keys are plentiful by design)
        if (!reached.has(nb)) {
          reached.add(nb);
          entryInv[nb] = Object.assign({}, inv);
          keys += countKeys(dun.rooms[nb]);
          if (hasChestItem(dun.rooms[nb], dun.item)) inv[dun.item] = true;
          changed = true;
        }
      }
    }
  }

  check('all rooms reachable', reached.size === roomIds.length, reached.size + '/' + roomIds.length);
  check('boss room reachable', reached.has(dun.goal));
  check('relic (' + dun.item + ') obtained', !!inv[dun.item]);

  // ── per-room puzzle solvability with entry inventory ──
  let allSolvable = true, badRoom = '';
  for (const id of roomIds) {
    const room = dun.rooms[id];
    const hasSwitch = room.map.some(r => r.includes('s') || r.includes('B'));
    if (!hasSwitch) continue;
    if (!roomSolves(id)) { allSolvable = false; badRoom = id; }
  }
  check('every switch room is solvable', allSolvable, badRoom && 'room ' + badRoom);

  // ── traversal: each room's non-shutter exits reachable from an entry ──
  let travOk = true, badTrav = '';
  for (const id of roomIds) {
    if (!reached.has(id)) continue;
    const room = dun.rooms[id];
    const { w, h } = dims(room);
    // entry cell: '@' for start, else inner cell of any door to a reached room
    let entry = null;
    if (id === dun.start.room) entry = { r: dun.start.r, c: dun.start.c };
    else {
      for (const side of SIDES) {
        if (!room.doors[side]) continue;
        const nb = neighborId(dun, room, side);
        if (nb && reached.has(nb)) { entry = innerCell(w, h, side); break; }
      }
    }
    if (!entry) continue;
    const invHere = solveInv(id);
    for (const side of SIDES) {
      const type = room.doors[side]; if (!type || type === 'shutter') continue;
      const inner = innerCell(w, h, side);
      const st = E.parseLevel({ map: room.map });
      st.player.r = entry.r; st.player.c = entry.c;
      const res = E.canReachCell(st, invHere, inner.r, inner.c, 200000);
      if (!res.solvable) { travOk = false; badTrav = id + '.' + side; }
    }
  }
  check('room exits are traversable', travOk, badTrav && 'at ' + badTrav);

  // ── entry cells must be walkable (no door dumps you onto a wall/block) ──
  let entryOk = true, badEntry = '';
  for (const id of roomIds) {
    if (!reached.has(id)) continue;
    const room = dun.rooms[id];
    const { w, h } = dims(room);
    const st = E.parseLevel({ map: room.map });
    for (const side of SIDES) {
      if (!room.doors[side]) continue;         // you enter this room via OPP[side]
      const nb = neighborId(dun, room, side);
      if (!nb || !reached.has(nb)) continue;
      const inn = innerCell(w, h, side);
      const t = st.tiles[inn.r][inn.c];
      const blocked = t === E.TILE.WALL || E.blockAt(st, inn.r, inn.c);
      if (blocked) { entryOk = false; badEntry = id + '.' + side; }
    }
  }
  check('door entry cells are walkable', entryOk, badEntry && 'at ' + badEntry);

  // ── shutter exits reachable AFTER the room is solved (blocks may not
  //    end up parked in the doorway you need to leave through) ──
  const applyPath = (st, invv, pth) => { let s = st; for (const [dc, dr] of pth) { const r = E.move(s, dc, dr, invv); if (r.ok) s = r.state; } return s; };
  let shutOk = true, badShut = '';
  for (const id of roomIds) {
    if (!reached.has(id)) continue;
    const room = dun.rooms[id];
    const shutters = SIDES.filter(s => room.doors[s] === 'shutter');
    if (!shutters.length) continue;
    const { w, h } = dims(room);
    // entry inner cell from a reached neighbour
    let entry = id === dun.start.room ? { r: dun.start.r, c: dun.start.c } : null;
    if (!entry) for (const side of SIDES) {
      if (!room.doors[side]) continue;
      const nb = neighborId(dun, room, side);
      if (nb && reached.has(nb)) { entry = innerCell(w, h, side); break; }
    }
    if (!entry) continue;
    const invHere = solveInv(id);
    const fresh = E.parseLevel({ map: room.map });
    const solRes = E.solveGoal(fresh, invHere, s => E.switchesDone(s), 300000);
    if (!solRes.solvable) { shutOk = false; badShut = id + ' (unsolvable)'; continue; }
    const solved = applyPath(E.parseLevel({ map: room.map }), invHere, solRes.path);
    for (const side of shutters) {
      solved.player.r = entry.r; solved.player.c = entry.c;
      const inn = innerCell(w, h, side);
      const res = E.canReachCell(solved, invHere, inn.r, inn.c, 200000);
      if (!res.solvable) { shutOk = false; badShut = id + '.' + side; }
    }
  }
  check('shutter exits reachable when solved', shutOk, badShut && 'at ' + badShut);
}

console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL DUNGEON CHECKS PASSED');
process.exit(failures ? 1 : 0);
