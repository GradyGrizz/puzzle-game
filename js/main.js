'use strict';
// ── App: boot, screen manager, input routing, render loop ─────

const App = {
  W: 0, H: 0,
  canvas: null, ctx: null,
  screen: null, screenName: '',
  isTouch: ('ontouchstart' in window) || navigator.maxTouchPoints > 0,
  transition: null, // {phase:'out'|'in', t, next, params}

  screens: {},

  init() {
    this.canvas = document.getElementById('c');
    this.ctx = this.canvas.getContext('2d');
    Save.load();
    Snd.syncVolumes();
    // default walk pace (dev tools can retune at runtime)
    this.moveMs = 350;

    this.screens = {
      title: ScreenTitle,
      intro: ScreenIntro,
      menu: ScreenMenu,
      story: ScreenStory,
      settings: ScreenSettings,
      game: ScreenGame,
      challenge: ScreenChallenge,
      timed: ScreenTimed,
      shop: ScreenShop,
      dev: ScreenDev,
    };

    Art.setSkin(Save.data.shop.skin);
    Art.setTheme(Save.data.shop.theme);

    this.resize();
    window.addEventListener('resize', () => this.resize());

    Art.loadSprites(() => {});
    this.bindInput();
    this.setScreen('title', null, true);
    requestAnimationFrame(ts => this.loop(ts));
  },

  safeTop: 0, framed: false,
  resize() {
    const dpr = window.devicePixelRatio || 1;
    this._applyFrame();                       // may resize #device (desktop bezel)
    const dev = document.getElementById('device');
    this.W = dev.clientWidth;
    this.H = dev.clientHeight;
    const probe = document.getElementById('safe-probe');
    this.safeTop = probe ? probe.offsetHeight : 0;
    if (this.framed) this.safeTop = Math.max(this.safeTop, 26); // reserve notch
    this.canvas.width = this.W * dpr;
    this.canvas.height = this.H * dpr;
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  },

  // On a mouse-driven, roomy window (i.e. a desktop browser) we shrink the
  // game into a centred phone-shaped bezel — this is an iPhone/Android game,
  // so desktop gets a phone preview rather than a stretched full screen.
  _applyFrame() {
    const fine = window.matchMedia('(pointer: fine)').matches;
    const roomy = window.innerWidth > 620 && window.innerHeight > 560;
    this.framed = fine && roomy;
    document.body.classList.toggle('framed', this.framed);
    const dev = document.getElementById('device');
    if (!this.framed) { dev.style.width = ''; dev.style.height = ''; return; }
    const AR = 390 / 844;                      // iPhone-ish portrait aspect
    let h = Math.min(880, window.innerHeight - 28);
    let w = Math.round(h * AR);
    const maxW = window.innerWidth - 28;
    if (w > maxW) { w = maxW; h = Math.round(w / AR); }
    dev.style.width = w + 'px';
    dev.style.height = h + 'px';
  },

  // in-game on-screen controls take the bottom slice on real touch devices
  // AND in the desktop phone frame — reserve space for them either way
  padControls() { return this.isTouch || this.framed; },

  setScreen(name, params, instant) {
    if (instant) {
      this._activate(name, params);
      return;
    }
    this.transition = { phase: 'out', t: 0, next: name, params };
  },

  _activate(name, params) {
    if (this.screen && this.screen.exit) this.screen.exit();
    this.screenName = name;
    this.screen = this.screens[name];
    document.body.classList.toggle('in-game', name === 'game');
    this.screen.enter(params || {});
  },

  lastTs: 0,
  loop(ts) {
    requestAnimationFrame(t => this.loop(t));
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000) || 0.016;
    this.lastTs = ts;

    if (this.screen && this.screen.update) this.screen.update(dt);
    if (this.screen && this.screen.draw) {
      // keep all UI below the notch; the strip above stays background-black
      if (this.safeTop > 0) {
        this.ctx.fillStyle = '#08090e';
        this.ctx.fillRect(0, 0, this.W, this.safeTop);
      }
      this.ctx.save();
      this.ctx.translate(0, this.safeTop);
      this.screen.draw(this.ctx, this.W, this.H - this.safeTop);
      this.ctx.restore();
    }

    // fade transition
    if (this.transition) {
      const tr = this.transition;
      tr.t += dt * 4;
      if (tr.phase === 'out') {
        this.ctx.fillStyle = `rgba(2,3,6,${Math.min(1, tr.t)})`;
        this.ctx.fillRect(0, 0, this.W, this.H);
        if (tr.t >= 1) {
          this._activate(tr.next, tr.params);
          tr.phase = 'in'; tr.t = 0;
        }
      } else {
        this.ctx.fillStyle = `rgba(2,3,6,${Math.max(0, 1 - tr.t)})`;
        this.ctx.fillRect(0, 0, this.W, this.H);
        if (tr.t >= 1) this.transition = null;
      }
    }
  },

  // ── input ──
  bindInput() {
    const unlock = () => {
      Snd.unlock();
      if (Snd._pendingSong) { const s = Snd._pendingSong; Snd._pendingSong = null; Snd.playMusic(s); }
    };
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });

    // canvas taps + drag-scroll (tap fires on release if barely moved)
    let ptr = null;
    this.canvas.addEventListener('pointerdown', e => {
      if (this.transition) return;
      const r = this.canvas.getBoundingClientRect();
      ptr = { x: e.clientX - r.left, y: e.clientY - r.top, ly: e.clientY - r.top, moved: false };
    });
    this.canvas.addEventListener('pointermove', e => {
      if (!ptr) return;
      const r = this.canvas.getBoundingClientRect();
      const y = e.clientY - r.top;
      const dy = y - ptr.ly;
      if (Math.abs(y - ptr.y) > 9) ptr.moved = true;
      if (ptr.moved && this.screen && this.screen.onScroll) this.screen.onScroll(dy);
      ptr.ly = y;
    });
    const ptrUp = e => {
      if (!ptr) return;
      const wasTap = !ptr.moved;
      const { x, y } = ptr;
      ptr = null;
      if (wasTap && !this.transition && this.screen && this.screen.onTap) this.screen.onTap(x, y - this.safeTop);
    };
    this.canvas.addEventListener('pointerup', ptrUp);
    this.canvas.addEventListener('pointercancel', () => { ptr = null; });

    // d-pad buttons
    const DIRS = {
      'dp-up': [0, -1], 'dp-down': [0, 1],
      'dp-left': [-1, 0], 'dp-right': [1, 0],
    };
    Object.entries(DIRS).forEach(([id, [dc, dr]]) => {
      const btn = document.getElementById(id);
      const onPress = e => {
        e.preventDefault();
        if (this.transition) return;
        if (this.screen && this.screen.onDirPress) this.screen.onDirPress(dc, dr);
      };
      const onRelease = e => {
        if (e) e.preventDefault();
        if (this.screen && this.screen.onDirRelease) this.screen.onDirRelease(dc, dr);
      };
      btn.addEventListener('touchstart', onPress, { passive: false });
      btn.addEventListener('touchend', onRelease, { passive: false });
      btn.addEventListener('touchcancel', onRelease, { passive: false });
      btn.addEventListener('mousedown', onPress);
      btn.addEventListener('mouseup', onRelease);
      btn.addEventListener('mouseleave', () => onRelease(null));
    });

    const bindBtn = (id, fn) => {
      const b = document.getElementById(id);
      const h = e => { e.preventDefault(); if (!this.transition) fn(); };
      b.addEventListener('touchstart', h, { passive: false });
      b.addEventListener('mousedown', h);
    };
    bindBtn('btn-undo', () => this.screen && this.screen.onUndo && this.screen.onUndo());
    bindBtn('btn-reset', () => this.screen && this.screen.onReset && this.screen.onReset());
    bindBtn('btn-hint', () => this.screen && this.screen.onHint && this.screen.onHint());
    bindBtn('btn-gear', () => this.screen && this.screen.onGear && this.screen.onGear());
    bindBtn('btn-bag', () => this.screen && this.screen.onBag && this.screen.onBag());

    // keyboard
    const KEY_DIRS = {
      'ArrowUp': [0, -1], 'ArrowDown': [0, 1], 'ArrowLeft': [-1, 0], 'ArrowRight': [1, 0],
      'w': [0, -1], 's': [0, 1], 'a': [-1, 0], 'd': [1, 0],
    };
    document.addEventListener('keydown', e => {
      if (this.transition) return;
      const d = KEY_DIRS[e.key];
      if (d) {
        e.preventDefault();
        if (e.repeat) return;
        if (this.screen && this.screen.onDirPress) this.screen.onDirPress(d[0], d[1]);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (this.screen && this.screen.onConfirm) this.screen.onConfirm();
      } else if (e.key === 'Escape' || e.key === 'x' || e.key === 'X') {
        if (this.screen && this.screen.onBack) this.screen.onBack();
      } else if (e.key === 'u' || e.key === 'U') {
        if (this.screen && this.screen.onUndo) this.screen.onUndo();
      } else if (e.key === 'r' || e.key === 'R') {
        if (this.screen && this.screen.onReset) this.screen.onReset();
      } else if (e.key === 'e' || e.key === 'E') {
        if (this.screen && this.screen.onGear) this.screen.onGear();
      } else if (e.key === 'i' || e.key === 'I') {
        if (this.screen && this.screen.onBag) this.screen.onBag();
      }
    });
    document.addEventListener('keyup', e => {
      const d = KEY_DIRS[e.key];
      if (d && this.screen && this.screen.onDirRelease) this.screen.onDirRelease(d[0], d[1]);
    });
  },
};

window.addEventListener('DOMContentLoaded', () => App.init());
// expose for tests/debugging
window.DELVE = App;
