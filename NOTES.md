# Token Radar 01 — build notes (draft, NOT submitted)

- slug: token-radar-01 — "Build the best token launch radar"
- reward: $1,325 total, 10 paid places, 1st $1,000, 2nd–5th $50, 6th–10th $25
- deadline: 2026-12-14T10:00:00Z
- submissionCount at 2026-11-15 12:26 UTC: 5,798
- category: Trading, skills Node.js / Data visualization / DeFi
- status: open, escrow open, $1,325 locked on Solana
- GitHub: limitlessneverdies (confirmed by Kyle 2026-11-15), wallet linked (confirmed)
- repo name to use: token-radar-01 → https://github.com/limitlessneverdies/token-radar-01
- grader: `node /bot/main.ts` (Node 22), no network, /input read-only, /output writable, 120s, 1 CPU, 1024 MB, exit 0, deterministic

## Kit — downloaded 2026-11-15, no API key used

- Kit: `GET https://make.fun/c/token-radar-01/kit` → `~/workspace/makefun/kit/token-radar-01-kit/` (5.5 MB tarball, extracted). kit.json bundle sha256 ea1c9dccab78e6846655e81b921a79465c7267677ea2e0908624ddbc8a012d43.
- Real input: `input/snapshot.json`, as_of 2026-11-14, source DefiLlama https://api.llama.fi/protocols fetched 2026-11-14T01:18:33Z, floor $50,000,000, 758 protocols, watchlist 40, 342 pre-token (mcap+gecko+symbol all null).
- Real protocol fields (exactly 10, no others): slug, name, category (or null), chains[], tvl_usd, change_7d (or null), mcap_usd (or null), listed_at (or null), gecko_id (or null), symbol (or null). There is NO fdv field, NO hasToken flag, NO tvl field. Pre-token = mcap_usd AND gecko_id AND symbol all null.
- Board: `/output/board.json` is `{"rows": [...]}` — 100 to 4,000 rows, each with slug, name, rank (1..N, once each), implied_value_usd (positive integer, descending with rank, not all equal), farm_steps (3–12 strings, 20–600 chars each). Whole watchlist must be covered.
- Dossier: `/output/dossier.json` must be byte-for-byte what `buildDossier('/output', {text_max_bytes: 65536})` writes from dashboard/ + screenshots/, at most 1.5 MiB. Screenshots: 3–4 images, each ≤512 KiB, long side ≤1440, short side ≥800, PNG/JPEG.
- vendor/makefun-board.ts: copied byte-for-byte from the kit into `vendor/` (sha256 9ca51b6e5cd84fe46cb0efa61e2ea99365a1fb0e21f2b75e6007f977f0dc326e, matches kit). Do NOT edit it; the scorer runs the same file.
- Starter: the kit starter is the house's 2-plain anchor dashboard. Handing it in unchanged is an ordinary entry. The transcript gate counts only code the uploaded agent sessions wrote, so main.ts, lib/model.ts and dashboard/ were written by hand in this session, NOT copied from the starter.

## What was wrong in the first draft (fixed 2026-11-15)

- It read `tvl` / `fdv` / `mcap` fields that do not exist in the real snapshot (real fields are `tvl_usd` / `mcap_usd`, no FDV), so on real input every TVL was 0 and every implied value was 0 — the board would have failed the gate (all rows sharing one implied value).
- Its board.json shape was `{title, methodology, counts, model, rows}` with rows carrying `protocol`, `impliedFdvUsd`, `upsideMultiple`, `confidence`, `farmPlan` object. The gate wants `{"rows": [...]}` with `slug`, `name`, `rank`, `implied_value_usd`, `farm_steps` (strings).
- Its dossier.json was a hand-written summary object. The scorer rebuilds the dossier from /output with buildDossier and compares bytes — a hand-written dossier always fails.
- It had no vendor/makefun-board.ts, no data.js, and its dashboard was a single static HTML file with synthetic data baked in and no detail view.
- All of that is now fixed. The synthetic test-input/ and the synthetic root board.json / dossier.json were deleted.

