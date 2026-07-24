'use strict';
// Reusable real-time combat simulation. Positions are tile-space centres.
// The module has no canvas/save dependencies, so timing and collision rules
// can be tested in Node and reused by future enemy types.

const Combat = {
  ENEMY: {
    skeleton: { hp: 3, speed: 1.35, aggro: 7, range: 0.95, windup: 25 / 36, cooldown: 0.9 },
    dart:     { hp: 2, speed: 1.05, aggro: 9, range: 7.0, windup: 0.48, cooldown: 1.45 },
  },
  PLAYER_MAX_HP: 5,
  PLAYER_INVULN: 0.75,
  ATTACK_ACTIVE: 0.07,
  ATTACK_DURATION: 0.22,
  ATTACK_RANGE: 1.2,

  create(spawns, defeated) {
    const gone = defeated || {};
    return {
      enemies: (spawns || []).filter((s, i) => !gone[s.id || ('enemy-' + i)]).map((s, i) => {
        const type = this.ENEMY[s.type] ? s.type : 'skeleton';
        const cfg = this.ENEMY[type];
        return {
          id: s.id || ('enemy-' + i), type, x: s.c + 0.5, y: s.r + 0.5,
          hp: cfg.hp, maxHp: cfg.hp, state: 'idle', timer: 0,
          cooldown: (i % 3) * 0.18, flash: 0, dead: false, faceX: 0, faceY: 1,
        };
      }),
      projectiles: [],
      effects: [],
      attack: null,
      attackSeq: 0,
      playerHp: this.PLAYER_MAX_HP,
      playerInvuln: 0,
      playerDead: false,
    };
  },

  startAttack(state) {
    if (!state || state.playerDead || state.attack) return false;
    state.attack = { t: 0, struck: false, seq: ++state.attackSeq };
    return true;
  },

  update(state, world, player, dt) {
    if (!state) return [];
    const events = [];
    state.playerInvuln = Math.max(0, state.playerInvuln - dt);
    for (const e of state.enemies) {
      e.flash = Math.max(0, e.flash - dt);
      e.cooldown = Math.max(0, e.cooldown - dt);
      if (e.dead) e.timer -= dt;
    }
    for (const fx of state.effects) fx.t -= dt;
    state.effects = state.effects.filter(fx => fx.t > 0);

    if (state.attack) {
      state.attack.t += dt;
      if (!state.attack.struck && state.attack.t >= this.ATTACK_ACTIVE) {
        state.attack.struck = true;
        this._swordHit(state, player, events);
      }
      if (state.attack.t >= this.ATTACK_DURATION) state.attack = null;
    }

    if (!state.playerDead) {
      for (const enemy of state.enemies) {
        if (enemy.dead) continue;
        this._updateEnemy(state, enemy, world, player, dt, events);
      }
      this._updateProjectiles(state, world, player, dt, events);
    }
    state.enemies = state.enemies.filter(e => !e.dead || e.timer > -0.35);
    return events;
  },

  _swordHit(state, player, events) {
    const dir = {
      up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
    }[player.dir] || [0, 1];
    for (const e of state.enemies) {
      if (e.dead) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      const dist = Math.hypot(dx, dy);
      const dot = dist > 0 ? (dx * dir[0] + dy * dir[1]) / dist : 1;
      if (dist <= this.ATTACK_RANGE && dot >= 0.25) {
        e.hp--;
        e.flash = 0.14;
        const k = dist > 0 ? 0.24 / dist : 0;
        e.x += dx * k; e.y += dy * k;
        state.effects.push({ type: 'hit', x: e.x, y: e.y, t: 0.18 });
        events.push({ type: 'enemyHit', enemy: e });
        if (e.hp <= 0) {
          e.dead = true; e.timer = 0;
          events.push({ type: 'enemyDead', enemy: e });
        }
      }
    }
  },

  _updateEnemy(state, e, world, player, dt, events) {
    const cfg = this.ENEMY[e.type];
    let dx = player.x - e.x, dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    dx /= dist; dy /= dist;
    e.faceX = dx; e.faceY = dy;
    if (dist > cfg.aggro) { e.state = 'idle'; return; }

    if (e.state === 'windup') {
      e.timer -= dt;
      if (e.timer <= 0) {
        if (e.type === 'skeleton') {
          if (dist <= cfg.range + 0.25) this._hurtPlayer(state, player, 1, dx, dy, events, 'melee');
        } else {
          state.projectiles.push({ x: e.x, y: e.y, vx: dx * 4.4, vy: dy * 4.4, life: 2.4 });
          events.push({ type: 'dartFired', enemy: e });
        }
        e.state = 'cooldown'; e.cooldown = cfg.cooldown;
      }
      return;
    }
    if (e.cooldown > 0) { e.state = 'cooldown'; return; }

    if (e.type === 'skeleton') {
      if (dist <= cfg.range) { e.state = 'windup'; e.timer = cfg.windup; events.push({ type: 'enemyWindup', enemy: e }); }
      else this._move(e, dx, dy, cfg.speed * dt, world);
    } else {
      if (dist >= 2.8 && dist <= cfg.range && world.lineClear(e.x, e.y, player.x, player.y)) {
        e.state = 'windup'; e.timer = cfg.windup; events.push({ type: 'enemyWindup', enemy: e });
      } else {
        const sign = dist < 2.5 ? -1 : 1;
        this._move(e, dx * sign, dy * sign, cfg.speed * dt, world);
      }
    }
  },

  _move(e, dx, dy, step, world) {
    const nx = e.x + dx * step;
    if (!world.solid(nx, e.y, 0.27)) e.x = nx;
    const ny = e.y + dy * step;
    if (!world.solid(e.x, ny, 0.27)) e.y = ny;
  },

  _updateProjectiles(state, world, player, dt, events) {
    for (const p of state.projectiles) {
      p.life -= dt;
      const steps = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy) * dt / 0.18));
      for (let i = 0; i < steps && p.life > 0; i++) {
        p.x += p.vx * dt / steps; p.y += p.vy * dt / steps;
        if (world.solid(p.x, p.y, 0.10)) { p.life = 0; events.push({ type: 'dartImpact', x: p.x, y: p.y }); break; }
        if (Math.hypot(p.x - player.x, p.y - player.y) < 0.42) {
          this._hurtPlayer(state, player, 1, p.vx, p.vy, events, 'dart');
          p.life = 0; break;
        }
      }
    }
    state.projectiles = state.projectiles.filter(p => p.life > 0);
  },

  _hurtPlayer(state, player, amount, dx, dy, events, source) {
    if (state.playerDead || state.playerInvuln > 0 || player.rolling) return false;
    state.playerHp = Math.max(0, state.playerHp - amount);
    state.playerInvuln = this.PLAYER_INVULN;
    const len = Math.hypot(dx, dy) || 1;
    events.push({ type: 'playerHit', hp: state.playerHp, dx: dx / len, dy: dy / len, source });
    if (state.playerHp <= 0) {
      state.playerDead = true;
      events.push({ type: 'playerDead' });
    }
    return true;
  },

  render(state, ctx, board, t) {
    if (!state || !board) return;
    const { bx, by, T } = board;
    for (const e of state.enemies) {
      if (e.dead && e.timer < -0.35) continue;
      const x = bx + (e.x - 0.5) * T, y = by + (e.y - 0.5) * T;
      ctx.save();
      if (e.flash > 0) ctx.globalAlpha = 0.45 + 0.55 * Math.sin(t * 55);
      if (e.dead) ctx.globalAlpha = Math.max(0, 1 + e.timer / 0.35);
      if (e.type === 'skeleton') this._drawSkeleton(ctx, x, y, T, e);
      else this._drawDarter(ctx, x, y, T, e);
      ctx.restore();
    }
    for (const p of state.projectiles) {
      const x = bx + p.x * T, y = by + p.y * T;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillStyle = '#d9c46b'; ctx.fillRect(-T * 0.22, -2, T * 0.44, 4);
      ctx.fillStyle = '#7b5931'; ctx.fillRect(-T * 0.28, -1, T * 0.12, 2);
      ctx.restore();
    }
    for (const fx of state.effects) {
      const x = bx + fx.x * T, y = by + fx.y * T;
      ctx.fillStyle = `rgba(255,235,150,${Math.min(1, fx.t * 6)})`;
      ctx.fillRect(x - 3, y - T * 0.36, 6, T * 0.72);
      ctx.fillRect(x - T * 0.36, y - 3, T * 0.72, 6);
    }
  },

  _drawSkeleton(ctx, x, y, T, e) {
    const attackRight = typeof Art !== 'undefined' && Art.img && Art.img.skeleton_attack_right;
    const facingRight = Math.abs(e.faceX) > Math.abs(e.faceY) && e.faceX > 0;
    const attackElapsed = this.ENEMY.skeleton.windup - Math.max(0, e.timer);
    const frame = typeof spriteLabAttackFrameAt === 'function'
      ? spriteLabAttackFrameAt(attackElapsed) : 0;
    const frameImage = typeof Art !== 'undefined' && Art.img
      ? Art.img['skeleton_attack_right_' + String(frame + 1).padStart(2, '0')] : null;
    if (e.state === 'windup' && facingRight && frameImage && Art._ready(frameImage)
        && typeof spriteLabAttackImage === 'function') {
      const scale = SKELETON_ATTACK_SCALE[frame];
      const drawImg = spriteLabAttackImage(frameImage, frame);
      // Frame 1's opaque body is 873px tall inside its 1254px canvas.
      // A 1.61T canvas therefore produces the same ~1.12T body height as idle.
      const box = T * 1.61 * scale;
      const iw = drawImg.naturalWidth || drawImg.width;
      const ih = drawImg.naturalHeight || drawImg.height;
      const fit = Math.min(box / iw, box / ih);
      const dw = Math.round(iw * fit), dh = Math.round(ih * fit);
      const cy = y + T - (SKELETON_ATTACK_FEET[frame] / 1254 - 0.5) * box;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(drawImg, Math.round(x + T / 2 - dw / 2), Math.round(cy - dh / 2), dw, dh);
      return;
    }
    if (e.state === 'windup' && facingRight && attackRight && Art._ready(attackRight)) {
      const progress = 1 - Math.max(0, e.timer) / this.ENEMY.skeleton.windup;
      const oldFrame = Math.min(7, Math.max(0, Math.floor(progress * 8)));
      const sx = Math.floor(oldFrame * attackRight.naturalWidth / 8);
      const ex = Math.floor((oldFrame + 1) * attackRight.naturalWidth / 8);
      const sw = ex - sx, sh = attackRight.naturalHeight;
      const dh = Math.round(T * 3.4), dw = Math.round(dh * sw / sh);
      const dx = Math.round(x + (T - dw) / 2);
      const dy = Math.round(y - T * 1.33);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(attackRight, sx, 0, sw, sh, dx, dy, dw, dh);
      return;
    }
    const sprite = typeof Art !== 'undefined' && Art.img && Art.img.skeleton;
    if (sprite && Art._ready(sprite)) {
      const dir = Math.abs(e.faceX) > Math.abs(e.faceY)
        ? (e.faceX < 0 ? 'left' : 'right')
        : (e.faceY < 0 ? 'up' : 'down');
      const frames = {
        left:  [373, 175, 238, 319],
        right: [927, 175, 237, 319],
        up:    [429, 591, 231, 299],
        down:  [882, 591, 232, 299],
      };
      const [sx, sy, sw, sh] = frames[dir];
      const dh = Math.round(T * 1.12);
      const dw = Math.round(dh * sw / sh);
      const dx = Math.round(x + (T - dw) / 2);
      const dy = Math.round(y + T - dh);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, sx, sy, sw, sh, dx, dy, dw, dh);
      return;
    }
    const w = Math.max(2, Math.floor(T / 9));
    ctx.fillStyle = '#e4dfc6';
    ctx.fillRect(x + T * 0.31, y + T * 0.12, T * 0.38, T * 0.28);
    ctx.fillRect(x + T * 0.39, y + T * 0.40, T * 0.22, T * 0.36);
    ctx.fillStyle = '#17131b';
    ctx.fillRect(x + T * 0.38, y + T * 0.22, w, w);
    ctx.fillRect(x + T * 0.57, y + T * 0.22, w, w);
    ctx.strokeStyle = e.state === 'windup' ? '#ff6655' : '#c8a647';
    ctx.lineWidth = Math.max(2, T / 12);
    ctx.beginPath(); ctx.moveTo(x + T * 0.62, y + T * 0.48); ctx.lineTo(x + T * 0.88, y + T * 0.18); ctx.stroke();
  },

  _drawDarter(ctx, x, y, T, e) {
    ctx.fillStyle = e.state === 'windup' ? '#d96a4e' : '#7762a8';
    ctx.fillRect(x + T * 0.22, y + T * 0.24, T * 0.56, T * 0.54);
    ctx.fillStyle = '#d8c8a0';
    ctx.fillRect(x + T * 0.34, y + T * 0.12, T * 0.32, T * 0.28);
    ctx.fillStyle = '#2c203b';
    ctx.fillRect(x + T * 0.42, y + T * 0.20, Math.max(2, T / 9), Math.max(2, T / 9));
    ctx.fillStyle = '#b48a45';
    ctx.fillRect(x + T * 0.62, y + T * 0.43, T * 0.28, Math.max(3, T / 10));
  },
};

if (typeof window !== 'undefined') window.Combat = Combat;
if (typeof module !== 'undefined') module.exports = { Combat };
