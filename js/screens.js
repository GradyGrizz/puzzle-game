'use strict';
// ── Screens: title, menu, story select, settings, intro ───────

// shared dungeon backdrop: dim floor tiles + vignette
function drawBackdrop(ctx, W, H, t) {
  ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, W, H);
  const ts = 44;
  ctx.save();
  ctx.globalAlpha = 0.22;
  for (let r = 0; r < Math.ceil(H / ts); r++)
    for (let c = 0; c < Math.ceil(W / ts); c++)
      Art.floor(ctx, c * ts, r * ts, ts);
  ctx.restore();
  const g = ctx.createRadialGradient(W / 2, H * 0.42, 60, W / 2, H * 0.42, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(8,9,14,0)');
  g.addColorStop(1, 'rgba(2,3,6,0.88)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// vertical menu list with dpad/tap support
class MenuList {
  constructor(items) {
    this.items = items; // [{label, sub?, action, disabled?}]
    this.sel = 0;
    this.rects = [];
  }
  nav(dr) {
    if (!this.items.length) return;
    const n = this.items.length;
    this.sel = (this.sel + dr + n) % n;
    Snd.blip();
  }
  activate() {
    const it = this.items[this.sel];
    if (!it || it.disabled) { Snd.error(); return; }
    Snd.select();
    it.action();
  }
  tapAt(x, y) {
    for (let i = 0; i < this.rects.length; i++) {
      const r = this.rects[i];
      if (r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
        this.sel = i;
        this.activate();
        return true;
      }
    }
    return false;
  }
  // sharp card list: hard pixel shadows, gold selection bar, icons,
  // staggered slide-in when `t` (seconds since screen enter) is given
  draw(ctx, cx, y, w, itemH, s, t) {
    this.rects = [];
    const gap = 10;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const baseY = y + i * (itemH + gap);
      const x = Math.round(cx - w / 2);
      this.rects.push({ x, y: baseY, w, h: itemH });
      const appear = t == null ? 1 : Math.min(1, Math.max(0, (t - i * 0.05) / 0.16));
      if (appear <= 0) continue;
      const ease = 1 - Math.pow(1 - appear, 3);
      const iy = Math.round(baseY + (1 - ease) * 16);
      const seld = i === this.sel;
      ctx.save();
      ctx.globalAlpha = ease;
      // hard pixel drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x + 4, iy + 4, w, itemH);
      // card body
      ctx.fillStyle = seld ? '#161226' : '#0d1120';
      ctx.fillRect(x, iy, w, itemH);
      if (seld) {
        ctx.fillStyle = 'rgba(210,160,40,0.08)';
        ctx.fillRect(x, iy, w, itemH);
      }
      // border
      ctx.fillStyle = seld ? PAL.gold : 'rgba(255,255,255,0.10)';
      ctx.fillRect(x, iy, w, 2); ctx.fillRect(x, iy + itemH - 2, w, 2);
      ctx.fillRect(x, iy, 2, itemH); ctx.fillRect(x + w - 2, iy, 2, itemH);
      // gold accent bar on the left of the selected card
      if (seld) {
        ctx.fillStyle = PAL.goldHi;
        ctx.fillRect(x, iy, 5, itemH);
      }
      // icon
      let textL = x + 16, textR = x + w - 16;
      if (it.icon) {
        const isz = Math.min(28, itemH - 16);
        Art.uiIcon(ctx, it.icon, x + 16, iy + Math.round((itemH - isz) / 2), isz);
        textL = x + 16 + isz + 14;
      }
      const col = it.disabled ? PAL.uiDim : (seld ? PAL.goldHi : PAL.ui);
      const hasSub = !!it.sub;
      const ty = iy + Math.round((itemH - (hasSub ? 7 * s + 5 + 7 : 7 * s)) / 2);
      const tcx = it.icon ? textL : Math.round(x + w / 2);
      const align = it.icon ? 'left' : 'center';
      const maxW = it.icon ? textR - textL : w - 36;
      drawTextFit(ctx, it.label, tcx, ty, maxW, s, col, align, '#000');
      if (hasSub) {
        drawTextFit(ctx, it.sub, tcx, ty + 7 * s + 7, maxW, 1, PAL.uiDim, align);
      }
      ctx.restore();
    }
  }
}

function coinsBadge(ctx, x, y, n, s) {
  const txt = (Save.devOn && Save.devOn()) ? '∞' : String(n);
  const w = textWidth(txt, s) + 14 * s;
  Art.coinIcon(ctx, x - w, y, 7 * s);
  drawText(ctx, txt, x - w + 10 * s, y + s, s, PAL.goldHi, 'left', '#000');
}

// classic drop-and-bounce easing for the logo landing
function easeOutBounce(x) {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) { x -= 1.5 / d1; return n1 * x * x + 0.75; }
  if (x < 2.5 / d1) { x -= 2.25 / d1; return n1 * x * x + 0.9375; }
  x -= 2.625 / d1; return n1 * x * x + 0.984375;
}

