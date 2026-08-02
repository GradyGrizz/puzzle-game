'use strict';

const fs = require('fs');
const path = require('path');

let failed = 0;
function expect(name, ok) {
  if (ok) console.log('  OK  ' + name);
  else { console.error('FAIL  ' + name); failed++; }
}

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const screens = fs.readFileSync(path.join(root, 'js', 'screens.js'), 'utf8');
const game = fs.readFileSync(path.join(root, 'js', 'game.js'), 'utf8');
const reference = fs.readFileSync(
  path.join(root, 'js', 'sprite-lab-reference-animations.js'), 'utf8'
);

expect('reference animation module loads before Sprite Lab screens',
  html.indexOf('js/sprite-lab-reference-animations.js') >= 0 &&
  html.indexOf('js/sprite-lab-reference-animations.js') < html.indexOf('js/screens.js'));
expect('Sprite Lab delegates to the isolated reference module',
  screens.includes('SpriteLabReferenceAnimations.draw(ctx, id, anim, t, x, y, tile)'));
expect('all four walk directions have reference timing profiles',
  ['up', 'down', 'left', 'right'].every(dir => reference.includes(dir + ': {')));
expect('push study includes anticipation, contact hold, and recovery',
  reference.includes('const PUSH =') &&
  reference.includes('drive: [-0.055') &&
  reference.includes('frame === 4 || frame === 5'));
expect('gameplay does not call the Sprite Lab reference module',
  !game.includes('SpriteLabReferenceAnimations'));

if (failed) {
  console.error('\n' + failed + ' SPRITE LAB REFERENCE TEST(S) FAILED');
  process.exit(1);
}
console.log('\nALL SPRITE LAB REFERENCE TESTS PASSED');

