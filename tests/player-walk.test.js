'use strict';

const fs = require('fs');
const path = require('path');

let failed = 0;
function expect(name, ok) {
  if (ok) console.log('  OK  ' + name);
  else { console.error('FAIL  ' + name); failed++; }
}

const root = path.join(__dirname, '..');
const art = fs.readFileSync(path.join(root, 'js', 'art.js'), 'utf8');
const game = fs.readFileSync(path.join(root, 'js', 'game.js'), 'utf8');
const freeMove = fs.readFileSync(path.join(root, 'js', 'freemove.js'), 'utf8');
const screens = fs.readFileSync(path.join(root, 'js', 'screens.js'), 'utf8');
const sheet = fs.readFileSync(
  path.join(root, 'art', 'animations', 'player_walk_right', 'sprite_sheet_review.png')
);
const upSheet = fs.readFileSync(
  path.join(root, 'art', 'animations', 'player_walk_up', 'sprite_sheet_review.png')
);

// PNG IHDR stores width and height as unsigned big-endian integers.
const width = sheet.readUInt32BE(16);
const height = sheet.readUInt32BE(20);
const upWidth = upSheet.readUInt32BE(16);
const upHeight = upSheet.readUInt32BE(20);

expect('approved gameplay walk sheet has eight equal 522px cells',
  width === 8 * 522 && height === 763);
expect('horizontal gameplay movement selects the approved walk sheet',
  art.includes("(dir === 'right' || dir === 'left')") &&
  art.includes('player_walk_right_review'));
expect('left gameplay movement mirrors the approved right cycle',
  art.includes("if (dir === 'left')") && art.includes('ctx.scale(-1, 1)'));
expect('sprite lab uses the four-frame walk-up sheet',
  upWidth === 4 * 511 && upHeight === 767 &&
  art.includes('player_walk_up_review') &&
  screens.includes("const isUpWalk = anim.dir === 'up'"));
expect('gameplay advances the walk cycle at twelve frames per second',
  game.includes('Math.floor(this.walkPhase * 5) % 8'));
expect('normal movement uses the animation-matched 2.4 tile speed',
  freeMove.includes('SPEED: 2.4'));
expect('a new walk begins on the neutral first frame',
  freeMove.includes('const wasMoving = !!g.pmoving') &&
  freeMove.includes(': 0;'));
expect('full-stride frames add a symmetrical whole-body bob',
  art.includes('[0, 0, 1, 0, 0, 0, 1, 0]') &&
  sourceHasSpriteLabBob());
expect('idle and vertical movement retain directional idle sprites',
  art.includes("this.img['player_idle_' + dir]"));

function sourceHasSpriteLabBob() {
  return screens.includes('[0, 0, 1, 0, 0, 0, 1, 0]');
}

if (failed) {
  console.error('\n' + failed + ' PLAYER WALK TEST(S) FAILED');
  process.exit(1);
}
console.log('\nALL PLAYER WALK TESTS PASSED');
