'use strict';
// ── Procedural puzzle generator + fast push-solver ────────────
// Challenge/Timed levels use the pure block/switch subset of the
// engine. Levels are built by REVERSE GENERATION: start from the
// solved state (blocks on switches) and pull blocks backward, so
// every level is solvable by construction. The recorded pull
// sequence doubles as a known solution: its move count sets the
// move budget, and replaying it forward validates exit placement.
// A small-capped push-solver only rejects puzzles that turn out
// too easy (a capped-out search means "hard enough" — keep it).

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── fast push-solver (player region abstraction, BFS over pushes) ──
function fastSolve(w, h, walls, switches, exitIdx, blocks0, player0, maxNodes) {
  const swSet = new Set(switches);
  const key = (bl, norm) => bl.join(',') + '|' + norm;
  const N = w * h;
  const dist = new Int16Array(N), dStamp = new Int32Array(N), nStamp = new Int32Array(N);
  let stamp = 0, normStampC = 0;

  function reach(blocks, start) {
    stamp++;
    const my = stamp;
    let norm = start;
    const q = [start]; let head = 0;
    dist[start] = 0; dStamp[start] = my;
    while (head < q.length) {
      const i = q[head++];
      if (i < norm) norm = i;
      for (const d of [-1, 1, -w, w]) {
        const j = i + d;
        if (j < 0 || j >= N) continue;
        if (d === -1 && i % w === 0) continue;
        if (d === 1 && i % w === w - 1) continue;
        if (walls[j] || j === exitIdx || blocks.includes(j) || dStamp[j] === my) continue;
        dist[j] = dist[i] + 1; dStamp[j] = my;
        q.push(j);
      }
    }
    return { dist: j => (dStamp[j] === my ? dist[j] : -1), norm };
  }

  function normOf(blocks, start) {
    normStampC++;
    let norm = start;
    const q = [start]; let head = 0;
    nStamp[start] = normStampC;
    while (head < q.length) {
      const i = q[head++];
      for (const d of [-1, 1, -w, w]) {
        const j = i + d;
        if (j < 0 || j >= N) continue;
        if (d === -1 && i % w === 0) continue;
        if (d === 1 && i % w === w - 1) continue;
        if (walls[j] || j === exitIdx || blocks.includes(j) || nStamp[j] === normStampC) continue;
        if (j < norm) norm = j;
        nStamp[j] = normStampC;
        q.push(j);
      }
    }
    return Math.min(norm, start);
  }

  function exitReachable(blocks, player) {
    const vis = new Set([player]);
    const q = [player]; let head = 0;
    while (head < q.length) {
      const i = q[head++];
      for (const d of [-1, 1, -w, w]) {
        const j = i + d;
        if (j < 0 || j >= N) continue;
        if (d === -1 && i % w === 0) continue;
        if (d === 1 && i % w === w - 1) continue;
        if (j === exitIdx) return true;
        if (walls[j] || blocks.includes(j) || vis.has(j)) continue;
        vis.add(j); q.push(j);
      }
    }
    return false;
  }

  const solvedNow = bl => [...swSet].every(s => bl.includes(s));
  const b0 = blocks0.slice().sort((a, b) => a - b);
  if (solvedNow(b0)) return { solvable: exitReachable(b0, player0), pushes: 0, moves: 0 };

  const seen = new Set([key(b0, normOf(b0, player0))]);
  let frontier = [{ bl: b0, player: player0, moves: 0 }];
  let nodes = 0, pushes = 0;

  while (frontier.length) {
    pushes++;
    const next = [];
    for (const cur of frontier) {
      const r = reach(cur.bl, cur.player);
      for (let bi = 0; bi < cur.bl.length; bi++) {
        const b = cur.bl[bi];
        for (const d of [-1, 1, -w, w]) {
          const behind = b - d, target = b + d;
          if (behind < 0 || behind >= N || target < 0 || target >= N) continue;
          if (Math.abs(d) === 1 && (Math.floor(behind / w) !== Math.floor(b / w) || Math.floor(target / w) !== Math.floor(b / w))) continue;
          if (walls[target] || target === exitIdx || cur.bl.includes(target)) continue;
          const bd = r.dist(behind);
          if (bd < 0) continue;
          const nb = cur.bl.slice();
          nb[bi] = target;
          nb.sort((a, z) => a - z);
          const moves = cur.moves + bd + 1;
          if (solvedNow(nb)) {
            if (exitReachable(nb, b)) return { solvable: true, pushes, moves: moves + 2, nodes };
            continue;
          }
          const k = key(nb, normOf(nb, b));
          if (seen.has(k)) continue;
          seen.add(k);
          next.push({ bl: nb, player: b, moves });
          if (++nodes > maxNodes) return { solvable: false, reason: 'cap', nodes };
        }
      }
    }
    frontier = next;
  }
  return { solvable: false, reason: 'exhausted', nodes };
}

