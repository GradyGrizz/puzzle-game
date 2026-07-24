'use strict';
// ── Art: ALTTP-style procedural pixel tiles + hero sprite sheet ──
// Palette and tile drawers preserved from the established prototype.

const PAL = {
  bg:   '#08090e',
  fl:   '#1c2232', flG: '#121828', flD: '#22283e',
  wBg:  '#070810', wFace:'#162030', wHi:'#263444',
  wSh:  '#04050a', wMid:'#1a2838',
  dFrm: '#40301c', dPass:'#040508',
  swPl: '#b83818', swBtn:'#d84820', swAPl:'#d85f20', swABtn:'#f07030',
  blF:  '#1a2440', blH:'#263450',  blSh:'#0c1020',
  gold: '#d2a028', goldHi:'#f0c040', goldLo:'#8a6818',
  ui:   '#c8d0e0', uiDim:'#5a647a', uiDark:'#2a3248',
  green:'#3f7a3a', greenHi:'#579b4c', greenLo:'#2a5228',
  red:  '#c03828',
};

const PAL_BASE = Object.assign({}, PAL);

// ── shop catalogs ─────────────────────────────────────────────
const SKINS = {
  skin_default: { name: 'TRAVELER GREEN',   price: 0,   tint: null },
  skin_crimson: { name: 'CRIMSON WANDERER', price: 150, tint: [205, 62, 48] },
  skin_azure:   { name: 'AZURE KNIGHT',     price: 150, tint: [70, 118, 225] },
  skin_shadow:  { name: 'SHADOW DELVER',    price: 250, tint: [122, 112, 150] },
  skin_gilded:  { name: 'GILDED HERO',      price: 400, tint: [232, 184, 60] },
};

const THEMES = {
  theme_default: { name: 'SUNKEN BLUE', price: 0, pal: {} },
  theme_ember: {
    name: 'EMBER HALLS', price: 200,
    pal: {
      fl: '#241a16', flG: '#181008', flD: '#2e2119',
      wBg: '#0e0806', wFace: '#38241a', wHi: '#543826', wMid: '#422c1e', wSh: '#060302',
      blF: '#432a20', blH: '#5a3a2c', blSh: '#20120c',
    },
  },
  theme_moss: {
    name: 'VERDANT CRYPT', price: 200,
    pal: {
      fl: '#1a2a20', flG: '#101c14', flD: '#223428',
      wBg: '#080f0a', wFace: '#1c3024', wHi: '#2e4a36', wMid: '#24382a', wSh: '#030704',
      blF: '#1f3a34', blH: '#2c4c44', blSh: '#0e1c18',
    },
  },
  theme_royal: {
    name: 'AMETHYST VAULT', price: 200,
    pal: {
      fl: '#241d33', flG: '#171126', flD: '#2c2440',
      wBg: '#0c081a', wFace: '#2a2040', wHi: '#3e3258', wMid: '#322848', wSh: '#050310',
      blF: '#332a52', blH: '#443a66', blSh: '#171030',
    },
  },
};

