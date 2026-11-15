# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/limitlessneverdies/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/limitlessneverdies/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Launch Radar — rank pre-token DeFi protocols by implied launch value.

The base multiple is calibrated per category from the snapshot itself: the median market-cap / TVL of tokenized protocols in that category, clamped 0.05–0.80, falling back to the global median when a category has fewer than three comps. Implied value = TVL × base multiple × a 7-day growth multiplier × a maturity multiplier. Pre-token means the snapshot records no token at all — no market cap, no CoinGecko id, no symbol.

The board covers the whole watchlist and the largest pre-token subjects below the floor. It deliberately leaves out wrapped, staked, bridged and versioned products (WBTC, Binance staked ETH, USDT0 and the like), because those are not protocols still waiting on a launch of their own.

## The dashboard

Four views share one static page:

- **Board** — every ranked row, with rank, category, chains, TVL, 7-day change, the base multiple applied and the implied value.
- **Detail** — one protocol's snapshot record, the model's multiplication laid out step by step, the category calibration evidence, same-category live comparables and a six-step farm plan.
- **Filter** — text, category, chain, TVL floor, watchlist-only and sort; the URL carries the filter so a view can be linked.
- **Live** — token-bearing protocols at the market's own market cap, beside the category table that shows each category's comps, median market-cap / TVL and the base multiple the board applies.

## Run it

```sh
node main.ts --input <path to snapshot.json>
```

Reads the sealed DefiLlama snapshot at `/input/snapshot.json` (758 protocols, as of 2026-11-14, watchlist 40 at a $50,000,000 floor), writes `board.json` (178 rows: the whole watchlist plus the 138 largest pre-token subjects below the floor), `data.js`, and `dashboard/` + `screenshots/` + `dossier.json` to `/output`. Node 22.18+, stdlib only, no network, deterministic.

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

`vendor/makefun-board.ts` is the kit's file, unchanged; `buildDossier` writes the dossier the scorer rebuilds from `/output`.

## Screenshots

`screenshots/1-board.png`, `2-detail.png` and `3-filtered.png` are 1440×900 renders of the page above: the board, the Steakhouse Financial detail view, and the board filtered to Lending.

---

Built for [make.fun](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