## Current entry (2026-11-15, rewritten)

- `main.ts` — reads `/input/snapshot.json` (or `--input`), builds the board, writes `board.json` (`{"rows": [...]}`), `data.js`, copies `dashboard/` + `screenshots/` to output, writes `dossier.json` via buildDossier (text cap 65,536, screenshots max 4 / 512 KiB, dashboard max 400 files / 4 MiB). Exits 1 if fewer than 3 screenshots.
- `lib/model.ts` — model radar-2-category-mcap-tvl. Base multiple calibrated per category from the snapshot itself: median market-cap / TVL of tokenized protocols in that category (3+ comps, clamped 0.05–0.80, fallback global median 0.2049, then 0.25). Implied = TVL × base × (1 + clamp(change_7d, -60, 120)/100 × 0.5) × (0.6 + min(age_days, 1095)/1095 × 0.4), age unknown = 365 days. Board = whole watchlist (40) + 160 largest pre-token protocols below the floor = 200 rows. Farm plan: 6 steps per row, capital by TVL band ($50/$100/$150/$250), hold by age (30/45/60 days), action by category.
- `dashboard/` — index.html + app.css + app.js, written here, 10,086 bytes total (well under the 65,536-byte dossier text cap). Board table, click a row for detail + farm plan + model breakdown, filter by text, category dropdown, watchlist-only toggle, live-token comparison table (top 24 by market cap).
- `README.md` — badges fixed: owner limitlessneverdies, repo token-radar-01. Referral code NOT invented: the make.fun link has no `?ref=` parameter; add Kyle's real referral code (from `node cli/makefun.mjs referrals` in the kit) before submitting if he wants it.
- `screenshots/` — EMPTY except a `.gitkeep` (dot file, skipped by the copy step). No fake renders. See blockers.
- `output/` — local run artifact only: real board.json + data.js + dashboard copy from the real snapshot. NO dossier.json here (see test-only run below). Remove output/ before pushing, or gitignore it — the grader writes its own /output.

## Test results (real kit input, 2026-11-15)

- Node: v24.22.1 — satisfies the 22.18+ prerequisite (a newer major counts).
- Docker: NOT available in this VM (`docker: command not found`) — grader-style docker run NOT tested. See blockers.
- Browser: NONE in this VM (no chromium/firefox, no playwright) — screenshots NOT taken. See blockers.
- Repo run (no screenshots): `MAKEFUN_OUTPUT_DIR=/tmp/radar-out-repo node main.ts --input <kit>/input/snapshot.json` → exits 1, correctly: "screenshots/ holds 0 images: hand in 3, the board, a detail view and a filtered view".
- Test run with TEMP starter screenshots only (in /tmp/radar-test, NOT in the repo): two runs into separate output dirs, `diff -r` identical — DETERMINISTIC-OK.
  - board.json: 200 rows, watchlist covered 40/40, ranks 1..200, implied descending, 6 farm steps per row (20–600 chars), all implied > 0, 200 distinct implied values.
  - Top 5: steakhouse-financial $464,924,662; gauntlet $276,897,852; veda $266,216,989; usdd $144,565,339; upshift $95,509,574.
  - Base multiples actually used: 0.05, 0.1324, 0.1477, 0.151, 0.1687, 0.1914, 0.2138, 0.2748, 0.3424, 0.5567, 0.6544, 0.7464.
  - dossier.json: schema makefun/dossier/v1, cover 0, 3 images, text 10,346 bytes (cap 65,536), file 685,195 bytes (cap 1.5 MiB).
  - Full test output (with the temp starter screenshots, TEST-ONLY): `~/workspace/makefun/token-radar-01-run/output-test-only/` — see its README.md. Do NOT submit that dossier; its screenshots are the starter's, not this dashboard's.
- No API key was used or saved anywhere in this work. Grep of the entry tree for key values: clean.

## Blockers to submit — do NOT submit yet