const Art = {

// swap the dungeon palette in place; all tile drawers read PAL live
setTheme(id) {
  const th = THEMES[id] || THEMES.theme_default;
  Object.assign(PAL, PAL_BASE, th.pal);
},

// deterministic per-tile hash -> [0,1), so texture is stable frame to frame
_h(seed, i) { let z = (((seed >>> 0) + i * 374761393) >>> 0); z = ((z ^ (z >>> 13)) * 1274126177) >>> 0; return (z >>> 8) / 16777216; },

// ── base tiles ────────────────────────────────────────────────
// textured flagstone floor: seams + a few scattered pebbles / hairline
// cracks (seeded by tile so it doesn't shimmer). `seed` optional.
floor(ctx, x, y, t, seed) {
  const im = this.img['floor' + (Math.abs(Math.floor(x) * 131 + Math.floor(y) * 57) % 3)];
  if (this._ready(im)) { ctx.drawImage(im, x, y, t, t); return; }
  ctx.fillStyle = PAL.fl; ctx.fillRect(x, y, t, t);
  // bevelled flagstone: light top-left seam, dark bottom-right
  ctx.fillStyle = PAL.flG; ctx.fillRect(x, y, t, 1); ctx.fillRect(x, y, 1, t);
  ctx.fillStyle = PAL.flD; ctx.fillRect(x, y + t - 1, t, 1); ctx.fillRect(x + t - 1, y, 1, t);
  const s = (seed == null ? ((x * 131) ^ (y * 57)) : seed) >>> 0;
  const n = this._h(s, 1);
  if (n > 0.5) {
    const px = x + 4 + Math.floor(this._h(s, 2) * (t - 10));
    const py = y + 4 + Math.floor(this._h(s, 3) * (t - 10));
    ctx.fillStyle = PAL.flD; ctx.fillRect(px, py, 3, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(px, py, 2, 1);
    if (n > 0.82) {
      const qx = x + 4 + Math.floor(this._h(s, 4) * (t - 10));
      const qy = y + 4 + Math.floor(this._h(s, 5) * (t - 10));
      ctx.fillStyle = PAL.flD; ctx.fillRect(qx, qy, 2, 2);
    }
  } else if (n < 0.13) {
    const cx = x + 4 + Math.floor(this._h(s, 6) * (t - 9));
    ctx.fillStyle = PAL.flG;
    ctx.fillRect(cx, y + 3, 1, Math.floor(t * 0.42));
    ctx.fillRect(cx + 1, y + 3 + Math.floor(t * 0.3), 1, Math.floor(t * 0.3));
  }
},

// chiselled stone wall: running-bond bricks, each bevelled (lit top-left,
// shadowed bottom-right) for a 2.5D carved look, plus a bottom cast shadow
// that lifts the wall off the floor.
wall(ctx, x, y, t) {
  if (this._ready(this.img.wall)) { ctx.drawImage(this.img.wall, x, y, t, t); return; }
  ctx.fillStyle = PAL.wSh; ctx.fillRect(x, y, t, t);        // mortar base
  const half = Math.floor(t / 2), g = 1;
  const seedRow = (yy) => ((x * 0) ^ (yy * 2654435761)) >>> 0; // seam continues across tiles
  const courses = [
    { by: y + g, bh: half - g, off: 0 },
    { by: y + half + g, bh: t - half - g, off: half },
  ];
  let bi = 0;
  for (const co of courses) {
    let bx = x - (co.off ? half : 0);
    while (bx < x + t) {
      const rx = Math.max(x, bx + g);
      const rw = Math.min(x + t, bx + half) - rx;
      if (rw > 1) {
        ctx.fillStyle = PAL.wFace; ctx.fillRect(rx, co.by, rw, co.bh);
        const v = this._h(seedRow(co.by), Math.floor((bx + 999) / half));
        if (v > 0.62) { ctx.fillStyle = 'rgba(255,255,255,' + ((v - 0.62) * 0.16).toFixed(3) + ')'; ctx.fillRect(rx, co.by, rw, co.bh); }
        else if (v < 0.42) { ctx.fillStyle = 'rgba(0,0,0,' + ((0.42 - v) * 0.34).toFixed(3) + ')'; ctx.fillRect(rx, co.by, rw, co.bh); }
        // bevel: light top+left, dark bottom+right
        ctx.fillStyle = PAL.wHi; ctx.fillRect(rx, co.by, rw, 1); ctx.fillRect(rx, co.by, 1, co.bh);
        ctx.fillStyle = PAL.wBg; ctx.fillRect(rx, co.by + co.bh - 1, rw, 1); ctx.fillRect(rx + rw - 1, co.by, 1, co.bh);
        // rare moss / crack
        if (v > 0.9) { ctx.fillStyle = 'rgba(74,112,58,0.45)'; ctx.fillRect(rx + 1, co.by + co.bh - 2, Math.max(2, rw - 3), 2); }
      }
      bx += half; bi++;
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(x, y + t - 1, t, 1);   // cast shadow
},

// wall-mounted torch (drawn over a wall tile); animated flame + warm glow
torch(ctx, x, y, t, time) {
  const cx = x + Math.floor(t / 2), by = y + Math.floor(t * 0.6);
  const tt = (time || 0) * 10;
  // warm glow pool first (under the flame)
  ctx.save();
  ctx.fillStyle = `rgba(240,150,50,${0.12 + 0.04 * Math.sin(tt * 1.3)})`;
  ctx.beginPath(); ctx.arc(cx, by - t * 0.18, t * 0.85, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // iron sconce
  ctx.fillStyle = '#26201a'; ctx.fillRect(cx - 3, by, 6, Math.floor(t * 0.28));
  ctx.fillStyle = '#3c2e1e'; ctx.fillRect(cx - 2, by, 4, Math.floor(t * 0.28));
  ctx.fillStyle = '#5a4326'; ctx.fillRect(cx - 4, by - 2, 8, 2);
  // flame
  const fh = Math.floor(t * (0.32 + 0.07 * Math.sin(tt)));
  const fw = Math.max(3, Math.floor(t * 0.13));
  ctx.fillStyle = '#d8641c'; ctx.fillRect(cx - fw, by - fh, fw * 2, fh);
  ctx.fillStyle = '#f0a828'; ctx.fillRect(cx - fw + 1, by - Math.floor(fh * 0.72), fw * 2 - 2, Math.floor(fh * 0.72));
  ctx.fillStyle = '#ffe89a'; ctx.fillRect(cx - 1, by - Math.floor(fh * 0.46), Math.max(2, fw - 2), Math.floor(fh * 0.46));
},

// A flat, recessed floor-plate rather than a tall raised block, so the
// hero (drawn on top) clearly stands ON it instead of merging into it.
switchTile(ctx, x, y, t, on) {
  this.floor(ctx, x, y, t);
  if (this._ready(this.img.switch)) {
    this._blit(ctx, this.img.switch, x + t / 2, y + t / 2, t * 0.84, t * 0.84);
    if (on) { ctx.fillStyle = 'rgba(255,200,80,0.30)'; ctx.fillRect(x, y, t, t); }
    return;
  }
  const s = Math.floor(t * .5), ox = x + Math.floor((t - s) / 2), oy = y + Math.floor((t - s) / 2);
  // dark recessed socket the plate sits inside
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(ox - 2, oy - 2, s + 4, s + 4);
  // red plate (pressed = brighter, flush)
  ctx.fillStyle = on ? PAL.swAPl : PAL.swPl; ctx.fillRect(ox, oy, s, s);
  const is = Math.floor(s * .58), iox = ox + Math.floor((s - is) / 2), ioy = oy + Math.floor((s - is) / 2);
  ctx.fillStyle = on ? PAL.swABtn : PAL.swBtn; ctx.fillRect(iox, ioy, is, is);
  // subtle bevel so it reads as an inset button
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(ox, oy, s, 1); ctx.fillRect(ox, oy, 1, s);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(ox, oy + s - 1, s, 1); ctx.fillRect(ox + s - 1, oy, 1, s);
  if (on) { ctx.fillStyle = 'rgba(255,200,80,0.25)'; ctx.fillRect(ox, oy, s, s); }
},

// carved push-stone: raised cube with a lit top face, chiselled rune,
// left light edge + right/bottom shadow, and a cast shadow for depth
block(ctx, x, y, t, glow) {
  this.floor(ctx, x, y, t, ((x * 3) ^ (y * 5)));
  if (this._ready(this.img.block)) {
    this._blit(ctx, this.img.block, x + t / 2, y + t / 2, t * 0.94, t * 0.94);
    if (glow) { ctx.fillStyle = 'rgba(210,80,20,0.28)'; ctx.fillRect(x, y, t, t); }
    return;
  }
  const p = Math.floor(t * .08), bs = t - p * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + p + 3, y + p + 4, bs, bs); // cast shadow
  ctx.fillStyle = PAL.blF; ctx.fillRect(x + p, y + p, bs, bs);                    // body
  // lit top face band + crisp highlight (light from above)
  ctx.fillStyle = PAL.blH; ctx.fillRect(x + p, y + p, bs, Math.max(3, Math.floor(bs * .2)));
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + p, y + p, bs, 2);
  ctx.fillStyle = PAL.blH; ctx.fillRect(x + p, y + p, 3, bs);                      // left light edge
  // deep right + bottom shadow
  ctx.fillStyle = PAL.blSh; ctx.fillRect(x + p + bs - 3, y + p, 3, bs); ctx.fillRect(x + p, y + p + bs - 3, bs, 3);
  // chiselled rune cross
  const m = Math.floor(t / 2);
  ctx.fillStyle = PAL.blSh;
  ctx.fillRect(x + m - 1, y + p + 5, 2, bs - 10); ctx.fillRect(x + p + 5, y + m - 1, bs - 10, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(x + m, y + p + 6, 1, bs - 12); ctx.fillRect(x + p + 6, y + m, bs - 12, 1);
  if (glow) { ctx.fillStyle = 'rgba(210,80,20,0.28)'; ctx.fillRect(x + p, y + p + bs - 5, bs, 5); }
},

// block drawn floating over pit (falling anim uses scale)
blockRaw(ctx, x, y, t, scale) {
  const sc = scale == null ? 1 : scale;
  if (this._ready(this.img.block)) { this._blit(ctx, this.img.block, x + t / 2, y + t / 2, t * 0.94 * sc, t * 0.94 * sc); return; }
  const p = Math.floor(t * .1), bs0 = t - p * 2;
  const bs = Math.max(2, Math.floor(bs0 * (scale == null ? 1 : scale)));
  const off = Math.floor((bs0 - bs) / 2);
  const bx = x + p + off, by = y + p + off;
  ctx.fillStyle = PAL.blF; ctx.fillRect(bx, by, bs, bs);
  ctx.fillStyle = PAL.blH;
  ctx.fillRect(bx, by, bs, Math.max(1, Math.floor(bs * .12)));
  ctx.fillRect(bx, by, Math.max(1, Math.floor(bs * .12)), bs);
  ctx.fillStyle = PAL.blSh;
  ctx.fillRect(bx + bs - 2, by, 2, bs); ctx.fillRect(bx, by + bs - 2, bs, 2);
},

// ── new tiles, same language ─────────────────────────────────
exitTile(ctx, x, y, t, open, anim) {
  // stairs descending into darkness
  this.floor(ctx, x, y, t);
  ctx.fillStyle = PAL.dPass; ctx.fillRect(x + 2, y + 2, t - 4, t - 4);
  const steps = 4;
  for (let i = 0; i < steps; i++) {
    const sh = Math.floor((t - 8) / steps);
    const inset = 3 + i * 2;
    const shade = 0.5 - i * 0.13;
    ctx.fillStyle = `rgba(70,90,120,${Math.max(0.06, shade)})`;
    ctx.fillRect(x + inset, y + 3 + i * sh, t - inset * 2, sh - 1);
  }
  if (!open) {
    // iron grate over the stairs
    ctx.fillStyle = '#2c3648';
    ctx.fillRect(x + 1, y + 1, t - 2, 3);
    for (let i = 0; i < 4; i++) {
      const bx = x + 3 + i * Math.floor((t - 7) / 3);
      ctx.fillRect(bx, y + 2, 3, t - 4);
    }
    ctx.fillStyle = '#404e66';
    for (let i = 0; i < 4; i++) {
      const bx = x + 3 + i * Math.floor((t - 7) / 3);
      ctx.fillRect(bx, y + 2, 1, t - 4);
    }
    ctx.fillStyle = '#2c3648';
    ctx.fillRect(x + 1, y + t - 4, t - 2, 3);
  } else if (anim) {
    // soft golden glow when newly opened
    ctx.fillStyle = `rgba(240,180,60,${0.25 * anim})`;
    ctx.fillRect(x + 2, y + 2, t - 4, t - 4);
  }
},

crack(ctx, x, y, t) {
  this.floor(ctx, x, y, t);
  ctx.fillStyle = 'rgba(6,8,14,0.85)';
  const m = Math.floor(t / 2);
  // jagged crack lines
  ctx.fillRect(x + m - 1, y + 3, 2, 4);
  ctx.fillRect(x + m + 1, y + 6, 2, 4);
  ctx.fillRect(x + m - 3, y + 9, 2, 5);
  ctx.fillRect(x + m, y + 13, 2, Math.max(2, t - 16));
  ctx.fillRect(x + 4, y + m, 5, 2);
  ctx.fillRect(x + 8, y + m + 2, 4, 2);
  ctx.fillRect(x + t - 9, y + m - 2, 5, 2);
  ctx.fillRect(x + t - 6, y + m - 4, 3, 2);
},

pit(ctx, x, y, t) {
  ctx.fillStyle = PAL.wSh; ctx.fillRect(x, y, t, t);
  ctx.fillStyle = '#000208'; ctx.fillRect(x + 2, y + 2, t - 4, t - 4);
  // rim highlight top-left
  ctx.fillStyle = 'rgba(60,76,100,0.5)';
  ctx.fillRect(x + 1, y + 1, t - 2, 2);
  ctx.fillRect(x + 1, y + 1, 2, t - 2);
  ctx.fillStyle = 'rgba(30,40,58,0.6)';
  ctx.fillRect(x + 2, y + t - 3, t - 3, 2);
  ctx.fillRect(x + t - 3, y + 2, 2, t - 3);
},

doorLocked(ctx, x, y, t) {
  this.floor(ctx, x, y, t);
  ctx.fillStyle = PAL.dFrm; ctx.fillRect(x, y, 3, t); ctx.fillRect(x + t - 3, y, 3, t);
  ctx.fillRect(x + 3, y, t - 6, 3);
  ctx.fillStyle = '#1e1008'; ctx.fillRect(x + 3, y + 3, t - 6, t - 3);
  const lx = x + Math.floor(t / 2), ly = y + Math.floor(t * .32);
  ctx.fillStyle = '#7a5828';
  ctx.fillRect(lx - 2, ly, 5, 4); ctx.fillRect(lx - 3, ly + 3, 7, 5);
  ctx.fillStyle = '#4a3010'; ctx.fillRect(lx - 1, ly + 5, 3, 2);
},

// room-edge doorway punched through the border wall. type: open|shutter|lock
doorway(ctx, x, y, t, side, type, open) {
  this.wall(ctx, x, y, t);
  const horiz = (side === 'n' || side === 's');
  const m = Math.floor(t * 0.24);
  let ox, oy, ow, oh;
  if (horiz) { ox = x + m; oy = y; ow = t - m * 2; oh = t; }
  else { ox = x; oy = y + m; ow = t; oh = t - m * 2; }
  // carved stone frame around the passage
  ctx.fillStyle = PAL.dFrm;
  ctx.fillRect(ox - 2, oy - 2, ow + 4, oh + 4);
  // passage interior (dark void of the next room)
  ctx.fillStyle = open ? PAL.dPass : '#0a0d16';
  ctx.fillRect(ox, oy, ow, oh);
  if (open) {
    // faint cool light spilling from the room beyond
    ctx.fillStyle = 'rgba(90,110,150,0.16)';
    ctx.fillRect(ox + 1, oy + 1, ow - 2, oh - 2);
  } else if (type === 'shutter') {
    // barred iron portcullis
    ctx.fillStyle = '#3a4658';
    if (horiz) { for (let i = 0; i < 4; i++) { const bx = ox + 2 + i * Math.floor((ow - 4) / 3.2); ctx.fillRect(bx, oy + 1, 3, oh - 2); } }
    else { for (let i = 0; i < 4; i++) { const by = oy + 2 + i * Math.floor((oh - 4) / 3.2); ctx.fillRect(ox + 1, by, ow - 2, 3); } }
    ctx.fillStyle = '#556278';
    if (horiz) ctx.fillRect(ox, oy + 1, ow, 2); else ctx.fillRect(ox + 1, oy, 2, oh);
  } else if (type === 'lock') {
    // heavy locked slab with a gold keyhole
    ctx.fillStyle = '#3a2410'; ctx.fillRect(ox, oy, ow, oh);
    ctx.fillStyle = '#50361a'; ctx.fillRect(ox + 2, oy + 2, ow - 4, oh - 4);
    const kx = ox + Math.floor(ow / 2), ky = oy + Math.floor(oh / 2);
    ctx.fillStyle = PAL.goldHi;
    ctx.fillRect(kx - 2, ky - 3, 4, 4); ctx.fillRect(kx - 1, ky, 2, 4);
  }
},

fire(ctx, x, y, t, time) {
  this.floor(ctx, x, y, t);
  // charred base
  ctx.fillStyle = '#0c0806';
  const p = Math.floor(t * .18);
  ctx.fillRect(x + p, y + t - p - 4, t - p * 2, 5);
  // three flame tongues, flickering
  const cx = x + Math.floor(t / 2);
  const base = y + t - p - 2;
  const tt = (time || 0) * 9;
  for (let i = -1; i <= 1; i++) {
    const fx = cx + i * Math.floor(t * 0.2);
    const hh = Math.floor(t * (0.34 + 0.1 * Math.sin(tt + i * 2.1)) * (i === 0 ? 1.35 : 1));
    const wsz = Math.max(3, Math.floor(t * 0.14));
    ctx.fillStyle = PAL.swBtn;
    ctx.fillRect(fx - wsz, base - hh, wsz * 2, hh);
    ctx.fillStyle = PAL.swABtn;
    ctx.fillRect(fx - wsz + 1, base - Math.floor(hh * 0.7), wsz * 2 - 2, Math.floor(hh * 0.7));
    ctx.fillStyle = '#f0b428';
    ctx.fillRect(fx - 1, base - Math.floor(hh * 0.42), Math.max(2, wsz - 1), Math.floor(hh * 0.42));
  }
  // ember glow on surrounding floor
  ctx.fillStyle = `rgba(220,90,30,${0.10 + 0.05 * Math.sin(tt * 1.7)})`;
  ctx.fillRect(x + 1, y + 1, t - 2, t - 2);
},

bush(ctx, x, y, t) {
  this.floor(ctx, x, y, t);
  const p = Math.floor(t * .12), s = t - p * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(x + p + 2, y + p + 3, s, s - 1);
  ctx.fillStyle = PAL.greenLo;
  ctx.fillRect(x + p + 2, y + p, s - 4, s);
  ctx.fillRect(x + p, y + p + 2, s, s - 4);
  ctx.fillStyle = PAL.green;
  ctx.fillRect(x + p + 3, y + p + 1, s - 6, s - 3);
  ctx.fillRect(x + p + 1, y + p + 3, s - 2, s - 7);
  ctx.fillStyle = PAL.greenHi;
  ctx.fillRect(x + p + 4, y + p + 2, 3, 2);
  ctx.fillRect(x + p + s - 9, y + p + 4, 3, 2);
  ctx.fillRect(x + p + 3, y + p + 8, 2, 3);
  ctx.fillStyle = PAL.greenLo;
  ctx.fillRect(x + p + Math.floor(s / 2) - 1, y + p + s - 4, 2, 3);
},

// ── entities ─────────────────────────────────────────────────
chest(ctx, x, y, t, openPhase) {
  // openPhase: 0 closed, 0..1 opening, 1 open
  this.floor(ctx, x, y, t);
  const p = Math.floor(t * .12), w = t - p * 2, h = Math.floor(w * .82);
  const cy = y + t - p - h;
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x + p + 2, cy + 3, w, h);
  // body
  ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x + p, cy + Math.floor(h * .35), w, Math.floor(h * .65));
  ctx.fillStyle = '#6e4a22'; ctx.fillRect(x + p + 2, cy + Math.floor(h * .35), w - 4, Math.floor(h * .5));
  // lid — rotates back as it opens
  const lidH = Math.floor(h * .42);
  const lift = Math.floor(lidH * (openPhase || 0));
  ctx.fillStyle = openPhase >= 1 ? '#3c2410' : '#7a5228';
  ctx.fillRect(x + p, cy - lift, w, lidH);
  ctx.fillStyle = openPhase >= 1 ? '#2a1808' : '#8f6432';
  ctx.fillRect(x + p + 2, cy - lift + 2, w - 4, lidH - 4);
  if (openPhase > 0 && openPhase < 1) {
    ctx.fillStyle = `rgba(240,200,80,${openPhase * 0.8})`;
    ctx.fillRect(x + p + 2, cy + lidH - lift, w - 4, 3);
  }
  if (openPhase >= 1) {
    // glowing interior
    ctx.fillStyle = 'rgba(240,200,80,0.55)';
    ctx.fillRect(x + p + 3, cy + 3, w - 6, Math.floor(h * .3));
  }
  // gold banding + clasp
  ctx.fillStyle = PAL.gold;
  ctx.fillRect(x + p, cy + Math.floor(h * .35) - 1 - lift * 0, w, 2);
  const cx0 = x + Math.floor(t / 2);
  if (!openPhase) {
    ctx.fillRect(cx0 - 2, cy + Math.floor(h * .3), 4, 6);
    ctx.fillStyle = PAL.goldLo; ctx.fillRect(cx0 - 1, cy + Math.floor(h * .3) + 2, 2, 2);
  }
},

key(ctx, x, y, t, bob) {
  const b = bob ? Math.round(Math.sin(bob) * t * 0.04) : 0;
  const s = Math.max(2, Math.floor(t / 16));
  const cx = x + Math.floor(t / 2), cy = y + Math.floor(t / 2) + b;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(cx - s * 2, y + t - 4, s * 4, 2);
  ctx.fillStyle = PAL.gold;
  // bow (ring)
  ctx.fillRect(cx - s * 3, cy - s * 3, s * 3, s);
  ctx.fillRect(cx - s * 3, cy - s * 2, s, s * 2);
  ctx.fillRect(cx - s, cy - s * 2, s, s * 2);
  ctx.fillRect(cx - s * 3, cy, s * 3, s);
  // shaft + teeth
  ctx.fillRect(cx - s, cy, s, s * 3);
  ctx.fillRect(cx, cy + s * 2, s * 2, s);
  ctx.fillStyle = PAL.goldHi;
  ctx.fillRect(cx - s * 3, cy - s * 3, s * 3, Math.max(1, Math.floor(s / 2)));
},

coin(ctx, x, y, t, bob) {
  const b = bob ? Math.round(Math.sin(bob) * t * 0.05) : 0;
  const cx = x + Math.floor(t / 2), cy = y + Math.floor(t / 2) + b;
  const r = Math.floor(t * .18);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(cx - r, y + t - 4, r * 2, 2);
  if (this._ready(this.img.coin)) { this._blit(ctx, this.img.coin, cx, cy, t * 0.46, t * 0.46); return; }
  ctx.fillStyle = PAL.goldLo;
  ctx.fillRect(cx - r, cy - r + 1, r * 2, r * 2 - 2);
  ctx.fillRect(cx - r + 1, cy - r, r * 2 - 2, r * 2);
  ctx.fillStyle = PAL.gold;
  ctx.fillRect(cx - r + 1, cy - r + 1, r * 2 - 3, r * 2 - 3);
  ctx.fillStyle = PAL.goldHi;
  ctx.fillRect(cx - r + 2, cy - r + 1, 2, 2);
  ctx.fillStyle = PAL.goldLo;
  ctx.fillRect(cx - 1, cy - r + 2, 1, r * 2 - 4);
},

// small coin icon for HUD
coinIcon(ctx, x, y, s) {
  ctx.fillStyle = PAL.goldLo;
  ctx.fillRect(x, y + 1, s, s - 2);
  ctx.fillRect(x + 1, y, s - 2, s);
  ctx.fillStyle = PAL.gold;
  ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  ctx.fillStyle = PAL.goldHi;
  ctx.fillRect(x + 2, y + 1, 2, 2);
},

keyIcon(ctx, x, y, s) {
  const u = Math.max(1, Math.floor(s / 8));
  ctx.fillStyle = PAL.gold;
  ctx.fillRect(x, y, u * 3, u);
  ctx.fillRect(x, y + u, u, u * 2);
  ctx.fillRect(x + u * 2, y + u, u, u * 2);
  ctx.fillRect(x, y + u * 3, u * 3, u);
  ctx.fillRect(x + u, y + u * 3, u, u * 4);
  ctx.fillRect(x + u * 2, y + u * 5, u * 2, u);
  ctx.fillRect(x + u * 2, y + u * 7, u * 2, u);
},

// ── inventory / chest items ──────────────────────────────────
item(ctx, type, x, y, s) {
  const relic = this.img['relic_' + type];
  if (this._ready(relic)) { this._blit(ctx, relic, x + s / 2, y + s / 2, s, s); return; }
  const u = Math.max(1, Math.floor(s / 16));
  const cx = x + Math.floor(s / 2);
  if (type === 'sword') {
    ctx.fillStyle = '#b8c8dc';                       // blade
    ctx.fillRect(cx - u, y + u, u * 2, u * 9);
    ctx.fillStyle = '#e8f0f8';
    ctx.fillRect(cx - u, y + u, u, u * 9);
    ctx.fillStyle = '#b8c8dc';
    ctx.fillRect(cx - u, y, u * 2, u);               // tip
    ctx.fillStyle = PAL.gold;                        // crossguard
    ctx.fillRect(cx - u * 3, y + u * 10, u * 6, u * 2);
    ctx.fillStyle = '#5a3a1a';                       // grip
    ctx.fillRect(cx - u, y + u * 12, u * 2, u * 3);
    ctx.fillStyle = PAL.goldHi;                      // pommel
    ctx.fillRect(cx - u, y + u * 15, u * 2, u);
  } else if (type === 'shield') {
    ctx.fillStyle = '#284a78';
    ctx.fillRect(x + u * 3, y + u, u * 10, u * 9);
    ctx.fillRect(x + u * 4, y + u * 10, u * 8, u * 2);
    ctx.fillRect(x + u * 5, y + u * 12, u * 6, u * 2);
    ctx.fillRect(x + u * 6, y + u * 14, u * 4, u);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(x + u * 3, y + u, u * 10, u);
    ctx.fillRect(x + u * 7, y + u * 3, u * 2, u * 6); // emblem
    ctx.fillRect(x + u * 5, y + u * 5, u * 6, u * 2);
  } else if (type === 'glove') {
    ctx.fillStyle = '#8a5a28';
    ctx.fillRect(x + u * 4, y + u * 3, u * 8, u * 8);
    ctx.fillRect(x + u * 12, y + u * 5, u * 2, u * 4); // thumb
    ctx.fillStyle = '#a87038';
    ctx.fillRect(x + u * 5, y + u * 4, u * 6, u * 6);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(x + u * 4, y + u * 11, u * 8, u * 2); // cuff
  } else if (type === 'boots') {
    ctx.fillStyle = '#7a3020';
    ctx.fillRect(x + u * 4, y + u * 2, u * 4, u * 9);
    ctx.fillRect(x + u * 4, y + u * 11, u * 7, u * 3);
    ctx.fillStyle = '#9a4028';
    ctx.fillRect(x + u * 5, y + u * 3, u * 2, u * 8);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(x + u * 4, y + u * 2, u * 4, u);
  } else if (type === 'lantern') {
    ctx.fillStyle = '#4a5568';
    ctx.fillRect(x + u * 6, y + u, u * 4, u);         // handle
    ctx.fillRect(x + u * 5, y + u * 2, u, u * 2);
    ctx.fillRect(x + u * 10, y + u * 2, u, u * 2);
    ctx.fillRect(x + u * 4, y + u * 4, u * 8, u * 9); // body
    ctx.fillStyle = '#f0c040';
    ctx.fillRect(x + u * 5, y + u * 5, u * 6, u * 7); // glass
    ctx.fillStyle = '#fff0a0';
    ctx.fillRect(x + u * 7, y + u * 7, u * 2, u * 3); // flame
    ctx.fillStyle = '#4a5568';
    ctx.fillRect(x + u * 4, y + u * 13, u * 8, u);
  } else if (type === 'map') {
    ctx.fillStyle = '#d8c8a0';
    ctx.fillRect(x + u * 3, y + u * 2, u * 10, u * 12);
    ctx.fillStyle = '#b09868';
    ctx.fillRect(x + u * 3, y + u * 2, u * 10, u);
    ctx.fillRect(x + u * 3, y + u * 13, u * 10, u);
    ctx.fillStyle = PAL.red;
    ctx.fillRect(x + u * 9, y + u * 5, u * 2, u * 2); // X marks
    ctx.fillStyle = '#6a5838';
    ctx.fillRect(x + u * 5, y + u * 8, u * 5, u);
    ctx.fillRect(x + u * 5, y + u * 5, u, u * 4);
  } else if (type === 'sunstone') {
    // radiant faceted gem
    const cx = x + s / 2;
    ctx.fillStyle = '#f0c040';
    ctx.fillRect(cx - u * 4, y + u * 5, u * 8, u * 6);
    ctx.fillRect(cx - u * 3, y + u * 3, u * 6, u * 10);
    ctx.fillRect(cx - u * 2, y + u * 2, u * 4, u * 12);
    ctx.fillStyle = '#fff0a0';
    ctx.fillRect(cx - u * 2, y + u * 4, u * 2, u * 6);
    ctx.fillStyle = '#d88818';
    ctx.fillRect(cx + u, y + u * 8, u * 2, u * 4);
    // sun rays
    ctx.fillStyle = 'rgba(240,200,80,0.5)';
    ctx.fillRect(cx - u, y, u * 2, u * 2);
    ctx.fillRect(cx - u, y + u * 13, u * 2, u * 2);
    ctx.fillRect(x + u, y + s / 2 - u, u * 2, u * 2);
    ctx.fillRect(x + s - u * 3, y + s / 2 - u, u * 2, u * 2);
  }
},

// ── hero sprite sheet ────────────────────────────────────────
// All frame boxes below were auto-derived from hero2.png by connected-
// component detection (scratchpad/ccl.js), so they're tight and aligned.
// The sheet has four sections (IDLE, WALK, PUSH, PULL); each has real
// up/down/left/right rows — including a dedicated PUSH-LEFT row, so no
// mirroring is needed (an earlier build wrongly mirrored right for left).
// NB: on this sheet the idle side-rows are ordered RIGHT then LEFT
IDLE: {
  up:    [218,45,46,61], down: [218,111,46,61], left: [221,244,45,61], right: [219,178,46,61],
},
WALK: {
  up:    [[221,343,46,64],[339,342,48,67],[461,343,47,66],[578,343,47,65]],
  down:  [[220,412,47,63],[341,411,46,64],[461,412,46,63],[580,412,46,63]],
  left:  [[218,481,49,62],[337,481,52,63],[459,481,48,63],[577,481,50,63]],
  right: [[222,551,49,65],[341,551,50,65],[461,551,48,64],[580,551,49,65]],
},
PUSH: {
  up:    [[213,653,66,64],[332,652,65,65],[452,653,65,64],[570,653,66,64]], // back view
  down:  [[220,727,45,64],[339,728,45,63],[459,727,45,64],[579,727,44,65]], // front view
  left:  [[208,798,71,65],[327,798,70,65],[447,797,70,66],[566,798,70,65]], // left profile
  right: [[208,875,71,64],[328,875,70,64],[448,875,70,64],[567,875,69,64]], // right profile
},

sheet: null,
_skin: 'skin_default', _skinCache: {},
// optional standalone push sheets (4-frame horizontal strips) that override
// the corresponding direction on the main sheet once present in the repo.
_aux: {},

loadSprites(onReady) {
  this.sheet = new Image();
  this.sheet.src = 'hero2.png';
  this.sheet.onload = onReady;
  this._loadAux();
  this.loadAssets();
},

// load push_up.png if present and auto-slice 4 tight frames; missing files
// just fall back to the main-sheet poses. (push_left.png is intentionally
// NOT used: its four frames slice to very uneven widths, so the sprite jerks
// frame-to-frame. The mirrored PUSH.right frames are uniform and read clean.)
_loadAux() {
  const files = { up: 'push_up.png' };
  for (const dir in files) {
    const img = new Image();
    img.onload = () => this._sliceAux(dir, img);
    img.onerror = () => {};
    img.src = files[dir];
  }
},
// Rebalance the push sheet's proportions: the source hero has an oversized,
// forward-hunched head that reads as chibi next to the walk/idle sprite. For
// each frame we shrink the head (hair, above the tunic line) a touch and centre
// it over the body, which enlarges the body's share and straightens the lean —
// so it reads as the same character/size as the walk sprite. Returns a corrected
// canvas the rest of the slicing runs on; falls back to the original on any error.
_fixProportions(img) {
  try {
    const HS = 0.85;                       // head scale (relative to body)
    const W = img.naturalWidth, H = img.naturalHeight, cw = Math.floor(W / 4);
    const sc = document.createElement('canvas'); sc.width = W; sc.height = H;
    const scx = sc.getContext('2d'); scx.drawImage(img, 0, 0);
    const d = scx.getImageData(0, 0, W, H).data;
    const A = (x, y) => d[(y * W + x) * 4 + 3] > 60;
    const isGreen = (x, y) => { const i = (y * W + x) * 4, R = d[i], G = d[i + 1], B = d[i + 2]; return d[i + 3] > 60 && G > R + 6 && G > B + 6 && G > 60; };
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const ctx = out.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    for (let f = 0; f < 4; f++) {
      const x0 = f * cw;
      let top = H, feet = 0;
      for (let y = 0; y < H; y++) for (let x = x0; x < x0 + cw; x++) if (A(x, y)) { if (y < top) top = y; if (y > feet) feet = y; }
      if (feet < top) continue;
      let neck = -1;
      for (let y = top; y <= feet; y++) { let g = 0; for (let x = x0; x < x0 + cw; x++) if (isGreen(x, y)) g++; if (g >= 8) { neck = y; break; } }
      if (neck < 0) neck = Math.round(top + (feet - top) * 0.48);   // no tunic found → assume mid-height
      // horizontal centroids of body (tunic+legs) and head (everything above neck)
      let bsx = 0, bn = 0, hsx = 0, hn = 0;
      for (let y = neck; y <= feet; y++) for (let x = x0; x < x0 + cw; x++) if (A(x, y)) { bsx += x; bn++; }
      for (let y = top; y < neck; y++) for (let x = x0; x < x0 + cw; x++) if (A(x, y)) { hsx += x; hn++; }
      const bodyCX = bn ? bsx / bn : x0 + cw / 2, headCX = hn ? hsx / hn : x0 + cw / 2;
      // body stays put; head shrinks and re-centres over the body, bottom kept a
      // touch into the shoulders so there's no gap at the neck
      ctx.drawImage(sc, x0, neck, cw, feet - neck + 1, x0, neck, cw, feet - neck + 1);
      const headH = neck - top, overlap = Math.round(headH * 0.10), nh = headH * HS;
      const destBottom = neck + overlap, destTop = destBottom - nh;
      const dX = bodyCX - (headCX - x0) * HS;
      ctx.drawImage(sc, x0, top, cw, headH, dX, destTop, cw * HS, nh);
    }
    return out;
  } catch (e) { return img; }
},

_sliceAux(dir, img) {
  try {
    img = this._fixProportions(img);       // rebalance head/body proportions first
    const W = img.width || img.naturalWidth, H = img.height || img.naturalHeight;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'); c.drawImage(img, 0, 0);
    const d = c.getImageData(0, 0, W, H).data, A = (x, y) => d[(y * W + x) * 4 + 3];
    // hair = brown pixels only (tracks the head): excludes the green tunic and
    // the bright-gold arm/torch, whose sideways reach would drag any alpha- or
    // bbox-based anchor around and re-introduce the shake.
    const isHair = (x, y) => { const i = (y * W + x) * 4, R = d[i], G = d[i + 1], B = d[i + 2]; return d[i + 3] > 40 && R > 55 && R < 165 && G > 30 && G < 105 && B < 80 && (R - G) > 12 && R > G && G >= B; };
    const cw = Math.floor(W / 4);
    // Shared vertical band across the whole strip so every frame is the exact
    // same size (differing sizes make hero() resize the sprite frame-to-frame).
    let top = H, bot = 0;
    for (let y = 0; y < H; y++) { let any = false; for (let x = 0; x < cw * 4 && !any; x++) if (A(x, y) > 40) any = true; if (any) { if (y < top) top = y; if (y > bot) bot = y; } }
    if (bot < top) return;
    const bh = bot - top + 1;
    // Per-frame HEAD anchor: these source frames are drawn with the character's
    // head rocking side to side cell-to-cell (head one way, feet the other), so a
    // plain fixed-cell slice makes the head visibly swing every loop (the
    // "shaking"). We pin the head: measure the horizontal centroid of the HAIR
    // and record its offset from the cell centre; hero() shifts the draw by that
    // offset so the head stays put while the feet do a small natural step.
    const frames = [];
    for (let i = 0; i < 4; i++) {
      const x0 = i * cw;
      let sx = 0, n = 0, hairTop = bot, feet = top;
      for (let y = top; y <= bot; y++) for (let x = x0; x < x0 + cw; x++) {
        if (isHair(x, y)) { sx += x; n++; if (y < hairTop) hairTop = y; }
        if (A(x, y) > 40 && y > feet) feet = y;   // lowest opaque row = feet
      }
      const anchor = n ? (sx / n) - (x0 + cw / 2) : 0;   // hair centre relative to cell centre (source px)
      frames.push([x0, top, cw, bh, anchor, hairTop, feet]);
    }
    // ONE body span for the whole sheet (highest head-top to the shared feet
    // baseline) so hero() scales and places every push frame identically — a
    // per-frame span would round differently frame-to-frame and shrink/pulse
    // the hero at small in-game tile sizes.
    const bodyTop = Math.min.apply(null, frames.map(f => f[5]));
    const bodyBot = bot;
    this._aux[dir] = { img, frames, bodyTop, bodyBot };
  } catch (e) { /* cross-origin/tainted (file://) — fall back to main sheet */ }
},


// ── image assets sliced from the uploaded sprite sheets (art/) ──
// Each draw falls back to the procedural version until its PNG is loaded,
// so the game never blocks on these.
ASSETS: {
  floor0: 'art/tile_floor0.png', floor1: 'art/tile_floor1.png', floor2: 'art/tile_floor2.png',
  wall: 'art/tile_wall.png', coin: 'art/tile_coin.png', block: 'art/tile_block_flat.png',
  switch: 'art/tile_switch.png', door: 'art/tile_door.png',
  relic_sword: 'art/relic_sword.png', relic_shield: 'art/relic_shield.png',
  relic_glove: 'art/relic_glove.png', relic_lantern: 'art/relic_lantern.png',
  relic_boots: 'art/relic_boots.png',
  mi_sword: 'art/mi_sword.png', mi_depth: 'art/mi_depth.png', mi_clock: 'art/mi_clock.png',
  mi_cart: 'art/mi_cart.png', mi_gear: 'art/mi_gear.png',
  skeleton: 'art/skeleton.png', skeleton_attack_right: 'art/skeleton_attack_right.png',
  skeleton_rig_right: 'art/rig/skeleton_idle_right.png',
  skeleton_rig_left: 'art/rig/skeleton_idle_left.png',
  skeleton_rig_up: 'art/rig/skeleton_idle_up.png',
  skeleton_rig_down: 'art/rig/skeleton_idle_down.png',
},
img: {},
loadAssets() {
  for (const k in this.ASSETS) { const im = new Image(); im.src = this.ASSETS[k]; this.img[k] = im; }
},
_ready(im) { return !!(im && im.complete && im.naturalWidth > 0); },
// draw `im` centered in a maxW×maxH box at (cx,cy), preserving aspect, pixel-crisp
_blit(ctx, im, cx, cy, maxW, maxH) {
  const iw = im.naturalWidth, ih = im.naturalHeight, sc = Math.min(maxW / iw, maxH / ih);
  const w = Math.max(1, Math.round(iw * sc)), h = Math.max(1, Math.round(ih * sc));
  ctx.drawImage(im, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
},

// ── skins: recolor the green tunic/cap to a tint, keep shading ──
setSkin(id) {
  this._skin = SKINS[id] ? id : 'skin_default';
},

_recolor(img, tint) {
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const c2 = cv.getContext('2d');
  c2.drawImage(img, 0, 0);
  try {
    const im = c2.getImageData(0, 0, cv.width, cv.height);
    const d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
      if (!a) continue;
      // greenish pixels = tunic + cap
      if (g > r + 14 && g > b + 14) {
        const lum = (r + g + b) / 3 / 105; // ~105 = midtone of the tunic
        d[i]     = Math.min(255, Math.round(tint[0] * lum));
        d[i + 1] = Math.min(255, Math.round(tint[1] * lum));
        d[i + 2] = Math.min(255, Math.round(tint[2] * lum));
      }
    }
    c2.putImageData(im, 0, 0);
  } catch (e) {
    // canvas tainted (file:// dev) — fall back to original colors
    return img;
  }
  return cv;
},

_activeSheet() {
  const sk = SKINS[this._skin];
  if (!sk || !sk.tint) return this.sheet;
  let cached = this._skinCache[this._skin];
  if (!cached) {
    if (!this.sheet || !this.sheet.complete) return this.sheet;
    cached = this._skinCache[this._skin] = this._recolor(this.sheet, sk.tint);
  }
  return cached;
},

hero(ctx, dir, frame, px, py, tile, pushing, idle) {
  // pick the right frame box: idle pose when standing, else walk/push cycle.
  // Two sheet quirks handled here:
  //  - PUSH.up reaches its arms out to the side (reads as a side-push), so the
  //    up-push uses the clean back-view WALK.up cycle instead.
  //  - the sheet has no true left-push row (its "left" row faces right), so we
  //    mirror the good PUSH.right frames for the left-push.
  let box, flip = false, src = this._activeSheet();
  const auxDir = pushing && (dir === 'up' || dir === 'left') ? this._aux[dir] : null;
  if (auxDir) {
    box = auxDir.frames[frame % 4]; src = auxDir.img;   // dedicated push sheet
  } else if (pushing) {
    if (dir === 'up') box = this.WALK.up[frame % 4];
    else if (dir === 'left') { box = this.PUSH.right[frame % 4]; flip = true; }
    else box = this.PUSH[dir][frame % 4];
  } else if (idle) box = this.IDLE[dir];
  else box = this.WALK[dir][frame % 4];
  let [sx, sy, sw, sh] = box;
  if (!src || (src.complete === false)) return;
  let dh, dw, dx, dy;
  const anchor = box[4] || 0;
  if (auxDir) {
    // Crop each push frame to its BODY (head-top → feet) and draw it into a dest
    // box whose height is EXACTLY round(tile*1.05) — the same integer body height
    // the walk/idle sprites use — with the feet on the floor. This pins the
    // on-screen body to idle's size (verified pixel-exact at T30, the tile size
    // every dungeon uses on phones and the desktop bezel). The head anchor keeps
    // it horizontally steady; a ~1px hand-tip above the hair is trimmed.
    const hairTop = box[5], feet = box[6];
    const target = Math.round(tile * 1.05);
    sy = hairTop; sh = Math.max(1, feet - hairTop + 1);
    const scale = target / sh;
    dw = Math.round(sw * scale);
    dh = target;
    dx = px + ((tile - dw) >> 1) - Math.round(anchor * scale);
    dy = py + tile - target;
  } else {
    dh = Math.round(tile * 1.05);
    dw = Math.round(dh * sw / sh);
    dx = px + ((tile - dw) >> 1) - Math.round(anchor * dw / sw);
    dy = py + tile - dh;
  }
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(px + tile / 2, py + tile - 3, tile * 0.28, tile * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (flip) {
    ctx.save(); ctx.translate(dx + dw, dy); ctx.scale(-1, 1);
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, dw, dh); ctx.restore();
  } else {
    ctx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
  }
},

// ── UI chrome ────────────────────────────────────────────────
// sharp modern-retro card: opaque body + hard pixel drop shadow
panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x + 5, y + 5, w, h);
  ctx.fillStyle = '#0b0e1a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h);
  ctx.fillStyle = PAL.gold;
  ctx.fillRect(x, y, 8, 2); ctx.fillRect(x, y, 2, 8);
  ctx.fillRect(x + w - 8, y, 8, 2); ctx.fillRect(x + w - 2, y, 2, 8);
  ctx.fillRect(x, y + h - 2, 8, 2); ctx.fillRect(x, y + h - 8, 2, 8);
  ctx.fillRect(x + w - 8, y + h - 2, 8, 2); ctx.fillRect(x + w - 2, y + h - 8, 2, 8);
},