// ══ TITLE ═════════════════════════════════════════════════════
// Retro startup sequence (Pokémon-ish): the DELVE logo drops in from the
// top, bounces to a stop with a little screen-shake + thud, a shine sweeps
// across it, then the rest of the screen fades in.
// build stamp — bump this to the deploy time (Arizona/Phoenix time) on each update
const BUILD_STAMP = '7/23/2026 10:29am (mst)';

const ScreenTitle = {
  FALL: 0.85, SHINE_DELAY: 0.12, SHINE_DUR: 0.6,
  t: 0, heroX: -80, frame: 0, landed: false, shineT: -1, shake: 0,
  enter() { this.t = 0; this.heroX = -80; this.landed = false; this.shineT = -1; this.shake = 0; Snd.playMusic('title'); },
  update(dt) {
    this.t += dt;
    this.frame = Math.floor(this.t * 7) % 4;
    if (this.landed) { this.heroX += dt * 42; if (this.heroX > App.W + 80) this.heroX = -80; }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    if (!this.landed && this.t >= this.FALL) {
      this.landed = true; this.shineT = 0; this.shake = 0.22;
      Snd.thud(); Platform.haptic('heavy');
    }
    if (this.shineT >= 0) this.shineT += dt;
  },
  draw(ctx, W, H) {
    drawBackdrop(ctx, W, H, this.t);
    const s = Math.max(2, Math.floor(W / 200));
    const big = Math.max(4, Math.floor(W / 82));
    const ly = H * 0.24;
    const logoW = textWidth('DELVE', big);
    // falling logo with a bounce landing
    const p = Math.min(1, this.t / this.FALL);
    const startY = -7 * big - 30;
    const logoY = Math.round(startY + (ly - startY) * easeOutBounce(p));

    ctx.save();
    if (this.shake > 0) { const k = this.shake / 0.22; ctx.translate(0, Math.round((Math.random() - 0.5) * 9 * k)); }
    drawText(ctx, 'DELVE', W / 2, logoY, big, PAL.goldHi, 'center', '#3a2808');
    // shine sweep across the letters once it lands
    if (this.landed && this.shineT >= this.SHINE_DELAY) {
      const sp = (this.shineT - this.SHINE_DELAY) / this.SHINE_DUR;
      if (sp <= 1) {
        const lx = W / 2 - logoW / 2, band = big * 7, slant = big * 4;
        const cx = lx - band + (logoW + band * 2) * sp;
        const top = logoY - 4, bot = logoY + 7 * big + 4;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, top); ctx.lineTo(cx + band, top);
        ctx.lineTo(cx + band - slant, bot); ctx.lineTo(cx - slant, bot);
        ctx.closePath(); ctx.clip();
        ctx.globalAlpha = 0.92 * Math.sin(sp * Math.PI);
        drawText(ctx, 'DELVE', W / 2, logoY, big, '#fffbe6', 'center');
        ctx.restore();
      }
    }
    ctx.restore();

    // the rest of the screen fades in after the logo settles
    const rev = this.landed ? Math.min(1, this.shineT / 0.35) : 0;
    if (rev <= 0) return;
    ctx.save();
    ctx.globalAlpha = rev;
    drawText(ctx, 'THE KEEP OF ALARIC', W / 2, ly + 7 * big + 12, Math.max(2, s), PAL.ui, 'center', '#000');
    const stripY = H * 0.56, ts = 46;
    for (let c = -1; c < Math.ceil(W / ts) + 1; c++) Art.floor(ctx, c * ts, stripY, ts);
    ctx.fillStyle = 'rgba(2,3,6,0.35)'; ctx.fillRect(0, stripY, W, ts);
    Art.hero(ctx, 'right', this.frame, this.heroX, stripY - 8, ts, false);
    drawText(ctx, 'A DUNGEON PUZZLE', W / 2, H - 40, 1, PAL.uiDim, 'center');
    drawText(ctx, 'UPDATED ' + BUILD_STAMP, W / 2, H - 14, 1, PAL.uiDim, 'center');
    ctx.restore();
    if (rev >= 1 && Math.floor(this.t * 1.6) % 2 === 0) {
      drawText(ctx, 'TAP TO BEGIN', W / 2, H * 0.76, Math.max(2, s - 1), PAL.ui, 'center', '#000');
    }
  },
  _go() {
    Snd.select();
    if (!Save.data.meta.seenIntro) App.setScreen('intro');
    else App.setScreen('menu');
  },
  onTap() { this._go(); },
  onConfirm() { this._go(); },
  onDirPress() {}, onDirRelease() {}, onBack() {},
};

