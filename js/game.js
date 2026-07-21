'use strict';
// ── Game screen: plays one puzzle level with anims + sfx ──────
// Supports three game modes:
//   story     — handcrafted campaign levels with dialogs/chests
//   challenge — endless generated depths with a move budget
//   timed     — 5-stage generated gauntlet against the clock

const MOVE_MS = 150;

const ScreenGame = {
  // mode: dialog | play | moving | chest | won | results | runover
  enter(params) {
    this.gameMode = params.gameMode || 'story';
    this.run = params.run || null;

    if (this.gameMode === 'story') {
      const found = getStoryLevel(params.levelId);
      this.chapter = found.chapter;
      this.lv = found.level;
      this.levelId = this.lv.id;
      this.firstTime = !Save.isLevelDone(this.levelId);
      this.budget = 0;
    } else if (this.gameMode === 'challenge') {
      let g = App.pregen && App.pregen.depth === this.run.depth && App.pregen.seed === this.run.seed
        ? App.pregen.gen : genLevel(this.run.depth, this.run.seed);
      App.pregen = null;
      this.lv = { id: 'DEPTH ' + this.run.depth, name: '', map: g.def.map };
      this.levelId = this.lv.id;
      this.firstTime = false;
      this.budget = g.budget;
    } else { // timed
      const g = this.run.defs[this.run.idx];
      this.lv = { id: 'STAGE ' + (this.run.idx + 1) + '/' + this.run.defs.length, name: '', map: g.def.map };
      this.levelId = this.lv.id;
      this.firstTime = false;
      this.budget = 0;
      this.levelMs = 0;
    }

    this.state = parseLevel(this.lv);
    this.history = [];
    this.filled = {};
    this.mode = 'play';
    this.t = 0;
    this.anim = null;
    this.fallAnim = null;
    this.cutAnim = null;
    this.chestAnim = null;
    this.dialog = null;
    this.toast = null;
    this.flash = 0;
    this.exitGlow = 0;
    this.heldDir = null;
    this.queued = null;
    this.holdTimer = 0;
    this.wonT = 0;
    this.resultInfo = null;
    this.frame = 0;
    this._awarded = false;
    this.hintPath = null;
    Snd.playMusic('dungeon');
    // hint scrolls work on story levels (small enough to solve live)
    const hintBtn = document.getElementById('btn-hint');
    if (hintBtn) hintBtn.style.display = this.gameMode === 'story' ? 'flex' : 'none';
    if (this.gameMode === 'story' && this.lv.intro && this.firstTime) {
      this.showDialog(this.lv.intro, () => {});
    }
  },

  onHint() {
    if (this.gameMode !== 'story') return;
    if (this.mode !== 'play' && this.mode !== 'moving') return;
    if (this.hintPath) return; // one at a time
    if (Save.data.shop.hints <= 0) {
      Snd.error();
      this.showToast('NO HINT SCROLLS. VISIT THE SHOP.');
      return;
    }
    const res = solveFrom(this.state, this.inventory(), 300000);
    if (!res.solvable) {
      Snd.error();
      // a capped-out search means "too deep to see", not "impossible"
      this.showToast(res.reason === 'node-cap'
        ? 'THE SPIRITS CANNOT SEE THAT FAR AHEAD.'
        : 'NO WAY FORWARD. TRY UNDO OR RESET.');
      return;
    }
    Save.useHint();
    Snd.keyGet();
    // trace the first steps so arrows land on real tiles
    const steps = [];
    let sim = this.state;
    for (let i = 0; i < Math.min(3, res.path.length); i++) {
      const [dc, dr] = res.path[i];
      const r2 = move(sim, dc, dr, this.inventory());
      steps.push({ r: r2.state.player.r, c: r2.state.player.c, dc, dr });
      sim = r2.state;
      if (!r2.ok) break;
    }
    this.hintPath = { steps, t: 4.5 };
  },

  showDialog(text, cb) {
    this.mode = 'dialog';
    this.dialog = { text: String(text), chars: 0, cb };
  },

  showToast(text) {
    this.toast = { text, t: 1.8 };
  },

  inventory() { return Save.data.story.items; },

  movesLeft() { return this.budget ? Math.max(0, this.budget - this.state.moves) : null; },

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
          else if (need.item === 'shield') this.showToast('THE FLAMES DRIVE YOU BACK.');
        }
      }
      return;
    }

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

    if (has('cut')) {
      this.history.push(this.state);
      this.state = res.state;
      const ev = evs.find(e => e.type === 'cut');
      this.cutAnim = { r: ev.r, c: ev.c, t: 0.25 };
      Snd.cut();
      return;
    }

    const from = { r: this.state.player.r, c: this.state.player.c };
    const pushEv = evs.find(e => e.type === 'push');
    this.history.push(this.state);
    if (this.history.length > 300) this.history.shift();
    this.anim = { from, t: 0, push: pushEv || null, events: evs, newState: res.state };
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
    if (has('snuff')) Snd.snuff();
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
    // challenge: out of moves ends the run
    if (this.gameMode === 'challenge' && this.movesLeft() === 0) {
      this._runOver();
      return;
    }
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
    else if ((this.mode === 'results' || this.mode === 'runover') && dr && this.resultInfo) this.resultInfo.list.nav(dr);
  },
  onDirRelease(dc, dr) {
    if (this.heldDir && this.heldDir.dc === dc && this.heldDir.dr === dr) this.heldDir = null;
  },

  onConfirm() {
    if (this.mode === 'dialog') this._advanceDialog();
    else if (this.mode === 'chest') this._advanceChest();
    else if ((this.mode === 'results' || this.mode === 'runover') && this.resultInfo) this.resultInfo.list.activate();
  },
  onTap(x, y) {
    if (this.mode === 'dialog') this._advanceDialog();
    else if (this.mode === 'chest') this._advanceChest();
    else if ((this.mode === 'results' || this.mode === 'runover') && this.resultInfo) this.resultInfo.list.tapAt(x, y);
    else if (y < 44 && x < 90) this.onBack();
  },
  onBack() {
    if (this.mode === 'dialog') { this._advanceDialog(); return; }
    Snd.back();
    if (this.gameMode === 'challenge') {
      // leaving mid-run ends the run (score = depths fully cleared)
      this._recordChallenge();
      App.setScreen('challenge');
    } else if (this.gameMode === 'timed') {
      App.setScreen('timed');
    } else {
      App.setScreen('story');
    }
  },
  onUndo() {
    if (this.mode !== 'play' && this.mode !== 'moving') return;
    if (!this.history.length) { Snd.error(); return; }
    this.anim = null; this.fallAnim = null;
    this.state = this.history.pop();
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
    if (d.cb) d.cb();
  },

  _advanceChest() {
    const ca = this.chestAnim;
    if (!ca || ca.phase < 2) return;
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

  // ── mode results ──
  _enterResults() {
    if (this.gameMode === 'challenge') return this._challengeClear();
    if (this.gameMode === 'timed') return this._timedClear();
    const first = this.firstTime && !this._awarded;
    const coins = 5 + this.state.coinsGot + (first ? 10 : 0);
    this._awarded = true;
    Save.completeStoryLevel(this.levelId, this.state.moves, coins);
    const next = nextStoryLevel(this.levelId);
    const items = [];
    if (next) items.push({ label: 'NEXT LEVEL', action: () => App.setScreen('game', { levelId: next.id }) });
    items.push({ label: 'LEVEL SELECT', action: () => App.setScreen('story') });
    let coinLine = 'COINS +' + coins;
    if (first) coinLine += ' (FIRST CLEAR +10)';
    this.resultInfo = {
      title: 'LEVEL CLEAR', sub: this.lv.name,
      lines: ['MOVES: ' + this.state.moves, coinLine],
      list: new MenuList(items),
    };
    this.mode = 'results';
  },

  _challengeClear() {
    const run = this.run;
    if (!this._awarded) {
      this._awarded = true;
      const coins = 3 + this.state.coinsGot;
      run.cleared = run.depth;
      run.coins += coins;
      Save.addCoins(coins);
      // pregenerate the next depth while the player reads results
      const nd = run.depth + 1, seed = run.seed;
      App.pregen = null;
      setTimeout(() => { App.pregen = { depth: nd, seed, gen: genLevel(nd, seed) }; }, 30);
    }
    this.resultInfo = {
      title: 'DEPTH ' + run.depth + ' CLEARED', sub: 'THE STAIRS SPIRAL DOWN...',
      lines: ['MOVES: ' + this.state.moves + ' / ' + this.budget, 'RUN COINS: ' + run.coins],
      list: new MenuList([
        { label: 'DELVE DEEPER', action: () => { run.depth++; App.setScreen('game', { gameMode: 'challenge', run }); } },
        { label: 'END RUN', action: () => { this._recordChallenge(); App.setScreen('challenge'); } },
      ]),
    };
    this.mode = 'results';
  },

  _recordChallenge() {
    if (this.run && this.run.cleared > 0 && !this.run.recorded) {
      this.run.recorded = true;
      Save.recordChallengeRun(this.run.cleared, this.run.coins);
    }
  },

  _runOver() {
    Snd.timeUp();
    this._recordChallenge();
    const run = this.run;
    this.resultInfo = {
      title: 'OUT OF MOVES', sub: 'THE SEAL SNAPS SHUT AT DEPTH ' + run.depth,
      lines: ['DEPTHS CLEARED: ' + run.cleared, 'COINS EARNED: ' + run.coins,
              (Save.data.challenge.best === run.cleared && run.cleared > 0) ? 'NEW BEST!' : ''],
      list: new MenuList([
        { label: 'NEW RUN', action: () => App.startChallenge() },
        { label: 'LEADERBOARD', action: () => App.setScreen('challenge') },
      ]),
    };
    this.mode = 'runover';
  },

  _timedClear() {
    const run = this.run;
    if (!this._awarded) {
      this._awarded = true;
      run.totalMs += this.levelMs;
      run.coins += this.state.coinsGot;
      run.splits.push(this.levelMs);
    }
    if (run.idx < run.defs.length - 1) {
      this.resultInfo = {
        title: 'STAGE ' + (run.idx + 1) + ' CLEAR', sub: fmtMs(this.levelMs),
        lines: ['TOTAL: ' + fmtMs(run.totalMs)],
        list: new MenuList([
          { label: 'NEXT STAGE', action: () => { run.idx++; App.setScreen('game', { gameMode: 'timed', run }); } },
        ]),
      };
      this.mode = 'results';
      // auto-advance keeps the rush feeling
      this._autoNext = 1.1;
    } else {
      const bonus = 12 + run.coins;
      Save.addCoins(bonus);
      const rank = Save.recordTimedRun(run.totalMs);
      this.resultInfo = {
        title: 'RUN COMPLETE', sub: 'TOTAL ' + fmtMs(run.totalMs),
        lines: ['COINS +' + bonus, rank === 1 ? 'NEW RECORD!' : (rank > 0 ? 'RANK #' + rank : '')],
        list: new MenuList([
          { label: 'RACE AGAIN', action: () => App.startTimed() },
          { label: 'LEADERBOARD', action: () => App.setScreen('timed') },
        ]),
      };
      this.mode = 'results';
    }
  },

  // ── update ──
  update(dt) {
    this.t += dt;
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
    if (this.exitGlow > 0) this.exitGlow = Math.max(0, this.exitGlow - dt * 0.4);
    if (this.fallAnim) { this.fallAnim.t += dt; if (this.fallAnim.t > 0.3) this.fallAnim = null; }
    if (this.cutAnim) { this.cutAnim.t -= dt; if (this.cutAnim.t <= 0) this.cutAnim = null; }
    if (this.hintPath) { this.hintPath.t -= dt; if (this.hintPath.t <= 0) this.hintPath = null; }

    if (this.gameMode === 'timed' && (this.mode === 'play' || this.mode === 'moving')) {
      this.levelMs += dt * 1000;
    }
    if (this._autoNext != null && this.mode === 'results') {
      this._autoNext -= dt;
      if (this._autoNext <= 0) {
        this._autoNext = null;
        this.resultInfo.list.activate();
        return;
      }
    }

    if (this.mode === 'dialog' && this.dialog) {
      this.dialog.chars = Math.min(this.dialog.text.length, this.dialog.chars + dt * 46);
    }

    if (this.mode === 'moving' && this.anim) {
      this.anim.t += dt * 1000;
      this.frame = 1 + Math.floor((this.anim.t / MOVE_MS) * 3.99) % 4;
      if (this.anim.t >= MOVE_MS) { this.frame = 0; this.settleMove(); }
    } else if (this.mode === 'play') {
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
      if (this.wonT > (this.gameMode === 'timed' ? 0.6 : 1.15)) {
        if (this.gameMode === 'story' && this.lv.outro && this.firstTime) {
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

    for (let r = 0; r < st.h; r++) for (let c = 0; c < st.w; c++) {
      const x = bx + c * T, y = by + r * T, t = st.tiles[r][c];
      if (t === TILE.WALL) Art.wall(ctx, x, y, T);
      else if (t === TILE.FLOOR) {
        Art.floor(ctx, x, y, T);
        if (this.filled[r + ',' + c]) {
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
      else if (t === TILE.FIRE) Art.fire(ctx, x, y, T, this.t);
    }

    for (const k in st.items) {
      const [r, c] = k.split(',').map(Number);
      const x = bx + c * T, y = by + r * T;
      if (st.items[k] === 'coin') Art.coin(ctx, x, y, T, this.t * 4 + r + c);
      else if (st.items[k] === 'key') Art.key(ctx, x, y, T, this.t * 4 + r);
    }

    if (st.chest && st.chest.r >= 0) {
      let phase = st.chest.opened ? 1 : 0;
      if (this.chestAnim && this.chestAnim.phase === 0) phase = Math.min(1, this.chestAnim.t / 0.5);
      Art.chest(ctx, bx + st.chest.c * T, by + st.chest.r * T, T, phase);
    }

    for (const b of st.blocks) {
      Art.block(ctx, bx + b.c * T, by + b.r * T, T, false);
    }
    const pushEv = (this.anim && this.anim.push) || null;
    if (pushEv && this.anim) {
      const pr = this.anim.t / MOVE_MS;
      const br = pushEv.fr + (pushEv.tr - pushEv.fr) * pr;
      const bc = pushEv.fc + (pushEv.tc - pushEv.fc) * pr;
      Art.block(ctx, Math.round(bx + bc * T), Math.round(by + br * T), T, false);
    }

    if (this.fallAnim) {
      const f = this.fallAnim;
      const sc = Math.max(0.1, 1 - f.t / 0.3);
      Art.pit(ctx, bx + f.c * T, by + f.r * T, T);
      Art.blockRaw(ctx, bx + f.c * T, by + f.r * T, T, sc);
    }

    if (this.cutAnim) {
      const ca = this.cutAnim;
      const x = bx + ca.c * T, y = by + ca.r * T;
      ctx.fillStyle = PAL.greenHi;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const d = (0.25 - ca.t) * T * 2.4;
        ctx.fillRect(x + T / 2 + Math.cos(a) * d, y + T / 2 + Math.sin(a) * d, 3, 3);
      }
    }

    let hr = st.player.r, hc = st.player.c;
    let pushing = false;
    if (this.anim) {
      const pr = this.anim.t / MOVE_MS;
      const np = this.anim.newState.player;
      hr = this.anim.from.r + (np.r - this.anim.from.r) * pr;
      hc = this.anim.from.c + (np.c - this.anim.from.c) * pr;
      pushing = !!this.anim.push;
    }
    const animSt = this.anim ? this.anim.newState : st;
    Art.hero(ctx, animSt.player.dir, this.frame, Math.round(bx + hc * T), Math.round(by + hr * T), T, pushing);

    // darkness (ch5): chunky per-tile falloff around the lantern
    if (st.dark) {
      const radius = 2.4;
      for (let r = 0; r < st.h; r++) for (let c = 0; c < st.w; c++) {
        const d = Math.max(Math.abs(r - hr), Math.abs(c - hc));
        let a = Math.min(0.94, Math.max(0, (d - radius) * 0.55));
        if (a <= 0) continue;
        const tl = st.tiles[r][c];
        if (tl === TILE.FIRE) a *= 0.25;      // flames pierce the dark
        else if (tl === TILE.EXIT && st.exitOpen) a *= 0.45;
        ctx.fillStyle = `rgba(1,2,4,${a})`;
        ctx.fillRect(bx + c * T, by + r * T, T, T);
      }
      // soft lantern tint
      ctx.fillStyle = 'rgba(240,200,110,0.045)';
      ctx.fillRect(bx + (hc - 1.5) * T, by + (hr - 1.5) * T, T * 4, T * 4);
    }

    // hint arrows
    if (this.hintPath) {
      const blink = 0.55 + 0.45 * Math.sin(this.t * 6);
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.hintPath.t) * blink;
      for (let i = 0; i < this.hintPath.steps.length; i++) {
        const sp = this.hintPath.steps[i];
        const glyph = sp.dr < 0 ? '▲' : sp.dr > 0 ? '▼' : sp.dc < 0 ? '◀' : '▶';
        const gs = Math.max(2, Math.floor(T / 10));
        drawText(ctx, glyph, bx + sp.c * T + T / 2, by + sp.r * T + T / 2 - 3 * gs, gs, PAL.goldHi, 'center', '#3a2808');
      }
      ctx.restore();
    }

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
    if ((this.mode === 'results' || this.mode === 'runover') && this.resultInfo) this.drawResults(ctx, W, H);
  },

  drawHud(ctx, W, H, hudH) {
    ctx.fillStyle = 'rgba(4,5,10,0.8)';
    ctx.fillRect(0, 0, W, hudH);
    ctx.fillStyle = PAL.uiDark; ctx.fillRect(0, hudH - 1, W, 1);
    drawText(ctx, '◀', 16, 16, 2, PAL.uiDim, 'left');
    const title = this.gameMode === 'story' ? this.levelId + ' ' + this.lv.name : this.levelId;
    drawText(ctx, title, W / 2, 10, 2, PAL.ui, 'center', '#000');
    if (this.gameMode === 'challenge') {
      const left = this.movesLeft();
      const urgent = left != null && left <= 5;
      drawText(ctx, 'MOVES LEFT ' + left, W / 2, 30, 1, urgent ? PAL.red : PAL.uiDim, 'center');
    } else if (this.gameMode === 'timed') {
      drawText(ctx, fmtMs(this.levelMs + 0) + '  TOTAL ' + fmtMs(this.run.totalMs + this.levelMs), W / 2, 30, 1, PAL.goldHi, 'center');
    } else {
      drawText(ctx, 'MOVES ' + this.state.moves, W / 2, 30, 1, PAL.uiDim, 'center');
    }
    coinsBadge(ctx, W - 12, 14, Save.data.coins + (this.gameMode === 'story' ? this.state.coinsGot : 0), 2);
    if (this.state.keys > 0) {
      Art.keyIcon(ctx, W - 110, 12, 16);
      drawText(ctx, '×' + this.state.keys, W - 96, 16, 2, PAL.goldHi, 'left');
    }
    if (this.gameMode === 'story' && this.lv.hint && this.firstTime && this.mode === 'play' && this.state.moves < 6) {
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
      drawText(ctx, ln.slice(0, shown), px + 18, ty, s, PAL.ui, 'left');
      shown -= ln.length + 1;
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
    Art.chest(ctx, cx, cy, b.T, ca.phase === 0 ? Math.min(1, ca.t / 0.5) : 1);
    if (ca.phase >= 1) {
      const rise = ca.phase === 1 ? Math.min(1, ca.t / 0.7) : 1;
      const iy = cy - rise * b.T * 1.1;
      const size = b.T * 0.9;
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
    const ri = this.resultInfo;
    const s = Math.max(2, Math.floor(W / 240));
    const pw = Math.min(W - 32, 420), ph = 310;
    const px = (W - pw) / 2, py = Math.max(30, H * 0.14);
    Art.panel(ctx, px, py, pw, ph);
    const titleCol = this.mode === 'runover' ? PAL.red : PAL.goldHi;
    drawText(ctx, ri.title, W / 2, py + 20, s + 1, titleCol, 'center', '#000');
    if (ri.sub) drawText(ctx, ri.sub, W / 2, py + 20 + 9 * (s + 1), Math.max(1, s - 1), PAL.uiDim, 'center');
    let ty = py + 84;
    for (const ln of ri.lines) {
      if (ln) drawText(ctx, ln, W / 2, ty, s, ln.includes('NEW') ? PAL.goldHi : PAL.ui, 'center');
      ty += 11 * s;
    }
    ri.list.draw(ctx, W / 2, py + ph - 122, pw - 60, 44, s);
  },
};

function fmtMs(ms) {
  ms = Math.max(0, Math.round(ms));
  const m = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const t = Math.floor((ms % 1000) / 100);
  return m + ':' + String(sec).padStart(2, '0') + '.' + t;
}
