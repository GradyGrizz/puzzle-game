'use strict';
// ── Game screen: plays one puzzle level with anims + sfx ──────

const MOVE_MS = 150;

const ScreenGame = {
  // mode: dialog | play | moving | chest | won | results
  enter(params) {
    const found = getStoryLevel(params.levelId);
    this.chapter = found.chapter;
    this.lv = found.level;
    this.levelId = this.lv.id;
    this.firstTime = !Save.isLevelDone(this.levelId);
    this.state = parseLevel(this.lv);
    this.history = [];
    this.filled = {};       // "r,c" -> true (sunken block, visual only)
    this.mode = 'play';
    this.t = 0;
    this.anim = null;       // move tween
    this.fallAnim = null;   // {r,c,t}
    this.cutAnim = null;    // {r,c,t} bush slash
    this.chestAnim = null;  // {phase, t, item}
    this.dialog = null;
    this.toast = null;
    this.flash = 0;
    this.exitGlow = 0;
    this.heldDir = null;
    this.queued = null;
    this.holdTimer = 0;
    this.wonT = 0;
    this.resultList = null;
    this.frame = 0;
    Snd.playMusic('dungeon');
    if (this.lv.intro && this.firstTime) {
      this.showDialog(this.lv.intro, () => {});
    }
  },

  showDialog(text, cb) {
    this.mode = 'dialog';
    this.dialog = { text: String(text), chars: 0, cb };
  },

  showToast(text) {
    this.toast = { text, t: 1.8 };
  },

  inventory() { return Save.data.story.items; },

  // ── input ──
  attemptMove(dc, dr, fromRepeat) {
    if (this.mode !== 'play') return;
    const res = move(this.state, dc, dr, this.inventory());
    const evs = res.events;
    const has = t => evs.some(e => e.type === t);

    if (!res.ok) {
      this.state.player.dir = res.state.player.dir;
      if (!fromRepeat) {
        Snd.bump();
        const need = evs.find(e => e.type === 'needItem');
        if (need) {
          if (need.item === 'key') this.showToast('LOCKED. FIND A KEY.');
          else if (need.item === 'sword') this.showToast('TOO THICK. YOU NEED A BLADE.');
          else if (need.item === 'glove') this.showToast('FAR TOO HEAVY TO PUSH.');
        }
      }
      return;
    }

    // chest bump: no movement, run cutscene
    if (has('chest')) {
      this.history.push(this.state);
      this.state = res.state;
      const ev = evs.find(e => e.type === 'chest');
      this.pendingExitOpen = has('exitOpen');
      this.mode = 'chest';
      this.chestAnim = { phase: 0, t: 0, item: ev.item };
      Snd.chestOpen();
      return;
    }

    // bush cut: no movement
    if (has('cut')) {
      this.history.push(this.state);
      this.state = res.state;
      const ev = evs.find(e => e.type === 'cut');
      this.cutAnim = { r: ev.r, c: ev.c, t: 0.25 };
      Snd.cut();
      return;
    }

    // start tween
    const from = { r: this.state.player.r, c: this.state.player.c };
    const to = { r: res.state.player.r, c: res.state.player.c };
    const pushEv = evs.find(e => e.type === 'push');
    this.history.push(this.state);
    if (this.history.length > 300) this.history.shift();
    this.anim = {
      from, to, t: 0,
      push: pushEv || null,
      events: evs,
      newState: res.state,
    };
    this.mode = 'moving';
    if (evs.some(e => e.type === 'unlock')) Snd.unlock();
    if (evs.some(e => e.type === 'crackBreak')) Snd.crack();
    if (pushEv) Snd.push(); else Snd.step();
  },

  settleMove() {
    const a = this.anim;
    this.anim = null;
    this.state = a.newState;
    this.mode = 'play';
    const has = t => a.events.some(e => e.type === t);
    if (a.push && !has('blockFall')) Snd.thud();
    if (has('blockFall')) {
      const ev = a.events.find(e => e.type === 'blockFall');
      this.fallAnim = { r: ev.r, c: ev.c, t: 0 };
      Snd.fall();
      this.filled[ev.r + ',' + ev.c] = true;
    }
    if (has('switchOn')) Snd.switchOn();
    if (has('coin')) Snd.coin();
    if (has('key')) Snd.keyGet();
    if (has('exitOpen')) {
      Snd.exitOpen();
      this.exitGlow = 1;
      if (!Save.data.settings.reducedFlash) this.flash = 1;
    }
    if (has('win')) {
      this.mode = 'won';
      this.wonT = 0;
      Snd.fanfare();
      return;
    }
    // continue held/queued input
    if (this.queued) {
      const q = this.queued; this.queued = null;
      this.attemptMove(q.dc, q.dr);
    } else if (this.heldDir) {
      this.attemptMove(this.heldDir.dc, this.heldDir.dr, true);
    }
  },

  onDirPress(dc, dr) {
    this.heldDir = { dc, dr };
    this.holdTimer = 0;
    if (this.mode === 'play') this.attemptMove(dc, dr);
    else if (this.mode === 'moving') this.queued = { dc, dr };
    else if (this.mode === 'results' && dr) this.resultList.nav(dr);
  },
  onDirRelease(dc, dr) {
    if (this.heldDir && this.heldDir.dc === dc && this.heldDir.dr === dr) this.heldDir = null;
  },

  onConfirm() {
    if (this.mode === 'dialog') this._advanceDialog();
    else if (this.mode === 'chest') this._advanceChest();
    else if (this.mode === 'results') this.resultList.activate();
  },
  onTap(x, y) {
    if (this.mode === 'dialog') this._advanceDialog();
    else if (this.mode === 'chest') this._advanceChest();
    else if (this.mode === 'results') this.resultList.tapAt(x, y);
    else if (y < 44 && x < 90) this.onBack();
  },
  onBack() {
    if (this.mode === 'dialog') { this._advanceDialog(); return; }
    Snd.back();
    App.setScreen('story');
  },
  onUndo() {
    if (this.mode !== 'play' && this.mode !== 'moving') return;
    if (!this.history.length) { Snd.error(); return; }
    this.anim = null; this.fallAnim = null;
    this.state = this.history.pop();
    // rebuild filled markers is impossible from state alone; recompute:
    // any tile that was crack/pit in the source map but FLOOR now was filled
    this._recomputeFilled();
    this.mode = 'play';
    Snd.undo();
  },
  onReset() {
    if (this.mode !== 'play' && this.mode !== 'moving') return;
    this.anim = null; this.fallAnim = null;
    this.history.push(this.state);
    this.state = parseLevel(this.lv);
    this.filled = {};
    this.exitGlow = 0;
    this.mode = 'play';
    Snd.back();
  },
  _recomputeFilled() {
    this.filled = {};
    const fresh = parseLevel(this.lv);
    for (let r = 0; r < this.state.h; r++) for (let c = 0; c < this.state.w; c++) {
      const t0 = fresh.tiles[r][c], t1 = this.state.tiles[r][c];
      if ((t0 === TILE.PIT || t0 === TILE.CRACK) && t1 === TILE.FLOOR) this.filled[r + ',' + c] = true;
    }
  },

  _advanceDialog() {
    const d = this.dialog;
    if (!d) return;
    if (d.chars < d.text.length) { d.chars = d.text.length; return; }
    Snd.select();
    this.dialog = null;
    this.mode = 'play';
    const cb = d.cb;
    if (cb) cb();
  },

  _advanceChest() {
    const ca = this.chestAnim;
    if (!ca) return;
    if (ca.phase < 2) return; // still animating
    // banner shown -> dismiss
    Save.grantItem(ca.item);
    this.chestAnim = null;
    this.mode = 'play';
    Snd.select();
    if (this.pendingExitOpen) {
      Snd.exitOpen();
      this.exitGlow = 1;
      if (!Save.data.settings.reducedFlash) this.flash = 1;
      this.pendingExitOpen = false;
    }
  },

  _enterResults() {
    const first = this.firstTime && !this._awarded;
    const coins = 5 + this.state.coinsGot + (first ? 10 : 0);
    this._awarded = true;
    this.earned = { base: 5, collected: this.state.coinsGot, bonus: first ? 10 : 0, total: coins };
    Save.completeStoryLevel(this.levelId, this.state.moves, coins);
    const next = nextStoryLevel(this.levelId);
    const items = [];
    if (next) items.push({ label: 'NEXT LEVEL', action: () => App.setScreen('game', { levelId: next.id }) });
    items.push({ label: 'LEVEL SELECT', action: () => App.setScreen('story') });
    this.resultList = new MenuList(items);
    this.mode = 'results';
  },

  // ── update ──
  update(dt) {
    this.t += dt;
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
    if (this.exitGlow > 0) this.exitGlow = Math.max(0, this.exitGlow - dt * 0.4);
    if (this.fallAnim) { this.fallAnim.t += dt; if (this.fallAnim.t > 0.3) this.fallAnim = null; }
    if (this.cutAnim) { this.cutAnim.t -= dt; if (this.cutAnim.t <= 0) this.cutAnim = null; }

    if (this.mode === 'dialog' && this.dialog) {
      this.dialog.chars = Math.min(this.dialog.text.length, this.dialog.chars + dt * 46);
    }

    if (this.mode === 'moving' && this.anim) {
      this.anim.t += dt * 1000;
      this.frame = 1 + Math.floor((this.anim.t / MOVE_MS) * 3.99) % 4;
      if (this.anim.t >= MOVE_MS) { this.frame = 0; this.settleMove(); }
    } else if (this.mode === 'play') {
      // held-direction repeat (handles bumps against walls gracefully)
      if (this.heldDir) {
        this.holdTimer += dt;
        if (this.holdTimer > 0.16) { this.holdTimer = 0; this.attemptMove(this.heldDir.dc, this.heldDir.dr, true); }
      }
    }

    if (this.mode === 'chest' && this.chestAnim) {
      const ca = this.chestAnim;
      ca.t += dt;
      if (ca.phase === 0 && ca.t > 0.55) { ca.phase = 1; ca.t = 0; Snd.itemGet(); }
      else if (ca.phase === 1 && ca.t > 1.0) { ca.phase = 2; ca.t = 0; }
    }

    if (this.mode === 'won') {
      this.wonT += dt;
      if (this.wonT > 1.15) {
        if (this.lv.outro && this.firstTime) {
          const outro = this.lv.outro;
          this.lv = Object.assign({}, this.lv, { outro: null });
          this.showDialog(outro, () => this._enterResults());
          this.mode = 'dialog';
        } else {
          this._enterResults();
        }
      }
    }
  },

  // ── draw ──
  draw(ctx, W, H) {
    ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, W, H);
    const st = this.state;
    const hudH = 48;
    const botH = App.isTouch ? 248 : 36;
    const T = Math.max(8, Math.floor(Math.min((W - 8) / st.w, (H - hudH - botH) / st.h)));
    const bx = Math.floor((W - T * st.w) / 2);
    const by = hudH + Math.floor((H - hudH - botH - T * st.h) / 2);
    this._board = { bx, by, T };

    // tiles
    for (let r = 0; r < st.h; r++) for (let c = 0; c < st.w; c++) {
      const x = bx + c * T, y = by + r * T, t = st.tiles[r][c];
      if (t === TILE.WALL) Art.wall(ctx, x, y, T);
      else if (t === TILE.FLOOR) {
        Art.floor(ctx, x, y, T);
        if (this.filled[r + ',' + c]) {
          // sunken block resting in the filled hole
          ctx.save(); ctx.globalAlpha = 0.55;
          Art.blockRaw(ctx, x, y, T, 0.85);
          ctx.restore();
        }
      }
      else if (t === TILE.EXIT) Art.exitTile(ctx, x, y, T, st.exitOpen, this.exitGlow);
      else if (t === TILE.SWITCH) Art.switchTile(ctx, x, y, T, !!blockAt(st, r, c));
      else if (t === TILE.CRACK) Art.crack(ctx, x, y, T);
      else if (t === TILE.PIT) Art.pit(ctx, x, y, T);
      else if (t === TILE.DOOR) Art.doorLocked(ctx, x, y, T);
      else if (t === TILE.BUSH) Art.bush(ctx, x, y, T);
    }

    // items
    for (const k in st.items) {
      const [r, c] = k.split(',').map(Number);
      const x = bx + c * T, y = by + r * T;
      if (st.items[k] === 'coin') Art.coin(ctx, x, y, T, this.t * 4 + r + c);
      else if (st.items[k] === 'key') Art.key(ctx, x, y, T, this.t * 4 + r);
    }

    // chest
    if (st.chest && st.chest.r >= 0) {
      let phase = st.chest.opened ? 1 : 0;
      if (this.chestAnim && this.chestAnim.phase === 0) phase = Math.min(1, this.chestAnim.t / 0.5);
      Art.chest(ctx, bx + st.chest.c * T, by + st.chest.r * T, T, phase);
    }

    // blocks (skip one being pushed — drawn interpolated)
    const pushEv = (this.anim && this.anim.push) || null;
    for (const b of st.blocks) {
      Art.block(ctx, bx + b.c * T, by + b.r * T, T, false);
    }
    if (pushEv && this.anim) {
      const pr = this.anim.t / MOVE_MS;
      const br = pushEv.fr + (pushEv.tr - pushEv.fr) * pr;
      const bc = pushEv.fc + (pushEv.tc - pushEv.fc) * pr;
      Art.block(ctx, Math.round(bx + bc * T), Math.round(by + br * T), T, false);
    }

    // falling block (into pit/crack)
    if (this.fallAnim) {
      const f = this.fallAnim;
      const sc = Math.max(0.1, 1 - f.t / 0.3);
      Art.pit(ctx, bx + f.c * T, by + f.r * T, T);
      Art.blockRaw(ctx, bx + f.c * T, by + f.r * T, T, sc);
    }

    // bush cut particles
    if (this.cutAnim) {
      const ca = this.cutAnim;
      const x = bx + ca.c * T, y = by + ca.r * T;
      ctx.fillStyle = PAL.greenHi;
      const n = 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const d = (0.25 - ca.t) * T * 2.4;
        ctx.fillRect(x + T / 2 + Math.cos(a) * d, y + T / 2 + Math.sin(a) * d, 3, 3);
      }
    }

    // hero
    let hr = st.player.r, hc = st.player.c;
    let pushing = false;
    if (this.anim) {
      const pr = this.anim.t / MOVE_MS;
      hr = this.anim.from.r + (this.anim.to.r - this.anim.from.r) * pr;
      hc = this.anim.from.c + (this.anim.to.c - this.anim.from.c) * pr;
      pushing = !!this.anim.push;
    }
    Art.hero(ctx, st.player.dir, this.frame, Math.round(bx + hc * T), Math.round(by + hr * T), T, pushing);

    // flash
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(240,180,40,${this.flash * 0.16})`;
      ctx.fillRect(0, 0, W, H);
    }

    this.drawHud(ctx, W, H, hudH);

    if (this.toast) {
      const s = 2;
      const tw = textWidth(this.toast.text, s) + 24;
      const tx = (W - tw) / 2, ty = by - 4;
      ctx.fillStyle = 'rgba(4,5,10,0.9)';
      ctx.fillRect(tx, ty, tw, 24);
      drawText(ctx, this.toast.text, W / 2, ty + 6, s, PAL.goldHi, 'center');
    }

    if (this.mode === 'dialog') this.drawDialog(ctx, W, H);
    if (this.mode === 'chest') this.drawChest(ctx, W, H);
    if (this.mode === 'won') {
      const a = Math.min(0.5, this.wonT * 0.7);
      ctx.fillStyle = `rgba(2,3,6,${a})`; ctx.fillRect(0, 0, W, H);
      drawText(ctx, 'CLEAR!', W / 2, H * 0.4, 5, PAL.goldHi, 'center', '#3a2808');
    }
    if (this.mode === 'results') this.drawResults(ctx, W, H);
  },

  drawHud(ctx, W, H, hudH) {
    ctx.fillStyle = 'rgba(4,5,10,0.8)';
    ctx.fillRect(0, 0, W, hudH);
    ctx.fillStyle = PAL.uiDark; ctx.fillRect(0, hudH - 1, W, 1);
    drawText(ctx, '◀', 16, 16, 2, PAL.uiDim, 'left');
    drawText(ctx, this.levelId + ' ' + this.lv.name, W / 2, 10, 2, PAL.ui, 'center', '#000');
    drawText(ctx, 'MOVES ' + this.state.moves, W / 2, 30, 1, PAL.uiDim, 'center');
    coinsBadge(ctx, W - 12, 14, Save.data.coins + this.state.coinsGot, 2);
    if (this.state.keys > 0) {
      Art.keyIcon(ctx, W - 110, 12, 16);
      drawText(ctx, '×' + this.state.keys, W - 96, 16, 2, PAL.goldHi, 'left');
    }
    // first-time hint below hud
    if (this.lv.hint && this.firstTime && this.mode === 'play' && this.state.moves < 6) {
      drawText(ctx, this.lv.hint, W / 2, hudH + 6, 1, PAL.gold, 'center', '#000');
    }
  },

  drawDialog(ctx, W, H) {
    const s = Math.max(2, Math.floor(W / 240));
    const pw = Math.min(W - 24, 520);
    const lines = wrapText(this.dialog.text, s, pw - 36);
    const lh = 8 * s + 3;
    const ph = lines.length * lh + 44;
    const px = (W - pw) / 2;
    const py = H - ph - (App.isTouch ? 262 : 50);
    Art.panel(ctx, px, py, pw, ph);
    let shown = Math.floor(this.dialog.chars);
    let ty = py + 18;
    for (const ln of lines) {
      if (shown <= 0) break;
      const seg = ln.slice(0, shown);
      shown -= ln.length + 1;
      drawText(ctx, seg, px + 18, ty, s, PAL.ui, 'left');
      ty += lh;
    }
    if (this.dialog.chars >= this.dialog.text.length && Math.floor(this.t * 2) % 2 === 0) {
      drawText(ctx, '▼', px + pw - 20, py + ph - 16, s, PAL.gold, 'left');
    }
  },

  drawChest(ctx, W, H) {
    const ca = this.chestAnim;
    if (!ca) return;
    ctx.fillStyle = 'rgba(2,3,6,0.55)'; ctx.fillRect(0, 0, W, H);
    const b = this._board;
    const st = this.state;
    const cx = b.bx + st.chest.c * b.T, cy = b.by + st.chest.r * b.T;
    // redraw chest above dim
    Art.chest(ctx, cx, cy, b.T, ca.phase === 0 ? Math.min(1, ca.t / 0.5) : 1);
    // item rising
    if (ca.phase >= 1) {
      const rise = ca.phase === 1 ? Math.min(1, ca.t / 0.7) : 1;
      const iy = cy - rise * b.T * 1.1;
      const size = b.T * 0.9;
      // glow
      ctx.fillStyle = `rgba(240,200,80,${0.25 + 0.1 * Math.sin(this.t * 6)})`;
      ctx.beginPath();
      ctx.arc(cx + b.T / 2, iy + size / 2, size * 0.75, 0, Math.PI * 2);
      ctx.fill();
      Art.item(ctx, ca.item, cx + (b.T - size) / 2, iy, size);
    }
    if (ca.phase === 2) {
      const info = ITEMS[ca.item];
      const s = Math.max(2, Math.floor(W / 240));
      const pw = Math.min(W - 32, 460), ph = 96;
      const px = (W - pw) / 2, py = H - ph - (App.isTouch ? 262 : 50);
      Art.panel(ctx, px, py, pw, ph);
      drawText(ctx, 'YOU GOT THE ' + info.name + '!', W / 2, py + 16, s, PAL.goldHi, 'center');
      drawText(ctx, info.desc, W / 2, py + 16 + 10 * s, Math.max(1, s - 1), PAL.ui, 'center');
      if (Math.floor(this.t * 2) % 2 === 0)
        drawText(ctx, '▼', px + pw - 20, py + ph - 14, s, PAL.gold, 'left');
    }
  },

  drawResults(ctx, W, H) {
    ctx.fillStyle = 'rgba(2,3,6,0.72)'; ctx.fillRect(0, 0, W, H);
    const s = Math.max(2, Math.floor(W / 240));
    const pw = Math.min(W - 32, 420), ph = 300;
    const px = (W - pw) / 2, py = Math.max(30, H * 0.14);
    Art.panel(ctx, px, py, pw, ph);
    drawText(ctx, 'LEVEL CLEAR', W / 2, py + 20, s + 1, PAL.goldHi, 'center', '#000');
    drawText(ctx, this.lv.name, W / 2, py + 20 + 9 * (s + 1), Math.max(1, s - 1), PAL.uiDim, 'center');
    let ty = py + 78;
    drawText(ctx, 'MOVES: ' + this.state.moves, W / 2, ty, s, PAL.ui, 'center'); ty += 11 * s;
    const e = this.earned;
    let coinLine = 'COINS +' + e.total;
    if (e.bonus) coinLine += ' (FIRST CLEAR +' + e.bonus + ')';
    drawText(ctx, coinLine, W / 2, ty, s, PAL.goldHi, 'center'); ty += 12 * s;
    this.resultList.draw(ctx, W / 2, py + ph - 118, pw - 60, 44, s);
  },
};