// ══ INTRO (onboarding cards) ══════════════════════════════════
const ScreenIntro = {
  page: 0, t: 0,
  cards: [
    { title: 'PUSH & SOLVE', body: 'PUSH STONE BLOCKS ONTO RED SWITCHES TO UNSEAL THE STAIRS. PLAN AHEAD - BLOCKS ONLY MOVE FORWARD.', art: 'block' },
    { title: 'DELVE DEEPER', body: 'FIND KEYS, OPEN CHESTS, AND CLAIM LOST RELICS. EACH RELIC OPENS NEW PATHS THROUGH THE KEEP.', art: 'chest' },
    { title: 'GROW RICHER', body: 'EARN COINS WITH EVERY PUZZLE. SPEND THEM IN THE SHOP ON GEAR AND STYLES FOR YOUR DELVER.', art: 'coin' },
  ],
  enter() { this.page = 0; this.t = 0; },
  update(dt) { this.t += dt; },
  draw(ctx, W, H) {
    drawBackdrop(ctx, W, H, this.t);
    const s = Math.max(2, Math.floor(W / 200));
    const card = this.cards[Math.min(this.page, this.cards.length - 1)];
    const pw = Math.min(W - 40, 420), ph = 300;
    const px = (W - pw) / 2, py = H * 0.22;
    Art.panel(ctx, px, py, pw, ph);
    drawText(ctx, card.title, W / 2, py + 22, s + 1, PAL.goldHi, 'center', '#000');
    // pictogram
    const ax = W / 2 - 30, ay = py + 60;
    if (card.art === 'block') { Art.block(ctx, ax, ay, 60, false); Art.switchTile(ctx, ax + 70 - 60, ay + 70 - 60 + 60, 0, false); Art.switchTile(ctx, ax - 70, ay, 60, false); }
    else if (card.art === 'chest') Art.chest(ctx, ax, ay, 60, 0);
    else if (card.art === 'coin') Art.coin(ctx, ax, ay, 60, this.t * 4);
    const lines = wrapText(card.body, s, pw - 40);
    let ty = py + 145;
    for (const ln of lines) { drawText(ctx, ln, W / 2, ty, s, PAL.ui, 'center'); ty += 8 * s + 2; }
    // dots
    for (let i = 0; i < this.cards.length; i++) {
      ctx.fillStyle = i === this.page ? PAL.gold : PAL.uiDark;
      ctx.fillRect(W / 2 - this.cards.length * 8 + i * 16 + 4, py + ph - 26, 8, 8);
    }
    if (Math.floor(this.t * 1.6) % 2 === 0)
      drawText(ctx, this.page < this.cards.length - 1 ? 'TAP TO CONTINUE' : 'TAP TO DELVE', W / 2, py + ph + 24, s, PAL.ui, 'center', '#000');
  },
  _next() {
    if (this.page >= this.cards.length) return; // already leaving
    Snd.select();
    this.page++;
    if (this.page >= this.cards.length) {
      Save.data.meta.seenIntro = true; Save.write();
      App.setScreen('menu');
    }
  },
  onTap() { this._next(); },
  onConfirm() { this._next(); },
  onDirPress() {}, onDirRelease() {},
  onBack() { Save.data.meta.seenIntro = true; Save.write(); App.setScreen('menu'); },
};

// ══ MENU ══════════════════════════════════════════════════════
const ScreenMenu = {
  t: 0,
  enter() {
    this.t = 0;
    Snd.playMusic('title');
    const items = [];
    // quick-continue straight into the next unfinished dungeon
    const all = allDungeons();
    const next = all.find(d => !Save.isDungeonDone(d.id) && isDungeonUnlocked(d.id, Save));
    const started = all.some(d => Save.isDungeonDone(d.id));
    const allDone = all.every(d => Save.isDungeonDone(d.id));
    if (next && started) {
      items.push({
        label: 'CONTINUE', sub: next.name, icon: 'play',
        action: () => App.setScreen('game', { gameMode: 'story', dungeonId: next.id }),
      });
    }
    items.push(
      { label: 'STORY', sub: allDone ? 'THE KEEP SHINES AGAIN' : 'THE KEEP OF ALARIC', icon: 'sword', action: () => App.setScreen('story') },
      { label: 'CHALLENGE', sub: 'ENDLESS DEPTHS', icon: 'depth', action: () => App.setScreen('challenge') },
      { label: 'TIMED RUSH', sub: 'RACE THE CLOCK', icon: 'clock', action: () => App.setScreen('timed') },
      { label: 'SHOP', sub: 'SPEND YOUR COINS', icon: 'cart', action: () => App.setScreen('shop') },
      { label: 'SETTINGS', icon: 'gear', action: () => App.setScreen('settings') },
    );
    this.list = new MenuList(items);
  },
  update(dt) { this.t += dt; },
  draw(ctx, W, H) {
    drawBackdrop(ctx, W, H, this.t);
    const s = Math.max(2, Math.floor(W / 220));
    const ts = s + 2;
    drawText(ctx, 'DELVE', W / 2, 38, ts, PAL.goldHi, 'center', '#3a2808');
    // animated gold underline
    const ease = 1 - Math.pow(1 - Math.min(1, this.t / 0.45), 3);
    const uw = Math.round(textWidth('DELVE', ts) * ease);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(Math.round(W / 2 - uw / 2), 38 + 8 * ts + 4, uw, 3);
    coinsBadge(ctx, W - 16, 16, Save.data.coins, Math.max(2, s - 1));
    const iw = Math.min(W - 40, 360);
    this.list.draw(ctx, W / 2, Math.max(112, H * 0.16), iw, 30 + s * 12, s, this.t);
  },
  onDirPress(dc, dr) { if (dr) this.list.nav(dr); },
  onDirRelease() {},
  onConfirm() { this.list.activate(); },
  onTap(x, y) { this.list.tapAt(x, y); },
  onBack() { App.setScreen('title'); Snd.back(); },
};