1. **Screenshots (required).** 3 real renders of THIS dashboard, 1440×800-ish, each 300–350 KB recommended (cap 512 KiB): 1-board (full board), 2-detail (one protocol detail view open), 3-filtered (filter applied). No browser in this VM, so they must be taken on a machine with Chrome/Chromium/Firefox: open `output/dashboard/index.html` with the real `data.js` beside it (serve the output dir, e.g. `python3 -m http.server` in output/, or open the file directly), screenshot each view, save as `screenshots/1-board.png`, `2-detail.png`, `3-filtered.png` in the repo. Then re-run main.ts — it will copy them to /output and write the real dossier.json.
2. **Docker grader run (unverified).** No docker in this VM. Before submitting, run the grader-style command from the kit (see requirements, check run_completes) on a machine with docker, with the real /input mounted, twice, and confirm exit 0 and identical outputs.
3. **Transcripts — the big one.** This build was done in Muse subagent sessions, not a recorded Claude Code / Codex session the kit `bundle` reads. `handed_over_places` for this bounty is `none`: an entry with a handed-over session is ranked where it scores but takes NO paid place. Do NOT hand over. Rebuild in a recorded harness so it is prize-eligible:
   - Free option: Superbot (https://superbot.gg) — run on your own computer, it keeps sessions that `bundle` reads. In Superbot, open the repo, paste the rebuild prompt (see below), let it rewrite main.ts / lib/model.ts / dashboard/ in that recorded session (it must write the files again in that session — at least 30% of counted lines must trace to the sessions, at least one authored line in main.ts, and at least 2 assistant messages must write/edit some counted file), then run `bundle --dry-run` to check it finds the sessions.
   - Or: Claude Code (`claude -p` with `--permission-mode acceptEdits`) or Codex (`codex exec`) wrapped in the kit's recorder: `node cli/makefun.mjs record --competition token-radar-01 --source <repo dir> -- claude -p "<rebuild prompt>" ...` — only Claude Code and Codex sessions are recorded this way. Start the recording BEFORE the agent writes code, keep it running for every session.
   - The rebuild prompt (word for word, Kyle's words to the agent — bundle needs the opening prompt verbatim): "Finish the make.fun token-radar-01 entry in this repo for GitHub limitlessneverdies: rewrite main.ts, lib/model.ts and dashboard/ from the kit in ~/workspace/makefun/kit/token-radar-01-kit/ so the board uses the real snapshot format (tvl_usd, mcap_usd, gecko_id, symbol, watchlist), the model calibrates its base multiple per category from tokenized comps, and the dashboard has board, detail, filter and live views. Take the 3 screenshots, run it twice for determinism, and bundle the transcripts." (Adjust paths to the machine the rebuild runs on.)
   - Then verify the bundle: from inside the unpacked kit, `node cli/makefun.mjs bundle --dry-run` (lists sessions found), then `node cli/makefun.mjs check --transcripts <bundle>` if available. Bundle must include the top-level session AND every subagent session, each whole, with timestamps and provider usage. Do not write or rebuild a session log by hand.
4. **GitHub repo (not created yet).** Create AFTER 2026-11-14T10:00:00Z (now is fine — any creation from now on qualifies), public, under limitlessneverdies, named token-radar-01. Do not reuse an older repo.
5. **API key via secure flow.** The key Kyle pasted in chat was NOT saved here and must NOT be pasted into any file or command line. At submission time, provide it through the secure entry flow / the kit's sign-in, and use the kit CLI to submit (it signs the entry message with a wallet on the account).

## Exact next commands (run on a machine with Node 22.18+, docker, a browser, and a recorded harness)

```sh
# 1. Create the repo (GitHub CLI, signed in as limitlessneverdies)
gh repo create limitlessneverdies/token-radar-01 --public \
  --description 'Token Launch Radar — rank pre-token DeFi protocols by implied launch value. Built by an AI agent for make.fun'"'"'s “Build the best token launch radar” bounty, $1,325 in USDC.'
cd token-radar-01
# copy in: main.ts lib/ vendor/ dashboard/ screenshots/ LICENSE README.md NOTES.md
# (do NOT copy output/ or token-radar-01-run/ — local artifacts only)

# 2. Set GitHub About (required)
gh repo edit limitlessneverdies/token-radar-01 \
  --description 'Token Launch Radar — rank pre-token DeFi protocols by implied launch value. Built by an AI agent for make.fun'"'"'s “Build the best token launch radar” bounty, $1,325 in USDC.' \
  --homepage 'https://make.fun/bounty/token-radar-01' \
  --add-topic 'makefun,ai-agents,bounties,trading'

git add -A && git commit -m 'Token Launch Radar: category-calibrated implied-value board, 200 rows' && git push -u origin main
# note the full 40-char commit sha for the submit step

# 3. Screenshots (browser, on that machine): open output/dashboard/index.html
# with data.js beside it, capture 1-board.png, 2-detail.png, 3-filtered.png
# into screenshots/, then re-run main.ts so /output/dossier.json is real:
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ~/workspace/makefun/kit/token-radar-01-kit/input/snapshot.json
# run it twice into two dirs and diff -r them — must be identical

# 4. Grader-style docker run (from the kit / requirements, check run_completes):
# docker run --rm --network none --cap-drop ALL --security-opt no-new-privileges \
#   --read-only --tmpfs /tmp:rw,size=256m -u 65534:65534 --memory 1024m \
#   --memory-swap 1024m --cpus 1 --pids-limit 64 -e TZ=UTC -e PYTHONHASHSEED=0 \
#   -e LANG=C.UTF-8 -e MAKEFUN_BOT_DIR=/bot -v <repo>:/bot:ro \
#   -v "$PWD/input":/input:ro -v <out>:/output \
#   -e MAKEFUN_INPUT_DIR=/input -e MAKEFUN_OUTPUT_DIR=/output \
#   --entrypoint node node@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d /bot/main.ts
# (fill in <repo>, input dir and <out>; chmod 777 the output dir first so uid 65534 can write it)

# 5. Bundle transcripts (recorded harness only — see blocker 3), from inside the unpacked kit:
# node cli/makefun.mjs bundle --repo <repo dir> --system-prompt <file-or-withheld-line> --effort <effort> --out transcripts.tar.gz
# node cli/makefun.mjs bundle --dry-run   # check what it finds first

# 6. Submit (kit CLI signs with a wallet on Kyle's account; API key via secure flow, never pasted):
# node cli/makefun.mjs submit --competition token-radar-01 \
#   --repo-url https://github.com/limitlessneverdies/token-radar-01 \
#   --commit <full 40-char sha> --title 'Token Launch Radar' \
#   --bundle transcripts.tar.gz --keypair <wallet keypair file>
# Quota: max 5/day, 10 total for this bounty. Deadline 2026-12-14T10:00:00Z.
```

## Board scan (2026-11-15 12:26 UTC crawl, deadlines after 2026-11-15 12:30 UTC)
- token-radar-01: $1,325, Dec 14, 5,798 subs, 10 places, 1st $1,000 — CHOSEN
- tiny-chess-01: $500, Nov 24 17:00, 7,848 subs, Games, open — strongest chess engine in 4KB Python, metric-based, very low win chance
- btc-race-24h-20261115-0828: $250, Nov 15 14:28 UTC, 2,748 subs, Trading, open — live race, dev-gate, hours left
- bring-the-humans-01: $1,000, Nov 16 18:00, 3,079 subs, Growth, referral/v1 — ranked by referrals/signups, needs distribution
- free-model-aggregator-01: $500, Nov 16 02:30, 5,851 subs, Code, open — ~14h left
- github-core-clone-01: $500, Nov 21 06:30, 4,370 subs, Code — build a GitHub-compatible git forge, huge scope
- Polymarket FAA outage forecast: $250, forecast window Nov 14–16, entry deadline already passed — not enterable
- xStocks forecast: race ends Nov 16, entry deadline Nov 9/10 — not enterable
- Roblox game: $250 — needs Roblox Studio on Windows/macOS + publishable Roblox account, this VM is Linux, excluded
- All other Growth/design/joke/news/sticker/cutest-picture bounties in scan: deadlines Nov 9–14, resolved/expired
