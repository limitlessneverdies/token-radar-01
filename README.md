# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/limitlessneverdies/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/limitlessneverdies/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Launch Radar — rank pre-token DeFi protocols by implied launch value.

The base multiple is calibrated per category from the snapshot itself: the median market-cap / TVL of tokenized protocols in that category, clamped 0.05–0.80, falling back to the global median. Implied value = TVL × base multiple × a 7-day growth multiplier × a maturity multiplier. Pre-token means the snapshot records no token at all — no market cap, no CoinGecko id, no symbol.

## Run it

```sh
node main.ts --input <path to snapshot.json>
```

Reads the sealed DefiLlama snapshot at `/input/snapshot.json` (758 protocols, as of 2026-11-14, watchlist 40 at a $50,000,000 floor), writes `board.json` (200 rows: the whole watchlist plus the 160 largest pre-token protocols below the floor), `data.js`, and `dashboard/` + `screenshots/` + `dossier.json` to `/output`. Node 22+, stdlib only, no network, deterministic.

---

Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
