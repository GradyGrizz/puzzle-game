'use strict';
// ── Shop: skins, themes, supplies, coin vault ─────────────────
// Monetization stance: no forced ads. Revenue = coin IAPs (native
// build) + opt-in rewarded ads. Everything cosmetic is buyable
// with earned coins so free players see the whole catalog.

const ScreenShop = {
  t: 0, sel: 0, scrollY: 0, confirmId: null, ad: null, toast: null,

  enter() {
    this.t = 0;
    this.scrollY = 0;
    this.confirmId = null;
    this.ad = null;
    this.toast = null;
    Snd.playMusic('shop');
    this._build();
    // select first selectable row
    this.sel = this.rows.findIndex(r => r.type === 'item');
  },

  _build() {
    const rows = [];
    rows.push({ type: 'header', label: '- DELVER SKINS -' });
    for (const id in SKINS) {
      const sk = SKINS[id];
      rows.push({ type: 'item', kind: 'skin', id, name: sk.name, price: sk.price });
    }
    rows.push({ type: 'header', label: '- DUNGEON THEMES -' });
    for (const id in THEMES) {
      const th = THEMES[id];
      rows.push({ type: 'item', kind: 'theme', id, name: th.name, price: th.price });
    }
    rows.push({ type: 'header', label: '- SUPPLIES -' });
    rows.push({ type: 'item', kind: 'hints', id: 'hint_pack', name: 'HINT SCROLLS ×3', price: 60, desc: 'A WHISPER OF THE WAY FORWARD' });
    rows.push({ type: 'header', label: '- COIN VAULT -' });
    rows.push({ type: 'item', kind: 'ad', id: 'ad_reward', name: 'WATCH & EARN', price: 0, desc: '+20 COINS' });
    for (const p of Platform.iap.products) {
      rows.push({ type: 'item', kind: 'iap', id: p.sku, name: p.label, price: 0, desc: '+' + p.coins + ' COINS  ' + p.price });
    }
    this.rows = rows;
  },

  _rowState(row) {
    if (row.kind === 'skin') {
      if (Save.data.shop.skin === row.id) return 'equipped';
      return Save.owns(row.id) ? 'owned' : 'buy';
    }
    if (row.kind === 'theme') {
      if (Save.data.shop.theme === row.id) return 'equipped';
      return Save.owns(row.id) ? 'owned' : 'buy';
    }
    if (row.kind === 'hints') return 'buy';
    if (row.kind === 'ad') return Save.adsLeftToday() > 0 ? 'buy' : 'soldout';
    return 'iap';
  },

  _activate(row) {
    const state = this._rowState(row);
    if (row.kind === 'skin' || row.kind === 'theme') {
      if (state === 'equipped') { Snd.blip(); return; }
      if (state === 'owned') {
        if (row.kind === 'skin') { Save.data.shop.skin = row.id; Art.setSkin(row.id); }
        else { Save.data.shop.theme = row.id; Art.setTheme(row.id); }
        Save.write();
        Snd.select();
        Platform.haptic();
        return;
      }
      // buy flow with tap-again confirm
      if (this.confirmId !== row.id) {
        if (Save.data.coins < row.price) { Snd.error(); this._say('NOT ENOUGH COINS'); return; }
        this.confirmId = row.id;
        Snd.blip();
        return;
      }
      this.confirmId = null;
      if (Save.buyItem(row.id, row.price)) {
        if (row.kind === 'skin') { Save.data.shop.skin = row.id; Art.setSkin(row.id); }
        else { Save.data.shop.theme = row.id; Art.setTheme(row.id); }
        Save.write();
        Snd.buy();
        Platform.haptic('heavy');
        this._say('YOURS! EQUIPPED.');
      } else {
        Snd.error();
      }
      return;
    }
    if (row.kind === 'hints') {
      if (this.confirmId !== row.id) {
        if (Save.data.coins < row.price) { Snd.error(); this._say('NOT ENOUGH COINS'); return; }
        this.confirmId = row.id;
        Snd.blip();
        return;
      }
      this.confirmId = null;
      if (Save.spend(row.price)) {
        Save.addHints(3);
        Snd.buy();
        this._say('3 HINT SCROLLS ADDED');
      } else Snd.error();
      return;
    }
    if (row.kind === 'ad') {
      if (state === 'soldout') { Snd.error(); this._say('COME BACK TOMORROW'); return; }
      // web build: simulated ad break; native build swaps in a real
      // rewarded SDK behind Platform.ads
      Snd.select();
      this.ad = { t: 3 };
      return;
    }
    if (row.kind === 'iap') {
      Platform.iap.buy(row.id, res => {
        if (!res.ok) {
          Snd.blip();
          this._say('COIN PACKS ARRIVE WITH THE APP STORE BUILD');
        }
      });
    }
  },

  _say(text) { this.toast = { text, t: 2.2 }; },

  update(dt) {
    this.t += dt;
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
    if (this.ad) {
      this.ad.t -= dt;
      if (this.ad.t <= 0) {
        this.ad = null;
        Save.recordAdWatch();
        Save.addCoins(20);
        Snd.coin();
        this._say('+20 COINS. THANKS FOR WATCHING!');
      }
    }
  },

  _layout(W, H) {
    const top = 92;
    const rowH = r => (r.type === 'header' ? 30 : 62);
    let y = top - this.scrollY;
    const out = [];
    for (const r of this.rows) {
      const h = rowH(r);
      out.push({ row: r, y, h });
      y += h + 6;
    }
    this.contentH = y + this.scrollY - top;
    this.viewH = H - top - (App.isTouch ? 30 : 16);
    return out;
  },

  draw(ctx, W, H) {
    drawBackdrop(ctx, W, H, this.t);
    const s = Math.max(2, Math.floor(W / 220));
    const lay = this._layout(W, H);
    const pw = Math.min(W - 28, 420);
    const px = (W - pw) / 2;

    // scrollable content
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 84, W, H - 84);
    ctx.clip();
    for (let i = 0; i < lay.length; i++) {
      const { row, y, h } = lay[i];
      if (y + h < 60 || y > H) continue;
      if (row.type === 'header') {
        drawText(ctx, row.label, W / 2, y + 10, 1, PAL.uiDim, 'center');
        continue;
      }
      const seld = i === this.sel;
      const state = this._rowState(row);
      ctx.fillStyle = seld ? 'rgba(210,160,40,0.13)' : 'rgba(255,255,255,0.045)';
      ctx.fillRect(px, y, pw, h);
      ctx.fillStyle = seld ? PAL.gold : 'rgba(255,255,255,0.1)';
      ctx.fillRect(px, y, pw, 2); ctx.fillRect(px, y + h - 2, pw, 2);
      ctx.fillRect(px, y, 2, h); ctx.fillRect(px + pw - 2, y, 2, h);

      // preview swatch
      const ps = h - 16;
      const ix = px + 10, iy = y + 8;
      if (row.kind === 'skin') {
        const sk = SKINS[row.id];
        ctx.fillStyle = '#0c101c'; ctx.fillRect(ix, iy, ps, ps);
        // tunic swatch + hero silhouette color
        const tint = sk.tint || [87, 155, 76];
        ctx.fillStyle = `rgb(${tint[0] * 0.55 | 0},${tint[1] * 0.55 | 0},${tint[2] * 0.55 | 0})`;
        ctx.fillRect(ix + 6, iy + ps * 0.42, ps - 12, ps * 0.44);
        ctx.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`;
        ctx.fillRect(ix + 8, iy + ps * 0.46, ps - 16, ps * 0.2);
        ctx.fillStyle = '#8a5a30'; // hair
        ctx.fillRect(ix + ps * 0.3, iy + 5, ps * 0.4, ps * 0.28);
      } else if (row.kind === 'theme') {
        const th = THEMES[row.id];
        const p2 = Object.assign({}, PAL_BASE, th.pal);
        ctx.fillStyle = p2.fl; ctx.fillRect(ix, iy, ps, ps);
        ctx.fillStyle = p2.wFace; ctx.fillRect(ix, iy, ps, ps * 0.4);
        ctx.fillStyle = p2.wHi; ctx.fillRect(ix, iy + 2, ps, 2);
        ctx.fillStyle = p2.blF; ctx.fillRect(ix + ps * 0.25, iy + ps * 0.5, ps * 0.5, ps * 0.4);
        ctx.fillStyle = p2.blH; ctx.fillRect(ix + ps * 0.25, iy + ps * 0.5, ps * 0.5, 3);
      } else if (row.kind === 'hints') {
        Art.item(ctx, 'map', ix, iy, ps);
      } else if (row.kind === 'ad') {
        Art.coin(ctx, ix, iy - 4, ps + 6, this.t * 4);
      } else {
        Art.coinIcon(ctx, ix + 4, iy + 4, ps - 10);
      }

      const tx = ix + ps + 12;
      drawText(ctx, row.name, tx, y + 10, s, seld ? PAL.goldHi : PAL.ui, 'left');
      if (row.desc) drawText(ctx, row.desc, tx, y + 10 + 9 * s, 1, PAL.uiDim, 'left');
      if (row.kind === 'ad') {
        drawText(ctx, Save.adsLeftToday() + ' LEFT TODAY', tx, y + 10 + 9 * s + 12, 1, PAL.uiDim, 'left');
      }

      // right-side status
      let label, col = PAL.ui;
      if (this.confirmId === row.id) { label = 'TAP: -' + row.price; col = PAL.goldHi; }
      else if (state === 'equipped') { label = 'EQUIPPED'; col = PAL.goldHi; }
      else if (state === 'owned') { label = 'EQUIP'; }
      else if (state === 'soldout') { label = 'DONE TODAY'; col = PAL.uiDim; }
      else if (state === 'iap') { label = ''; }
      else if (row.kind === 'ad') { label = 'FREE'; col = PAL.goldHi; }
      else { label = '● ' + row.price; col = Save.data.coins >= row.price ? PAL.goldHi : PAL.red; }
      if (label) {
        if (label.startsWith('● ')) {
          const wTxt = textWidth(label.slice(2), s);
          Art.coinIcon(ctx, px + pw - 16 - wTxt - 12, y + h / 2 - 4, 8);
          drawText(ctx, label.slice(2), px + pw - 16, y + h / 2 - 6, s, col, 'right');
        } else {
          drawText(ctx, label, px + pw - 16, y + h / 2 - 6, s, col, 'right');
        }
      }
    }
    ctx.restore();

    // header (over content)
    ctx.fillStyle = 'rgba(4,5,10,0.92)';
    ctx.fillRect(0, 0, W, 84);
    drawText(ctx, 'SHOP', W / 2, 26, s + 1, PAL.goldHi, 'center', '#000');
    drawText(ctx, '◀ BACK', 16, 12, s, PAL.uiDim, 'left');
    coinsBadge(ctx, W - 16, 20, Save.data.coins, s);
    drawText(ctx, 'HINTS ×' + Save.data.shop.hints, W - 16, 48, 1, PAL.uiDim, 'right');

    // scroll indicator
    if (this.contentH > this.viewH) {
      const frac = this.viewH / this.contentH;
      const barH = Math.max(24, this.viewH * frac);
      const barY = 92 + (this.scrollY / (this.contentH - this.viewH)) * (this.viewH - barH);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(W - 5, barY, 3, barH);
    }

    if (this.toast) {
      const tw = textWidth(this.toast.text, 2) + 28;
      ctx.fillStyle = 'rgba(4,5,10,0.94)';
      ctx.fillRect((W - tw) / 2, H - 120, tw, 30);
      drawText(ctx, this.toast.text, W / 2, H - 112, 2, PAL.goldHi, 'center');
    }

    // simulated ad overlay
    if (this.ad) {
      ctx.fillStyle = 'rgba(2,3,6,0.92)'; ctx.fillRect(0, 0, W, H);
      const pw2 = Math.min(W - 60, 320);
      Art.panel(ctx, (W - pw2) / 2, H * 0.36, pw2, 120);
      drawText(ctx, 'AD BREAK', W / 2, H * 0.36 + 24, s + 1, PAL.goldHi, 'center');
      drawText(ctx, 'REWARD IN ' + Math.ceil(this.ad.t) + '...', W / 2, H * 0.36 + 64, s, PAL.ui, 'center');
    }
  },

  _clampScroll() {
    const max = Math.max(0, this.contentH - this.viewH);
    this.scrollY = Math.max(0, Math.min(max, this.scrollY));
  },

  _ensureVisible(H) {
    const lay = this._layout(App.W, H || App.H);
    const it = lay[this.sel];
    if (!it) return;
    if (it.y < 96) this.scrollY -= (96 - it.y);
    else if (it.y + it.h > App.H - 30) this.scrollY += it.y + it.h - (App.H - 30);
    this._clampScroll();
  },

  onDirPress(dc, dr) {
    if (this.ad || !dr) return;
    let i = this.sel;
    do { i += dr; } while (i >= 0 && i < this.rows.length && this.rows[i].type !== 'item');
    if (i >= 0 && i < this.rows.length) {
      this.sel = i;
      this.confirmId = null;
      Snd.blip();
      this._ensureVisible();
    }
  },
  onDirRelease() {},
  onConfirm() {
    if (this.ad) return;
    const row = this.rows[this.sel];
    if (row && row.type === 'item') this._activate(row);
  },
  onTap(x, y) {
    if (this.ad) return;
    if (y < 40 && x < 120) { this.onBack(); return; }
    const lay = this._layout(App.W, App.H);
    const pw = Math.min(App.W - 28, 420);
    const px = (App.W - pw) / 2;
    for (let i = 0; i < lay.length; i++) {
      const { row, y: ry, h } = lay[i];
      if (row.type !== 'item' || ry < 60) continue;
      if (x >= px && x < px + pw && y >= ry && y < ry + h) {
        if (this.sel !== i) this.confirmId = null;
        this.sel = i;
        this._activate(row);
        return;
      }
    }
  },
  onScroll(dy) {
    if (this.ad) return;
    this.scrollY -= dy;
    this._clampScroll();
  },
  onBack() {
    if (this.ad) return;
    Snd.back();
    App.setScreen('menu');
  },
};
