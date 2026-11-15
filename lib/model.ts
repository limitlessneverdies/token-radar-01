// Token Radar model: one sealed DefiLlama snapshot in, one ranked board out.
//
// The snapshot's protocol record has exactly ten fields, and the model uses
// only those: slug, name, category, chains, tvl_usd, change_7d, mcap_usd,
// listed_at, gecko_id and symbol. There is no fdv field and no tvl field;
// pre-token means the record carries no token at all, so mcap_usd, gecko_id
// and symbol are all null. The watchlist is the floor, never the ceiling.
//
// The kit starter prices every TVL dollar at one fixed 0.25 multiple. This
// model calibrates the base multiple per category from the snapshot itself:
//
//   base(category) = clamp(median(mcap_usd / tvl_usd of tokenized protocols
//                            in that category), 0.05, 0.80)
//
// A category needs at least three tokenized comps to set its own multiple;
// with fewer, it falls back to the global median across every tokenized
// protocol in the snapshot. The snapshot has 128 such comps and a global
// median of about 0.2138, so a DEX (about 0.34) and a lending market (about
// 0.13) no longer receive the same price per TVL dollar.
//
//   growth      = clamp(change_7d, -60, 120) percent
//   growthMult  = 1 + (growth / 100) x 0.5
//   maturity    = 0.6 + min(age_days, 1095) / 1095 x 0.4   (unknown age: 365)
//   implied     = max(1, round(tvl_usd x base x growthMult x maturity))
//
// Everything is deterministic: no clock, no network, no randomness. The only
// date is the snapshot's own as_of. The page renders the same numbers that
// board.json carries, including the farm plan.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The constants of the model, stated in the page and used by every row. */
export const MODEL_VERSION = 'radar-3-category-comps';
export const MIN_COMPS = 3;
export const BASE_FLOOR = 0.05;
export const BASE_CEIL = 0.8;
export const GLOBAL_FALLBACK = 0.25;
export const GROWTH_WEIGHT = 0.5;
export const GROWTH_FLOOR = -60;
export const GROWTH_CAP = 120;
export const MATURITY_FLOOR = 0.6;
export const MATURITY_RANGE = 0.4;
export const MATURITY_DAYS = 1095;
export const UNKNOWN_AGE_DAYS = 365;

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

/** How many live-token comparables the live view carries, by market cap. */
export const LIVE_ROWS = 24;

const DAY_MS = 86_400_000;
const OTHER_CATEGORY = 'Other';

/** One category's calibration, including the evidence behind its multiple. */
export interface CategoryCalibration {
  /** The category the snapshot names, or "Other" for a null category. */
  category: string;
  /** Tokenized protocols in this category with a positive market cap and TVL. */
  comps: number;
  /** Median market-cap / TVL of those comps, before clamping. */
  median_multiple: number | null;
  /** The multiple the model actually applies to this category. */
  base_multiple: number;
  /** "category" when the category had enough comps, else "global". */
  source: 'category' | 'global';
  /** True when the category median was outside 0.05-0.80 and was clamped. */
  clamped: boolean;
}

export interface Calibration {
  global: CategoryCalibration;
  byCategory: Map<string, CategoryCalibration>;
  categories: CategoryCalibration[];
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    category_multiple: number | null;
    comps: number;
    calibration: 'category' | 'global';
    clamped: boolean;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's view of one board row; farm steps are carried, not rebuilt in the page. */
export interface RadarRow extends BoardRow {
  watchlist: boolean;
}

/** A token-bearing protocol shown beside the board, at the market's own figures. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  age_days: number | null;
  /** mcap_usd / tvl_usd, or null when either is missing. */
  multiple: number | null;
}

/** Everything dashboard/app.js reads from window.RADAR. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  model: {
    min_comps: number;
    base_floor: number;
    base_ceil: number;
    growth_weight: number;
    growth_floor: number;
    growth_cap: number;
    maturity_floor: number;
    maturity_range: number;
    maturity_days: number;
    unknown_age_days: number;
    global_base: number;
    global_comps: number;
    global_median: number | null;
  };
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  categories: CategoryCalibration[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function round(n: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(n * factor) / factor;
}

/** Thousands separators without Intl, so the text is identical on every build. */
function usd(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** The number of whole days from listed_at to the snapshot's as_of. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const end = Date.parse(`${asOf}T00:00:00Z`);
  const start = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(end) || !Number.isFinite(start)) return null;
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}