// ══ DUNGEON SELECT ════════════════════════════════════════════
const ScreenStory = {
  t: 0, sel: 0, cells: [],
  enter() {
    this.t = 0;
    Snd.playMusic('title');
    const all = allDungeons();
    let idx = all.findIndex(d => !Save.isDungeonDone(d.id) && isDungeonUnlocked(d.id, Save));
    if (idx < 0) idx = 0;
    this.sel = idx;
  },
  update(dt) { this.t += dt; },
  draw(ctx, W, H) {
    drawBackdrop(ctx, W, H, this.t);
    const s = Math.max(2, Math.floor(W / 220));
    const all = allDungeons();
    const allDone = all.every(d => Save.isDungeonDone(d.id));

    drawTextFit(ctx, 'THE KEEP OF ALARIC', W / 2, 30, W - 120, s + 1, PAL.goldHi, 'center', '#000');
    drawText(ctx, allDone ? 'THE KEEP SHINES AGAIN.' : 'CHOOSE YOUR DESCENT', W / 2, 30 + 8 * (s + 1) + 6, 1, PAL.uiDim, 'center');
    drawText(ctx, 'BACK', 16, 8, 1, PAL.uiDim, 'left');
    coinsBadge(ctx, W - 16, 4, Save.data.coins, 1);

    const cardW = Math.min(W - 32, 448);
    const cardH = 64, gap = 10;
    const x = (W - cardW) / 2;
    let y = Math.max(80, H * 0.12);
    this.cells = [];
    for (let i = 0; i < all.length; i++) {
      const d = all[i];
      const unlocked = isDungeonUnlocked(d.id, Save);
      const done = Save.isDungeonDone(d.id);
      const seld = i === this.sel;
      const appear = Math.min(1, Math.max(0, (this.t - i * 0.05) / 0.16));
      const ease = 1 - Math.pow(1 - appear, 3);
      const iy = Math.round(y + (1 - ease) * 14);
      this.cells.push({ x, y: iy, w: cardW, h: cardH });
      if (appear > 0) {
        ctx.save();
        ctx.globalAlpha = ease;
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x + 4, iy + 4, cardW, cardH);
        ctx.fillStyle = seld ? '#161226' : '#0d1120'; ctx.fillRect(x, iy, cardW, cardH);
        if (seld) { ctx.fillStyle = 'rgba(210,160,40,0.08)'; ctx.fillRect(x, iy, cardW, cardH); }
        ctx.fillStyle = seld ? PAL.gold : (done ? 'rgba(210,160,40,0.4)' : 'rgba(255,255,255,0.10)');
        ctx.fillRect(x, iy, cardW, 2); ctx.fillRect(x, iy + cardH - 2, cardW, 2);
        ctx.fillRect(x, iy, 2, cardH); ctx.fillRect(x + cardW - 2, iy, 2, cardH);
        if (seld) { ctx.fillStyle = PAL.goldHi; ctx.fillRect(x, iy, 5, cardH); }
        // relic icon (or padlock if sealed)
        const icoX = x + 16, icoY = iy + (cardH - 34) / 2;
        if (unlocked) {
          Art.item(ctx, d.item, icoX, icoY, 34);
        } else {
          ctx.fillStyle = PAL.uiDark;
          const lx = icoX + 6, ly2 = icoY + 6;
          ctx.fillRect(lx + 3, ly2, 14, 7);
          ctx.fillRect(lx + 3, ly2, 3, 10); ctx.fillRect(lx + 14, ly2, 3, 10);
          ctx.fillRect(lx, ly2 + 9, 20, 13);
        }
        const tx = x + 62;
        drawText(ctx, 'DUNGEON ' + (i + 1), tx, iy + 11, 1, PAL.uiDim, 'left');
        drawTextFit(ctx, unlocked ? d.name : '? ? ?', tx, iy + 23, cardW - 150, s, unlocked ? (seld ? PAL.goldHi : PAL.ui) : PAL.uiDim, 'left', '#000');
        drawTextFit(ctx, unlocked ? d.tagline : 'SEALED UNTIL THE PRIOR DELVE IS DONE', tx, iy + 23 + 8 * s + 4, cardW - 82, 1, PAL.uiDim, 'left');
        if (done) drawText(ctx, '★ CLEAR', x + cardW - 14, iy + 11, 1, PAL.gold, 'right');
        else if (unlocked) drawText(ctx, roomCount(d) + ' ROOMS', x + cardW - 14, iy + 11, 1, PAL.uiDim, 'right');
        ctx.restore();
      }
      y += cardH + gap;
    }
    // relics collected so far
    const items = Object.keys(Save.data.story.items);
    if (items.length) {
      let ix = 20;
      const iy = H - (App.isTouch ? 256 : 54);
      drawText(ctx, 'RELICS', ix, iy + 8, 1, PAL.uiDim, 'left');
      ix += 50;
      for (const it of items) { Art.item(ctx, it, ix, iy, 24); ix += 30; }
    }
  },
  _start() {
    const d = allDungeons()[this.sel];
    if (!d || !isDungeonUnlocked(d.id, Save)) { Snd.error(); return; }
    Snd.select();
    App.setScreen('game', { gameMode: 'story', dungeonId: d.id });
  },
  onDirPress(dc, dr) {
    const n = allDungeons().length;
    if (dr) { this.sel = (this.sel + dr + n) % n; Snd.blip(); }
  },
  onDirRelease() {},
  onConfirm() { this._start(); },
  onTap(x, y) {
    if (y < 40 && x < 90) { this.onBack(); return; }
    for (let i = 0; i < this.cells.length; i++) {
      const r = this.cells[i];
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) { this.sel = i; this._start(); return; }
    }
  },
  onBack() { Snd.back(); App.setScreen('menu'); },
};

