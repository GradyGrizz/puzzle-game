'use strict';

const { SkeletonRig } = require('../js/rig.js');

let failed = 0;
function expect(name, ok) {
  if (ok) console.log('  OK  ' + name);
  else { console.error('FAIL  ' + name); failed++; }
}

const rig = SkeletonRig.RIGHT;
const required = ['head', 'body', 'swordArm', 'frontLeg', 'backLeg'];
expect('right skeleton rig defines every required body part',
  required.every(name => rig.parts[name] && rig.parts[name].poly.length >= 3));

const rest = SkeletonRig._attackPose(0);
const windup = SkeletonRig._attackPose(0.30);
const strike = SkeletonRig._attackPose(0.53);
const loop = SkeletonRig._attackPose(1);
expect('attack starts from the rest pose', Math.abs(rest.swordArm.r) < 0.001);
expect('attack winds the sword arm backward', windup.swordArm.r < -0.4);
expect('attack swings the sword arm forward', strike.swordArm.r > 0.8);
expect('attack returns to rest for a clean loop', Math.abs(loop.swordArm.r) < 0.001);

if (failed) {
  console.error('\n' + failed + ' RIG TEST(S) FAILED');
  process.exit(1);
}
console.log('\nALL RIG TESTS PASSED');
