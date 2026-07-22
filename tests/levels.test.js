'use strict';
// Engine mechanics unit tests (per-room puzzle rules). Full multi-room
// dungeon solvability lives in tests/dungeons.test.js.
// Run: node tests/levels.test.js

const path = require('path');
const { solve, parseLevel, move } = require(path.join(__dirname, '..', 'js', 'engine.js'));

let failures = 0;

// sanity checks on engine mechanics
function expect(name, cond) {
  if (cond) console.log(`  OK  mechanic: ${name}`);
  else { console.error(`FAIL  mechanic: ${name}`); failures++; }
}

// push onto switch opens exit
{
  const def = { map: ['#####', '#@bsx'.replace('x', 'x') + '', '#####'] };
  const st = parseLevel({ map: ['######', '#@bs.#', '#....#', '###x##'] });
  const r1 = move(st, 1, 0, {});
  expect('push block onto switch opens exit', r1.ok && r1.state.exitOpen);
}

// block fills pit
{
  const st = parseLevel({ map: ['######', '#@bp.#', '######'] });
  const r1 = move(st, 1, 0, {});
  const fell = r1.ok && r1.state.blocks.length === 0 && r1.state.tiles[1][3] === '.';
  expect('block pushed into pit fills it', fell);
  if (fell) {
    // push already moved player to c2; one more step lands on the filled pit
    const r2 = move(r1.state, 1, 0, {});
    expect('player can walk over filled pit', r2.ok && r2.state.player.c === 3);
  }
}

// crack breaks behind player
{
  const st = parseLevel({ map: ['#####', '#@c.#', '#####'] });
  const r1 = move(st, 1, 0, {});
  const r2 = move(r1.state, 1, 0, {});
  expect('crack becomes pit after leaving', r2.ok && r2.state.tiles[1][2] === 'p');
  const r3 = move(r2.state, -1, 0, {});
  expect('cannot walk back into new pit', !r3.ok);
}

// key opens door
{
  const st = parseLevel({ map: ['#####', '#@kd#', '#####'] });
  const r1 = move(st, 1, 0, {});
  expect('key picked up', r1.ok && r1.state.keys === 1);
  const r2 = move(r1.state, 1, 0, {});
  expect('door consumes key and opens', r2.ok && r2.state.keys === 0 && r2.state.player.c === 3);
}

// door blocks without key
{
  const st = parseLevel({ map: ['#####', '#@d.#', '#####'] });
  const r1 = move(st, 1, 0, {});
  expect('door blocks without key', !r1.ok);
}

// bush blocks without sword, cuts with sword
{
  const st = parseLevel({ map: ['#####', '#@u.#', '#####'] });
  const r1 = move(st, 1, 0, {});
  expect('bush blocks without sword', !r1.ok);
  const r2 = move(st, 1, 0, { sword: true });
  expect('sword cuts bush (no step)', r2.ok && r2.state.player.c === 1 && r2.state.tiles[1][2] === '.');
  const r3 = move(r2.state, 1, 0, { sword: true });
  expect('walk through cut bush', r3.ok && r3.state.player.c === 2);
}

// fire: shield gating + block snuff
{
  const st = parseLevel({ map: ['#####', '#@f.#', '#####'] });
  const r1 = move(st, 1, 0, {});
  expect('fire blocks without shield', !r1.ok);
  const r2 = move(st, 1, 0, { shield: true });
  expect('shield walks through fire (fire persists)', r2.ok && r2.state.player.c === 2 && r2.state.tiles[1][2] === 'f');
}
{
  const st = parseLevel({ map: ['######', '#@bf.#', '######'] });
  const r1 = move(st, 1, 0, {});
  expect('block snuffs fire and stays', r1.ok && r1.state.tiles[1][3] === '.' && r1.state.blocks[0].c === 3
    && r1.events.some(e => e.type === 'snuff'));
}

// heavy block needs glove
{
  const st = parseLevel({ map: ['######', '#@h..#', '######'] });
  const r1 = move(st, 1, 0, {});
  expect('heavy block blocks without glove', !r1.ok);
  const r2 = move(st, 1, 0, { glove: true });
  expect('glove pushes heavy block', r2.ok && r2.state.blocks[0].c === 3);
}

// chest requires opening before exit unlocks
{
  const st = parseLevel({ map: ['#####', '#@Cx#', '#####'], chest: { item: 'sword' } });
  expect('exit closed while chest unopened', !st.exitOpen);
  const r1 = move(st, 1, 0, {});
  expect('bumping chest opens it', r1.ok && r1.state.chest.opened && r1.state.exitOpen);
}

// undo safety: move never mutates its input state
{
  const st = parseLevel({ map: ['######', '#@b..#', '######'] });
  const before = JSON.stringify(st);
  move(st, 1, 0, {});
  expect('move() does not mutate input state', JSON.stringify(st) === before);
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL TESTS PASSED');
process.exit(failures ? 1 : 0);
