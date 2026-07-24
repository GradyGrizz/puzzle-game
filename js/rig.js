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
    let arm, body, head, brace, rootX, rootY, stretch;
    if (p < 0.32) {
      // Big anticipation: sit back, open the stance, and pull the sword well
      // behind the skull so the strike has somewhere visible to travel from.
      const t = this._ease(p / 0.32);
      arm = -0.92 * t; body = -0.18 * t; head = 0.11 * t;
      brace = t; rootX = -10 * t; rootY = 5 * t; stretch = -0.035 * t;
    } else if (p < 0.50) {
      // Fast acceleration through the target. The torso and whole body lunge
      // with the sword instead of leaving the arm to do all the movement.
      const t = this._ease((p - 0.32) / 0.18);
      arm = -0.92 + 2.32 * t; body = -0.18 + 0.50 * t;
      head = 0.11 - 0.25 * t; brace = 1;
      rootX = -10 + 42 * t; rootY = 5 - 10 * t; stretch = -0.035 + 0.11 * t;
    } else if (p < 0.68) {
      // Follow-through carries slightly farther before the recovery begins.
      const t = this._ease((p - 0.50) / 0.18);
      arm = 1.40 + 0.24 * t; body = 0.32 + 0.07 * t;
      head = -0.14 - 0.03 * t; brace = 1 - 0.15 * t;
      rootX = 32 + 6 * t; rootY = -5 + 8 * t; stretch = 0.075 - 0.035 * t;
    } else {
      const t = this._ease((p - 0.68) / 0.32);
      arm = 1.64 * (1 - t); body = 0.39 * (1 - t);
      head = -0.17 * (1 - t); brace = 0.85 * (1 - t);
      rootX = 38 * (1 - t); rootY = 3 * (1 - t); stretch = 0.04 * (1 - t);
    }
    return {
      root: { x: rootX, y: rootY },
      head: { r: head, x: body * 26, y: -Math.abs(body) * 8, sx: 1, sy: 1 },
      body: { r: body, x: body * 34, y: brace * 3, sx: 1 + stretch, sy: 1 - stretch * 0.45 },
      swordArm: { r: arm, x: body * 42, y: -Math.max(0, body) * 15, sx: 1, sy: 1 },
      frontLeg: { r: -0.22 * brace, x: 11 * brace, y: -2 * brace, sx: 1, sy: 1 },
      backLeg: { r: 0.18 * brace, x: -9 * brace, y: 4 * brace, sx: 1, sy: 1 },
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
    ctx.scale(pose.sx == null ? 1 : pose.sx, pose.sy == null ? 1 : pose.sy);
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
    const pose = this._attackPose(progress);
    const originX = Math.round(cx - rig.centerX * scale + pose.root.x * scale);
    const originY = Math.round(feetY - rig.feetY * scale + pose.root.y * scale);
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
