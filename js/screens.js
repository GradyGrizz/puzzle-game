'use strict';
// ── Screens: title, menu, story select, settings, intro ───────

// shared dungeon backdrop: dim floor tiles + vignette
function drawBackdrop(ctx, W, H, t) {
  ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, W, H);
  const ts = 44;
  ctx.save();
  ctx.globalAlpha = 0.35;
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
  draw(ctx, cx, y, w, itemH, s) {
    this.rects = [];
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const iy = y + i * (itemH + 8);
      const x = cx - w / 2;
      this.rects.push({ x, y: iy, w, h: itemH });
      const seld = i === this.sel;
      ctx.fillStyle = seld ? 'rgba(210,160,40,0.14)' : 'rgba(255,255,255,0.045)';
      ctx.fillRect(x, iy, w, itemH);
      ctx.fillStyle = seld ? PAL.gold : 'rgba(255,255,255,0.10)';
      ctx.fillRect(x, iy, w, 2); ctx.fillRect(x, iy + itemH - 2, w, 2);
      ctx.fillRect(x, iy, 2, itemH); ctx.fillRect(x + w - 2, iy, 2, itemH);
      const col = it.disabled ? PAL.uiDim : (seld ? PAL.goldHi : PAL.ui);
      const ty = iy + Math.round((itemH - (it.sub ? 7 * s + 5 * (s - 1) + 6 : 7 * s)) / 2);
      drawText(ctx, it.label, cx, ty, s, col, 'center', '#000');
      if (it.sub) {
        drawText(ctx, it.sub, cx, ty + 7 * s + 6, Math.max(1, s - 1), PAL.uiDim, 'center');
      }
      if (seld) {
        drawText(ctx, '▶', x + 10, iy + Math.round(itemH / 2) - 3 * s, s, PAL.gold, 'left');
      }
    }
  }
}

function coinsBadge(ctx, x, y, n, s) {
  const txt = String(n);
  const w = textWidth(txt, s) + 14 * s;
  Art.coinIcon(ctx, x - w, y, 7 * s);
  drawText(ctx, txt, x - w + 10 * s, y + s, s, PAL.goldHi, 'left', '#000');
}

// ══ TITLE ═════════════════════════════════════════════════════
const ScreenTitle = {
  t: 0, heroX: -80, frame: 0,
  enter() { this.t = 0; Snd.playMusic('title'); },
  update(dt) {
    this.t += dt;
    this.heroX += dt * 42;
    const W = App.W;
    if (this.heroX > W + 80) this.heroX = -80;
    this.frame = Math.floor(this.t * 7) % 4;
  },
  draw(ctx, W, H) {
    drawBackdrop(ctx, W, H, this.t);
    const s = Math.max(2, Math.floor(W / 130));
    const ly = H * 0.24;
    drawText(ctx, 'DELVE', W / 2, ly, s * 2.5 | 0, PAL.goldHi, 'center', '#3a2808');
    drawText(ctx, STORY.title, W / 2, ly + 7 * (s * 2.5 | 0) + 14, Math.max(2, s - 1), PAL.ui, 'center', '#000');
    // hero strolling on a floor strip
    const stripY = H * 0.56;
    const ts = 46;
    for (let c = -1; c < Math.ceil(W / ts) + 1; c++) Art.floor(ctx, c * ts, stripY, ts);
    ctx.fillStyle = 'rgba(2,3,6,0.35)'; ctx.fillRect(0, stripY, W, ts);
    Art.hero(ctx, 'right', this.frame, this.heroX, stripY - 8, ts, false);
    if (Math.floor(this.t * 1.6) % 2 === 0) {
      drawText(ctx, 'TAP TO BEGIN', W / 2, H * 0.76, Math.max(2, s - 1), PAL.ui, 'center', '#000');
    }
    drawText(ctx, 'A DUNGEON PUZZLE', W / 2, H - 40, 1, PAL.uiDim, 'center');
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
      App.setScreen('game', { levelId: '1-1' });
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
    this.list = new MenuList([
      { label: 'STORY', sub: 'THE SUNKEN KEEP', action: () => App.setScreen('story') },
      { label: 'CHALLENGE', sub: 'ENDLESS DEPTHS', action: () => App.setScreen('challenge') },
      { label: 'TIMED RUSH', sub: 'RACE THE CLOCK', action: () => App.setScreen('timed') },
      { label: 'SHOP', sub: 'SPEND YOUR COINS', action: () => App.setScreen('soon', { title: 'SHOP' }) },
      { label: 'SETTINGS', action: () => App.setScreen('settings') },
    ]);
  },
  update(dt) { this.t += dt; },
  draw(ctx, W, H) {
    drawBackdrop(ctx, W, H, this.t);
    const s = Math.max(2, Math.floor(W / 220));
    drawText(ctx, 'DELVE', W / 2, 42, s + 2, PAL.goldHi, 'center', '#3a2808');
    coinsBadge(ctx, W - 16, 20, Save.data.coins, Math.max(2, s - 1));
    const iw = Math.min(W - 48, 340);
    this.list.draw(ctx, W / 2, Math.max(110, H * 0.17), iw, 32 + s * 12, s);
  },
  onDirPress(dc, dr) { if (dr) this.list.nav(dr); },
  onDirRelease() {},
  onConfirm() { this.list.activate(); },
  onTap(x, y) { this.list.tapAt(x, y); },
  onBack() { App.setScreen('title'); Snd.back(); },
};

