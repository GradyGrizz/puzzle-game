'use strict';
// ── Save: localStorage persistence with versioned schema ──────

const SAVE_KEY = 'delve_save_v1';

const Save = {
  data: null,

  defaults() {
    return {
      version: 1,
      coins: 0,
      story: {
        // per-level: { done:true, bestMoves:n }
        levels: {},
        items: {}, // sword, shield, glove, boots, lantern
      },
      challenge: {
        best: 0,
        runs: [], // {levels, coins, date}
      },
      timed: {
        // per difficulty tier: best times [{ms, date}]
        bests: [],
      },
      shop: {
        owned: ['skin_default', 'theme_default'],
        skin: 'skin_default',
        theme: 'theme_default',
        hints: 0,
        adDay: '',
        adCount: 0,
      },
      settings: {
        music: true,
        sfx: true,
        reducedFlash: false,
        haptics: true,
      },
      meta: {
        seenIntro: false,
        launches: 0,
      },
    };
  },

  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) {}
    this.data = this._merge(this.defaults(), d || {});
    this.data.meta.launches++;
    this.write();
    return this.data;
  },

  _merge(base, over) {
    for (const k in over) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) &&
          base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        this._merge(base[k], over[k]);
      } else if (over[k] !== undefined) {
        base[k] = over[k];
      }
    }
    return base;
  },

  write() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) {}
  },

  wipe() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    this.load();
  },

  // ── convenience ──
  addCoins(n) { this.data.coins = Math.max(0, this.data.coins + n); this.write(); },

  completeStoryLevel(id, moves, coinsEarned) {
    const rec = this.data.story.levels[id];
    const first = !rec || !rec.done;
    this.data.story.levels[id] = {
      done: true,
      bestMoves: rec && rec.bestMoves ? Math.min(rec.bestMoves, moves) : moves,
    };
    this.data.coins += coinsEarned;
    this.write();
    return first;
  },

  hasItem(item) { return !!this.data.story.items[item]; },
  grantItem(item) { this.data.story.items[item] = true; this.write(); },

  isLevelDone(id) {
    const rec = this.data.story.levels[id];
    return !!(rec && rec.done);
  },

  // ── shop ──
  owns(id) {
    return id.endsWith('_default') || this.data.shop.owned.includes(id);
  },

  // returns true on success (coins deducted, item owned)
  buyItem(id, price) {
    if (this.owns(id) || this.data.coins < price) return false;
    this.data.coins -= price;
    this.data.shop.owned.push(id);
    this.write();
    return true;
  },

  // consumables: pay without ownership (hint packs)
  spend(price) {
    if (this.data.coins < price) return false;
    this.data.coins -= price;
    this.write();
    return true;
  },

  addHints(n) { this.data.shop.hints += n; this.write(); },
  useHint() {
    if (this.data.shop.hints <= 0) return false;
    this.data.shop.hints--;
    this.write();
    return true;
  },

  // rewarded ad allowance: 3 per calendar day
  adsLeftToday() {
    const today = new Date().toDateString();
    if (this.data.shop.adDay !== today) return 3;
    return Math.max(0, 3 - this.data.shop.adCount);
  },
  recordAdWatch() {
    const today = new Date().toDateString();
    if (this.data.shop.adDay !== today) { this.data.shop.adDay = today; this.data.shop.adCount = 0; }
    this.data.shop.adCount++;
    this.write();
  },

  // ── leaderboards (local device) ──
  recordChallengeRun(depth, coins) {
    const runs = this.data.challenge.runs;
    runs.push({ depth, coins, date: Date.now() });
    runs.sort((a, b) => b.depth - a.depth || a.date - b.date);
    if (runs.length > 10) runs.length = 10;
    this.data.challenge.best = Math.max(this.data.challenge.best || 0, depth);
    this.write();
  },

  // returns 1-based rank of this run among bests (0 if not top 10)
  recordTimedRun(ms) {
    ms = Math.round(ms);
    const bests = this.data.timed.bests;
    const entry = { ms, date: Date.now() };
    bests.push(entry);
    bests.sort((a, b) => a.ms - b.ms);
    if (bests.length > 10) bests.length = 10;
    this.write();
    const i = bests.indexOf(entry);
    return i >= 0 ? i + 1 : 0;
  },
};