// ══ SETTINGS ══════════════════════════════════════════════════
// Secret dev-mode code. Client-side only — anyone reading the JS can find
// it, so it's obscurity (hidden entry + code), not real security. Change
// it here anytime. '3358' spells DELV on a phone keypad (D3 E3 L5 V8).
const ScreenSettings = {
  t: 0, sel: 0, scrollY: 0, confirmWipe: false, toast: null,

  enter() {
    this.t = 0; this.scrollY = 0; this.confirmWipe = false;
    this.toast = null;
    this._build();
    this.sel = this.rows.findIndex(r => r.type !== 'header');
  },

  _apply() { Save.write(); Snd.syncVolumes(); },
  _say(t) { this.toast = { text: t, t: 2.2 }; },

  _build() {
    const s = Save.data.settings;
    const rows = [];
    rows.push({ type: 'header', label: 'AUDIO' });
    rows.push({ type: 'toggle', label: 'MUSIC', get: () => s.music, set: v => { s.music = v; this._apply(); } });
    rows.push({ type: 'slider', label: 'MUSIC VOLUME', get: () => s.musicVol, set: v => { s.musicVol = v; this._apply(); }, dim: () => !s.music });
    rows.push({ type: 'toggle', label: 'SOUND FX', get: () => s.sfx, set: v => { s.sfx = v; this._apply(); } });
    rows.push({ type: 'slider', label: 'SFX VOLUME', get: () => s.sfxVol, set: v => { s.sfxVol = v; this._apply(); Snd.blip(); }, dim: () => !s.sfx });
    rows.push({ type: 'header', label: 'GAME' });
    rows.push({ type: 'toggle', label: 'HAPTICS', get: () => s.haptics, set: v => { s.haptics = v; Save.write(); if (v) Platform.haptic(); } });
    rows.push({ type: 'toggle', label: 'REDUCED FLASH', get: () => s.reducedFlash, set: v => { s.reducedFlash = v; Save.write(); } });
    rows.push({ type: 'toggle', label: 'TUTORIAL TIPS', get: () => s.tips !== false, set: v => { s.tips = v; Save.write(); } });
    rows.push({ type: 'button', label: 'CONTROLS', action: () => { Snd.select(); App.setScreen('controls'); } });
    rows.push({ type: 'button', label: 'REPLAY INTRO', action: () => { Snd.select(); App.setScreen('intro'); } });
    rows.push({ type: 'header', label: 'ACCOUNT' });
    rows.push({ type: 'button', label: this.confirmWipe ? 'TAP AGAIN TO ERASE ALL' : 'RESET PROGRESS', danger: true, action: () => this._reset() });
    rows.push({ type: 'button', label: 'LOG OUT', disabled: true, action: () => this._say('ACCOUNTS ARE COMING SOON.') });
    // ── developer mode (separate save profile; account-gated at launch) ──
    rows.push({ type: 'header', label: 'DEVELOPER' });
    rows.push({ type: 'toggle', label: 'DEVELOPER MODE', get: () => Save.devOn(), set: v => this._setDev(v) });
    if (Save.devOn()) rows.push({ type: 'button', label: 'DEV TOOLS', gold: true, action: () => { Snd.select(); App.setScreen('dev'); } });
    this.rows = rows;
  },

  _setDev(on) {
    Save.setDevMode(on);          // swaps to the separate dev/normal profile
    Snd.syncVolumes();
    Art.setSkin(Save.data.shop.skin);
    Art.setTheme(Save.data.shop.theme);
    Snd.select();
    this.confirmWipe = false;
    this._build();
    this._say(on ? 'DEVELOPER MODE ON — SEPARATE PROFILE' : 'DEVELOPER MODE OFF');
  },

  _reset() {
    if (!this.confirmWipe) { this.confirmWipe = true; Snd.blip(); this._build(); return; }
    Save.wipe();                  // wipes only the active profile
    Snd.syncVolumes();
    Art.setSkin(Save.data.shop.skin);
    Art.setTheme(Save.data.shop.theme);
    Snd.error();
    this.confirmWipe = false;
    this._build();
    this._say('PROGRESS ERASED.');
  },

  _focusable(i) { const r = this.rows[i]; return r && r.type !== 'header'; },

  update(dt) {
    this.t += dt;
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
  },

  // ── layout (scrollable card list) ──
  _layout(W, H) {
    const top = 78;
    let y = top - this.scrollY;
    const out = [];
    for (const r of this.rows) {
      const h = r.type === 'header' ? 30 : 54;
      out.push({ row: r, y, h });
      y += h + 8;
    }
    this.contentH = y + this.scrollY - top;
    this.viewH = H - top - 40;
    return out;
  },
  _clampScroll() { this.scrollY = Math.max(0, Math.min(Math.max(0, this.contentH - this.viewH), this.scrollY)); },
  _ensureVisible() {
    const lay = this._layout(App.W, App.H);
    const it = lay[this.sel]; if (!it) return;
    if (it.y < 84) this.scrollY -= (84 - it.y);
    else if (it.y + it.h > App.H - 44) this.scrollY += it.y + it.h - (App.H - 44);
    this._clampScroll();
  },

  draw(ctx, W, H) {
    drawBackdrop(ctx, W, H, this.t);
    const s = Math.max(2, Math.floor(W / 240));
    const lay = this._layout(W, H);
    const pw = Math.min(W - 28, 420), px = (W - pw) / 2;

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 70, W, H - 70); ctx.clip();
    for (let i = 0; i < lay.length; i++) {
      const { row, y, h } = lay[i];
      if (y + h < 60 || y > H) continue;
      if (row.type === 'header') { drawText(ctx, row.label, px + 4, y + 12, 1, PAL.uiDim, 'left'); continue; }
      const seld = i === this.sel;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(px + 4, y + 4, pw, h);
      ctx.fillStyle = seld ? '#161226' : '#0d1120'; ctx.fillRect(px, y, pw, h);
      if (seld) { ctx.fillStyle = 'rgba(210,160,40,0.08)'; ctx.fillRect(px, y, pw, h); }
      const border = row.danger ? PAL.red : (row.gold ? PAL.gold : (seld ? PAL.gold : 'rgba(255,255,255,0.10)'));
      ctx.fillStyle = border;
      ctx.fillRect(px, y, pw, 2); ctx.fillRect(px, y + h - 2, pw, 2);
      ctx.fillRect(px, y, 2, h); ctx.fillRect(px + pw - 2, y, 2, h);
      if (seld) { ctx.fillStyle = row.danger ? PAL.red : PAL.goldHi; ctx.fillRect(px, y, 5, h); }

      const labelCol = row.disabled ? PAL.uiDim : row.danger ? '#e06a58' : row.gold ? PAL.goldHi : (seld ? PAL.goldHi : PAL.ui);
      const midY = y + Math.floor(h / 2);

      if (row.type === 'toggle') {
        drawTextFit(ctx, row.label, px + 16, midY - 6, pw - 120, s, labelCol, 'left');
        const on = row.get();
        const pw2 = 54, ph2 = 24, tx = px + pw - pw2 - 14, ty = midY - ph2 / 2;
        ctx.fillStyle = on ? 'rgba(210,160,40,0.25)' : 'rgba(255,255,255,0.06)';
        ctx.fillRect(tx, ty, pw2, ph2);
        ctx.fillStyle = on ? PAL.gold : 'rgba(255,255,255,0.14)';
        ctx.fillRect(tx, ty, pw2, 2); ctx.fillRect(tx, ty + ph2 - 2, pw2, 2);
        ctx.fillRect(tx, ty, 2, ph2); ctx.fillRect(tx + pw2 - 2, ty, 2, ph2);
        // knob
        ctx.fillStyle = on ? PAL.goldHi : PAL.uiDim;
        ctx.fillRect(on ? tx + pw2 - 20 : tx + 4, ty + 4, 16, ph2 - 8);
        drawText(ctx, on ? 'ON' : 'OFF', on ? tx + 6 : tx + pw2 - 6, midY - 3, 1, on ? PAL.goldHi : PAL.uiDim, on ? 'left' : 'right');
      } else if (row.type === 'slider') {
        const dim = row.dim && row.dim();
        drawText(ctx, row.label, px + 16, y + 10, 1, dim ? PAL.uiDim : (seld ? PAL.goldHi : PAL.ui), 'left');
        const val = row.get();
        const trackX = px + 16, trackW = pw - 84, trackY = y + h - 18;
        row._track = { x: trackX, w: trackW };
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(trackX, trackY, trackW, 6);
        ctx.fillStyle = dim ? PAL.uiDark : (seld ? PAL.goldHi : PAL.gold);
        ctx.fillRect(trackX, trackY, Math.round(trackW * val), 6);
        // knob
        const kx = trackX + Math.round(trackW * val);
        ctx.fillStyle = dim ? PAL.uiDim : PAL.goldHi;
        ctx.fillRect(kx - 3, trackY - 4, 7, 14);
        drawText(ctx, Math.round(val * 100) + '%', px + pw - 14, trackY - 3, 1, dim ? PAL.uiDim : PAL.ui, 'right');
      } else { // button
        drawTextFit(ctx, row.label, px + pw / 2, midY - 3 * s, pw - 32, s, labelCol, 'center', '#000');
      }
    }
    ctx.restore();

    // header bar
    ctx.fillStyle = 'rgba(4,5,10,0.92)'; ctx.fillRect(0, 0, W, 70);
    drawText(ctx, 'SETTINGS', W / 2, 24, s + 1, PAL.goldHi, 'center', '#000');
    drawText(ctx, '◀ BACK', 16, 12, s, PAL.uiDim, 'left');

    if (this.contentH > this.viewH) {
      const frac = this.viewH / this.contentH, barH = Math.max(24, this.viewH * frac);
      const barY = 78 + (this.scrollY / (this.contentH - this.viewH)) * (this.viewH - barH);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(W - 5, barY, 3, barH);
    }

    drawText(ctx, 'DELVE V1.0', W / 2, H - 22, 1, PAL.uiDark, 'center');

    if (this.toast) {
      const tw = textWidth(this.toast.text, 2) + 24;
      ctx.fillStyle = 'rgba(4,5,10,0.94)'; ctx.fillRect((W - tw) / 2, H - 96, Math.min(tw, W - 20), 28);
      drawTextFit(ctx, this.toast.text, W / 2, H - 89, W - 36, 2, PAL.goldHi, 'center');
    }
  },

  // ── input ──
  onDirPress(dc, dr) {
    if (dr) {
      let i = this.sel;
      do { i += dr; } while (i >= 0 && i < this.rows.length && !this._focusable(i));
      if (i >= 0 && i < this.rows.length) { this.sel = i; this.confirmWipe = false; this._build(); Snd.blip(); this._ensureVisible(); }
    } else if (dc) {
      const row = this.rows[this.sel];
      if (row && row.type === 'slider') {
        const v = Math.max(0, Math.min(1, Math.round((row.get() + dc * 0.1) * 10) / 10));
        row.set(v); Snd.tick();
      }
    }
  },
  onDirRelease() {},
  onConfirm() {
    const row = this.rows[this.sel];
    if (!row) return;
    if (row.type === 'toggle') { row.set(!row.get()); Snd.select(); this.confirmWipe = false; this._build(); }
    else if (row.type === 'button') row.action();
    else if (row.type === 'slider') { row.set(row.get() >= 1 ? 0 : Math.min(1, row.get() + 0.1)); }
  },
  onScroll(dy) { this.scrollY -= dy; this._clampScroll(); },

  onTap(x, y) {
    if (y < 40 && x < 110) { this.onBack(); return; }
    const lay = this._layout(App.W, App.H);
    const pw = Math.min(App.W - 28, 420), px = (App.W - pw) / 2;
    for (let i = 0; i < lay.length; i++) {
      const { row, y: ry, h } = lay[i];
      if (row.type === 'header' || ry < 60) continue;
      if (x >= px && x < px + pw && y >= ry && y < ry + h) {
        this.sel = i;
        if (row.type === 'toggle') { row.set(!row.get()); Snd.select(); this.confirmWipe = false; this._build(); }
        else if (row.type === 'button') row.action();
        else if (row.type === 'slider' && row._track) {
          const val = Math.max(0, Math.min(1, (x - row._track.x) / row._track.w));
          row.set(Math.round(val * 20) / 20); Snd.tick();
        }
        return;
      }
    }
  },
  onBack() { Snd.back(); App.setScreen('menu'); },
};

