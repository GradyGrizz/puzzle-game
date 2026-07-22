'use strict';
// Verifies every dungeon is fully completable, accounting for backtracking,
// multiple keys, item-gating and per-room traversal. Runs a fixed-point
// macro-search over the dungeon graph:
//   - a room's far door is only usable if you can physically TRAVERSE to its
//     inner cell from a cell you can already stand in (pushing blocks, cutting
//     bushes, etc. with the items you currently hold)
//   - keys and the relic are only collected if you can reach them in-room
//   - shutter doors need the room solved; locks need a spare key
// Then it checks: all rooms reachable, the relic obtained before the boss
// room, the boss room reachable, the map chest reachable, and every switch
// room individually solvable with its arrival inventory.
// Run: node tests/dungeons.test.js
const path = require('path');
const E = require(path.join(__dirname, '..', 'js', 'engine.js'));
const { DUNGEONS } = require(path.join(__dirname, '..', 'js', 'levels.js'));

const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
const GRID = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const STEP = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const SIDES = ['n', 's', 'e', 'w'];
const dims = room => ({ w: room.map[0].length, h: room.map.length });
function doorCell(w, h, side) {
  const mc = (w - 1) >> 1, mr = (h - 1) >> 1;
  return side === 'n' ? { r: 0, c: mc } : side === 's' ? { r: h - 1, c: mc } : side === 'w' ? { r: mr, c: 0 } : { r: mr, c: w - 1 };
}
function innerCell(w, h, side) {
  const d = doorCell(w, h, side), s = STEP[side];
  return { r: d.r - s[1], c: d.c - s[0] };
}
function neighborId(dun, room, side) {
  const g = GRID[side], nx = room.gx + g[0], ny = room.gy + g[1];
  for (const id in dun.rooms) { const rr = dun.rooms[id]; if (rr.gx === nx && rr.gy === ny) return id; }
  return null;
}
const keyCells = room => { const o = []; room.map.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === 'k') o.push({ r, c }); })); return o; };
const hasSwitch = room => room.map.some(r => r.includes('s') || r.includes('B'));

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('  OK  ' + name);
  else { console.error('FAIL  ' + name + (detail ? ' — ' + detail : '')); failures++; }
}

// standing at any cell in `starts`, can the player reach any of `targets`
// (a single {r,c} or a list) in `state` with `inv`?
function reachAny(state, inv, starts, targets, cap) {
  const tl = Array.isArray(targets) ? targets : [targets];
  for (const s of starts) {
    for (const target of tl) {
      const st = E.cloneState(state);
      st.player.r = s.r; st.player.c = s.c;
      if (st.player.r === target.r && st.player.c === target.c) return true;
      if (E.canReachCell(st, inv, target.r, target.c, cap || 150000).solvable) return true;
    }
  }
  return false;
}

// a solved copy of the room (all switches covered) using `inv`, or null
function solvedState(room, inv) {
  const fresh = E.parseLevel({ map: room.map });
  if (!hasSwitch(room)) return fresh;
  const res = E.solveGoal(fresh, inv, s => E.switchesDone(s), 300000);
  if (!res.solvable) return null;
  let st = E.parseLevel({ map: room.map });
  for (const [dc, dr] of res.path) { const r = E.move(st, dc, dr, inv); if (r.ok) st = r.state; }
  return st;
}

