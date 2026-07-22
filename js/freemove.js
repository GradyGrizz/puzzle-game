'use strict';
// ── FreeMove: Zelda: Link's Awakening-style continuous player movement ──
// The player (and, later, enemies) move freely in sub-tile space with an
// AABB hitbox that slides along walls. Everything else — blocks, bramble,
// pits, fire, switches, chests, doors — stays on the tile grid, and all the
// puzzle rules run through the tested tile engine (move()): when the player
// pushes into a block/bush/chest we snap an engine "cursor" to the player's
// tile and call move() in that direction, so pushing, pit-fills, fire-snuffs,
// switch presses, cuts and chest opens behave exactly as before.
//
// Position convention: g.px, g.py are the player CENTRE in tile units; tile
// (r,c) spans [c,c+1] x [r,r+1] with centre (c+0.5, r+0.5).

const FM = {
  HALF: 0.30,        // half hitbox width (≈0.6 tile)
  SPEED: 3.6,        // tiles / second
  PUSH_T: 0.24,      // seconds of shoving before a block slides
  ALIGN: 12,         // how fast pushing snaps you into the block's lane

  STEP: { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] },

  setCell(g, r, c) { g.px = c + 0.5; g.py = r + 0.5; g.state.player.r = r; g.state.player.c = c; },

  // is tile (r,c) solid to the player right now?
  solid(g, r, c) {
    const st = g.state;
    if (r < 0 || c < 0 || r >= st.h || c >= st.w) return true;
    const t = st.tiles[r][c];
    if (t === TILE.WALL) {
      const d = g._doors && g._doors[r + ',' + c];
      return !(d && d.open);                    // an open doorway is a walkable gap
    }
    if (blockAt(st, r, c)) return true;
    if (st.chest && !st.chest.opened && st.chest.r === r && st.chest.c === c) return true;
    const inv = g.inventory();
    if (t === TILE.BUSH) return true;            // solid; cut on contact if armed
    if (t === TILE.FIRE) return !inv.shield;
    if (t === TILE.PIT) return !inv.boots;
    if (t === TILE.DOOR) return st.keys <= 0;
    if (t === TILE.EXIT) return !st.exitOpen;
    return false;
  },

  // resolve movement along one axis; record which solid cells were hit
  _axis(g, dx, dy, contacts) {
    const H = this.HALF;
    if (dx) {
      let px = g.px + dx;
      const dir = dx > 0 ? 1 : -1;
      const edge = px + dir * H;
      const cc = Math.floor(edge);
      const r0 = Math.floor(g.py - H + 1e-4), r1 = Math.floor(g.py + H - 1e-4);
      for (let r = r0; r <= r1; r++) {
        if (this.solid(g, r, cc)) { px = dir > 0 ? cc - H - 1e-4 : cc + 1 + H + 1e-4; contacts.push({ r, c: cc, dir: dir > 0 ? 'e' : 'w' }); break; }
      }
      g.px = px;
    }
    if (dy) {
      let py = g.py + dy;
      const dir = dy > 0 ? 1 : -1;
      const edge = py + dir * H;
      const cr = Math.floor(edge);
      const c0 = Math.floor(g.px - H + 1e-4), c1 = Math.floor(g.px + H - 1e-4);
      for (let c = c0; c <= c1; c++) {
        if (this.solid(g, cr, c)) { py = dir > 0 ? cr - H - 1e-4 : cr + 1 + H + 1e-4; contacts.push({ r: cr, c, dir: dir > 0 ? 's' : 'n' }); break; }
      }
      g.py = py;
    }
  },

  // snap an engine cursor to the player's tile and step toward `side`
  _act(g, side) {
    const st = g.state;
    st.player.r = Math.floor(g.py); st.player.c = Math.floor(g.px);
    const before = cloneState(st);
    const [dc, dr] = this.STEP[side];
    const res = move(st, dc, dr, g.inventory());
    return { res, before };
  },

  update(g, dt) {
    const events = [];
    if (g.gameMode === 'story') g._doors = g._doorCells(); else g._doors = null;
    const h = g.held || {};
    let vx = (h.right ? 1 : 0) - (h.left ? 1 : 0);
    let vy = (h.down ? 1 : 0) - (h.up ? 1 : 0);
    const moving = !!(vx || vy);
    if (vx && vy) { const k = Math.SQRT1_2; vx *= k; vy *= k; }
    if (moving) g.pdir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
    g.state.player.dir = g.pdir;

    const contacts = [];
    const step = this.SPEED * dt;
    if (vx) this._axis(g, vx * step, 0, contacts);
    if (vy) this._axis(g, 0, vy * step, contacts);

    g.pmoving = moving;
    if (moving) g.walkPhase = (g.walkPhase || 0) + step;

    this._contacts(g, contacts, dt, events);
    this._cell(g, events);
    // keep the engine cursor on the player's tile for hints/darkness/etc.
    g.state.player.r = Math.floor(g.py); g.state.player.c = Math.floor(g.px);
    return events;
  },

  _contacts(g, contacts, dt, events) {
    const st = g.state;
    // 1) locked-door contact: spend a key to unbar it (both sides)
    for (const ct of contacts) {
      const d = g._doors && g._doors[ct.r + ',' + ct.c];
      if (!d || d.open) continue;
      if (d.type === 'lock') {
        if (st.keys > 0) { st.keys--; g.dkeys = st.keys; g._unlockDoor(g.roomId, d.side); g._doors = g._doorCells(); events.push({ type: 'unlock' }); }
        else events.push({ type: 'lockedBump' });
      } else if (d.type === 'shutter') events.push({ type: 'shutterBump' });
    }
    // classify remaining contacts
    let block = null, bush = null, chest = null;
    for (const ct of contacts) {
      if (blockAt(st, ct.r, ct.c)) block = ct;
      else if (st.tiles[ct.r][ct.c] === TILE.BUSH) bush = ct;
      else if (st.chest && !st.chest.opened && st.chest.r === ct.r && st.chest.c === ct.c) chest = ct;
    }
    // 2) cut bramble on contact (instant, feels like a slash)
    if (bush && g.inventory().sword) {
      const { res, before } = this._act(g, bush.dir);
      if (res.ok && res.events.some(e => e.type === 'cut')) { g._pushHistory(before); g.state = res.state; g.pushT = 0; events.push(...res.events); return; }
    } else if (bush) { events.push({ type: 'needItem', item: 'sword' }); }
    // 3) open chest on contact
    if (chest) {
      const { res, before } = this._act(g, chest.dir);
      if (res.ok && res.events.some(e => e.type === 'chest')) { events.push({ type: '_chest', res, before }); return; }
    }
    // 4) shove a block: sustained push, then slide one tile via the engine
    if (block) {
      this._align(g, block, dt);
      g.pushT = (g.pushT || 0) + dt;
      if (g.pushT >= this.PUSH_T) {
        const { res, before } = this._act(g, block.dir);
        const pushEv = res.events.find(e => e.type === 'push');
        if (res.ok && pushEv) {
          g._pushHistory(before);
          g.state = res.state;
          g.blockSlide = { fr: pushEv.fr, fc: pushEv.fc, tr: pushEv.tr, tc: pushEv.tc, t: 0 };
          this.setCell(g, res.state.player.r, res.state.player.c); // follow the stone in
          events.push(...res.events);
        } else if (!res.ok) {
          const need = res.events.find(e => e.type === 'needItem');
          if (need) events.push(need);
        }
        g.pushT = 0;
      }
    } else {
      g.pushT = 0;
    }
  },

  // ease the player into the block's lane so pushes go straight
  _align(g, ct, dt) {
    const k = Math.min(1, dt * this.ALIGN);
    if (ct.dir === 'e' || ct.dir === 'w') g.py += (ct.r + 0.5 - g.py) * k;
    else g.px += (ct.c + 0.5 - g.px) * k;
  },

  // interactions with the tile under the player's centre
  _cell(g, events) {
    const st = g.state;
    const r = Math.floor(g.py), c = Math.floor(g.px);
    if (r < 0 || c < 0 || r >= st.h || c >= st.w) return;
    const key = r + ',' + c;
    if (g._lastTile !== key) { g.steps = (g.steps || 0) + 1; g._lastTile = key; } // "moves" for the challenge budget
    if (st.items[key] === 'coin') { delete st.items[key]; st.coinsGot++; events.push({ type: 'coin' }); }
    else if (st.items[key] === 'key') { delete st.items[key]; st.keys++; g.dkeys = st.keys; events.push({ type: 'key' }); }
    if (st.tiles[r][c] === TILE.EXIT && st.exitOpen && !st.won) { st.won = true; events.push({ type: 'win' }); }
    if (g.gameMode === 'story' && g._doors) {
      const d = g._doors[key];
      if (d && d.open) events.push({ type: 'door', side: d.side });
    }
  },
};

if (typeof window !== 'undefined') window.FM = FM;
if (typeof module !== 'undefined') module.exports = { FM };
