'use strict';
// Runtime cutout rigs. Source art stays untouched; polygon masks cut reusable
// pieces from each flattened PNG while Canvas transforms pose them at runtime.

const SkeletonRig = {
  RIGHT: {
    width: 419, height: 467, centerX: 205, feetY: 408, bodyH: 334,
    parts: {
      backLeg: {
        pivot: [205, 318],
        poly: [[180,292],[255,292],[270,408],[184,418]],
      },
      frontLeg: {
        pivot: [158, 316],
        poly: [[112,292],[205,292],[198,416],[105,416]],
      },
      body: {
        pivot: [187, 305],
        poly: [[105,198],[253,198],[273,315],[250,351],[113,351],[95,280]],
      },
      swordArm: {
        pivot: [224, 242],
        poly: [[205,190],[359,178],[374,286],[298,321],[214,300]],
      },
      head: {
        pivot: [186, 215],
        poly: [[91,57],[275,57],[283,225],[248,251],[111,237],[88,180]],
      },
    },
  },

  _ease(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  },

  _attackPose(progress) {
    const p = ((progress % 1) + 1) % 1;
    let arm, body, head, brace;
    if (p < 0.30) {
      const t = this._ease(p / 0.30);
      arm = -0.48 * t; body = -0.07 * t; head = 0.035 * t; brace = t;
    } else if (p < 0.53) {
      const t = this._ease((p - 0.30) / 0.23);
      arm = -0.48 + 1.42 * t; body = -0.07 + 0.18 * t;
      head = 0.035 - 0.075 * t; brace = 1;
    } else {
      const t = this._ease((p - 0.53) / 0.47);
      arm = 0.94 * (1 - t); body = 0.11 * (1 - t);
      head = -0.04 * (1 - t); brace = 1 - t;
    }
    return {
      head: { r: head, x: body * 18, y: 0 },
      body: { r: body, x: body * 25, y: brace * 2 },
      swordArm: { r: arm, x: body * 26, y: brace * 2 },
      frontLeg: { r: -0.08 * brace, x: 3 * brace, y: 0 },
      backLeg: { r: 0.08 * brace, x: -2 * brace, y: 0 },
    };
  },

  _drawPart(ctx, img, def, pose, originX, originY, scale) {
    const px = def.pivot[0], py = def.pivot[1];
    ctx.save();
    ctx.translate(
      originX + px * scale + (pose.x || 0) * scale,
      originY + py * scale + (pose.y || 0) * scale
    );
    ctx.rotate(pose.r || 0);
    ctx.translate(-px * scale, -py * scale);
    ctx.beginPath();
    const first = def.poly[0];
    ctx.moveTo(first[0] * scale, first[1] * scale);
    for (let i = 1; i < def.poly.length; i++) {
      ctx.lineTo(def.poly[i][0] * scale, def.poly[i][1] * scale);
    }
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, 0, 0, def.width || img.naturalWidth, def.height || img.naturalHeight,
      0, 0, img.naturalWidth * scale, img.naturalHeight * scale);
    ctx.restore();
  },

  drawAttackRight(ctx, cx, feetY, tile, progress) {
    const img = Art.img && Art.img.skeleton_rig_right;
    if (!Art._ready(img)) return false;
    const rig = this.RIGHT;
    const scale = tile * 1.12 / rig.bodyH;
    const originX = Math.round(cx - rig.centerX * scale);
    const originY = Math.round(feetY - rig.feetY * scale);
    const pose = this._attackPose(progress);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const order = ['backLeg', 'frontLeg', 'body', 'swordArm', 'head'];
    for (const name of order) {
      this._drawPart(ctx, img, rig.parts[name], pose[name], originX, originY, scale);
    }
    ctx.restore();
    return true;
  },
};

if (typeof window !== 'undefined') window.SkeletonRig = SkeletonRig;
if (typeof module !== 'undefined') module.exports = { SkeletonRig };