// ══ CONTROLS (reachable from SETTINGS) ════════════════════════
const ScreenControls = {
  t: 0,
  enter() { this.t = 0; this._build(); },
  _build() {
    const scheme = Save.data.settings.controlScheme || 'joystick';
    const items = [
      {
        label: 'MOVEMENT: ' + (scheme === 'dpad' ? 'D-PAD' : 'JOYSTICK'),
        sub: scheme === 'dpad' ? 'FIXED 8-WAY DIRECTION PAD' : 'FLOATING ANALOG STICK - TOUCH & DRAG',
        icon: 'play',
        action: () => this._toggleScheme(),
      },
      { label: 'BACK', action: () => { Snd.back(); App.setScreen('settings'); } },
    ];
    this.list = new MenuList(items);
    if (this._sel != null) this.list.sel = Math.min(this._sel, items.length - 1);
  },
  _toggleScheme() {
    const cur = Save.data.settings.controlScheme || 'joystick';
    Save.data.settings.controlScheme = cur === 'dpad' ? 'joystick' : 'dpad';
    Save.write();
    App.applyControlScheme();
    Snd.select();
    this._sel = this.list.sel;
    this._build();
  },
  update(dt) { this.t += dt; },
  draw(ctx, W, H) {
    drawBackdrop(ctx, W, H, this.t);
    const s = Math.max(2, Math.floor(W / 240));
    drawText(ctx, 'CONTROLS', W / 2, 34, s + 1, PAL.goldHi, 'center', '#000');
    drawText(ctx, 'CHOOSE HOW YOU MOVE', W / 2, 34 + 8 * (s + 1) + 6, 1, PAL.uiDim, 'center');
    const iw = Math.min(W - 40, 380);
    this.list.draw(ctx, W / 2, Math.max(112, H * 0.22), iw, 40 + s * 8, s, this.t);
    drawText(ctx, '◀ BACK', 16, 12, s, PAL.uiDim, 'left');
  },
  onDirPress(dc, dr) { if (dr) { this.list.nav(dr); this._sel = this.list.sel; } },
  onDirRelease() {},
  onConfirm() { this._sel = this.list.sel; this.list.activate(); },
  onTap(x, y) { if (y < 40 && x < 110) { this.onBack(); return; } this._sel = this.list.sel; this.list.tapAt(x, y); },
  onBack() { Snd.back(); App.setScreen('settings'); },
};

