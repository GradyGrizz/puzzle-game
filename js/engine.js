'use strict';
// ── Engine: pure grid puzzle logic (no rendering, node-testable) ──

const TILE = {
  WALL: '#', FLOOR: '.', EXIT: 'x', SWITCH: 's', CRACK: 'c',
  PIT: 'p', DOOR: 'd', BUSH: 'u',
};

// Map legend:
//  # wall   . floor   x exit    s switch   c crack   p pit
//  d locked door      u bush    b block    B block-on-switch
//  h heavy block      k key     o coin     C chest   @ player start
function parseLevel(def) {
  const rows = def.map;
  const h = rows.length, w = rows[0].length;
  const st = {
    w, h,
    tiles: [],
    blocks: [],          // {r,c,heavy}
    items: {},           // "r,c" -> 'key' | 'coin'
    player: { r: 1, c: 1, dir: 'down' },
    keys: 0,
    coinsGot: 0,
    moves: 0,
    chest: def.chest ? { r: -1, c: -1, item: def.chest.item, opened: false } : null,
    onCrack: false,      // player currently standing on a crack
    exitOpen: false,
    won: false,
  };
  for (let r = 0; r < h; r++) {
    const row = [];
    for (let c = 0; c < w; c++) {
      const ch = rows[r][c] || '#';
      let t = TILE.FLOOR;
      if (ch === '#') t = TILE.WALL;
      else if (ch === 'x') t = TILE.EXIT;
      else if (ch === 's') t = TILE.SWITCH;
      else if (ch === 'c') t = TILE.CRACK;
      else if (ch === 'p') t = TILE.PIT;
      else if (ch === 'd') t = TILE.DOOR;
      else if (ch === 'u') t = TILE.BUSH;
      else if (ch === 'b') { st.blocks.push({ r, c, heavy: false }); }
      else if (ch === 'B') { t = TILE.SWITCH; st.blocks.push({ r, c, heavy: false }); }
      else if (ch === 'h') { st.blocks.push({ r, c, heavy: true }); }
      else if (ch === 'k') { st.items[r + ',' + c] = 'key'; }
      else if (ch === 'o') { st.items[r + ',' + c] = 'coin'; }
      else if (ch === 'C') { if (st.chest) { st.chest.r = r; st.chest.c = c; } }
      else if (ch === '@') { st.player.r = r; st.player.c = c; }
      row.push(t);
    }
    st.tiles.push(row);
  }
  st.totalSwitches = countSwitches(st);
  updateExit(st);
  return st;
}

function countSwitches(st) {
  let n = 0;
  for (let r = 0; r < st.h; r++) for (let c = 0; c < st.w; c++)
    if (st.tiles[r][c] === TILE.SWITCH) n++;
  return n;
}

function blockAt(st, r, c) {
  return st.blocks.find(b => b.r === r && b.c === c) || null;
}

function switchesDone(st) {
  for (let r = 0; r < st.h; r++) for (let c = 0; c < st.w; c++) {
    if (st.tiles[r][c] === TILE.SWITCH && !blockAt(st, r, c)) return false;
  }
  return true;
}

function updateExit(st) {
  const was = st.exitOpen;
  const chestDone = !st.chest || st.chest.r < 0 || st.chest.opened;
  st.exitOpen = switchesDone(st) && chestDone;
  return !was && st.exitOpen;
}

function cloneState(st) {
  return JSON.parse(JSON.stringify(st));
}