/** Pre-token means the snapshot records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;

/**
 * Products that are not subjects in their own right: exchanges, bridges,
 * liquid-staking and restaking wrappers, versioned pools, and names that say
 * they are a wrapped or staked version of a token that already trades. The
 * watchlist already applies this rule; the same rule keeps the early rows
 * honest when the board looks below the floor.
 */
const NON_SUBJECT_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'CEX',
  'Liquid Restaking',
  'Liquid Staking',
  'Restaked BTC',
]);

export function isRadarSubject(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && NON_SUBJECT_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/**
 * Calibrate one base multiple per category from the snapshot's own tokenized
 * comps. Categories with fewer than MIN_COMPS comps use the global median.
 */
export function calibrateBaseMultiples(protocols: SnapshotProtocol[]): Calibration {
  const groups = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    all.push(ratio);
    const key = p.category ?? OTHER_CATEGORY;
    const bucket = groups.get(key) ?? [];
    bucket.push(ratio);
    groups.set(key, bucket);
  }

  const globalRaw = all.length > 0 ? median(all) : GLOBAL_FALLBACK;
  const globalBase = round(clamp(globalRaw, BASE_FLOOR, BASE_CEIL), 4);
  const global: CategoryCalibration = {
    category: 'All tokenized protocols',
    comps: all.length,
    median_multiple: round(globalRaw, 4),
    base_multiple: globalBase,
    source: 'global',
    clamped: round(globalRaw, 4) !== globalBase,
  };

  const byCategory = new Map<string, CategoryCalibration>();
  const categories: CategoryCalibration[] = [];
  for (const [category, ratios] of [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const raw = median(ratios);
    const enough = ratios.length >= MIN_COMPS;
    const appliedRaw = enough ? raw : globalBase;
    const applied = round(clamp(appliedRaw, BASE_FLOOR, BASE_CEIL), 4);
    const cal: CategoryCalibration = {
      category,
      comps: ratios.length,
      median_multiple: round(raw, 4),
      base_multiple: applied,
      source: enough ? 'category' : 'global',
      clamped: enough && round(raw, 4) !== applied,
    };
    byCategory.set(category, cal);
    categories.push(cal);
  }
  return { global, byCategory, categories };
}

/** The calibration a category actually receives, including the global fallback. */
export function calibrationFor(calibration: Calibration, category: string | null): CategoryCalibration {
  const key = category ?? OTHER_CATEGORY;
  const found = calibration.byCategory.get(key);
  if (found !== undefined) return found;
  return { ...calibration.global, category: key };
}

/** Score one protocol at one base multiple. */
export function impliedValue(
  p: SnapshotProtocol,
  asOf: string,
  baseMultiple: number,
): { implied: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, p.listed_at);
  const growthPct = clamp(p.change_7d ?? 0, GROWTH_FLOOR, GROWTH_CAP);
  const growthMult = 1 + (growthPct / 100) * GROWTH_WEIGHT;
  const ageForModel = age ?? UNKNOWN_AGE_DAYS;
  const maturityMult = MATURITY_FLOOR + (Math.min(Math.max(ageForModel, 0), MATURITY_DAYS) / MATURITY_DAYS) * MATURITY_RANGE;
  const implied = Math.max(1, Math.round(p.tvl_usd * baseMultiple * growthMult * maturityMult));
  return { implied, growthPct, growthMult, maturityMult, age };
}

function capitalFor(tvlUsd: number): number {
  if (tvlUsd >= 5_000_000_000) return 250;
  if (tvlUsd >= 1_000_000_000) return 150;
  if (tvlUsd >= 100_000_000) return 100;
  return 50;
}

