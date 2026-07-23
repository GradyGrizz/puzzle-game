'use strict';
const path = require('path');
const { Combat } = require(path.join(__dirname, '..', 'js', 'combat.js'));
const { TEST_DUNGEON } = require(path.join(__dirname, '..', 'js', 'levels.js'));
let failures = 0;
function expect(name, cond) { if (cond) console.log('  OK  combat: ' + name); else { console.error('FAIL  combat: ' + name); failures++; } }
const openWorld = { solid: () => false, lineClear: () => true };
const player = (rolling) => ({ x: 1.5, y: 1.5, dir: 'right', rolling: !!rolling });

{
  const st = Combat.create([{ id: 's', type: 'skeleton', r: 1, c: 2 }], {});
  Combat.startAttack(st);
  Combat.update(st, openWorld, player(false), 0.05);
  expect('sword does not hit before active frame', st.enemies[0].hp === 3);
  Combat.update(st, openWorld, player(false), 0.03);
  expect('sword hits during active frame', st.enemies[0].hp === 2);
  Combat.update(st, openWorld, player(false), 0.12);
  expect('one swing damages an enemy only once', st.enemies[0].hp === 2);
}

{
  const st = Combat.create([{ id: 's', type: 'skeleton', r: 1, c: 2 }], {});
  st.enemies[0].state = 'windup'; st.enemies[0].timer = 0;
  Combat.update(st, openWorld, player(true), 0.01);
  expect('roll grants melee invulnerability', st.playerHp === Combat.PLAYER_MAX_HP);
}

{
  const st = Combat.create([{ id: 's', type: 'skeleton', r: 1, c: 2 }], {});
  st.enemies[0].state = 'windup'; st.enemies[0].timer = 0;
  Combat.update(st, openWorld, player(false), 0.01);
  expect('melee attack damages player', st.playerHp === Combat.PLAYER_MAX_HP - 1);
  expect('post-hit invulnerability is applied', st.playerInvuln > 0);
}

{
  const st = Combat.create([], {});
  st.projectiles.push({ x: 1, y: 1, vx: 4, vy: 0, life: 2 });
  const wallWorld = { solid: x => x >= 1.25, lineClear: () => true };
  Combat.update(st, wallWorld, { x: 9, y: 9, dir: 'left', rolling: false }, 0.1);
  expect('dart disappears when it hits a wall', st.projectiles.length === 0);
}

{
  const st = Combat.create([], {});
  st.projectiles.push({ x: 1.1, y: 1.5, vx: 4, vy: 0, life: 2 });
  Combat.update(st, openWorld, player(true), 0.1);
  expect('roll grants dart invulnerability', st.playerHp === Combat.PLAYER_MAX_HP);
}

{
  const st = Combat.create([{ id: 's', type: 'skeleton', r: 1, c: 2 }], {});
  let died = false;
  for (let i = 0; i < Combat.PLAYER_MAX_HP; i++) {
    st.playerInvuln = 0; st.enemies[0].state = 'windup'; st.enemies[0].timer = 0;
    died = Combat.update(st, openWorld, player(false), 0.01).some(e => e.type === 'playerDead') || died;
  }
  expect('zero health emits player death', st.playerHp === 0 && st.playerDead && died);
}
{
  const st = Combat.create([{ id: 'dead', type: 'skeleton', r: 1, c: 2 }], { dead: true });
  expect('defeated enemies stay defeated within a run', st.enemies.length === 0);
}

expect('test dungeon is exactly 30x15', TEST_DUNGEON.map.length === 15 && TEST_DUNGEON.map.every(r => r.length === 30));
for (const ch of ['b', 'h', 's', 'p', 'c', 'f', 'u', 'o', 'k', 'C', 'd', 'x']) {
  expect('test dungeon includes ' + ch, TEST_DUNGEON.map.some(row => row.includes(ch)));
}
expect('test dungeon contains both enemy types', TEST_DUNGEON.enemies.some(e => e.type === 'skeleton') && TEST_DUNGEON.enemies.some(e => e.type === 'dart'));

console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL COMBAT TESTS PASSED');
process.exit(failures ? 1 : 0);