# Token Radar 01 — build notes

## Entry

- `main.ts` — reads `/input/snapshot.json` (or `--input`), validates the snapshot's ten-field record (`tvl_usd`, not `tvl`; `mcap_usd`, not `fdv`; plus `gecko_id`, `symbol`, `watchlist`), builds the board, and writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to `/output`. Exit 1 on a gate-shaped board or fewer than three screenshots.
- `lib/model.ts` — model `radar-3-category-comps`.
  - Pre-token = `mcap_usd`, `gecko_id` and `symbol` all null.
  - Base multiple = median `mcap_usd / tvl_usd` of tokenized protocols in the category (3+ comps), clamped 0.05–0.80; otherwise the global median (0.2138 over 128 comps); else 0.25.
  - Implied = `tvl_usd × base × (1 + clamp(change_7d, -60, 120)/100 × 0.5) × (0.6 + min(age_days, 1095)/1095 × 0.4)`; unknown age is 365 days; result rounded to a positive dollar.
  - Early rows use the same subject filter as the watchlist: no CEX, Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking or Restaked BTC, no versioned names, no wrapped/staked/staking names, no exchange products. This leaves 138 early subjects below the floor rather than 160 raw pre-token records full of wrapped and bridged products.
  - Six farm steps per row: capital by TVL band, hold by age, action by category, plus the snapshot's own 7-day change and implied value.
- `dashboard/` — `index.html`, `app.css`, `app.js`; no framework, no fetch, no network address in the source. Board, detail, filter and live views; hash routes (`#board`, `#detail/<slug>`, `#filter?category=…`, `#live`). Farm steps come from the data, not a second implementation in the page.
- `vendor/makefun-board.ts` — copied byte-for-byte from the kit (sha256 `9ca51b6e5cd84fe46cb0efa61e2ea99365a1fb0e21f2b75e6007f977f0dc326e`); never edited.
- `screenshots/` — three real 1440×900 renders taken with headless Chrome from the output dashboard with the real `data.js`: `1-board.png`, `2-detail.png` (Steakhouse Financial), `3-filtered.png` (category Lending).

## Verified on the real kit snapshot

- `node main.ts` twice into two clean output dirs: `diff -r` identical. DETERMINISTIC-OK.
- `board.json`: 178 rows; watchlist covered 40/40; ranks 1..178; implied values strictly descending; 6 farm steps per row (124–223 chars); every value positive.
- Top rows: Steakhouse Financial $464,917,576; Gauntlet $276,897,852; Veda $266,216,989; USDD $144,565,339; Upshift $95,509,574.
- 14 categories use their own median: Lending 0.1324, Dexs 0.3424, Liquid Staking 0.0500 (clamped), Yield 0.1914, CEX 0.0748, RWA 0.2748, Canonical Bridge 0.7464, Basis Trading 0.6544, Bridge 0.5567, Cross Chain Bridge 0.8000 (clamped), Yield Aggregator 0.1510, Indexes 0.1477, CDP 0.1687, Privacy 0.8000 (clamped). The rest borrow the global 0.2138.
- `dossier.json`: 1,017,134 bytes (cap 1.5 MiB); text 48,452 bytes (cap 65,536); 3 images, each 220,943–261,298 bytes and 1440×900 (caps 512 KiB, long side 1440, short side 800).
- No API key, wallet key or secret is stored in the repository or used by the program.

## Transcripts

The uploaded session is the pi session that wrote `main.ts`, `lib/model.ts` and all three `dashboard/` files. Bundle command used from the unpacked kit:

```sh
node cli/makefun.mjs bundle \
  --repo <this repository> \
  --out transcripts.tar.gz \
  --harness pi --harness-version 1.5.1 \
  --provider deepseek --model deepseek-v4.1-flash --effort high \
  --mcp none
```

`bundle --dry-run` finds the session, the typed opening prompt, the system prompt in-session, one instruction file (`pi/settings.json`) and no MCP servers. The bundle redacts home paths, usernames, e-mail addresses and credentials on its own.

## Submission status

- The repository is public at `https://github.com/limitlessneverdies/token-radar-01` and the entry commits are pushed to `main`.
- The kit pre-submit `check` was run against the repository and the transcript bundle: **13 passed, 0 failed, 6 skipped**, and all five site-side checks (public, owner, created after the opening, commit pushed, distinct snapshot) are satisfied by the pushed public repository under `limitlessneverdies`.
- `transcripts.tar.gz` is the bundle built by the command above; it is a local upload artifact and is gitignored, not committed.
- The only remaining step is the signed `submit` call with the account's API key and wallet, through the kit's secure flow. The API key is never written to the repository or a command line.
