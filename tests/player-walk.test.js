'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
const spriteLabReference = fs.readFileSync(path.join(root, 'js', 'sprite-lab-reference-animations.js'), 'utf8');
const sheet = fs.readFileSync(
  path.join(root, 'art', 'animations', 'player_walk_right', 'sprite_sheet_review.png')
);
const upSheet = fs.readFileSync(
  path.join(root, 'art', 'animations', 'player_walk_up', 'sprite_sheet_review.png')
);
const downSheet = fs.readFileSync(
  path.join(root, 'art', 'animations', 'player_walk_down', 'sprite_sheet_review.png')
);

// PNG IHDR stores width and height as unsigned big-endian integers.
const width = sheet.readUInt32BE(16);
const height = sheet.readUInt32BE(20);
const upWidth = upSheet.readUInt32BE(16);
const upHeight = upSheet.readUInt32BE(20);
const downWidth = downSheet.readUInt32BE(16);
const downHeight = downSheet.readUInt32BE(20);
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

expect('approved walk sheets remain byte-for-byte locked',
  sha256(sheet) === 'd2ed36cdb5eda10f087f92c3c54f53c50ad32cd83befc68f218995b413540ac2' &&
  sha256(upSheet) === '9906ef3e21e1a17128fa974109704426688820e51f8f10dabce748ed3d8da6e2' &&
  sha256(downSheet) === '749aa56360edf3820567f5616aa2932e24684c67db89c0b8fb271e6539d69a90');
expect('approved player art is cache-versioned as one matching set',
  (art.match(/horizontal-backup-20260725/g) || []).length >= 5);

expect('approved gameplay walk sheet has eight equal 522px cells',
  width === 8 * 522 && height === 763);
expect('horizontal gameplay movement selects the approved walk sheet',
  art.includes("dir === 'right' || dir === 'left' || isUpWalk || isDownWalk") &&
  art.includes('player_walk_right_review'));
expect('left gameplay movement mirrors the approved right cycle',
  art.includes("if (dir === 'left')") && art.includes('ctx.scale(-1, 1)'));
expect('Sprite Lab uses the exact restored horizontal frame order and timing',
  (spriteLabReference.match(/sequence: \[0, 1, 2, 3, 4, 5, 6, 7\], fps: 12/g) || []).length === 2 &&
  spriteLabReference.includes('mirror: true'));
expect('sprite lab and gameplay use the four-frame walk-up sheet',
  upWidth === 4 * 511 && upHeight === 767 &&
  art.includes('player_walk_up_review') &&
  art.includes("const isUpWalk = dir === 'up'") &&
  art.includes('const frameCount = isUpWalk ? 4 : isDownWalk ? 9 : 8') &&
  screens.includes("const isUpWalk = anim.dir === 'up'"));
expect('sprite lab and gameplay use the nine-frame walk-down sheet',
  downWidth === 9 * 487 && downHeight === 679 &&
  art.includes('player_walk_down_review') &&
  art.includes("const isDownWalk = dir === 'down'") &&
  screens.includes("const isDownWalk = anim.dir === 'down'") &&
  game.includes("this.pdir === 'down' ? 9 : 8"));
expect('gameplay advances the walk cycle at twelve frames per second',
  game.includes('Math.floor(this.walkPhase * 5) % walkFrames'));
expect('normal movement uses the animation-matched 2.4 tile speed',
  freeMove.includes('SPEED: 2.4'));
expect('a new walk begins on the neutral first frame',
  freeMove.includes('const wasMoving = !!g.pmoving') &&
  freeMove.includes(': 0;'));
expect('restored horizontal backup has no later whole-body bob overlay',
  art.includes('const dy = py + tile - dh;') &&
  !art.includes('[0, 0, 1, 0, 0, 0, 1, 0]') &&
  !screens.includes('[0, 0, 1, 0, 0, 0, 1, 0]'));
expect('idle movement retains directional idle sprites',
  art.includes("this.img['player_idle_' + dir]"));

if (failed) {
  console.error('\n' + failed + ' PLAYER WALK TEST(S) FAILED');
  process.exit(1);
}
console.log('\nALL PLAYER WALK TESTS PASSED');
