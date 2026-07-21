# DELVE — Monetization Plan

## Philosophy

DELVE is a premium-feeling free game. The core loop (story, challenge,
timed) is entirely free and never interrupted. **There are no forced or
interstitial ads.** Revenue comes from players who *choose* to spend —
either to accelerate cosmetic collection or to support the game — plus
opt-in rewarded ads.

This stance is deliberate:

- Puzzle players punish interruption hard (retention cliff after the
  first forced ad in comparable titles).
- No forced ads → no "Remove Ads" SKU needed → simpler catalog, and the
  App Store review is cleaner (no ad-consent edge cases).
- Cosmetics + soft currency keeps everything within Apple's simplest IAP
  rules (consumable coin packs only).

## Economy

**Earning (free path)**

| Source | Coins |
|---|---|
| Story level clear | 5 + coins collected in level (+10 first clear) |
| Challenge depth clear | 3 + coins collected |
| Timed Rush run complete | 12 + coins collected |
| Rewarded ad (opt-in, max 3/day) | 20 |

Chapter 1 alone yields ~130–160 coins; a competent free player owns
their first skin (150) within their first session or two — early
gratification that teaches the shop loop exists.

**Spending**

| Item | Price (coins) |
|---|---|
| Hero skins (4 premium) | 150 / 150 / 250 / 400 |
| Dungeon themes (3) | 200 each |
| Hint Scrolls ×3 (consumable) | 60 |

Hint Scrolls are the quiet workhorse: they convert stuck-player
frustration (the #1 churn moment in puzzle games) into a coin sink and
a rescue mechanic simultaneously.

## IAP catalog (StoreKit, native build)

| SKU | Contents | Price |
|---|---|---|
| `delve.coins.pouch` | 500 coins | $1.99 (Tier 2) |
| `delve.coins.chest` | 1,500 coins | $4.99 (Tier 5) |

Both **consumable**. No subscriptions, no non-consumables, no restore
flow needed. Receipt validation: StoreKit 2 on-device verification is
sufficient at this scale (no server).

## Rewarded ads (native build)

- SDK: AdMob rewarded, **non-personalized ads configured** → no ATT
  prompt required, no tracking disclosure beyond standard.
- Placement: single "Watch & Earn +20" slot in the shop's Coin Vault,
  capped at 3/day (cap prevents the economy collapsing and keeps
  session length healthy).
- Web/dev build simulates the ad with a 3-second placeholder behind the
  same `Platform.ads` interface.

## App Store guideline notes

- 3.1.1: All purchases via IAP — no external purchase links. ✅
- 2.3.1: Simulated ad is dev-only; native build wires real SDK. ✅
- 5.1.1: No account required, no data collected; privacy "nutrition
  label" is effectively empty (local saves only). Game Center is
  Apple-managed. ✅
- Kids Category: **not** enrolling (rewarded ads disallow it);
  age rating 4+ content but standard category.

## Later (post-launch, not in v1)

- Seasonal skin drops (retention hook, zero mechanical impact).
- "Supporter's Lantern" one-time $4.99 non-consumable: golden lantern
  cosmetic + supporter badge on title screen — a tip jar with dignity.
  (Would require restore purchases; deferred to keep v1 simple.)
