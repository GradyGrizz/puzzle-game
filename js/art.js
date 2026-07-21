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

// ── base tiles (preserved) ────────────────────────────────────
floor(ctx, x, y, t) {
  ctx.fillStyle = PAL.fl; ctx.fillRect(x, y, t, t);
  ctx.fillStyle = PAL.flG; ctx.fillRect(x, y, t, 1); ctx.fillRect(x, y, 1, t);
  const d = Math.floor(t * .22);
  ctx.fillStyle = PAL.flD;
  ctx.fillRect(x + d, y + d, 2, 2); ctx.fillRect(x + t - d - 2, y + t - d - 2, 2, 2);
},

wall(ctx, x, y, t) {
  ctx.fillStyle = PAL.wBg; ctx.fillRect(x, y, t, t);
  ctx.fillStyle = PAL.wFace; ctx.fillRect(x + 1, y + 1, t - 2, t - 2);
  const h = Math.floor(t * .52);
  ctx.fillStyle = PAL.wHi;
  ctx.fillRect(x + 2, y + 2, t - 4, 2); ctx.fillRect(x + 2, y + h + 1, t - 4, 2);
  ctx.fillStyle = PAL.wBg;
  ctx.fillRect(x + 1, y + h, t - 2, 2);
  ctx.fillRect(x + Math.floor(t * .50), y + 2, 1, h - 3);
  ctx.fillRect(x + Math.floor(t * .25), y + h + 2, 1, t - h - 4);
  ctx.fillRect(x + Math.floor(t * .75), y + h + 2, 1, t - h - 4);
  ctx.fillStyle = PAL.wMid;
  ctx.fillRect(x + 2, y + 2, Math.floor(t * .20), h - 4);
  ctx.fillRect(x + Math.floor(t * .27), y + h + 2, Math.floor(t * .20), t - h - 4);
  ctx.fillStyle = PAL.wSh;
  ctx.fillRect(x + t - 1, y, 1, t); ctx.fillRect(x, y + t - 1, t, 1);
},

// A flat, recessed floor-plate rather than a tall raised block, so the
// hero (drawn on top) clearly stands ON it instead of merging into it.
switchTile(ctx, x, y, t, on) {
  this.floor(ctx, x, y, t);
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

block(ctx, x, y, t, glow) {
  this.floor(ctx, x, y, t);
  const p = Math.floor(t * .1), bs = t - p * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x + p + 2, y + p + 2, bs, bs);
  ctx.fillStyle = PAL.blF; ctx.fillRect(x + p, y + p, bs, bs);
  const m = Math.floor(t / 2);
  ctx.fillStyle = PAL.blSh;
  ctx.fillRect(x + m - 1, y + p + 3, 2, bs - 6); ctx.fillRect(x + p + 3, y + m - 1, bs - 6, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(x + m, y + p + 4, 1, bs - 7); ctx.fillRect(x + p + 4, y + m, bs - 7, 1);
  ctx.fillStyle = PAL.blH;
  ctx.fillRect(x + p, y + p, bs, 3); ctx.fillRect(x + p, y + p, 3, bs);
  ctx.fillStyle = PAL.blSh;
  ctx.fillRect(x + p + bs - 2, y + p, 2, bs); ctx.fillRect(x + p, y + p + bs - 2, bs, 2);
  if (glow) { ctx.fillStyle = 'rgba(210,80,20,0.28)'; ctx.fillRect(x + p, y + p + bs - 5, bs, 5); }
},

// block drawn floating over pit (falling anim uses scale)
blockRaw(ctx, x, y, t, scale) {
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
  }
},

// ── hero sprite sheet ────────────────────────────────────────
WALK: {
  up:    [[221,343,46,65],[339,343,48,65],[461,343,48,65],[578,343,48,65]],
  down:  [[220,411,47,64],[341,411,46,64],[461,411,46,64],[580,411,47,64]],
  left:  [[217,480,51,63],[337,480,52,63],[459,480,49,63],[577,480,50,63]],
  right: [[222,551,49,64],[341,551,50,64],[461,551,49,64],[580,551,49,64]],
},
// PUSH rows from hero2.png. The sheet has: a back-view row (up), a
// front-view row (down), and a RIGHT-facing profile row. There is NO
// dedicated left-facing push row — the sheet's fourth push row is just
// another right-facing pose — so `left` is the right frames mirrored
// horizontally at draw time (handled in hero()). Boxes measured tight
// from the sheet's non-transparent content.
PUSH: {
  up:    [[214,653,64,63],[333,653,63,63],[453,653,63,63],[572,653,63,63]], // back view
  down:  [[220,728,44,62],[340,728,44,62],[460,728,44,62],[579,728,44,61]], // front view
  right: [[209,876,69,62],[329,876,68,62],[449,875,68,63],[568,876,67,62]], // right profile
  // left := right, drawn flipped
},

sheet: null,
_skin: 'skin_default', _skinCache: {},

loadSprites(onReady) {
  this.sheet = new Image();
  this.sheet.src = 'hero2.png';
  this.sheet.onload = onReady;
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

hero(ctx, dir, frame, px, py, tile, pushing) {
  // no left-push sprite on the sheet -> mirror the right-push frames
  let flip = false, frames;
  if (pushing) {
    if (dir === 'left') { frames = this.PUSH.right; flip = true; }
    else frames = this.PUSH[dir];
  } else {
    frames = this.WALK[dir];
  }
  const [sx, sy, sw, sh] = frames[frame % 4];
  const src = this._activeSheet();
  if (!src || (src.complete === false)) return;
  const dh = Math.round(tile * 1.05);
  const dw = Math.round(dh * sw / sh);
  const dx = px + ((tile - dw) >> 1);
  const dy = py + tile - dh;
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(px + tile / 2, py + tile - 3, tile * 0.28, tile * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (flip) {
    ctx.save();
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, dw, dh);
    ctx.restore();
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
