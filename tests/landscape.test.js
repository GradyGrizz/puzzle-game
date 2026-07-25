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
const main = fs.readFileSync(path.join(root, 'js', 'main.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

expect('installed game declares landscape orientation',
  manifest.orientation === 'landscape');
expect('portrait viewport hides the game device',
  html.includes('@media (orientation: portrait)') &&
  html.includes('#device { visibility: hidden !important; }'));
expect('portrait viewport displays a dedicated landscape blocker',
  html.includes('id="landscape-lock"') &&
  html.includes('Portrait mode is disabled.'));
expect('runtime requests a landscape orientation lock',
  main.includes("orientation.lock('landscape')"));
expect('portrait pauses game updates and rendering',
  main.includes('if (this.portraitBlocked)') &&
  main.includes('this.lastTs = ts;'));
expect('canvas uses device-pixel scaling without CSS distortion',
  main.includes('this.canvas.width = this.W * dpr') &&
  main.includes('this.canvas.height = this.H * dpr') &&
  main.includes('this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)'));

if (failed) {
  console.error('\n' + failed + ' LANDSCAPE TEST(S) FAILED');
  process.exit(1);
}
console.log('\nALL LANDSCAPE TESTS PASSED');
