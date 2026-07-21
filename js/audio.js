'use strict';
// ── Snd: WebAudio chiptune synth — all SFX + music generated at runtime ──

const Snd = {
  ctx: null, master: null, sfxGain: null, musGain: null,
  musicOn: true, sfxOn: true,
  _musicTimer: null, _song: null, _songStep: 0, _nextNoteTime: 0,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.master);
    this.musGain = this.ctx.createGain();
    this.musGain.gain.value = 0.55;
    this.musGain.connect(this.master);
    this.applySettings();
  },

  // resume on first gesture (iOS requirement)
  unlock() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  applySettings() {
    if (!this.ctx) return;
    this.sfxGain.gain.value = this.sfxOn ? 1 : 0;
    this.musGain.gain.value = this.musicOn ? 0.55 : 0;
  },

  // ── primitive: one enveloped oscillator note ──
  tone(freq, dur, type, vol, when, slideTo, dest) {
    if (!this.ctx) return;
    const t = (when || this.ctx.currentTime);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  },

  noise(dur, vol, when, hipass) {
    if (!this.ctx) return;
    const t = (when || this.ctx.currentTime);
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    let node = src;
    if (hipass) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = hipass;
      src.connect(f); node = f;
    }
    node.connect(g); g.connect(this.sfxGain);
    src.start(t);
  },

  // ── SFX vocabulary ──
  blip()      { this.tone(620, 0.05, 'square', 0.12); },
  select()    { this.tone(520, 0.06, 'square', 0.14); this.tone(780, 0.09, 'square', 0.14, this.now(0.05)); },
  back()      { this.tone(420, 0.06, 'square', 0.12); this.tone(300, 0.09, 'square', 0.10, this.now(0.05)); },
  bump()      { this.tone(110, 0.06, 'square', 0.16); },
  step()      { this.tone(190, 0.025, 'triangle', 0.06); },
  push()      { this.tone(85, 0.12, 'sawtooth', 0.10); this.noise(0.08, 0.03, 0, 200); },
  thud()      { this.tone(72, 0.14, 'sine', 0.30); this.noise(0.05, 0.08, 0, 400); },
  switchOn()  { this.tone(880, 0.06, 'square', 0.14); this.tone(1320, 0.12, 'square', 0.12, this.now(0.06)); },
  exitOpen()  { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.14, 'square', 0.13, this.now(i * 0.08))); this.tone(55, 0.5, 'sawtooth', 0.10); },
  coin()      { this.tone(988, 0.06, 'square', 0.13); this.tone(1319, 0.16, 'square', 0.13, this.now(0.06)); },
  keyGet()    { [660, 880, 1100].forEach((f, i) => this.tone(f, 0.09, 'triangle', 0.16, this.now(i * 0.07))); },
  doorUnlock(){ this.noise(0.05, 0.10, 0, 800); this.tone(392, 0.08, 'square', 0.13, this.now(0.06)); this.tone(523, 0.14, 'square', 0.13, this.now(0.13)); },
  cut()       { this.noise(0.10, 0.14, 0, 1600); this.tone(240, 0.08, 'sawtooth', 0.07); },
  snuff()     { this.noise(0.22, 0.12, 0, 900); this.tone(180, 0.18, 'sine', 0.10, 0, 60); },
  crack()     { this.noise(0.14, 0.16, 0, 500); this.tone(150, 0.1, 'square', 0.08, 0, 60); },
  fall()      { this.tone(300, 0.35, 'square', 0.13, 0, 55); },
  chestOpen() { this.tone(196, 0.1, 'square', 0.12); this.tone(262, 0.1, 'square', 0.12, this.now(0.09)); this.tone(330, 0.18, 'square', 0.13, this.now(0.18)); },
  itemGet()   { [523, 587, 659, 1047].forEach((f, i) => this.tone(f, i === 3 ? 0.55 : 0.13, 'square', 0.15, this.now(i * 0.13))); },
  fanfare()   { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, i >= 4 ? 0.3 : 0.11, 'square', 0.14, this.now(i * 0.09))); },
  buy()       { this.coin(); this.tone(1568, 0.2, 'square', 0.10, this.now(0.14)); },
  error()     { this.tone(160, 0.09, 'square', 0.14); this.tone(120, 0.14, 'square', 0.14, this.now(0.08)); },
  tick()      { this.tone(1000, 0.03, 'square', 0.08); },
  tickUrgent(){ this.tone(1400, 0.04, 'square', 0.12); },
  timeUp()    { this.tone(400, 0.3, 'square', 0.15, 0, 90); },
  undo()      { this.tone(500, 0.05, 'triangle', 0.10); this.tone(380, 0.08, 'triangle', 0.10, this.now(0.04)); },

  now(dt) { return this.ctx ? this.ctx.currentTime + dt : 0; },

  // ── Music: tiny step sequencer. Songs = chord-driven arps ──
  // song: {bpm, bars:[{chord:[midi...], bass:midi}], patLen, melody:idxPattern}
  playMusic(name) {
    if (!this.ctx) { this._pendingSong = name; return; }
    if (this._song && this._song.name === name) return;
    this.stopMusic();
    const song = SONGS[name];
    if (!song) return;
    this._song = Object.assign({ name }, song);
    this._songStep = 0;
    this._nextNoteTime = this.ctx.currentTime + 0.1;
    this._musicTimer = setInterval(() => this._schedule(), 90);
  },

  stopMusic() {
    if (this._musicTimer) clearInterval(this._musicTimer);
    this._musicTimer = null;
    this._song = null;
  },

  _schedule() {
    if (!this._song || !this.ctx) return;
    const s = this._song;
    const spb = 60 / s.bpm / 2; // 8th note step
    while (this._nextNoteTime < this.ctx.currentTime + 0.3) {
      const stepsPerBar = s.melody.length;
      const bar = Math.floor(this._songStep / stepsPerBar) % s.bars.length;
      const step = this._songStep % stepsPerBar;
      const b = s.bars[bar];
      const mi = s.melody[step];
      const t = this._nextNoteTime;
      if (mi >= 0 && b.chord[mi] != null) {
        this.tone(midiF(b.chord[mi]), spb * 0.9, s.wave || 'square', s.vol || 0.045, t, null, this.musGain);
      }
      if (step === 0 || (s.bassHalf && step === stepsPerBar / 2)) {
        this.tone(midiF(b.bass), spb * (s.bassHalf ? stepsPerBar / 2 : stepsPerBar) * 0.95, 'triangle', s.bassVol || 0.09, t, null, this.musGain);
      }
      this._songStep++;
      this._nextNoteTime += spb;
    }
  },
};