// ══ STORY SELECT ══════════════════════════════════════════════
const ScreenStory = {
  t: 0, sel: 0, cells: [],
  enter() {
    this.t = 0;
    Snd.playMusic('title');
    this.levels = allStoryLevels();
    // default selection: first not-done level
    this.sel = this.levels.findIndex(l => !Save.isLevelDone(l.id));
    if (this.sel < 0) this.sel = this.levels.length - 1;
  },
  update(dt) { this.t += dt; },
  draw(ctx, W, H) {
    drawBackdrop(ctx, W, H, this.t);
    const s = Math.max(2, Math.floor(W / 220));
    const ch = STORY.chapters[0];
    drawText(ctx, ch.name, W / 2, 34, s + 1, PAL.goldHi, 'center', '#000');
    drawText(ctx, ch.tagline, W / 2, 34 + 8 * (s + 1) + 6, 1, PAL.uiDim, 'center');
    coinsBadge(ctx, W - 16, 12, Save.data.coins, Math.max(1, s - 1));
    // level grid
    const perRow = 4;
    const cell = Math.min(74, Math.floor((W - 60) / perRow));
    const gw = perRow * (cell + 10) - 10;
    const gx = (W - gw) / 2, gy = Math.max(100, H * 0.18);
    this.cells = [];
    for (let i = 0; i < this.levels.length; i++) {
      const lv = this.levels[i];
      const r = Math.floor(i / perRow), c = i % perRow;
      const x = gx + c * (cell + 10), y = gy + r * (cell + 10);
      this.cells.push({ x, y, w: cell, h: cell });
      const done = Save.isLevelDone(lv.id);
      const unlocked = isLevelUnlocked(lv.id, Save);
      const seld = i === this.sel;
      ctx.fillStyle = seld ? 'rgba(210,160,40,0.15)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(x, y, cell, cell);
      ctx.fillStyle = seld ? PAL.gold : (done ? 'rgba(210,160,40,0.4)' : 'rgba(255,255,255,0.12)');
      ctx.fillRect(x, y, cell, 2); ctx.fillRect(x, y + cell - 2, cell, 2);
      ctx.fillRect(x, y, 2, cell); ctx.fillRect(x + cell - 2, y, 2, cell);
      if (!unlocked) {
        // lock glyph
        ctx.fillStyle = PAL.uiDark;
        const lx = x + cell / 2 - 8, ly2 = y + cell / 2 - 8;
        ctx.fillRect(lx + 2, ly2, 12, 6);
        ctx.fillRect(lx + 2, ly2, 3, 8); ctx.fillRect(lx + 11, ly2, 3, 8);
        ctx.fillRect(lx, ly2 + 7, 16, 11);
      } else {
        drawText(ctx, lv.id, x + cell / 2, y + cell / 2 - 8, s, done ? PAL.goldHi : PAL.ui, 'center', '#000');
        if (done) drawText(ctx, '★', x + cell / 2, y + cell - 16, 1, PAL.gold, 'center');
        if (lv.chest) Art.coinIcon(ctx, x + 5, y + 5, 0); // no-op marker space
      }
    }
    // selected level name + relics
    const selLv = this.levels[this.sel];
    if (selLv) {
      const rows = Math.ceil(this.levels.length / perRow);
      const infoY = gy + rows * (cell + 10) + 12;
      drawText(ctx, selLv.name, W / 2, infoY, s, PAL.ui, 'center', '#000');
    }
    // relics owned
    const items = Object.keys(Save.data.story.items);
    if (items.length) {
      let ix = 20;
      const iy = H - (App.isTouch ? 260 : 60);
      drawText(ctx, 'RELICS:', ix, iy + 8, 1, PAL.uiDim, 'left');
      ix += 52;
      for (const it of items) { Art.item(ctx, it, ix, iy, 24); ix += 32; }
    }
    drawText(ctx, '◀ BACK', 16, 12, s, PAL.uiDim, 'left');
  },
  _start() {
    const lv = this.levels[this.sel];
    if (!isLevelUnlocked(lv.id, Save)) { Snd.error(); return; }
    Snd.select();
    App.setScreen('game', { levelId: lv.id });
  },
  onDirPress(dc, dr) {
    const perRow = 4, n = this.levels.length;
    let s2 = this.sel + dc + dr * perRow;
    if (s2 >= 0 && s2 < n && s2 !== this.sel) { this.sel = s2; Snd.blip(); }
  },
  onDirRelease() {},
  onConfirm() { this._start(); },
  onTap(x, y) {
    if (y < 40 && x < 120) { this.onBack(); return; }
    for (let i = 0; i < this.cells.length; i++) {
      const r = this.cells[i];
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
        this.sel = i; this._start(); return;
      }
    }
  },
  onBack() { Snd.back(); App.setScreen('menu'); },
};