// inventory = { sword:bool, glove:bool, ... } — story equipment
// Returns { ok, events: [..], state } — state is a NEW object; caller keeps
// the old one for undo. Events describe what happened for anim/sfx:
//  walk, bump, push {fr,fc,tr,tc}, blockFall {r,c}, coin, key, unlock,
//  cut, needItem {item}, crackBreak {r,c}, switchOn, exitOpen, chest, win
function move(prev, dc, dr, inventory) {
  const st = cloneState(prev);
  const inv = inventory || {};
  const ev = [];
  const p = st.player;
  const nr = p.r + dr, nc = p.c + dc;
  p.dir = dc < 0 ? 'left' : dc > 0 ? 'right' : dr < 0 ? 'up' : 'down';

  if (nr < 0 || nr >= st.h || nc < 0 || nc >= st.w) return blocked(prev, st, ev);
  const t = st.tiles[nr][nc];

  // chest: bump to open
  if (st.chest && !st.chest.opened && st.chest.r === nr && st.chest.c === nc) {
    st.chest.opened = true;
    ev.push({ type: 'chest', item: st.chest.item });
    if (updateExit(st)) ev.push({ type: 'exitOpen' });
    st.moves++;
    return { ok: true, events: ev, state: st };
  }

  if (t === TILE.WALL || t === TILE.PIT) return blocked(prev, st, ev);

  if (t === TILE.DOOR) {
    if (st.keys > 0) {
      st.keys--;
      st.tiles[nr][nc] = TILE.FLOOR;
      ev.push({ type: 'unlock', r: nr, c: nc });
      // door opens; player steps through on this same move
    } else {
      ev.push({ type: 'needItem', item: 'key' });
      return blocked(prev, st, ev, true);
    }
  }

  if (t === TILE.BUSH) {
    if (inv.sword) {
      st.tiles[nr][nc] = TILE.FLOOR;
      ev.push({ type: 'cut', r: nr, c: nc });
      st.moves++;
      return { ok: true, events: ev, state: st }; // slash, don't step
    }
    ev.push({ type: 'needItem', item: 'sword' });
    return blocked(prev, st, ev, true);
  }

  if (t === TILE.EXIT && !st.exitOpen) return blocked(prev, st, ev);

  // block pushing
  const bl = blockAt(st, nr, nc);
  let pushed = null;
  if (bl) {
    if (bl.heavy && !inv.glove) {
      ev.push({ type: 'needItem', item: 'glove' });
      return blocked(prev, st, ev, true);
    }
    const br = nr + dr, bc = nc + dc;
    if (br < 0 || br >= st.h || bc < 0 || bc >= st.w) return blocked(prev, st, ev);
    const bt = st.tiles[br][bc];
    if (bt === TILE.WALL || bt === TILE.DOOR || bt === TILE.BUSH || bt === TILE.EXIT)
      return blocked(prev, st, ev);
    if (blockAt(st, br, bc)) return blocked(prev, st, ev);
    if (st.chest && !st.chest.opened && st.chest.r === br && st.chest.c === bc)
      return blocked(prev, st, ev);
    // push it
    pushed = { fr: nr, fc: nc, tr: br, tc: bc };
    bl.r = br; bl.c = bc;
    ev.push({ type: 'push', ...pushed });
    if (bt === TILE.CRACK || bt === TILE.PIT) {
      // block falls in, fills the hole -> walkable floor
      st.blocks = st.blocks.filter(b => b !== bl);
      st.tiles[br][bc] = TILE.FLOOR;
      ev.push({ type: 'blockFall', r: br, c: bc });
    } else if (bt === TILE.SWITCH) {
      ev.push({ type: 'switchOn', r: br, c: bc });
    }
  }

  // crack the tile we're leaving
  if (st.onCrack) {
    st.tiles[p.r][p.c] = TILE.PIT;
    ev.push({ type: 'crackBreak', r: p.r, c: p.c });
    st.onCrack = false;
  }

  // step
  p.r = nr; p.c = nc;
  st.moves++;
  ev.push({ type: pushed ? 'pushWalk' : 'walk' });

  if (st.tiles[nr][nc] === TILE.CRACK) st.onCrack = true;

  // pickups
  const ik = nr + ',' + nc;
  if (st.items[ik] === 'coin') { delete st.items[ik]; st.coinsGot++; ev.push({ type: 'coin' }); }
  else if (st.items[ik] === 'key') { delete st.items[ik]; st.keys++; ev.push({ type: 'key' }); }

  if (updateExit(st)) ev.push({ type: 'exitOpen' });

  if (st.tiles[nr][nc] === TILE.EXIT && st.exitOpen) {
    st.won = true;
    ev.push({ type: 'win' });
  }

  return { ok: true, events: ev, state: st };
}

function blocked(prev, st, ev, keepEvents) {
  const out = keepEvents ? ev.slice() : ev.filter(e => e.type === 'needItem');
  out.unshift({ type: 'bump' });
  // direction change still applies
  const s2 = cloneState(prev);
  s2.player.dir = st.player.dir;
  return { ok: false, events: out, state: s2 };
}

// ── Solver: BFS over states (for tests & generator verification) ──
function stateKey(st) {
  const bl = st.blocks.map(b => b.r + ',' + b.c + (b.heavy ? 'h' : '')).sort().join('|');
  const mut = [];
  for (let r = 0; r < st.h; r++) for (let c = 0; c < st.w; c++) {
    const t = st.tiles[r][c];
    if (t === TILE.PIT || t === TILE.DOOR || t === TILE.BUSH || t === TILE.CRACK) mut.push(r + ',' + c + t);
  }
  const items = Object.keys(st.items).sort().join(';');
  const chest = st.chest ? (st.chest.opened ? 'O' : 'C') : '-';
  return st.player.r + ',' + st.player.c + '|' + bl + '|' + mut.join(';') + '|' + items + '|K' + st.keys + '|' + chest;
}

function solve(def, inventory, maxNodes) {
  const start = parseLevel(def);
  if (start.won) return { solvable: true, moves: 0, path: [] };
  const seen = new Set([stateKey(start)]);
  let frontier = [{ st: start, path: [] }];
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  let nodes = 0;
  const cap = maxNodes || 400000;
  let depth = 0;
  while (frontier.length) {
    const next = [];
    depth++;
    for (const { st, path } of frontier) {
      for (const [dc, dr] of dirs) {
        const res = move(st, dc, dr, inventory);
        if (!res.ok) continue;
        if (res.state.won) return { solvable: true, moves: depth, nodes, path: path.concat([[dc, dr]]) };
        const k = stateKey(res.state);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ st: res.state, path: path.concat([[dc, dr]]) });
        if (++nodes > cap) return { solvable: false, reason: 'node-cap', nodes };
      }
    }
    frontier = next;
  }
  return { solvable: false, reason: 'exhausted', nodes };
}

if (typeof module !== 'undefined') {
  module.exports = { TILE, parseLevel, move, solve, stateKey, blockAt, cloneState };
}