// small pixel glyphs for menu cards
uiIcon(ctx, name, x, y, size) {
  const mi = this.img['mi_' + name];
  if (this._ready(mi)) { this._blit(ctx, mi, x + size / 2, y + size / 2, size, size); return; }
  const u = Math.max(1, Math.floor(size / 12));
  if (name === 'play') {
    ctx.fillStyle = PAL.goldHi;
    for (let i = 0; i < 6; i++) ctx.fillRect(x + i * u, y + i * u, u, (12 - i * 2) * u);
  } else if (name === 'sword') {
    this.item(ctx, 'sword', x, y, size);
  } else if (name === 'depth') {
    // stairs descending into dark
    ctx.fillStyle = '#3c4c66';
    ctx.fillRect(x, y, u * 4, u * 3);
    ctx.fillStyle = '#2c3a52';
    ctx.fillRect(x + u * 4, y + u * 3, u * 4, u * 3);
    ctx.fillStyle = '#1c2638';
    ctx.fillRect(x + u * 8, y + u * 6, u * 4, u * 3);
    ctx.fillStyle = PAL.goldHi;
    ctx.fillRect(x + u * 9, y + u * 10, u * 2, u * 2);
  } else if (name === 'clock') {
    ctx.fillStyle = '#3c4c66';
    ctx.fillRect(x + u * 3, y, u * 6, u); ctx.fillRect(x + u * 3, y + u * 11, u * 6, u);
    ctx.fillRect(x, y + u * 3, u, u * 6); ctx.fillRect(x + u * 11, y + u * 3, u, u * 6);
    ctx.fillRect(x + u, y + u, u * 2, u * 2); ctx.fillRect(x + u * 9, y + u, u * 2, u * 2);
    ctx.fillRect(x + u, y + u * 9, u * 2, u * 2); ctx.fillRect(x + u * 9, y + u * 9, u * 2, u * 2);
    ctx.fillStyle = PAL.goldHi;
    ctx.fillRect(x + u * 5, y + u * 3, u * 2, u * 4);
    ctx.fillRect(x + u * 6, y + u * 6, u * 3, u * 2);
  } else if (name === 'coin') {
    this.coinIcon(ctx, x + u, y + u, size - u * 2);
  } else if (name === 'gear') {
    ctx.fillStyle = '#3c4c66';
    ctx.fillRect(x + u * 5, y, u * 2, u * 12);
    ctx.fillRect(x, y + u * 5, u * 12, u * 2);
    ctx.fillRect(x + u * 2, y + u * 2, u * 8, u * 8);
    ctx.fillStyle = '#0b0e1a';
    ctx.fillRect(x + u * 5, y + u * 5, u * 2, u * 2);
  } else if (name === 'cart') {
    ctx.fillStyle = '#3c4c66';
    ctx.fillRect(x, y + u * 2, u * 2, u);
    ctx.fillRect(x + u * 2, y + u * 2, u, u * 6);
    ctx.fillRect(x + u * 2, y + u * 8, u * 9, u);
    ctx.fillRect(x + u * 3, y + u * 3, u * 8, u * 4);
    ctx.fillRect(x + u * 3, y + u * 10, u * 2, u * 2);
    ctx.fillRect(x + u * 8, y + u * 10, u * 2, u * 2);
    ctx.fillStyle = PAL.goldHi;
    ctx.fillRect(x + u * 4, y + u * 4, u * 6, u * 2);
  }
},
};
