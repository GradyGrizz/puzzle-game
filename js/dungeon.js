'use strict';
// ── Dungeon: multi-room world built on top of the single-room engine ──
// Rooms sit on a grid (gx,gy). Each room is a normal engine level; the
// dungeon layer adds doorways at the four edge centres, room-to-room
// transitions, a shared key pool, and per-room persistent state.
//
// Door types (declared per room per side in the data):
//   open    — always passable
//   shutter — barred until THIS room is solved (all switches covered)
//   lock    — needs a key (consumed once, then permanently open)
// A side with no door is solid wall. Neighbour rooms are found by grid
// adjacency. Reaching the exit stairs in the goal room clears the dungeon.

const D_OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
const D_STEP = { n: { dc: 0, dr: -1 }, s: { dc: 0, dr: 1 }, e: { dc: 1, dr: 0 }, w: { dc: -1, dr: 0 } };
const D_GRID = { n: { x: 0, y: -1 }, s: { x: 0, y: 1 }, e: { x: 1, y: 0 }, w: { x: -1, y: 0 } };
const D_SIDES = ['n', 's', 'e', 'w'];

const Dungeon = {
  dims(room) { return { w: room.map[0].length, h: room.map.length }; },

  doorCell(w, h, side) {
    const mc = (w - 1) >> 1, mr = (h - 1) >> 1;
    if (side === 'n') return { r: 0, c: mc };
    if (side === 's') return { r: h - 1, c: mc };
    if (side === 'w') return { r: mr, c: 0 };
    return { r: mr, c: w - 1 }; // e
  },

  // the walkable cell just inside a door (where you stand / land)
  innerCell(w, h, side) {
    const d = this.doorCell(w, h, side), st = D_STEP[side];
    return { r: d.r - st.dr, c: d.c - st.dc };
  },

  neighborId(dun, room, side) {
    const g = D_GRID[side], nx = room.gx + g.x, ny = room.gy + g.y;
    for (const id in dun.rooms) {
      const rr = dun.rooms[id];
      if (rr.gx === nx && rr.gy === ny) return id;
    }
    return null;
  },

  roomSolved(state) { return Engine.switchesDone(state); },

  // which sides of `room` are currently passable, given its live state and
  // the set of unlocked lock-doors (keyed "roomId:side")
  passableSides(dun, roomId, state, unlocked, solvedLatch) {
    const room = dun.rooms[roomId];
    const out = {};
    const doors = room.doors || {};
    // a shutter stays open once the room has ever been solved (latched), even
    // if blocks are later moved back off the switches
    const solved = !!solvedLatch || this.roomSolved(state);
    for (const side of D_SIDES) {
      const type = doors[side];
      if (!type) continue;
      if (type === 'open') out[side] = true;
      else if (type === 'shutter') out[side] = solved;
      else if (type === 'lock') out[side] = !!unlocked[roomId + ':' + side];
    }
    return out;
  },
};

if (typeof module !== 'undefined') module.exports = { Dungeon, D_OPP, D_STEP, D_SIDES };
if (typeof window !== 'undefined') { window.Dungeon = Dungeon; window.D_OPP = D_OPP; window.D_STEP = D_STEP; window.D_SIDES = D_SIDES; }