function midiF(m) { return 440 * Math.pow(2, (m - 69) / 12); }

// A minor arps. midi: A4=69, C5=72, E5=76
const SONGS = {
  title: {
    bpm: 104, wave: 'square', vol: 0.05, bassVol: 0.10, bassHalf: true,
    melody: [0, 1, 2, 1, 3, 1, 2, 1],
    bars: [
      { chord: [69, 72, 76, 81], bass: 45 }, // Am
      { chord: [65, 69, 72, 77], bass: 41 }, // F
      { chord: [67, 71, 74, 79], bass: 43 }, // G
      { chord: [64, 68, 71, 76], bass: 40 }, // E
    ],
  },
  dungeon: {
    bpm: 76, wave: 'triangle', vol: 0.055, bassVol: 0.08,
    melody: [0, -1, 1, -1, 2, -1, 1, -1],
    bars: [
      { chord: [57, 60, 64], bass: 33 }, // Am low
      { chord: [57, 60, 64], bass: 33 },
      { chord: [55, 59, 62], bass: 31 }, // G
      { chord: [52, 56, 59], bass: 28 }, // E
    ],
  },
  deep: {
    bpm: 54, wave: 'triangle', vol: 0.05, bassVol: 0.075,
    melody: [0, -1, -1, 1, -1, -1, 2, -1],
    bars: [
      { chord: [45, 48, 52], bass: 33 }, // Am, very low
      { chord: [45, 48, 52], bass: 33 },
      { chord: [44, 47, 51], bass: 32 }, // Ab-ish drift
      { chord: [43, 47, 50], bass: 31 }, // G
    ],
  },
  shop: {
    bpm: 118, wave: 'square', vol: 0.045, bassVol: 0.10, bassHalf: true,
    melody: [0, 2, 1, 2, 3, 2, 1, 2],
    bars: [
      { chord: [72, 76, 79, 84], bass: 48 }, // C
      { chord: [65, 69, 72, 77], bass: 41 }, // F
      { chord: [67, 71, 74, 79], bass: 43 }, // G
      { chord: [72, 76, 79, 84], bass: 48 }, // C
    ],
  },
};
