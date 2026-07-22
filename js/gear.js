'use strict';
// ── GearUI: Ocarina-of-Time-style pause subscreens ────────────
// Two tabs, EQUIPMENT and INVENTORY, drawn as a deep-blue overlay on
// top of the paused level. Equipment is interactive (equip / unequip
// the relics that gate bushes, fire, heavy blocks, darkness). Inventory
// is a quest-status browser (relics collected + consumables + trophy).
// State lives on the game screen: g.gearTab, g.gearSel.

const GearUI = {
  // functional gear, in equip order (each is one OoT-style slot)
  slots: [
    { item: 'sword',   name: "GUARD'S BLADE",   use: 'SLASH THROUGH BUSHES & BRAMBLE.' },
    { item: 'shield',  name: "WARDEN'S SHIELD",  use: 'WALK UNBURNED THROUGH FLAME.' },
    { item: 'glove',   name: 'TITAN GLOVE',      use: 'HEAVE HEAVY IRON BLOCKS.' },
    { item: 'lantern', name: 'PALE LANTERN',     use: 'LIGHT THE LIGHTLESS DEEP.' },
    { item: 'boots',   name: 'STRIDER BOOTS',    use: 'STRIDE ACROSS OPEN CHASMS.' },
  ],

  // ── deep-blue OoT subscreen backdrop ──
  _bg(ctx, W, H, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a1430');
    g.addColorStop(1, '#050a1c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // faint star/grid speckle
    ctx.fillStyle = 'rgba(120,160,240,0.05)';
    for (let y = 0; y < H; y += 22) for (let x = ((y / 22) & 1) * 11; x < W; x += 22) ctx.fillRect(x, y, 2, 2);
    const rg = ctx.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, Math.max(W, H) * 0.7);
    rg.addColorStop(0, 'rgba(10,20,48,0)');
    rg.addColorStop(1, 'rgba(2,4,12,0.8)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  },

  // ── shared cell drawer ──
  _cell(ctx, x, y, sz, o) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x + 3, y + 3, sz, sz);
    ctx.fillStyle = o.selected ? '#1a2748' : '#101a34';
    ctx.fillRect(x, y, sz, sz);
    if (o.equipped) { ctx.fillStyle = 'rgba(230,190,60,0.14)'; ctx.fillRect(x, y, sz, sz); }
    const bc = o.equipped ? PAL.goldHi : (o.selected ? PAL.gold : 'rgba(120,150,210,0.35)');
    ctx.fillStyle = bc;
    ctx.fillRect(x, y, sz, 2); ctx.fillRect(x, y + sz - 2, sz, 2);
    ctx.fillRect(x, y, 2, sz); ctx.fillRect(x + sz - 2, y, 2, sz);
    if (o.selected) { ctx.fillStyle = PAL.goldHi; ctx.fillRect(x, y, 5, sz); }
    const pad = Math.floor(sz * 0.16);
    if (o.owned) {
      const isz = sz - pad * 2;
      if (o.item === 'coin') Art.coinIcon(ctx, x + pad + 2, y + pad + 2, isz - 4);
      else if (o.item === 'key') Art.keyIcon(ctx, x + pad + 2, y + pad + 2, isz - 4);
      else Art.item(ctx, o.item, x + pad, y + pad, isz);
    } else {
      // locked / undiscovered
      ctx.fillStyle = 'rgba(120,150,210,0.18)';
      const q = Math.floor(sz * 0.32), qx = x + sz / 2 - q / 2, qy = y + sz / 2 - q / 2;
      drawText(ctx, '?', x + sz / 2, y + sz / 2 - q / 2, Math.max(2, Math.floor(sz / 14)), 'rgba(150,170,220,0.35)', 'center');
    }
    if (o.equipped) {
      // gold "E" badge
      const b = Math.floor(sz * 0.26);
      ctx.fillStyle = PAL.gold; ctx.fillRect(x + sz - b - 2, y + 2, b, b);
      drawText(ctx, 'E', x + sz - b / 2 - 2, y + 3, Math.max(1, Math.floor(b / 8)), '#0a1430', 'center');
    }
    if (o.count != null) {
      drawText(ctx, '×' + o.count, x + sz - 4, y + sz - 10, 1, PAL.ui, 'right', '#000');
    }
  },

  // ── tabs header ──
  _tabs(ctx, W, active) {
    const tabs = [['EQUIPMENT', 'equipment'], ['INVENTORY', 'inventory']];
    const s = Math.max(2, Math.floor(W / 240));
    this._tabRects = [];
    const tw = Math.min(170, W / 2 - 10);
    let x = W / 2 - tw;
    for (const [label, id] of tabs) {
      const on = id === active;
      this._tabRects.push({ x, y: 14, w: tw, h: 34, id });
      ctx.fillStyle = on ? 'rgba(230,190,60,0.12)' : 'rgba(255,255,255,0.03)';
      ctx.fillRect(x + 4, 14, tw - 8, 34);
      drawTextFit(ctx, label, x + tw / 2, 22, tw - 16, s, on ? PAL.goldHi : PAL.uiDim, 'center', '#000');
      if (on) { ctx.fillStyle = PAL.gold; ctx.fillRect(x + 12, 46, tw - 24, 3); }
      x += tw;
    }
  },

  // ── main draw ──
  draw(g, ctx, W, H) {
    this._bg(ctx, W, H, g.t);
    this._tabs(ctx, W, g.gearTab);
    if (g.gearTab === 'equipment') this._drawEquip(g, ctx, W, H);
    else this._drawInv(g, ctx, W, H);
    // footer hint
    drawText(ctx, g.gearTab === 'equipment' ? 'TAP GEAR TO EQUIP  ·  TAP OUTSIDE TO CLOSE' : 'TAP OUTSIDE TO CLOSE',
      W / 2, H - (App.isTouch ? 262 : 30), 1, PAL.uiDim, 'center');
  },

  _drawEquip(g, ctx, W, H) {
    const s = Math.max(2, Math.floor(W / 240));
    const top = 64;
    // hero preview pedestal
    const boxW = Math.min(W - 48, 300), boxX = (W - boxW) / 2, boxY = top + 6, boxH = 132;
    Art.panel(ctx, boxX, boxY, boxW, boxH);
    const T = 84;
    Art.hero(ctx, 'down', 0, W / 2 - T / 2, boxY + 20, T, false);
    // equipped summary under hero
    const eq = this.slots.filter(sl => Save.isEquipped(sl.item));
    drawText(ctx, 'WORN', W / 2, boxY + boxH - 30, 1, PAL.uiDim, 'center');
    if (eq.length) {
      let ex = W / 2 - eq.length * 15;
      for (const sl of eq) { Art.item(ctx, sl.item, ex, boxY + boxH - 24, 22); ex += 30; }
    } else {
      drawText(ctx, 'NOTHING EQUIPPED', W / 2, boxY + boxH - 18, 1, PAL.uiDark, 'center');
    }

    // 4 gear slots in a row
    const n = this.slots.length;
    const gap = 10, sz = Math.min(72, Math.floor((W - 32 - gap * (n - 1)) / n));
    const rowW = n * sz + (n - 1) * gap, gx = (W - rowW) / 2, gy = boxY + boxH + 22;
    this._slotRects = [];
    for (let i = 0; i < n; i++) {
      const sl = this.slots[i], x = gx + i * (sz + gap);
      this._slotRects.push({ x, y: gy, w: sz, h: sz, i });
      this._cell(ctx, x, gy, sz, {
        item: sl.item, owned: Save.hasItem(sl.item),
        equipped: Save.isEquipped(sl.item), selected: g.gearSel === i,
      });
    }

    // description panel
    const sel = this.slots[g.gearSel] || this.slots[0];
    const owned = Save.hasItem(sel.item), equipped = Save.isEquipped(sel.item);
    const pw = Math.min(W - 32, 420), px = (W - pw) / 2, py = gy + sz + 20, ph = 92;
    Art.panel(ctx, px, py, pw, ph);
    drawTextFit(ctx, owned ? sel.name : '???', W / 2, py + 14, pw - 28, s, owned ? PAL.goldHi : PAL.uiDim, 'center', '#000');
    drawTextFit(ctx, owned ? sel.use : 'NOT YET FOUND IN THE KEEP.', W / 2, py + 14 + 10 * s, pw - 28, 1, PAL.ui, 'center');
    let status, col;
    if (!owned) { status = 'UNDISCOVERED'; col = PAL.uiDim; }
    else if (equipped) { status = 'EQUIPPED · TAP TO REMOVE'; col = PAL.goldHi; }
    else { status = 'TAP TO EQUIP'; col = PAL.ui; }
    drawTextFit(ctx, status, W / 2, py + ph - 20, pw - 24, s, col, 'center', '#000');
  },

  _invCells(g) {
    const cells = [];
    // relics (quest items)
    for (const it of ['sword', 'shield', 'glove', 'lantern', 'boots', 'sunstone']) {
      cells.push({
        item: it, owned: Save.hasItem(it),
        name: ITEMS[it] ? ITEMS[it].name : it, desc: ITEMS[it] ? ITEMS[it].desc : '',
      });
    }
    // consumables / counts
    cells.push({ item: 'map', owned: true, count: Save.data.shop.hints,
      name: 'HINT SCROLLS', desc: 'REVEALS THE NEXT FEW MOVES.' });
    cells.push({ item: 'coin', owned: true, count: Save.devOn() ? '∞' : Save.data.coins,
      name: 'COINS', desc: 'SPEND THESE IN THE SHOP.' });
    if (g.gameMode === 'story' && g.state && g.state.keys > 0) {
      cells.push({ item: 'key', owned: true, count: g.state.keys,
        name: 'KEYS', desc: 'OPENS ONE LOCKED DOOR EACH.' });
    }
    return cells;
  },

  _drawInv(g, ctx, W, H) {
    const s = Math.max(2, Math.floor(W / 240));
    const cells = this._invCells(g);
    const cols = 4;
    const gap = 10, top = 74;
    const sz = Math.min(76, Math.floor((W - 32 - gap * (cols - 1)) / cols));
    const rowW = cols * sz + (cols - 1) * gap, gx = (W - rowW) / 2;
    this._invRects = [];
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i], r = Math.floor(i / cols), col = i % cols;
      const x = gx + col * (sz + gap), y = top + r * (sz + gap);
      this._invRects.push({ x, y, w: sz, h: sz, i });
      this._cell(ctx, x, y, sz, {
        item: c.item, owned: c.owned, equipped: false, selected: g.gearSel === i,
        count: c.count,
      });
    }
    const rows = Math.ceil(cells.length / cols);
    const sel = cells[Math.min(g.gearSel, cells.length - 1)] || cells[0];
    const pw = Math.min(W - 32, 420), px = (W - pw) / 2;
    const py = top + rows * (sz + gap) + 16, ph = 84;
    Art.panel(ctx, px, py, pw, ph);
    const show = sel.owned;
    drawTextFit(ctx, show ? sel.name : '???', W / 2, py + 14, pw - 28, s, show ? PAL.goldHi : PAL.uiDim, 'center', '#000');
    drawTextFit(ctx, show ? sel.desc : 'NOT YET FOUND.', W / 2, py + 14 + 10 * s, pw - 28, 1, PAL.ui, 'center');
    if (sel.count != null && show) drawText(ctx, 'HELD: ' + sel.count, W / 2, py + ph - 18, s, PAL.ui, 'center');
  },

  _count(g) {
    return g.gearTab === 'equipment' ? this.slots.length : this._invCells(g).length;
  },

  // ── input ──
  onDir(g, dc, dr) {
    const cols = g.gearTab === 'inventory' ? 4 : this.slots.length;
    const n = this._count(g);
    if (g.gearTab === 'equipment') {
      // single row
      const ns = g.gearSel + dc;
      if (ns >= 0 && ns < n) { g.gearSel = ns; Snd.blip(); }
    } else {
      let ns = g.gearSel + dc + dr * cols;
      if (ns >= 0 && ns < n) { g.gearSel = ns; Snd.blip(); }
    }
  },
  onConfirm(g) {
    if (g.gearTab !== 'equipment') { Snd.blip(); return; }
    const sl = this.slots[g.gearSel];
    if (!sl || !Save.hasItem(sl.item)) { Snd.error(); return; }
    const nowOn = Save.toggleEquip(sl.item);
    if (nowOn) { Snd.itemGet(); Platform.haptic(); }
    else Snd.back();
  },
  setTab(g, tab) {
    if (g.gearTab === tab) return;
    g.gearTab = tab; g.gearSel = 0; Snd.select();
  },
  onTap(g, x, y) {
    // tabs
    for (const t of this._tabRects || []) {
      if (x >= t.x && x <= t.x + t.w && y >= t.y - 4 && y <= t.y + t.h) { this.setTab(g, t.id); return true; }
    }
    if (g.gearTab === 'equipment') {
      for (const r of this._slotRects || []) {
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
          g.gearSel = r.i; this.onConfirm(g); return true;
        }
      }
    } else {
      for (const r of this._invRects || []) {
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { g.gearSel = r.i; Snd.blip(); return true; }
      }
    }
    return false; // tap outside -> caller closes
  },
};