// ── generator ──
// depth: 1..∞. Deterministic for (depth, seed).
// Returns {def, pushes, moves, budget} — def is parseLevel-compatible.
function genLevel(depth, seed) {
  const rng = mulberry32((seed | 0) + depth * 7919);
  const w = Math.min(11, 7 + Math.floor(depth / 3));
  const h = Math.min(9, 6 + Math.floor(depth / 4));
  const nBlocks = Math.min(4, 1 + Math.floor(depth / 3));
  const extraWalls = Math.min(10, Math.floor(depth * 0.6));
  let minPushes = Math.min(10, 2 + Math.floor(depth * 0.5));
  const N = () => w * h;

  for (let attempt = 0; attempt < 80; attempt++) {
    if (attempt && attempt % 12 === 0) minPushes = Math.max(2, minPushes - 1);
    const pulls = minPushes * 2 + 4;
    const walls = new Uint8Array(w * h);
    for (let c = 0; c < w; c++) { walls[c] = 1; walls[(h - 1) * w + c] = 1; }
    for (let r = 0; r < h; r++) { walls[r * w] = 1; walls[r * w + w - 1] = 1; }
    const interior = [];
    for (let r = 1; r < h - 1; r++) for (let c = 1; c < w - 1; c++) interior.push(r * w + c);

    const pool = interior.slice();
    for (let i = 0; i < extraWalls && pool.length; i++) {
      const idx = Math.floor(rng() * pool.length);
      walls[pool[idx]] = 1;
      pool.splice(idx, 1);
    }

    const free = interior.filter(i => !walls[i]);
    if (free.length < nBlocks * 2 + 6) continue;

    // free space must be connected
    {
      const q = [free[0]]; const vis = new Set(q); let head = 0;
      while (head < q.length) {
        const i = q[head++];
        for (const d of [-1, 1, -w, w]) {
          const j = i + d;
          if (Math.abs(d) === 1 && Math.floor(j / w) !== Math.floor(i / w)) continue;
          if (j < 0 || j >= w * h || walls[j] || vis.has(j)) continue;
          vis.add(j); q.push(j);
        }
      }
      if (vis.size !== free.length) continue;
    }

    // BFS distances from `start` over floor minus blocks (exit optional block)
    const bfs = (start, blocks, blockExit, exitIdx2) => {
      const dist = new Int16Array(w * h).fill(-1);
      const q = [start]; let head = 0;
      dist[start] = 0;
      while (head < q.length) {
        const i = q[head++];
        for (const d of [-1, 1, -w, w]) {
          const j = i + d;
          if (j < 0 || j >= w * h) continue;
          if (Math.abs(d) === 1 && Math.floor(j / w) !== Math.floor(i / w)) continue;
          if (walls[j] || blocks.includes(j) || dist[j] >= 0) continue;
          if (blockExit && j === exitIdx2) continue;
          dist[j] = dist[i] + 1;
          q.push(j);
        }
      }
      return dist;
    };

    const pick = arr => arr.splice(Math.floor(rng() * arr.length), 1)[0];
    const avail = free.slice();

    // solved state: blocks on switches
    const switches = [];
    for (let i = 0; i < nBlocks; i++) {
      if (!avail.length) break;
      switches.push(pick(avail));
    }
    if (switches.length < nBlocks || !avail.length) continue;
    let blocks = switches.slice();
    let player = avail[Math.floor(rng() * avail.length)];

    // scramble with recorded pulls
    const pullSeq = [];
    let stuck = false, last = null;
    for (let k = 0; k < pulls; k++) {
      const dists = bfs(player, blocks, false, -1);
      const cands = [];
      for (const b of blocks) {
        for (const v of [-1, 1, -w, w]) {
          const p1 = b - v, p2 = b - 2 * v;
          if (p1 < 0 || p1 >= w * h || p2 < 0 || p2 >= w * h) continue;
          if (Math.abs(v) === 1 && (Math.floor(p1 / w) !== Math.floor(b / w) || Math.floor(p2 / w) !== Math.floor(b / w))) continue;
          if (walls[p1] || walls[p2] || blocks.includes(p1) || blocks.includes(p2)) continue;
          if (last && b === last.p1 && v === -last.v) continue;
          if (dists[p1] < 0 && player !== p1) continue;
          cands.push({ b, v, p1, p2, walk: player === p1 ? 0 : dists[p1] });
        }
      }
      if (!cands.length) { stuck = true; break; }
      const m = cands[Math.floor(rng() * cands.length)];
      blocks = blocks.map(b => (b === m.b ? m.p1 : b));
      player = m.p2;
      last = m;
      pullSeq.push(m);
    }
    if (stuck || !pullSeq.length) continue;
    if (switches.every(s => blocks.includes(s))) continue; // still solved

    // difficulty lower bound: block -> nearest switch manhattan sum
    let lb = 0;
    for (const b of blocks) {
      let best = 1e9;
      for (const s of switches) {
        best = Math.min(best, Math.abs((b % w) - (s % w)) + Math.abs(Math.floor(b / w) - Math.floor(s / w)));
      }
      lb += best;
    }
    if (lb < Math.max(2, Math.floor(minPushes * 0.5))) continue;

    // exit placement: replay the recorded solution forward with the
    // exit tile acting as a wall; must not sever the solution
    const used = new Set([...switches, ...blocks, player]);
    const exitCands = free.filter(i => !used.has(i));
    let exitIdx = -1, solMoves = 0;
    for (let tries = 0; tries < 8 && exitCands.length; tries++) {
      const ei = exitCands.splice(Math.floor(rng() * exitCands.length), 1)[0];
      let pos = player;
      let bl = blocks.slice();
      let moves = 0, ok = true;
      for (let i = pullSeq.length - 1; i >= 0; i--) {
        const m = pullSeq[i]; // forward push: stand p2, block p1 -> b
        const dd = bfs(pos, bl, true, ei);
        if (pos !== m.p2 && dd[m.p2] < 0) { ok = false; break; }
        moves += (pos === m.p2 ? 0 : dd[m.p2]) + 1;
        bl = bl.map(b => (b === m.p1 ? m.b : b));
        pos = m.p1;
      }
      if (!ok) continue;
      const fin = bfs(pos, bl, false, -1);
      if (fin[ei] < 0 && pos !== ei) continue;
      moves += (pos === ei ? 0 : fin[ei]);
      exitIdx = ei; solMoves = moves;
      break;
    }
    if (exitIdx < 0) continue;

    // reject too-easy: if a small search solves it under minPushes.
    // capped-out search = hard enough = accept.
    const chk = fastSolve(w, h, walls, switches, exitIdx, blocks, player, 3500);
    if (chk.solvable && chk.pushes < minPushes) continue;
    const bestMoves = chk.solvable ? Math.min(chk.moves, solMoves) : solMoves;

    // decorative coins
    const coinCands = free.filter(i => !used.has(i) && i !== exitIdx);
    const nCoins = Math.min(3, 1 + Math.floor(rng() * 3));
    const coins = [];
    for (let i = 0; i < nCoins && coinCands.length; i++) {
      coins.push(coinCands.splice(Math.floor(rng() * coinCands.length), 1)[0]);
    }

    const rows = [];
    for (let r = 0; r < h; r++) {
      let s = '';
      for (let c = 0; c < w; c++) {
        const i = r * w + c;
        if (walls[i]) s += '#';
        else if (i === exitIdx) s += 'x';
        else if (blocks.includes(i)) s += (switches.includes(i) ? 'B' : 'b');
        else if (switches.includes(i)) s += 's';
        else if (i === player) s += '@';
        else if (coins.includes(i)) s += 'o';
        else s += '.';
      }
      rows.push(s);
    }
    const budget = Math.ceil(bestMoves * 1.6) + 8;
    return { def: { map: rows }, pushes: pullSeq.length, moves: bestMoves, budget };
  }

  // ultimate fallback (should be unreachable)
  return {
    def: { map: ['#######', '#@.b.s#', '#....x#', '#######'] },
    pushes: 2, moves: 6, budget: 20,
  };
}

// Timed Rush: fixed 5-level gauntlet for a seed
function genTimedRun(seed) {
  const depths = [2, 4, 6, 8, 10];
  return depths.map((d, i) => genLevel(d, seed + i * 131071));
}

if (typeof module !== 'undefined') {
  module.exports = { genLevel, genTimedRun, fastSolve, mulberry32 };
}