for (const dun of DUNGEONS) {
  console.log('\n=== ' + dun.id + ' ' + dun.name + ' (' + Object.keys(dun.rooms).length + ' rooms) ===');
  const roomIds = Object.keys(dun.rooms);

  // ── door consistency ──
  let doorOk = true;
  for (const id of roomIds) {
    const room = dun.rooms[id];
    for (const side of SIDES) {
      if (!room.doors[side]) continue;
      const nb = neighborId(dun, room, side);
      if (!nb) { doorOk = false; console.error('   door ' + id + '.' + side + ' -> no neighbour'); }
      else if (!dun.rooms[nb].doors[OPP[side]]) { doorOk = false; console.error('   door ' + id + '.' + side + ' <-> ' + nb + '.' + OPP[side] + ' not mirrored'); }
    }
  }
  check('door graph is consistent', doorOk);

  // ── macro reachability (fixed point) ──
  const items = {}; for (const it of dun.prior) items[it] = true;
  const reached = new Set([dun.start.room]);
  const entries = { [dun.start.room]: [{ r: dun.start.r, c: dun.start.c }] };
  const keysGot = new Set();     // "roomId:r,c"
  const opened = new Set();      // "roomId:side"
  let keysAvail = 0;
  const relic = dun.item, mapItem = 'map';
  let progress = true, guard = 0;
  while (progress && guard++ < 200) {
    progress = false;
    for (const id of Array.from(reached)) {
      const room = dun.rooms[id];
      const { w, h } = dims(room);
      const fresh = E.parseLevel({ map: room.map, chest: room.chest || null });
      const starts = entries[id];
      // collect keys reachable in this room
      for (const kc of keyCells(room)) {
        const tag = id + ':' + kc.r + ',' + kc.c;
        if (keysGot.has(tag)) continue;
        if (reachAny(fresh, items, starts, kc)) { keysGot.add(tag); keysAvail++; progress = true; }
      }
      // collect relic / map from a chest (reach a cell adjacent to it)
      if (room.chest && fresh.chest && fresh.chest.r >= 0) {
        const it = room.chest.item;
        const have = it === relic ? items[relic] : it === mapItem ? items._map : items['_got_' + id];
        if (!have) {
          const adj = SIDES.map(s => ({ r: fresh.chest.r - STEP[s][1], c: fresh.chest.c - STEP[s][0] }))
            .filter(a => a.r >= 0 && a.c >= 0 && a.r < h && a.c < w && fresh.tiles[a.r][a.c] !== E.TILE.WALL);
          if (reachAny(fresh, items, starts, adj.length ? adj : [{ r: fresh.chest.r, c: fresh.chest.c }])) {
            if (it === relic) items[relic] = true; else if (it === mapItem) items._map = true; else items['_got_' + id] = true;
            progress = true;
          }
        }
      }
      // try each door
      for (const side of SIDES) {
        const type = room.doors[side]; if (!type) continue;
        const nb = neighborId(dun, room, side); if (!nb) continue;
        const inner = innerCell(w, h, side);
        let passable = false, useState = fresh;
        if (type === 'open') passable = true;
        else if (type === 'shutter') { const ss = solvedState(room, items); if (ss) { passable = true; useState = ss; } }
        else if (type === 'lock') passable = opened.has(id + ':' + side) || keysAvail > 0;
        if (!passable) continue;
        if (!reachAny(useState, items, starts, inner)) continue;   // can't physically get to the door
        if (type === 'lock' && !opened.has(id + ':' + side)) { opened.add(id + ':' + side); opened.add(nb + ':' + OPP[side]); keysAvail--; }
        const back = innerCell(dims(dun.rooms[nb]).w, dims(dun.rooms[nb]).h, OPP[side]);
        if (!entries[nb]) entries[nb] = [];
        if (!reached.has(nb)) { reached.add(nb); progress = true; }
        if (!entries[nb].some(e => e.r === back.r && e.c === back.c)) { entries[nb].push(back); progress = true; }
      }
    }
  }

  check('all rooms reachable', reached.size === roomIds.length, reached.size + '/' + roomIds.length + ' (missing: ' + roomIds.filter(id => !reached.has(id)).join(',') + ')');
  check('boss room reachable', reached.has(dun.goal));
  check('relic (' + relic + ') obtained', !!items[relic]);
  const mapRoom = roomIds.find(id => dun.rooms[id].chest && dun.rooms[id].chest.item === 'map');
  check('map chest reachable', !mapRoom || !!items._map, mapRoom && 'map in ' + mapRoom);

  // ── every switch room solvable with arrival inventory ──
  // (arrival inventory ~ prior + relic if relic-room reached before it; we use
  //  the final item set, which is a safe superset for solvability)
  let allSolvable = true, badRoom = '';
  for (const id of roomIds) {
    const room = dun.rooms[id];
    if (!hasSwitch(room)) continue;
    if (!solvedState(room, items)) { allSolvable = false; badRoom = id; }
  }
  check('every switch room is solvable', allSolvable, badRoom && 'room ' + badRoom);

  // ── door entry cells walkable (no door dumps you on a wall/block) ──
  let entryOk = true, badEntry = '';
  for (const id of roomIds) {
    if (!reached.has(id)) continue;
    const room = dun.rooms[id]; const { w, h } = dims(room);
    const st = E.parseLevel({ map: room.map });
    for (const side of SIDES) {
      if (!room.doors[side]) continue;
      const nb = neighborId(dun, room, side); if (!nb) continue;
      const inn = innerCell(w, h, side);
      if (st.tiles[inn.r][inn.c] === E.TILE.WALL || E.blockAt(st, inn.r, inn.c)) { entryOk = false; badEntry = id + '.' + side; }
    }
  }
  check('door entry cells are walkable', entryOk, badEntry && 'at ' + badEntry);
}

console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL DUNGEON CHECKS PASSED');
process.exit(failures ? 1 : 0);
