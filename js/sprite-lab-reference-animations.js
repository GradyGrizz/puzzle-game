'use strict';

// Sprite-Lab-only motion studies. These profiles translate common top-down
// pixel-animation principles into DELVE's original sprites; they do not copy
// character artwork from another game and are never used by gameplay.
//
// Motion references:
// - 4-frame contact/passing walk with counter-swinging arms:
//   https://pixelartapp.com/walk-cycle
// - planted-foot discipline, head arc, and uniform sprite-sheet cells:
//   https://spritegen.io/guides/how-to-animate-pixel-art/
// - 4-direction top-down walk conventions (CC0 reference asset):
//   https://store.godotengine.org/asset/snoblin/top-down-prototype-character/
// - anticipation, timing, follow-through, and weight:
//   https://www.gamedeveloper.com/production/the-12-principles-of-animation-in-video-games

const SpriteLabReferenceAnimations = (() => {
  const WALK = {
    up: {
      image: 'player_walk_up_review', count: 4,
      // contact, passing/step, contact, opposite step
      sequence: [0, 1, 1, 2, 3, 3], fps: 12,
    },
    down: {
      image: 'player_walk_down_review', count: 9,
      // Briefly hold the two full-stride poses so the feet read at game scale.
      sequence: [0, 1, 2, 2, 3, 4, 5, 6, 6, 7, 8], fps: 13,
    },
    right: {
      image: 'player_walk_right_review', count: 8,
      // Exact gameplay playback for the restored July 25 backup.
      sequence: [0, 1, 2, 3, 4, 5, 6, 7], fps: 12,
      bob: [0, 0, 1, 0, 0, 0, 1, 0],
    },
    left: {
      image: 'player_walk_right_review', count: 8,
      sequence: [0, 1, 2, 3, 4, 5, 6, 7], fps: 12,
      bob: [0, 0, 1, 0, 0, 0, 1, 0],
      mirror: true,
    },
  };

  // Heavy pushes spend more time in contact/compression than anticipation.
  const PUSH = {
    fps: 10,
    drive: [-0.055, -0.025, 0.012, 0.040, 0.050, 0.050, 0.028, 0.005],
    crouch: [0, 0, 0.006, 0.016, 0.026, 0.026, 0.012, 0],
  };

  function shadow(ctx, x, y, tile) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y - 3, tile * 0.28, tile * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function studyBlock(ctx, x, y, size) {
    if (Art._ready(Art.img.block)) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(Art.img.block, Math.round(x), Math.round(y),
        Math.round(size), Math.round(size));
      return;
    }
    ctx.fillStyle = PAL.blF;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(size), Math.round(size));
    ctx.fillStyle = PAL.blH;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(size),
      Math.max(2, Math.round(size * 0.18)));
  }

  function drawSheet(ctx, profile, t, x, y, tile) {
    const sheet = Art.img[profile.image];
    if (!Art._ready(sheet)) return false;
    const sequenceFrame = Math.floor(t * profile.fps) % profile.sequence.length;
    const frame = profile.sequence[sequenceFrame];
    const sw = Math.floor(sheet.naturalWidth / profile.count);
    const sh = sheet.naturalHeight;
    const dh = Math.round(tile * 1.05);
    const dw = Math.round(dh * sw / sh);
    const dx = Math.round(x - dw / 2);
    const bob = profile.bob ? profile.bob[frame] * Math.max(1, Math.round(tile / 30)) : 0;
    const dy = Math.round(y - dh + bob);
    shadow(ctx, x, y, tile);
    ctx.imageSmoothingEnabled = false;
    if (profile.mirror) {
      ctx.save();
      ctx.translate(dx + dw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, frame * sw, 0, sw, sh, 0, 0, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(sheet, frame * sw, 0, sw, sh, dx, dy, dw, dh);
    }
    return true;
  }

  function drawPush(ctx, dir, t, x, y, tile) {
    const img = Art.img['player_idle_' + dir];
    if (!Art._ready(img)) return false;
    const face = {
      up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
    }[dir];
    const frame = Math.floor(t * PUSH.fps) % PUSH.drive.length;
    const drive = PUSH.drive[frame] * tile;
    const crouch = PUSH.crouch[frame] * tile;
    const fx = face[0], fy = face[1];
    const blockSize = tile * 0.64;
    const blockDistance = tile * 0.62 + Math.max(0, drive) * 0.42;
    const blockX = x + fx * blockDistance - blockSize / 2;
    const blockY = y - tile * 0.50 + fy * blockDistance - blockSize / 2;

    // Up/left blocks sit behind the character; down/right blocks sit in front.
    if (fy < 0 || fx < 0) studyBlock(ctx, blockX, blockY, blockSize);
    shadow(ctx, x, y, tile);

    const dh = Math.round(tile * 1.05);
    const dw = Math.round(dh * img.naturalWidth / img.naturalHeight);
    const bodyX = Math.round(x - dw / 2 + fx * drive);
    const bodyY = Math.round(y - dh + fy * drive + crouch);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, bodyX, bodyY, dw, dh);
    if (fy > 0 || fx > 0) studyBlock(ctx, blockX, blockY, blockSize);

    // Contact ticks make the compression/hold readable without redrawing the
    // approved sprite. They appear only during the two heaviest push frames.
    if (frame === 4 || frame === 5) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = PAL.goldHi;
      const tick = Math.max(1, Math.round(tile / 34));
      const cx = x + fx * tile * 0.42;
      const cy = y - tile * 0.52 + fy * tile * 0.34;
      ctx.fillRect(Math.round(cx - fy * tick * 3), Math.round(cy + fx * tick * 3), tick, tick * 2);
      ctx.fillRect(Math.round(cx + fy * tick * 3), Math.round(cy - fx * tick * 3), tick, tick * 2);
      ctx.restore();
    }
    return true;
  }

  function draw(ctx, id, anim, t, x, y, tile) {
    if (id !== 'hero') return false;
    if (anim.kind === 'walk' && WALK[anim.dir]) {
      return drawSheet(ctx, WALK[anim.dir], t, x, y, tile);
    }
    if (anim.kind === 'push') return drawPush(ctx, anim.dir, t, x, y, tile);
    return false;
  }

  return { draw, WALK, PUSH };
})();
