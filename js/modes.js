'use strict';
// ── Challenge & Timed mode screens (start + leaderboards) ─────

App.startChallenge = function () {
  const run = { depth: 1, seed: (Date.now() % 1e9) | 0, cleared: 0, coins: 0 };
  App.setScreen('game', { gameMode: 'challenge', run });
};

App.startTimed = function () {
  const seed = (Date.now() % 1e9) | 0;
  const run = { defs: genTimedRun(seed), idx: 0, totalMs: 0, coins: 0, splits: [] };
  App.setScreen('game', { gameMode: 'timed', run });
};

function fmtDate(ts) {
  const d = new Date(ts);
  const mo = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getMonth()];
  return mo + ' ' + d.getDate();
}

// shared leaderboard-panel screen behaviour
function drawModeScreen(self, ctx, W, H, opts) {
  drawBackdrop(ctx, W, H, self.t);
  const s = Math.max(2, Math.floor(W / 220));
  drawText(ctx, opts.title, W / 2, 34, s + 1, PAL.goldHi, 'center', '#000');
  drawText(ctx, opts.tagline, W / 2, 34 + 8 * (s + 1) + 6, 1, PAL.uiDim, 'center');
  coinsBadge(ctx, W - 16, 12, Save.data.coins, Math.max(1, s - 1));
  drawText(ctx, '◀ BACK', 16, 12, s, PAL.uiDim, 'left');

  const pw = Math.min(W - 36, 400);
  const px = (W - pw) / 2;
  let py = Math.max(96, H * 0.15);

  // best banner
  Art.panel(ctx, px, py, pw, 46);
  drawText(ctx, opts.bestLabel, W / 2, py + 16, s, PAL.goldHi, 'center');
  py += 62;

  // leaderboard
  const rows = opts.rows;
  const lh = 24;
  const lbH = Math.max(1, rows.length) * lh + 40;
  Art.panel(ctx, px, py, pw, lbH);
  drawText(ctx, opts.lbTitle, W / 2, py + 10, 1, PAL.uiDim, 'center');
  let ty = py + 30;
  if (!rows.length) {
    drawText(ctx, 'NO RUNS YET. BE THE FIRST.', W / 2, ty, 1, PAL.uiDim, 'center');
  }
  for (let i = 0; i < rows.length; i++) {
    const col = i === 0 ? PAL.goldHi : PAL.ui;
    drawText(ctx, (i + 1) + '.', px + 18, ty, s - 0, col, 'left');
    drawText(ctx, rows[i].main, px + 52, ty, s - 0, col, 'left');
    drawText(ctx, rows[i].right, px + pw - 16, ty, 1, PAL.uiDim, 'right');
    ty += lh;
  }
  py += lbH + 16;

  self.list.draw(ctx, W / 2, py, Math.min(W - 60, 300), 46, s);
}

// ══ CHALLENGE ═════════════════════════════════════════════════
const ScreenChallenge = {
  t: 0,
  enter() {
    this.t = 0;
    Snd.playMusic('title');
    this.list = new MenuList([
      { label: 'BEGIN DELVE', action: () => App.startChallenge() },
      { label: 'BACK', action: () => this.onBack() },
    ]);
  },
  update(dt) { this.t += dt; },
  draw(ctx, W, H) {
    const best = Save.data.challenge.best || 0;
    drawModeScreen(this, ctx, W, H, {
      title: 'CHALLENGE',
      tagline: 'ENDLESS DEPTHS. EVERY MOVE COUNTS.',
      bestLabel: best ? 'BEST: DEPTH ' + best : 'NO DELVES YET',
      lbTitle: '- DEEPEST DELVES -',
      rows: Save.data.challenge.runs.slice(0, 8).map(r => ({
        main: 'DEPTH ' + r.depth,
        right: fmtDate(r.date),
      })),
    });
  },
  onDirPress(dc, dr) { if (dr) this.list.nav(dr); },
  onDirRelease() {},
  onConfirm() { this.list.activate(); },
  onTap(x, y) {
    if (y < 40 && x < 120) { this.onBack(); return; }
    this.list.tapAt(x, y);
  },
  onBack() { Snd.back(); App.setScreen('menu'); },
};

// ══ TIMED RUSH ════════════════════════════════════════════════
const ScreenTimed = {
  t: 0,
  enter() {
    this.t = 0;
    Snd.playMusic('title');
    this.list = new MenuList([
      { label: 'START THE CLOCK', action: () => App.startTimed() },
      { label: 'BACK', action: () => this.onBack() },
    ]);
  },
  update(dt) { this.t += dt; },
  draw(ctx, W, H) {
    const bests = Save.data.timed.bests;
    drawModeScreen(this, ctx, W, H, {
      title: 'TIMED RUSH',
      tagline: '5 VAULTS. ONE CLOCK. NO MERCY.',
      bestLabel: bests.length ? 'BEST: ' + fmtMs(bests[0].ms) : 'NO RUNS YET',
      lbTitle: '- FASTEST RUNS -',
      rows: bests.slice(0, 8).map(r => ({
        main: fmtMs(r.ms),
        right: fmtDate(r.date),
      })),
    });
  },
  onDirPress(dc, dr) { if (dr) this.list.nav(dr); },
  onDirRelease() {},
  onConfirm() { this.list.activate(); },
  onTap(x, y) {
    if (y < 40 && x < 120) { this.onBack(); return; }
    this.list.tapAt(x, y);
  },
  onBack() { Snd.back(); App.setScreen('menu'); },
};
