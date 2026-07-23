'use strict';
// ── Game screen: plays one puzzle level with anims + sfx ──────
// Supports three game modes:
//   story     — handcrafted campaign levels with dialogs/chests
//   challenge — endless generated depths with a move budget
//   timed     — 5-stage generated gauntlet against the clock

// Walk timing lives on App.moveMs so dev tools can tune it live.
// 350ms/tile ~= 2.9 tiles/sec, a Game-Boy-era Zelda/Pokemon walk pace
// (was 150ms = ~6.6 tiles/sec, too fast to read the animation).
function moveMs() { return (typeof App !== 'undefined' && App.moveMs) || 350; }

const ScreenGame = {
  // mode: dialog | play | moving | chest | won | results | runover
  enter(params) {
    this.gameMode = params.gameMode || 'story';
    this.run = params.run || null;
    this.dungeon = null;

    if (this.gameMode === 'story') {
      // multi-room dungeon
      this.dungeon = getDungeon(params.dungeonId);
      this.firstTime = !Save.isDungeonDone(this.dungeon.id);
      this.mapFound = Save.hasDungeonMap(this.dungeon.id);
      this.budget = 0;
      this.rooms = {};             // persistent per-room engine states
      this.dkeys = 0;              // shared key pool
      this.unlocked = {};          // "roomId:side" opened lock-doors
      this.visited = {};           // rooms seen (for the map)
      this._introSeen = {};
      this.introShown = false;
      this.roomTrans = null;
      this._initStoryFields();
      this._loadRoom(this.dungeon.start.room, null, this.dungeon.start);
      // dungeon-level intro on the very first room
      if (this.firstTime && this.dungeon.intro) {
        this.showDialog(this.dungeon.intro, () => this._maybeRoomIntro());
        this.introShown = true;
      }
      return;
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
    this._initStoryFields();
    this._setPlayerCell(this.state.player.r, this.state.player.c);
    Snd.playMusic(this.state.dark ? 'deep' : 'dungeon');
  },

  // transient per-screen state shared by all modes
  _initStoryFields() {
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
    this.pauseList = null;
    this.uiT = 0;
    this.gearTab = 'equipment';
    this.gearSel = 0;
    this.coinsRun = 0;        // coins gathered across the whole dungeon run
    this._song = null;        // current music track (avoid restarts per room)
    this._outroDone = false;
    this.roomTrans = null;
    // ── free-movement (Link's Awakening style) ──
    this.held = { up: false, down: false, left: false, right: false };
    this.px = 1.5; this.py = 1.5; this.pdir = 'down';
    this.pmoving = false; this.walkPhase = 0; this.pframe = 0;
    this.pushT = 0; this.pushGrace = 0; this.pushDir = null; this.blockSlide = null;
    this.steps = 0; this._lastTile = null; this._entryCell = null;
    this._needToastT = 0;
    const hintBtn = document.getElementById('btn-hint');
    if (hintBtn) hintBtn.style.display = this.gameMode === 'story' ? 'flex' : 'none';
    document.body.classList.toggle('no-relics', this.gameMode !== 'story');
    this._pulseGear(false);
  },

  // ── dungeon room loading / transitions ──
  _loadRoom(roomId, entrySide, startPos) {
    const room = this.dungeon.rooms[roomId];
    this.roomId = roomId;
    this.visited[roomId] = true;
    // restore a persisted room state, or parse it fresh
    let st = this.rooms[roomId];
    if (!st) { st = parseLevel({ map: room.map, chest: room.chest || null }); this.rooms[roomId] = st; }
    st.dark = !!room.dark;
    st.keys = this.dkeys;
    // place the player: dungeon start, or just inside the entry door
    if (startPos) { st.player.r = startPos.r; st.player.c = startPos.c; st.player.dir = 'down'; }
    else if (entrySide) {
      const { w, h } = Dungeon.dims(room), inner = Dungeon.innerCell(w, h, entrySide);
      st.player.r = inner.r; st.player.c = inner.c;
      st.player.dir = { n: 'down', s: 'up', e: 'left', w: 'right' }[entrySide];
    }
    this.state = st;
    this.lv = { map: room.map, chest: room.chest || null };
    this.history = [];
    this.filled = {};
    this._recomputeFilled();
    this.anim = null; this.heldDir = null; this.queued = null;
    this.blockSlide = null; this.pushT = 0;
    this._setPlayerCell(st.player.r, st.player.c);
    const song = st.dark ? 'deep' : 'dungeon';
    if (song !== this._song) { Snd.playMusic(song); this._song = song; }
  },

  // place the free-moving player at the centre of tile (r,c)
  _setPlayerCell(r, c) {
    this.px = c + 0.5; this.py = r + 0.5;
    this.state.player.r = r; this.state.player.c = c;
    this._lastTile = r + ',' + c;
    this._entryCell = { r, c };
  },

  // Per-room entry popups are intentionally disabled — walking into a room
  // never interrupts the player. Mechanics are taught reactively (interaction
  // toasts) and in the first-run intro; anything more belongs in a dedicated
  // tutorial dungeon. Room `intro` strings in the data are left unused.
  _maybeRoomIntro() {},
  _seenIntro(id) { return this._introSeen && this._introSeen[id]; },
  _markIntro(id) { (this._introSeen = this._introSeen || {})[id] = true; },

  // ── door transitions (dungeon mode) ──
  // is the cell the player would step into an edge doorway of this room?
  _doorAhead(dc, dr) {
    const room = this.dungeon.rooms[this.roomId];
    const { w, h } = Dungeon.dims(room);
    const tr = this.state.player.r + dr, tc = this.state.player.c + dc;
    for (const side of D_SIDES) {
      if (!room.doors[side]) continue;
      const cell = Dungeon.doorCell(w, h, side);
      if (cell.r === tr && cell.c === tc) return { side };
    }
    return null;
  },
  _tryDoor(side) {
    const room = this.dungeon.rooms[this.roomId];
    const type = room.doors[side];
    this.state.player.dir = { n: 'up', s: 'down', e: 'right', w: 'left' }[side];
    if (type === 'lock' && !this.unlocked[this.roomId + ':' + side]) {
      if (this.state.keys > 0) {
        this.state.keys--; this.dkeys = this.state.keys;
        this._unlockDoor(this.roomId, side);
        Snd.doorUnlock();
      } else { Snd.bump(); this.showToast('LOCKED. FIND A KEY.'); return; }
    } else if (type === 'shutter' && !Dungeon.roomSolved(this.state)) {
      Snd.bump(); this.showToast('SEALED. SOLVE THIS ROOM.'); return;
    }
    this._beginRoomTransition(side);
  },
  // opening a lock-door unbars it from both rooms so backtracking is free
  _unlockDoor(roomId, side) {
    this.unlocked[roomId + ':' + side] = true;
    const nid = Dungeon.neighborId(this.dungeon, this.dungeon.rooms[roomId], side);
    if (nid) this.unlocked[nid + ':' + D_OPP[side]] = true;
  },
  _beginRoomTransition(side) {
    const nid = Dungeon.neighborId(this.dungeon, this.dungeon.rooms[this.roomId], side);
    if (!nid) { Snd.bump(); return; }
    this.dkeys = this.state.keys;         // persist the shared key pool
    this.mode = 'trans';
    this.heldDir = null; this.queued = null; this.anim = null;
    this.roomTrans = { side, nid, phase: 'out', t: 0 };
    Snd.door();
  },
  // door cells + their live open/type for this room's render pass
  _doorCells() {
    const room = this.dungeon.rooms[this.roomId];
    const { w, h } = Dungeon.dims(room);
    const pass = Dungeon.passableSides(this.dungeon, this.roomId, this.state, this.unlocked);
    const out = {};
    for (const side of D_SIDES) {
      const type = room.doors[side];
      if (!type) continue;
      const cell = Dungeon.doorCell(w, h, side);
      out[cell.r + ',' + cell.c] = { side, type, open: !!pass[side] };
    }
    return out;
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

  // ── equipment / inventory subscreens (OoT-style) ──
  _pulseGear(on) {
    const b = document.getElementById('btn-gear');
    if (b) b.classList.toggle('pulse', !!on);
  },
  _openGear(tab, selItem) {
    if (this.gameMode !== 'story') return;
    if (this.mode !== 'play' && this.mode !== 'moving') return;
    this.anim = null;
    this.heldDir = null;
    this.gearTab = tab;
    this.gearSel = 0;
    if (selItem) {
      const i = GearUI.slots.findIndex(s => s.item === selItem);
      if (i >= 0) this.gearSel = i;
    }
    this.mode = 'gear';
    this.uiT = 0;
    this._pulseGear(false);
    Snd.select();
  },
  onGear() { if (this.mode === 'gear') GearUI.setTab(this, 'equipment'); else this._openGear('equipment'); },
  onBag() { if (this.mode === 'gear') GearUI.setTab(this, 'inventory'); else this._openGear('inventory'); },
  _closeGear() {
    this.mode = 'play';
    this.heldDir = null;
    Snd.back();
  },

  showDialog(text, cb) {
    this.mode = 'dialog';
    this.dialog = { text: String(text), chars: 0, cb };
  },

  showToast(text) {
    this.toast = { text, t: 1.8 };
  },

  // gameplay abilities come from EQUIPPED relics, not merely owned ones —
  // you must equip the blade before it cuts, the shield before it wards
  inventory() { return Save.data.story.equipped; },

  movesLeft() { return this.budget ? Math.max(0, this.budget - (this.steps || 0)) : null; },

  // undo history for the free-movement world: engine state + player position
  _pushHistory(beforeState) {
    this.history.push({ st: beforeState, px: this.px, py: this.py, steps: this.steps });
    if (this.history.length > 200) this.history.shift();
  },
  _needToast(item) {
    if (this._needToastT > 0) return;
    this._needToastT = 1.2;
    if (item === 'key') { this.showToast('LOCKED. FIND A KEY.'); return; }
    if (Save.hasItem(item) && !Save.isEquipped(item)) {
      const m = { sword: 'EQUIP YOUR BLADE FIRST!', shield: 'RAISE YOUR SHIELD FIRST!', glove: 'EQUIP THE TITAN GLOVE FIRST!', boots: 'EQUIP THE STRIDER BOOTS FIRST!', lantern: 'EQUIP THE PALE LANTERN FIRST!' };
      this.showToast(m[item] || 'EQUIP THAT GEAR FIRST!'); this._pulseGear(true); return;
    }
    const m = { sword: 'TOO THICK. YOU NEED A BLADE.', glove: 'FAR TOO HEAVY TO PUSH.', shield: 'THE FLAMES DRIVE YOU BACK.', boots: 'A CHASM. YOU NEED STRIDER BOOTS.' };
    if (m[item]) this.showToast(m[item]);
  },
  // react to a frame of free movement; returns true if it changed the mode
  _handleFreeEvents(evs) {
    const has = t => evs.some(e => e.type === t);
    if (has('coin')) { Snd.coin(); if (this.gameMode === 'story') this.coinsRun = (this.coinsRun || 0) + 1; }
    if (has('key')) Snd.keyGet();
    if (has('unlock')) Snd.doorUnlock();
    if (has('crackBreak')) Snd.crack();
    if (has('switchOn')) Snd.switchOn();
    if (has('snuff')) Snd.snuff();
    if (has('cut')) { const e = evs.find(x => x.type === 'cut'); this.cutAnim = { r: e.r, c: e.c, t: 0.25 }; Snd.cut(); }
    if (has('push')) { Snd.push(); Platform.haptic(); }
    if (has('blockFall')) { const e = evs.find(x => x.type === 'blockFall'); this.fallAnim = { r: e.r, c: e.c, t: 0 }; Snd.fall(); this.filled[e.r + ',' + e.c] = true; this.blockSlide = null; }
    if (has('exitOpen')) { Snd.exitOpen(); this.exitGlow = 1; if (!Save.data.settings.reducedFlash) this.flash = 1; }
    const need = evs.find(e => e.type === 'needItem'); if (need) this._needToast(need.item);
    if (has('lockedBump')) this._needToast('key');
    if (has('shutterBump') && this._needToastT <= 0) { this._needToastT = 1.2; this.showToast('SEALED. SOLVE THIS ROOM.'); }
    const chestE = evs.find(e => e.type === '_chest');
    if (chestE) {
      this._pushHistory(chestE.before);
      this.state = chestE.res.state;
      this.pendingExitOpen = chestE.res.events.some(e => e.type === 'exitOpen');
      this.mode = 'chest';
      this.chestAnim = { phase: 0, t: 0, item: chestE.res.events.find(e => e.type === 'chest').item };
      Snd.chestOpen();
      return true;
    }
    if (has('win')) { this.mode = 'won'; this.wonT = 0; Snd.fanfare(); Platform.haptic('heavy'); return true; }
    const door = evs.find(e => e.type === 'door');
    if (door) { this._beginRoomTransition(door.side); return true; }
    return false;
  },

  // ── input ──
  attemptMove(dc, dr, fromRepeat) {
    if (this.mode !== 'play') return;
    // dungeon: stepping toward a room-edge door leaves the room
    if (this.gameMode === 'story') {
      const d = this._doorAhead(dc, dr);
      if (d) { if (!fromRepeat) this._tryDoor(d.side); return; }
    }
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
          else if (Save.hasItem(need.item) && !Save.isEquipped(need.item)) {
            // owns it but hasn't equipped it — nudge them to the gear screen
            const m = { sword: 'EQUIP YOUR BLADE FIRST!', shield: 'RAISE YOUR SHIELD FIRST!', glove: 'EQUIP THE TITAN GLOVE FIRST!' };
            this.showToast(m[need.item] || 'EQUIP THAT GEAR FIRST!');
            this._pulseGear(true);
          }
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
    if (evs.some(e => e.type === 'unlock')) Snd.doorUnlock();
    if (evs.some(e => e.type === 'crackBreak')) Snd.crack();
    if (pushEv) Snd.push(); else Snd.step();
  },

  settleMove() {
    const a = this.anim;
    this.anim = null;
    this.state = a.newState;
    this.mode = 'play';
    const has = t => a.events.some(e => e.type === t);
    if (this.gameMode === 'story') this.dkeys = this.state.keys;
    if (a.push && !has('blockFall')) { Snd.thud(); Platform.haptic(); }
    if (has('blockFall')) {
      const ev = a.events.find(e => e.type === 'blockFall');
      this.fallAnim = { r: ev.r, c: ev.c, t: 0 };
      Snd.fall();
      this.filled[ev.r + ',' + ev.c] = true;
    }
    if (has('switchOn')) Snd.switchOn();
    if (has('snuff')) Snd.snuff();
    if (has('coin')) { Snd.coin(); this.coinsRun = (this.coinsRun || 0) + 1; }
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
      Platform.haptic('heavy');
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
    if (this.mode === 'play') {
      if (dc < 0) this.held.left = true; else if (dc > 0) this.held.right = true;
      if (dr < 0) this.held.up = true; else if (dr > 0) this.held.down = true;
    }
    else if (this.mode === 'gear') GearUI.onDir(this, dc, dr);
    else if (this.mode === 'paused' && dr) this.pauseList.nav(dr);
    else if ((this.mode === 'results' || this.mode === 'runover') && dr && this.resultInfo) this.resultInfo.list.nav(dr);
  },
  onDirRelease(dc, dr) {
    if (dc < 0) this.held.left = false; else if (dc > 0) this.held.right = false;
    if (dr < 0) this.held.up = false; else if (dr > 0) this.held.down = false;
  },

  onConfirm() {
    if (this.mode === 'dialog') this._advanceDialog();
    else if (this.mode === 'chest') this._advanceChest();
    else if (this.mode === 'gear') GearUI.onConfirm(this);
    else if (this.mode === 'paused') this.pauseList.activate();
    else if ((this.mode === 'results' || this.mode === 'runover') && this.resultInfo) this.resultInfo.list.activate();
  },
  onTap(x, y) {
    if (this.mode === 'dialog') this._advanceDialog();
    else if (this.mode === 'chest') this._advanceChest();
    else if (this.mode === 'gear') { if (!GearUI.onTap(this, x, y)) this._closeGear(); }
    else if (this.mode === 'paused') this.pauseList.tapAt(x, y);
    else if ((this.mode === 'results' || this.mode === 'runover') && this.resultInfo) this.resultInfo.list.tapAt(x, y);
    else if (this._backBtn) {
      const b = this._backBtn;
      // generous hit slop around the pill
      if (x >= b.x - 6 && x <= b.x + b.w + 8 && y >= b.y - 6 && y <= b.y + b.h + 6) this.onBack();
    }
  },
  onBack() {
    if (this.mode === 'dialog') { this._advanceDialog(); return; }
    if (this.mode === 'gear') { this._closeGear(); return; }
    if (this.mode === 'paused') { this._resume(); return; }
    if (this.mode !== 'play' && this.mode !== 'moving') return;
    this._pause();
  },
  _pause() {
    Snd.back();
    this.mode = 'paused';
    this.uiT = 0;
    this._buildPauseList();
  },
  _buildPauseList(keepSel) {
    const st = Save.data.settings;
    this.pauseList = new MenuList([
      { label: 'RESUME', action: () => this._resume() },
      { label: 'RESTART LEVEL', action: () => { this._resume(); this.onReset(); } },
      { label: 'MUSIC: ' + (st.music ? 'ON' : 'OFF'), action: () => this._pauseToggle('music') },
      { label: 'SOUND: ' + (st.sfx ? 'ON' : 'OFF'), action: () => this._pauseToggle('sfx') },
      { label: 'QUIT', action: () => this._quit() },
    ]);
    if (keepSel != null) this.pauseList.sel = keepSel;
  },
  _pauseToggle(k) {
    const st = Save.data.settings;
    st[k] = !st[k];
    Save.write();
    Snd.musicOn = st.music; Snd.sfxOn = st.sfx;
    Snd.applySettings();
    this._buildPauseList(this.pauseList.sel);
  },
  _resume() {
    Snd.select();
    this.mode = 'play';
    this.pauseList = null;
  },
  _quit() {
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
    if (this.mode !== 'play') return;
    if (!this.history.length) { Snd.error(); return; }
    this.fallAnim = null; this.blockSlide = null; this.pushT = 0;
    const h = this.history.pop();
    this.state = h.st; this.px = h.px; this.py = h.py; this.steps = h.steps;
    this.state.player.r = Math.floor(this.py); this.state.player.c = Math.floor(this.px);
    this._lastTile = this.state.player.r + ',' + this.state.player.c;
    if (this.gameMode === 'story') { this.rooms[this.roomId] = this.state; this.dkeys = this.state.keys; }
    this._recomputeFilled();
    Snd.undo();
  },
  onReset() {
    if (this.mode !== 'play') return;
    this._pushHistory(cloneState(this.state));
    this.fallAnim = null; this.blockSlide = null; this.pushT = 0;
    this.state = parseLevel(this.lv);
    if (this.gameMode === 'story') {
      const room = this.dungeon.rooms[this.roomId];
      this.state.dark = !!room.dark;
      this.state.keys = this.dkeys;
      this.rooms[this.roomId] = this.state;   // keep persisted room in sync
    }
    // return the player to where they entered this room
    const e = this._entryCell || { r: this.state.player.r, c: this.state.player.c };
    this._setPlayerCell(e.r, e.c);
    this.filled = {};
    this.exitGlow = 0;
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
    const item = ca.item;
    // the dungeon map is per-dungeon knowledge, not a global relic
    if (item === 'map') { Save.grantDungeonMap(this.dungeon.id); this.mapFound = true; }
    else Save.grantItem(item);
    this.chestAnim = null;
    this.mode = 'play';
    Snd.select();
    if (this.pendingExitOpen) {
      Snd.exitOpen();
      this.exitGlow = 1;
      if (!Save.data.settings.reducedFlash) this.flash = 1;
      this.pendingExitOpen = false;
    }
    // equippable relic? send the player straight to the gear screen so
    // the first time you EQUIP it feels deliberate (OoT get-item flow)
    if (item !== 'map' && GearUI.slots.some(s => s.item === item) && !Save.isEquipped(item)) {
      this._openGear('equipment', item);
    }
  },

  // ── mode results ──
  _enterResults() {
    if (this.gameMode === 'challenge') return this._challengeClear();
    if (this.gameMode === 'timed') return this._timedClear();
    // ── dungeon cleared ──
    const first = !Save.isDungeonDone(this.dungeon.id);
    const bonus = first ? 40 : 0;
    if (!this._awarded) {
      this._awarded = true;
      if (this.coinsRun) Save.addCoins(this.coinsRun);
      Save.completeDungeon(this.dungeon.id, bonus);
    }
    const next = nextDungeon(this.dungeon.id);
    const relic = ITEMS[this.dungeon.item];
    const items = [];
    if (next) items.push({ label: 'NEXT DUNGEON', action: () => App.setScreen('game', { gameMode: 'story', dungeonId: next.id }) });
    items.push({ label: 'DUNGEON SELECT', action: () => App.setScreen('story') });
    const gathered = this.coinsRun || 0;
    const lines = [];
    if (relic) lines.push('RELIC: ' + relic.name);
    if (gathered) lines.push('COINS GATHERED +' + gathered);
    if (first) lines.push('FIRST CLEAR BONUS +' + bonus);
    lines.push('TOTAL +' + (gathered + bonus) + ' COINS');
    this.resultInfo = {
      title: 'DUNGEON CLEARED', sub: this.dungeon.name,
      lines,
      list: new MenuList(items),
    };
    this.mode = 'results';
    this.uiT = 0;
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
      lines: ['MOVES: ' + (this.steps||0) + ' / ' + this.budget, 'RUN COINS: ' + run.coins],
      list: new MenuList([
        { label: 'DELVE DEEPER', action: () => { run.depth++; App.setScreen('game', { gameMode: 'challenge', run }); } },
        { label: 'END RUN', action: () => { this._recordChallenge(); App.setScreen('challenge'); } },
      ]),
    };
    this.mode = 'results';
    this.uiT = 0;
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
    this.uiT = 0;
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
      this.uiT = 0;
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
      this.uiT = 0;
    }
  },

  // ── update ──
  update(dt) {
    this.t += dt;
    this.uiT += dt;
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
    if (this.exitGlow > 0) this.exitGlow = Math.max(0, this.exitGlow - dt * 0.4);
    if (this.fallAnim) { this.fallAnim.t += dt; if (this.fallAnim.t > 0.3) this.fallAnim = null; }
    if (this.cutAnim) { this.cutAnim.t -= dt; if (this.cutAnim.t <= 0) this.cutAnim = null; }
    if (this.hintPath) { this.hintPath.t -= dt; if (this.hintPath.t <= 0) this.hintPath = null; }

    if (this.gameMode === 'timed' && this.mode === 'play') {
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

    if (this.mode === 'trans' && this.roomTrans) {
      const rt = this.roomTrans, DUR = 0.16;
      rt.t += dt;
      if (rt.phase === 'out' && rt.t >= DUR) {
        this._loadRoom(rt.nid, D_OPP[rt.side], null);
        this.mode = 'trans';           // _loadRoom doesn't set mode
        rt.phase = 'in'; rt.t = 0;
      } else if (rt.phase === 'in' && rt.t >= DUR) {
        this.roomTrans = null;
        this.mode = 'play';
        this._maybeRoomIntro();
      }
      return;
    }

    if (this.blockSlide) { this.blockSlide.t += dt; if (this.blockSlide.t >= 0.12) this.blockSlide = null; }
    if (this._needToastT > 0) this._needToastT -= dt;
    if (this.mode === 'play') {
      const evs = FM.update(this, dt);
      if (evs.length && this._handleFreeEvents(evs)) return;   // mode may have changed
      this.pframe = this.pmoving ? (1 + Math.floor(this.walkPhase * 5) % 4) : 0;
      if (this.gameMode === 'challenge' && this.movesLeft() === 0) { this._runOver(); return; }
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
        if (this.gameMode === 'story' && this.firstTime && this.dungeon.outro && !this._outroDone) {
          this._outroDone = true;
          this.showDialog(this.dungeon.outro, () => this._enterResults());
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
    const botH = App.padControls() ? 248 : 36;
    // cap tile size so the board stays compact and proportionate to the
    // controls instead of stretching edge-to-edge on big phones
    const maxT = App.padControls() ? 30 : 40;
    const T = Math.max(8, Math.min(maxT, Math.floor(Math.min((W - 8) / st.w, (H - hudH - botH) / st.h))));
    const bx = Math.floor((W - T * st.w) / 2);
    const by = hudH + Math.floor((H - hudH - botH - T * st.h) / 2);
    this._board = { bx, by, T };
    this._doors = this.gameMode === 'story' ? this._doorCells() : null;

    for (let r = 0; r < st.h; r++) for (let c = 0; c < st.w; c++) {
      const x = bx + c * T, y = by + r * T, t = st.tiles[r][c];
      const seed = (r * 92821) ^ (c * 68917);
      if (t === TILE.WALL) {
        const dd = this._doors && this._doors[r + ',' + c];
        if (dd) Art.doorway(ctx, x, y, T, dd.side, dd.type, dd.open);
        else { Art.wall(ctx, x, y, T); if (st.torches && st.torches[r + ',' + c]) Art.torch(ctx, x, y, T, this.t); }
      }
      else if (t === TILE.FLOOR) {
        Art.floor(ctx, x, y, T, seed);
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
      let bc = b.c, br = b.r;
      const sl = this.blockSlide;
      if (sl && b.r === sl.tr && b.c === sl.tc) {
        const pr = Math.min(1, sl.t / 0.12);
        bc = sl.fc + (sl.tc - sl.fc) * pr;
        br = sl.fr + (sl.tr - sl.fr) * pr;
      }
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

    // continuous player position (tile-box top-left = centre minus half a tile)
    const hc = this.px - 0.5, hr = this.py - 0.5;
    // push pose while a block is sliding, or while we're still shoving/gliding
    // into it (pushGrace) AND holding that same direction — the held-direction
    // gate keeps the pose from lingering when you turn or stop.
    const pushing = !!this.blockSlide || (this.pushGrace > 0 && this.pmoving && this.pushDir === this.pdir);
    const idle = !this.pmoving && !pushing;
    Art.hero(ctx, this.pdir, this.pframe, Math.round(bx + hc * T), Math.round(by + hr * T), T, pushing, idle);

    // darkness: a lit circle only when the PALE LANTERN is equipped;
    // otherwise the dark closes in and nudges you to the gear screen
    if (st.dark) {
      const radius = this.inventory().lantern ? 2.4 : 0.55;
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
    // the minimap only appears once you've claimed this dungeon's MAP chest
    if (this.gameMode === 'story' && this.mapFound && this.mode !== 'gear') this.drawMinimap(ctx, W, H, hudH);

    if (this.toast) {
      let s = 2;
      while (s > 1 && textWidth(this.toast.text, s) > W - 40) s--;
      const tw = Math.min(W - 16, textWidth(this.toast.text, s) + 24);
      const tx = (W - tw) / 2, ty = by - 4;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(tx + 3, ty + 3, tw, 26);
      ctx.fillStyle = '#0b0e1a';
      ctx.fillRect(tx, ty, tw, 26);
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(tx, ty, tw, 2);
      drawTextFit(ctx, this.toast.text, W / 2, ty + 8, tw - 16, s, PAL.goldHi, 'center');
    }

    if (this.mode === 'dialog') this.drawDialog(ctx, W, H);
    if (this.mode === 'chest') this.drawChest(ctx, W, H);
    if (this.mode === 'won') {
      const a = Math.min(0.5, this.wonT * 0.7);
      ctx.fillStyle = `rgba(2,3,6,${a})`; ctx.fillRect(0, 0, W, H);
      drawText(ctx, 'CLEAR!', W / 2, H * 0.4, 5, PAL.goldHi, 'center', '#3a2808');
    }
    if ((this.mode === 'results' || this.mode === 'runover') && this.resultInfo) this.drawResults(ctx, W, H);
    if (this.mode === 'paused') this.drawPause(ctx, W, H);
    if (this.mode === 'gear') GearUI.draw(this, ctx, W, H);

    // room-to-room fade (dungeon transitions)
    if (this.roomTrans) {
      const rt = this.roomTrans, DUR = 0.16;
      let a = rt.phase === 'out' ? rt.t / DUR : 1 - rt.t / DUR;
      a = Math.max(0, Math.min(1, a));
      ctx.fillStyle = `rgba(2,3,6,${a})`;
      ctx.fillRect(0, 0, W, H);
    }
  },

  drawPause(ctx, W, H) {
    // heavier dim in timed mode so pausing can't be used to study the board
    ctx.fillStyle = this.gameMode === 'timed' ? 'rgba(2,3,6,0.93)' : 'rgba(2,3,6,0.66)';
    ctx.fillRect(0, 0, W, H);
    const s = Math.max(2, Math.floor(W / 240));
    const pw = Math.min(W - 48, 340), ph = 330;
    const px = (W - pw) / 2, py = Math.max(30, H * 0.13);
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.uiT / 0.12);
    Art.panel(ctx, px, py, pw, ph);
    drawText(ctx, 'PAUSED', W / 2, py + 20, s + 1, PAL.goldHi, 'center', '#000');
    ctx.restore();
    this.pauseList.draw(ctx, W / 2, py + 64, pw - 48, 42, s, this.uiT);
  },

  // OoT-style minimap (top-left): visited rooms glow gold, the current room
  // is brightest with a marker; unvisited rooms show greyed once the dungeon
  // MAP chest has been opened (before that only your trail is drawn).
  drawMinimap(ctx, W, H, hudH) {
    const rooms = this.dungeon.rooms;
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    for (const id in rooms) {
      const r = rooms[id];
      if (r.gx < minx) minx = r.gx; if (r.gx > maxx) maxx = r.gx;
      if (r.gy < miny) miny = r.gy; if (r.gy > maxy) maxy = r.gy;
    }
    const cols = maxx - minx + 1, rows = maxy - miny + 1;
    const cell = 9, gap = 3, pad = 6, labelH = 11;
    const gw = cols * (cell + gap) - gap, gh = rows * (cell + gap) - gap;
    const pw = gw + pad * 2, ph = gh + pad * 2 + labelH;
    const px = 8, py = hudH + 6;
    ctx.fillStyle = 'rgba(6,8,14,0.76)'; ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(px, py, pw, 1); ctx.fillRect(px, py + ph - 1, pw, 1);
    ctx.fillRect(px, py, 1, ph); ctx.fillRect(px + pw - 1, py, 1, ph);
    ctx.fillStyle = PAL.gold; ctx.fillRect(px, py, pw, 1);
    drawText(ctx, this.mapFound ? 'MAP' : 'TRAIL', px + pad, py + 3, 1, PAL.uiDim, 'left');
    const hasMap = this.mapFound;
    const shown = id => this.visited[id] || hasMap;
    const gx0 = px + pad, gy0 = py + pad + labelH;
    const cellXY = r => [gx0 + (r.gx - minx) * (cell + gap), gy0 + (r.gy - miny) * (cell + gap)];
    // door connectors (faint) between shown adjacent rooms
    for (const id in rooms) {
      if (!shown(id)) continue;
      const r = rooms[id]; const [cx, cy] = cellXY(r);
      for (const [side, sx, sy] of [['e', 1, 0], ['s', 0, 1]]) {
        if (!r.doors[side]) continue;
        const nid = Dungeon.neighborId(this.dungeon, r, side);
        if (!nid || !shown(nid)) continue;
        ctx.fillStyle = 'rgba(180,160,90,0.35)';
        if (sx) ctx.fillRect(cx + cell, cy + (cell >> 1) - 1, gap, 2);
        else ctx.fillRect(cx + (cell >> 1) - 1, cy + cell, 2, gap);
      }
    }
    for (const id in rooms) {
      if (!shown(id)) continue;
      const r = rooms[id]; const [cx, cy] = cellXY(r);
      const cur = id === this.roomId, vis = this.visited[id];
      ctx.fillStyle = cur ? PAL.goldHi : vis ? PAL.gold : 'rgba(96,106,126,0.5)';
      ctx.fillRect(cx, cy, cell, cell);
      if (cur) { ctx.fillStyle = '#2a1c02'; ctx.fillRect(cx + (cell >> 1) - 1, cy + (cell >> 1) - 1, 3, 3); }
    }
  },

  drawHud(ctx, W, H, hudH) {
    ctx.fillStyle = 'rgba(4,5,10,0.8)';
    ctx.fillRect(0, 0, W, hudH);
    ctx.fillStyle = PAL.uiDark; ctx.fillRect(0, hudH - 1, W, 1);
    // back-to-menu button (a real tappable pill, not a bare glyph)
    const bw = 64, bh = 34, bxo = 8, byo = Math.floor((hudH - bh) / 2);
    this._backBtn = { x: bxo, y: byo, w: bw, h: bh };
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(bxo, byo, bw, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(bxo, byo, bw, 2); ctx.fillRect(bxo, byo + bh - 2, bw, 2);
    ctx.fillRect(bxo, byo, 2, bh); ctx.fillRect(bxo + bw - 2, byo, 2, bh);
    drawText(ctx, '◀', bxo + 11, byo + Math.floor(bh / 2) - 6, 2, PAL.ui, 'left');
    drawText(ctx, 'MENU', bxo + 26, byo + Math.floor(bh / 2) - 3, 1, PAL.uiDim, 'left');
    const title = this.gameMode === 'story' ? this.dungeon.name : this.levelId;
    // center in the free span between the back button and coins/keys
    const spanL = bxo + bw + 10, spanR = W - (this.state.keys > 0 ? 150 : 108);
    drawTextFit(ctx, title, (spanL + spanR) / 2, 10, spanR - spanL - 6, 2, PAL.ui, 'center', '#000');
    if (this.gameMode === 'challenge') {
      const left = this.movesLeft();
      const urgent = left != null && left <= 5;
      drawText(ctx, 'MOVES LEFT ' + left, W / 2, 30, 1, urgent ? PAL.red : PAL.uiDim, 'center');
    } else if (this.gameMode === 'timed') {
      drawText(ctx, fmtMs(this.levelMs + 0) + '  TOTAL ' + fmtMs(this.run.totalMs + this.levelMs), W / 2, 30, 1, PAL.goldHi, 'center');
    } else {
      drawText(ctx, 'STEPS ' + (this.steps||0), W / 2, 30, 1, PAL.uiDim, 'center');
    }
    // during play, preview coins collected this level; after the award
    // (results/runover) the save already includes them
    const awarded = this.mode === 'results' || this.mode === 'runover' || this._awarded;
    const preview = this.gameMode === 'story' ? (this.coinsRun || 0) : this.state.coinsGot;
    coinsBadge(ctx, W - 12, 14, Save.data.coins + (awarded ? 0 : preview), 2);
    if (this.state.keys > 0) {
      Art.keyIcon(ctx, W - 110, 12, 16);
      drawText(ctx, '×' + this.state.keys, W - 96, 16, 2, PAL.goldHi, 'left');
    }
    if (this.gameMode === 'story' && this.lv.hint && this.firstTime && this.mode === 'play' && (this.steps||0) < 8 && Save.data.settings.tips !== false) {
      drawTextFit(ctx, this.lv.hint, W / 2, hudH + 6, W - 16, 1, PAL.gold, 'center', '#000');
    }
  },

  drawDialog(ctx, W, H) {
    const s = Math.max(2, Math.floor(W / 240));
    const pw = Math.min(W - 24, 520);
    const lines = wrapText(this.dialog.text, s, pw - 36);
    const lh = 9 * s + 4;
    const ph = lines.length * lh + 44;
    const px = (W - pw) / 2;
    const py = H - ph - (App.padControls() ? 262 : 50);
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
      const px = (W - pw) / 2, py = H - ph - (App.padControls() ? 262 : 50);
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
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.uiT / 0.15);
    Art.panel(ctx, px, py, pw, ph);
    const titleCol = this.mode === 'runover' ? PAL.red : PAL.goldHi;
    drawTextFit(ctx, ri.title, W / 2, py + 20, pw - 28, s + 1, titleCol, 'center', '#000');
    if (ri.sub) drawTextFit(ctx, ri.sub, W / 2, py + 20 + 9 * (s + 1), pw - 28, Math.max(1, s - 1), PAL.uiDim, 'center');
    let ty = py + 84;
    for (const ln of ri.lines) {
      if (ln) drawTextFit(ctx, ln, W / 2, ty, pw - 32, s, ln.includes('NEW') ? PAL.goldHi : PAL.ui, 'center');
      ty += 11 * s;
    }
    ctx.restore();
    ri.list.draw(ctx, W / 2, py + ph - 122, pw - 60, 44, s, this.uiT);
  },
};

function fmtMs(ms) {
  ms = Math.max(0, Math.round(ms));
  const m = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const t = Math.floor((ms % 1000) / 100);
  return m + ':' + String(sec).padStart(2, '0') + '.' + t;
}