function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const category = (p.category ?? '').toLowerCase();
  if (category.includes('lend') || category.includes('cdp') || category.includes('collateral')) {
    return `Supply $${capital} of USDC to ${p.name} on ${chain} and keep the position open.`;
  }
  if (category.includes('dex') || category.includes('yield') || category.includes('farm')) {
    return `Provide $${capital} of liquidity to ${p.name}'s main pool on ${chain} and keep the position open.`;
  }
  if (category.includes('bridge')) {
    return `Bridge $${capital} of USDC to ${chain} through ${p.name} and use the bridged funds in its app.`;
  }
  if (category.includes('staking') || category.includes('restak')) {
    return `Stake $${capital} of the chain's staking asset through ${p.name} and keep the receipt.`;
  }
  if (category.includes('perpetual') || category.includes('derivative')) {
    return `Deposit $${capital} of USDC as margin on ${p.name} and open one small hedge.`;
  }
  if (category.includes('prediction')) {
    return `Fund $${capital} and place one market position on ${p.name}.`;
  }
  if (category.includes('stable') || category.includes('basis')) {
    return `Mint or deposit $${capital} of the protocol's stable asset through ${p.name} on ${chain}.`;
  }
  if (category.includes('rwa')) {
    return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  }
  if (category.includes('insurance')) {
    return `Buy $${capital} of cover from ${p.name} on ${chain} and keep the policy.`;
  }
  if (category.includes('risk') || category.includes('allocator') || category.includes('curator')) {
    return `Deposit $${capital} of USDC into a ${p.name} vault on ${chain} and keep the position open.`;
  }
  return `Deposit $${capital} of USDC into ${p.name} on ${chain} and keep the position open.`;
}

function growthNote(p: SnapshotProtocol, growthMult: number): string {
  if (p.change_7d === null) {
    return `The snapshot records no 7-day TVL change for this protocol, so the growth multiplier stays at ${round(growthMult, 4).toFixed(4)} and you should not add size on momentum.`;
  }
  const pct = round(clamp(p.change_7d, GROWTH_FLOOR, GROWTH_CAP), 2);
  const sign = pct >= 0 ? '+' : '';
  return `The snapshot's 7-day TVL change is ${sign}${pct}%, so the growth multiplier is ${round(growthMult, 4).toFixed(4)}; keep the weekly action only while that change stays positive.`;
}

function clip(step: string): string {
  return step.length > 600 ? `${step.slice(0, 596)}...` : step;
}

/** Six concrete steps per row, each 20-600 characters, derived from the row's own record. */
export function farmSteps(
  p: SnapshotProtocol,
  age: number | null,
  implied: number,
): string[] {
  const chain = p.chains.length > 0 ? p.chains[0]! : 'its main chain';
  const capital = capitalFor(p.tvl_usd);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const gas = capital >= 150 ? 8 : 4;
  const steps = [
    `Open a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline. Cost: under $3 of gas for the first transaction; time: 5 minutes.`,
    `${action} Cost: $${capital} of capital and about $${gas} of gas; time: 15 minutes to set up.`,
    `${growthNote(p, 1 + (clamp(p.change_7d ?? 0, GROWTH_FLOOR, GROWTH_CAP) / 100) * GROWTH_WEIGHT)} Cost: about $2 of gas a week; time: 10 minutes a week.`,
    `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot. Cost: the $${capital} stays in the position; time: ${hold} days.`,
    `Before you withdraw, open ${p.name}'s own site or app and check its points or rewards page; claim only from the link the protocol publishes. Cost: no fee to check, and never pay to claim; time: 10 minutes.`,
    `Write the wallet, the dates and every transaction in a farm log, and note this snapshot's implied value of $${usd(implied)} so you can repeat or unwind the position. Cost: nothing but the log; time: 5 minutes.`,
  ];
  return steps.map(clip);
}

function boardProtocols(snapshot: Snapshot): { chosen: SnapshotProtocol[]; earlyCount: number } {
  const watchlist = new Set(snapshot.watchlist);
  const seen = new Set<string>();
  const chosen: SnapshotProtocol[] = [];
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p === undefined || seen.has(slug)) continue;
    seen.add(slug);
    chosen.push(p);
  }
  const early = snapshot.protocols
    .filter((p) => !watchlist.has(p.slug) && isRadarSubject(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) {
    if (seen.has(p.slug)) continue;
    seen.add(p.slug);
    chosen.push(p);
  }
  return { chosen, earlyCount: chosen.length - snapshot.watchlist.filter((s) => index.has(s)).length };
}

