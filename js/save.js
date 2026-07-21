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
        owned: ['skin_default'],
        skin: 'skin_default',
        theme: 'theme_default',
      },
      settings: {
        music: true,
        sfx: true,
        reducedFlash: false,
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
};