// ══ SETTINGS ══════════════════════════════════════════════════
const ScreenSettings = {
  t: 0, confirmingWipe: false,
  enter() {
    this.t = 0; this.confirmingWipe = false;
    this._rebuild();
  },
  _rebuild() {
    const st = Save.data.settings;
    this.list = new MenuList([
      { label: 'MUSIC: ' + (st.music ? 'ON' : 'OFF'), action: () => this._toggle('music') },
      { label: 'SOUND FX: ' + (st.sfx ? 'ON' : 'OFF'), action: () => this._toggle('sfx') },
      { label: 'REDUCED FLASH: ' + (st.reducedFlash ? 'ON' : 'OFF'), action: () => this._toggle('reducedFlash') },
      { label: this.confirmingWipe ? 'REALLY ERASE ALL?' : 'ERASE PROGRESS', action: () => this._wipe() },
      { label: 'BACK', action: () => this.onBack() },
    ]);
    if (this._sel != null) this.list.sel = this._sel;
  },
  _toggle(k) {
    const st = Save.data.settings;
    st[k] = !st[k];
    Save.write();
    Snd.musicOn = st.music; Snd.sfxOn = st.sfx;
    Snd.applySettings();
    this._sel = this.list.sel;
    this.confirmingWipe = false;
    this._rebuild();
  },
  _wipe() {
    if (!this.confirmingWipe) {
      this.confirmingWipe = true;
      this._sel = this.list.sel;
      this._rebuild();
      return;
    }
    Save.wipe();
    Snd.musicOn = Save.data.settings.music; Snd.sfxOn = Save.data.settings.sfx;
    Snd.applySettings();
    Snd.error();
    this.confirmingWipe = false;
    this._sel = 0;
    this._rebuild();
  },
  update(dt) { this.t += dt; },
  draw(ctx, W, H) {
    drawBackdrop(ctx, W, H, this.t);
    const s = Math.max(2, Math.floor(W / 240));
    drawText(ctx, 'SETTINGS', W / 2, 40, s + 1, PAL.goldHi, 'center', '#000');
    const iw = Math.min(W - 48, 360);
    this.list.draw(ctx, W / 2, Math.max(100, H * 0.16), iw, 30 + s * 10, s);
    drawText(ctx, 'DELVE V0.1 - PHASE 1', W / 2, H - 30, 1, PAL.uiDim, 'center');
  },
  onDirPress(dc, dr) { if (dr) { this.list.nav(dr); this.confirmingWipe = false; this._sel = this.list.sel; this._rebuild(); } },
  onDirRelease() {},
  onConfirm() { this.list.activate(); },
  onTap(x, y) { this.list.tapAt(x, y); },
  onBack() { Snd.back(); App.setScreen('menu'); },
};

// ══ COMING SOON (placeholder while phases land) ═══════════════
const ScreenSoon = {
  t: 0, title: '',
  enter(params) { this.t = 0; this.title = (params && params.title) || 'SOON'; },
  update(dt) { this.t += dt; },
  draw(ctx, W, H) {
    drawBackdrop(ctx, W, H, this.t);
    const s = Math.max(2, Math.floor(W / 220));
    const pw = Math.min(W - 40, 380), ph = 170;
    const px = (W - pw) / 2, py = H * 0.3;
    Art.panel(ctx, px, py, pw, ph);
    drawText(ctx, this.title, W / 2, py + 30, s + 1, PAL.goldHi, 'center', '#000');
    drawText(ctx, 'THIS WING OF THE KEEP', W / 2, py + 80, s, PAL.ui, 'center');
    drawText(ctx, 'IS STILL BEING DUG OUT.', W / 2, py + 80 + 9 * s, s, PAL.ui, 'center');
    drawText(ctx, 'TAP TO GO BACK', W / 2, py + ph + 20, 1, PAL.uiDim, 'center');
  },
  onTap() { this.onBack(); },
  onConfirm() { this.onBack(); },
  onDirPress() {}, onDirRelease() {},
  onBack() { Snd.back(); App.setScreen('menu'); },
};
