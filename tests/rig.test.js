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
const windup = SkeletonRig._attackPose(0.32);
const strike = SkeletonRig._attackPose(0.68);
const loop = SkeletonRig._attackPose(1);
expect('attack starts from the rest pose', Math.abs(rest.swordArm.r) < 0.001);
expect('attack winds the sword arm far backward', windup.swordArm.r < -0.85);
expect('attack swings the sword arm through a wide arc', strike.swordArm.r > 1.5);
expect('attack lunges the whole skeleton forward', strike.root.x > 35);
expect('attack rotates the torso into the strike', strike.body.r > 0.35);
expect('attack braces both legs in opposite directions',
  strike.frontLeg.r < -0.15 && strike.backLeg.r > 0.1);
expect('attack returns to rest for a clean loop', Math.abs(loop.swordArm.r) < 0.001);

if (failed) {
  console.error('\n' + failed + ' RIG TEST(S) FAILED');
  process.exit(1);
}
console.log('\nALL RIG TESTS PASSED');