/** Build the ranked board: the whole watchlist, then the largest pre-token subjects below the floor. */
export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const calibration = calibrateBaseMultiples(snapshot.protocols);
  const watchlist = new Set(snapshot.watchlist);
  const { chosen } = boardProtocols(snapshot);
  const scored = chosen.map((p) => {
    const cal = calibrationFor(calibration, p.category);
    const value = impliedValue(p, snapshot.as_of, cal.base_multiple);
    return { p, cal, value, watch: watchlist.has(p.slug) };
  });
  scored.sort((a, b) => {
    if (b.value.implied !== a.value.implied) return b.value.implied - a.value.implied;
    if (a.watch !== b.watch) return a.watch ? -1 : 1;
    if (b.p.tvl_usd !== a.p.tvl_usd) return b.p.tvl_usd - a.p.tvl_usd;
    return a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0;
  });
  return scored.map(({ p, cal, value, watch }, index) => ({
    rank: index + 1,
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    mcap_usd: p.mcap_usd,
    listed_at: p.listed_at,
    gecko_id: p.gecko_id,
    symbol: p.symbol,
    token_status: 'pre-token' as const,
    watchlist: watch,
    age_days: value.age,
    implied_value_usd: value.implied,
    model: {
      base_multiple: cal.base_multiple,
      category_multiple: cal.median_multiple,
      comps: cal.comps,
      calibration: cal.source,
      clamped: cal.clamped,
      growth_pct: round(value.growthPct, 2),
      growth_multiplier: round(value.growthMult, 4),
      maturity_multiplier: round(value.maturityMult, 4),
      age_days: value.age,
    },
    farm_steps: farmSteps(p, value.age, value.implied),
  }));
}

/** Live-token protocols beside the board: the market's own figures, never the model's. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      age_days: ageDays(snapshot.as_of, p.listed_at),
      multiple: p.mcap_usd !== null && p.tvl_usd > 0 ? round(p.mcap_usd / p.tvl_usd, 4) : null,
    }));
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const calibration = calibrateBaseMultiples(snapshot.protocols);
  const board = buildBoard(snapshot);
  const live = liveRows(snapshot);
  const watchlist = new Set(snapshot.watchlist);
  const early = board.filter((row) => !watchlist.has(row.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    model: {
      min_comps: MIN_COMPS,
      base_floor: BASE_FLOOR,
      base_ceil: BASE_CEIL,
      growth_weight: GROWTH_WEIGHT,
      growth_floor: GROWTH_FLOOR,
      growth_cap: GROWTH_CAP,
      maturity_floor: MATURITY_FLOOR,
      maturity_range: MATURITY_RANGE,
      maturity_days: MATURITY_DAYS,
      unknown_age_days: UNKNOWN_AGE_DAYS,
      global_base: calibration.global.base_multiple,
      global_comps: calibration.global.comps,
      global_median: calibration.global.median_multiple,
    },
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((row) => ({ ...row, watchlist: row.watchlist })),
    live,
    categories: calibration.categories,
  };
  return { board, radar };
}

/** Read and validate the sealed snapshot without trusting any of its fields. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SnapshotError('snapshot.json is not a JSON object');
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) {
    throw new SnapshotError('snapshot.json has no as_of date');
  }
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) {
    throw new SnapshotError('snapshot.json has no floor_usd');
  }
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) {
    throw new SnapshotError('snapshot.json has no watchlist of slugs');
  }
  const protocols = o.protocols.map((value, index) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new SnapshotError(`snapshot.json's protocol ${index} is not an object`);
    }
    const p = value as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${index} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** The gate's shape: coverage, ranks, order, distinct values and farm-step limits. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100 to 4,000`;
  const slugs = new Set(board.map((row) => row.slug));
  const missing = snapshot.watchlist.filter((slug) => !slugs.has(slug));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slugs: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((row) => row.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) {
    if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  }
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value`;
  }
  for (const row of board) {
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) return `${row.slug} has ${row.farm_steps.length} farm steps`;
    for (const step of row.farm_steps) {
      const trimmed = step.trim();
      if (trimmed.length < 20 || trimmed.length > 600) return `${row.slug} has a farm step of ${trimmed.length} characters`;
    }
    if (!Number.isSafeInteger(row.implied_value_usd) || row.implied_value_usd <= 0) return `${row.slug} has implied value ${row.implied_value_usd}`;
    if (row.implied_value_usd > 100_000_000_000_000) return `${row.slug} has an implied value past the cap`;
  }
  return null;
}

/** The dashboard's data file: one assignment, no network and no fetch. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
