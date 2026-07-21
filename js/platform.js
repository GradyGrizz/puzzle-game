'use strict';
// ── Platform: native-bridge abstraction ───────────────────────
// The web build ships stubs; the Capacitor iOS build replaces
// these with StoreKit (IAP), a rewarded-ad SDK, and Game Center.
// Keeping every native touchpoint behind this one object means
// the game code never has to know which build it's running in.

const Platform = {
  isNative: !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()),

  // ── In-App Purchases (StoreKit via capacitor plugin in native build) ──
  iap: {
    available: false, // flips true in the native build
    products: [
      { sku: 'delve.coins.pouch', coins: 500, label: 'POUCH OF COINS', price: '$1.99' },
      { sku: 'delve.coins.chest', coins: 1500, label: 'CHEST OF COINS', price: '$4.99' },
    ],
    buy(sku, cb) {
      // native build: StoreKit purchase flow -> validate -> grant
      cb({ ok: false, reason: 'store-unavailable' });
    },
  },

  // ── Rewarded ads (opt-in only; no forced/interstitial ads) ──
  ads: {
    rewardedAvailable: true, // web build simulates; native uses real SDK
    simulated: true,
  },

  // ── Game Center (native build syncs local leaderboards) ──
  gameCenter: {
    available: false,
    submitChallengeDepth(depth) {},
    submitTimedMs(ms) {},
  },

  // light haptic tap where supported (Android web; iOS via native Haptics)
  haptic(strength) {
    try {
      if (typeof Save !== 'undefined' && Save.data && !Save.data.settings.haptics) return;
      if (navigator.vibrate) navigator.vibrate(strength === 'heavy' ? 24 : 8);
    } catch (e) {}
  },
};