// ══ DEV TOOLS (reachable from the DEVELOPER MODE section) ═════
const ScreenDev = {
  t: 0,
  enter() { this.t = 0; this._build(); },
  _speedName() {
    const m = App.moveMs;
    return m <= 220 ? 'FAST' : m >= 480 ? 'SLOW' : 'NORMAL';
  },
  _build() {
    // dev mode already grants infinite coins + all levels; these are the
    // extra testing shortcuts (relics, shop, walk speed)
    const grantAllItems = () => { for (const k in ITEMS) { Save.grantItem(k); Save.setEquipped(k, true); } };
    const items = [
      { label: 'GRANT + EQUIP ALL RELICS', action: () => { grantAllItems(); Snd.itemGet(); this._say('RELICS GRANTED'); } },
      { label: 'CLEAR RELICS', action: () => { Save.data.story.items = {}; Save.data.story.equipped = {}; Save.write(); Snd.back(); this._say('RELICS CLEARED'); } },
      { label: 'UNLOCK SHOP ITEMS', action: () => { for (const id in SKINS) if (!Save.owns(id)) Save.data.shop.owned.push(id); for (const id in THEMES) if (!Save.owns(id)) Save.data.shop.owned.push(id); Save.addHints(20); Save.write(); Snd.buy(); this._say('SHOP UNLOCKED'); } },
      { label: 'WALK SPEED: ' + this._speedName(), action: () => { App.moveMs = App.moveMs <= 220 ? 350 : App.moveMs >= 480 ? 200 : 500; Snd.blip(); this._build(); } },
      { label: 'TURN OFF DEV MODE', danger: true, action: () => { Save.setDevMode(false); Art.setSkin(Save.data.shop.skin); Art.setTheme(Save.data.shop.theme); Snd.back(); App.setScreen('settings'); } },
      { label: 'BACK', action: () => { Snd.back(); App.setScreen('settings'); } },
    ];
    this.list = new MenuList(items);
    if (this._sel != null) this.list.sel = Math.min(this._sel, items.length - 1);
  },
  _say(t) { this.toast = { text: t, t: 1.8 }; },
  update(dt) { this.t += dt; if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; } },
  draw(ctx, W, H) {
    drawBackdrop(ctx, W, H, this.t);
    const s = Math.max(2, Math.floor(W / 240));
    drawText(ctx, 'DEV TOOLS', W / 2, 34, s + 1, PAL.goldHi, 'center', '#000');
    drawText(ctx, 'FOR TESTING - HANDLE WITH CARE', W / 2, 34 + 8 * (s + 1) + 6, 1, PAL.uiDim, 'center');
    const iw = Math.min(W - 40, 360);
    this.list.draw(ctx, W / 2, Math.max(96, H * 0.15), iw, 30 + s * 8, s, this.t);
    if (this.toast) {
      const tw = textWidth(this.toast.text, 2) + 24;
      ctx.fillStyle = 'rgba(4,5,10,0.94)'; ctx.fillRect((W - tw) / 2, H - 70, tw, 28);
      drawText(ctx, this.toast.text, W / 2, H - 63, 2, PAL.goldHi, 'center');
    }
  },
  onDirPress(dc, dr) { if (dr) { this.list.nav(dr); this._sel = this.list.sel; } },
  onDirRelease() {},
  onConfirm() { this._sel = this.list.sel; this.list.activate(); },
  onTap(x, y) { this._sel = this.list.sel; this.list.tapAt(x, y); },
  onBack() { Snd.back(); App.setScreen('settings'); },
};

