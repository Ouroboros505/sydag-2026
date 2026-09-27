/** Turn predicted bushels into predicted dollars per acre, and choose what to advance.
 *
 * margin = yield × price − drying − lodging loss
 *   drying  = max(0, moisture − target) × cost per point per bushel × yield
 *   lodging = lodged share × loss fraction × yield × price
 *
 * Deliberately simple and fully visible. Every term is a number the user can move.
 */
import type { Candidate, EngineId, EngineValueRow, PriceDefaults, SeasonLines, SeasonPlots } from './types'

export interface Prices extends PriceDefaults {}

export interface Breakdown { gross: number; drying: number; lodging: number }

export function breakdown(c: Candidate, p: Prices): Breakdown {
  const gross = c.pred_yield * p.corn_price
  const drying = Math.max(0, c.pred_mst - p.target_moisture) * p.drying_cost_per_point * c.pred_yield
  const lodging = (c.pred_lodging / 100) * p.lodging_loss_fraction * c.pred_yield * p.corn_price
  return { gross, drying, lodging }
}

export function marginPerAcre(c: Candidate, p: Prices): number {
  const b = breakdown(c, p)
  return b.gross - b.drying - b.lodging
}

export interface Scored extends Candidate {
  margin: number
  rankByMargin: number
  rankByYield: number
}

/** Sorted by margin, descending, with both ranks attached. */
/** The same candidates as another engine sees them. 2-Step's numbers are the defaults;
 *  the benchmark engine swaps in its own yield, moisture and lodging, and its one 90% band. */
export function withEngine(cands: Candidate[], engine: EngineId, half90 = 0): Candidate[] {
  if (engine !== 'gblup') return cands
  return cands.map((c) => (c.gy == null ? c : {
    ...c, pred_yield: c.gy, pred_mst: c.gm ?? c.pred_mst, pred_lodging: c.gl ?? c.pred_lodging,
    lo: c.gy - half90, hi: c.gy + half90,
  }))
}

export function score(cands: Candidate[], p: Prices): Scored[] {
  // sorts on index arrays and copies each line once: this runs on every price-slider move
  const n = cands.length
  const margin = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const c = cands[i]
    margin[i] = c.pred_yield * p.corn_price
      - Math.max(0, c.pred_mst - p.target_moisture) * p.drying_cost_per_point * c.pred_yield
      - (c.pred_lodging / 100) * p.lodging_loss_fraction * c.pred_yield * p.corn_price
  }
  const byM = Array.from({ length: n }, (_, i) => i).sort((a, b) => margin[b] - margin[a])
  const byY = Array.from({ length: n }, (_, i) => i).sort((a, b) => cands[b].pred_yield - cands[a].pred_yield)
  const rankY = new Int32Array(n)
  for (let r = 0; r < n; r++) rankY[byY[r]] = r + 1
  const out: Scored[] = new Array(n)
  for (let r = 0; r < n; r++) {
    const i = byM[r]
    out[r] = { ...cands[i], margin: margin[i], rankByMargin: r + 1, rankByYield: rankY[i] }
  }
  return out
}

/** Advancement order under a per-family cap. Greedy in ranking order, so the first k of the
 *  result is the advanced set for every budget k, so one pass serves the whole frontier. */
export function advanceOrder(ranked: Scored[], cap: number): Scored[] {
  if (!Number.isFinite(cap)) return ranked
  const n = new Map<string, number>()
  const out: Scored[] = []
  for (const c of ranked) {
    const k = n.get(c.family) ?? 0
    if (k < cap) { out.push(c); n.set(c.family, k + 1) }
  }
  return out
}

/** Every family gets the same share of its lines advanced (largest-remainder rounding, so exactly
 *  k in total); inside a family the best lines by the given order. Returned in that order. The
 *  backtest's cheapest way to buy breadth in a year when the family call is weak. */
export function evenShare(ranked: Scored[], k: number): Scored[] {
  const n = ranked.length
  if (!n) return []
  const size = new Map<string, number>()
  for (const c of ranked) size.set(c.family, (size.get(c.family) ?? 0) + 1)
  const quota = new Map<string, number>()
  const rest: [string, number][] = []
  let used = 0
  for (const [f, s] of size) {
    const exact = (Math.min(k, n) * s) / n
    quota.set(f, Math.floor(exact))
    used += Math.floor(exact)
    rest.push([f, exact - Math.floor(exact)])
  }
  rest.sort((a, b) => b[1] - a[1])
  for (let i = 0; i < Math.min(k, n) - used && i < rest.length; i++) quota.set(rest[i][0], (quota.get(rest[i][0]) ?? 0) + 1)
  const taken = new Map<string, number>()
  const out: Scored[] = []
  for (const c of ranked) {
    const t = taken.get(c.family) ?? 0
    if (t < (quota.get(c.family) ?? 0)) { out.push(c); taken.set(c.family, t + 1) }
  }
  return out
}

export function byYieldOrder(scored: Scored[]): Scored[] {
  return [...scored].sort((a, b) => b.pred_yield - a.pred_yield)
}

export function populationMean(scored: Scored[]): number {
  return scored.reduce((s, c) => s + c.margin, 0) / (scored.length || 1)
}

export interface FrontierPoint {
  k: number
  byMargin: number   // $/acre over the population mean, advanced set chosen by margin
  byYield: number    // same, chosen by yield
}

/** Expected gain per advanced acre versus advancing at random, for both rankings:
 *  the selection differential, priced. Both respect the same family cap. */
export function frontier(scored: Scored[], cap: number, step = 1, yieldOrder?: Scored[]): FrontierPoint[] {
  const mean = populationMean(scored)
  const m = advanceOrder(scored, cap)
  const y = advanceOrder(yieldOrder ?? byYieldOrder(scored), cap)
  const n = Math.min(m.length, y.length)
  const out: FrontierPoint[] = []
  let cm = 0
  let cy = 0
  for (let i = 0; i < n; i++) {
    cm += m[i].margin
    cy += y[i].margin
    const k = i + 1
    if (k % step === 0 || k === n || k === 1) out.push({ k, byMargin: cm / k - mean, byYield: cy / k - mean })
  }
  return out
}

export interface Diversity {
  families: number            // distinct families in the advanced set
  effective: number           // 1 / Σ p², the number of equally-sized families it behaves like
  largestShare: number        // share of the advanced set taken by the biggest family
}

export function diversity(set: Scored[]): Diversity {
  const n = new Map<string, number>()
  for (const c of set) n.set(c.family, (n.get(c.family) ?? 0) + 1)
  const total = set.length || 1
  let sumSq = 0
  let max = 0
  for (const v of n.values()) { sumSq += (v / total) ** 2; max = Math.max(max, v) }
  return { families: n.size, effective: sumSq ? 1 / sumSq : 0, largestShare: max / total }
}

export interface Summary {
  gainByMargin: number
  gainByYield: number
  gap: number
  swapCount: number
  advanced: Scored[]          // the advanced set, in order
  diversity: Diversity
  capCost: number             // $/acre given up by the family cap (0 when uncapped)
}

export function summarize(scored: Scored[], k: number, cap: number, even = false, yieldOrder?: Scored[]): Summary {
  const mean = populationMean(scored)
  const avg = (xs: Scored[]) => xs.reduce((s, c) => s + c.margin, 0) / (xs.length || 1)
  const byYield = yieldOrder ?? byYieldOrder(scored)   // pass it in: sorting 16k lines per call adds up
  const advanced = even ? evenShare(scored, k) : advanceOrder(scored, cap).slice(0, k)
  const yieldSet = even ? evenShare(byYield, k) : advanceOrder(byYield, cap).slice(0, k)
  const uncapped = scored.slice(0, k)
  const inYield = new Set(yieldSet.map((c) => c.id))
  const gainByMargin = avg(advanced) - mean
  const gainByYield = avg(yieldSet) - mean
  return {
    gainByMargin,
    gainByYield,
    gap: gainByMargin - gainByYield,
    swapCount: advanced.filter((c) => !inYield.has(c.id)).length,
    advanced,
    diversity: diversity(advanced),
    capCost: even || Number.isFinite(cap) ? avg(uncapped) - avg(advanced) : 0,
  }
}

/** The same $/acre arithmetic on what the field actually said, when the cohort was held out.
 *  Lodging falls back to the prediction when the plots were not scored for it. */
export function actualMargin(c: Candidate, p: Prices): number | null {
  if (c.actual_yield == null || c.actual_mst == null) return null
  const y = c.actual_yield
  const lodg = c.actual_lodging ?? c.pred_lodging
  return y * p.corn_price
    - Math.max(0, c.actual_mst - p.target_moisture) * p.drying_cost_per_point * y
    - (lodg / 100) * p.lodging_loss_fraction * y * p.corn_price
}

export interface Backtest {
  n: number                 // candidates with real results
  mean: number              // realised $/acre of the average candidate
  byMargin: number          // realised $/acre of the $-ranked advanced set, over that mean
  byYield: number           // same for the bushel-ranked set
  oracle: number            // the true top k, with hindsight, over that mean
  topRecovered: number      // share of the true top k that the advanced set contains
  chance: number            // what topRecovered would be at random: k / n
  r: number                 // correlation, predicted $/acre vs realised
  rYield: number            // the same for yield alone
  deciles: number[]         // realised $/acre over the mean, by decile of predicted $/acre, best first
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 3) return 0
  const mx = xs.reduce((s, v) => s + v, 0) / n
  const my = ys.reduce((s, v) => s + v, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2 }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0
}

/** The parts of the backtest that depend only on prices: computed once per price change. */
export interface BacktestBase {
  n: number
  mean: number
  act: Map<string, number>        // realised $/acre per line
  actRank: Map<string, number>    // 0 = the line that really earned the most
  cumTop: Float64Array            // running sum of realised $/acre, best first
  deciles: number[]
  r: number
  rYield: number
}

export function backtestBase(scored: Scored[], p: Prices): BacktestBase | null {
  const rows: { id: string; pred: number; act: number }[] = []
  for (const c of scored) {
    const act = actualMargin(c, p)
    if (act != null) rows.push({ id: c.id, pred: c.margin, act })
  }
  if (rows.length < 20) return null
  const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / (xs.length || 1)
  const mean = avg(rows.map((r) => r.act))
  const byActual = [...rows].sort((a, b) => b.act - a.act)
  const cumTop = new Float64Array(byActual.length)
  let run = 0
  byActual.forEach((r, i) => { run += r.act; cumTop[i] = run })
  const withYield = scored.filter((c) => c.actual_yield != null)
  const deciles: number[] = []   // scored is already in predicted-$ order
  for (let d = 0; d < 10; d++) {
    const slice = rows.slice(Math.floor((d * rows.length) / 10), Math.floor(((d + 1) * rows.length) / 10))
    deciles.push(avg(slice.map((r) => r.act)) - mean)
  }
  return {
    n: rows.length, mean,
    act: new Map(rows.map((r) => [r.id, r.act])),
    actRank: new Map(byActual.map((r, i) => [r.id, i])),
    cumTop, deciles,
    r: pearson(rows.map((r) => r.pred), rows.map((r) => r.act)),
    rYield: pearson(withYield.map((c) => c.pred_yield), withYield.map((c) => c.actual_yield as number)),
  }
}

/** Score the advancement decision against the cohort's real field results: cheap, per budget. */
export function backtest(base: BacktestBase, advanced: Scored[], yieldSet: Scored[]): Backtest {
  const setGain = (xs: Scored[]) => {
    let s = 0, n = 0
    for (const c of xs) { const a = base.act.get(c.id); if (a != null) { s += a; n++ } }
    return n ? s / n - base.mean : 0
  }
  const k = Math.min(advanced.length, base.n)
  let hits = 0
  for (const c of advanced) { const r = base.actRank.get(c.id); if (r != null && r < k) hits++ }
  return {
    n: base.n, mean: base.mean,
    byMargin: setGain(advanced), byYield: setGain(yieldSet),
    oracle: k ? base.cumTop[k - 1] / k - base.mean : 0,
    topRecovered: k ? hits / k : 0,
    chance: k / base.n,
    r: base.r, rYield: base.rYield, deciles: base.deciles,
  }
}

export interface CapturePoint { planted: number; kept: number }

/** Resource efficiency on the held-out cohort: plant the top x% by predicted $/acre, what share
 *  of the real top `top` share (by realised $/acre) did you keep? Random planting keeps x%. */
export function captureCurve(scored: Scored[], p: Prices, top = 0.1, steps = 50): CapturePoint[] {
  const rows = scored
    .map((c) => ({ pred: c.margin, act: actualMargin(c, p) }))
    .filter((r): r is { pred: number; act: number } => r.act != null)
  if (rows.length < 50) return []
  const n = rows.length
  const cut = [...rows].sort((a, b) => b.act - a.act)[Math.max(0, Math.floor(top * n) - 1)].act
  const byPred = [...rows].sort((a, b) => b.pred - a.pred)
  const winners = rows.filter((r) => r.act >= cut).length
  const out: CapturePoint[] = [{ planted: 0, kept: 0 }]
  let got = 0
  let next = 1
  for (let i = 0; i < n; i++) {
    if (byPred[i].act >= cut) got++
    if (i + 1 >= Math.round((next * n) / steps)) { out.push({ planted: (i + 1) / n, kept: got / winners }); next++ }
  }
  return out
}

/** Share of lines that must be planted to keep `want` of the real winners (1 if never). */
export function plantedFor(curve: CapturePoint[], want: number): number {
  const hit = curve.find((c) => c.kept >= want)
  return hit ? hit.planted : 1
}

/** Mean of a numeric field over a set, ignoring missing values. */
export function meanOf<T>(xs: T[], f: (x: T) => number | undefined | null): number | null {
  let s = 0
  let n = 0
  for (const x of xs) {
    const v = f(x)
    if (v != null && Number.isFinite(v)) { s += v; n++ }
  }
  return n ? s / n : null
}

/** Evenly spaced "nice" tick values from 0 to at least max. */
export function niceTicks(max: number, count = 5): number[] {
  if (max <= 0) return [0]
  const raw = max / count
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const stepv = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((v) => v >= raw) ?? raw
  const ticks: number[] = []
  for (let v = 0; v <= max + 1e-9; v += stepv) ticks.push(Number(v.toFixed(6)))
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + stepv)
  return ticks
}

export interface Scenario { name: string; note: string; prices: Prices }

/** Economic conditions under which a bushel ranking and a dollar ranking part ways. */
export function scenarios(base: Prices): Scenario[] {
  return [
    { name: 'Today', note: 'the prices set on the left', prices: base },
    { name: 'Propane spike', note: 'drying at $0.09 / bu / pt', prices: { ...base, drying_cost_per_point: 0.09 } },
    { name: 'Cheap corn', note: '$3.50 / bu', prices: { ...base, corn_price: 3.5 } },
    { name: 'Lodging year', note: '90% of a lodged plant lost', prices: { ...base, lodging_loss_fraction: 0.9 } },
  ]
}

export function toCSV(rows: Scored[], p: Prices): string {
  const withActual = rows.some((c) => c.actual_yield != null)
  const head = ['rank', 'line', 'family', 'tester', 'usd_per_acre', 'gross', 'drying', 'lodging_loss',
    'pred_yield_bu_ac', 'lo90', 'hi90', 'pred_moisture_pct', 'pred_lodging_pct', 'rank_by_yield', 'confidence',
    ...(withActual ? ['actual_yield_bu_ac', 'actual_moisture_pct', 'actual_lodging_pct', 'actual_usd_per_acre'] : [])]
  const esc = (v: string | number) => (typeof v === 'string' && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v))
  const lines = rows.map((c, i) => {
    const b = breakdown(c, p)
    const cells: (string | number)[] = [i + 1, c.id, c.family, c.group, c.margin.toFixed(2), b.gross.toFixed(2),
      b.drying.toFixed(2), b.lodging.toFixed(2), c.pred_yield, c.lo, c.hi, c.pred_mst, c.pred_lodging, c.rankByYield, c.confidence]
    if (withActual) {
      const act = actualMargin(c, p)
      cells.push(c.actual_yield ?? '', c.actual_mst ?? '', c.actual_lodging ?? '', act == null ? '' : act.toFixed(2))
    }
    return cells.map(esc).join(',')
  })
  return [head.join(','), ...lines].join('\n') + '\n'
}

export const fmtUSD = (v: number, digits = 0) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits })
export const fmtNum = (v: number, digits = 0) =>
  v.toLocaleString('en-US', { maximumFractionDigits: digits })
export const fmtPct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`

/** What every plot of the held-out season really paid, $/acre at these prices. */
export function plotMargins(sp: SeasonPlots, p: Prices): Float64Array {
  const out = new Float64Array(sp.line.length)
  for (let i = 0; i < out.length; i++) {
    const y = sp.means.yield + sp.y10[i] / 10
    const m = sp.means.mst + sp.m100[i] / 100
    const l = Math.max(0, sp.means.lodging + sp.l10[i] / 10)
    out[i] = y * p.corn_price - Math.max(0, m - p.target_moisture) * p.drying_cost_per_point * y
      - (l / 100) * p.lodging_loss_fraction * y * p.corn_price
  }
  return out
}

export interface SiteResult { chosen: number; others: number; gain: number | null }

/** Per site: the chosen lines' plots against the other lines' plots in the same fields, $/acre.
 *  A site needs a few plots of each to count. */
export function siteResults(sp: SeasonPlots, margins: Float64Array, chosen: Uint8Array, nSites: number, min = 5): SiteResult[] {
  const sc = new Float64Array(nSites), so = new Float64Array(nSites)
  const nc = new Int32Array(nSites), no = new Int32Array(nSites)
  for (let i = 0; i < margins.length; i++) {
    const s = sp.site[i]
    if (chosen[sp.line[i]]) { sc[s] += margins[i]; nc[s]++ } else { so[s] += margins[i]; no[s]++ }
  }
  return Array.from({ length: nSites }, (_, s) => ({
    chosen: nc[s], others: no[s], gain: nc[s] >= min && no[s] >= min ? sc[s] / nc[s] - so[s] / no[s] : null,
  }))
}

/** One season's forecast and real value at any plot budget: straight-line between the budgets the
 *  pipeline scored (every 5% of the lines). */
export function valueAt(rows: EngineValueRow[], share: number): { predicted: number; real: number } | null {
  if (!rows.length) return null
  const s = [...rows].sort((a, b) => a.budget - b.budget)
  const x = Math.min(s[s.length - 1].budget, Math.max(s[0].budget, share))
  const j = Math.max(1, s.findIndex((r) => r.budget >= x))
  const a = s[j - 1], b = s[Math.min(j, s.length - 1)]
  const t = b.budget === a.budget ? 0 : (x - a.budget) / (b.budget - a.budget)
  return { predicted: a.predicted + t * (b.predicted - a.predicted), real: a.real + t * (b.real - a.real) }
}


export interface SeasonPoint {
  year: number; predicted: number; real: number
  // worked out from the season lines only: how many of the season's best lines (its top tenth by real
  // income) got a plot, out of how many, and how many lines were planted, out of how many
  best?: number; kept?: number; picked?: number; lines?: number
  // each family's lines split into fifths by predicted income, best first: what each fifth really earned
  // above its own family's average, $/acre
  stairs?: number[]
}
export interface SeasonValue extends SeasonPoint { forecast: number | null; lo: number | null; hi: number | null }
export interface PlanForecast { past: SeasonValue[]; now: SeasonPoint; forecast: number; lo: number; hi: number }

// numpy and Python round halves to even: match them, so the app and the pipeline pick the same lines
const roundHalfEven = (x: number) => {
  const r = Math.round(x)
  return Math.abs(x - Math.trunc(x)) === 0.5 && r % 2 !== 0 ? r - 1 : r
}

/** The fair share, every graded season, at these prices: each family plants its best share of lines by
 *  the engine's predicted $/acre; the season's forecast is the predicted gain of those picks over the
 *  average line, and the real gain is what they earned over it. */
// each season's families (line numbers in file order), worked out once per file: a knob step then only
// re-prices and re-sorts
const seasonFamilies = new WeakMap<SeasonLines, [number, number[][]][]>()
function familiesOf(sl: SeasonLines): [number, number[][]][] {
  let out = seasonFamilies.get(sl)
  if (!out) {
    const seasons = new Map<number, Map<number, number[]>>()
    for (let i = 0; i < sl.year.length; i++) {
      let fams = seasons.get(sl.year[i])
      if (!fams) seasons.set(sl.year[i], (fams = new Map()))
      let m = fams.get(sl.fam[i])
      if (!m) fams.set(sl.fam[i], (m = []))
      m.push(i)
    }
    out = [...seasons].sort((a, b) => a[0] - b[0]).map(([year, fams]) => [year, [...fams.values()]])
    seasonFamilies.set(sl, out)
  }
  return out
}

export function seasonValues(sl: SeasonLines, engine: EngineId, p: Prices, share: number): SeasonPoint[] {
  const n = sl.year.length
  const g = engine === 'gblup'
  const [py, pm, pl] = g ? [sl.gy, sl.gm, sl.gl] : [sl.py, sl.pm, sl.pl]
  const k = sl.scale
  const [ky, km, kl] = g ? [k.gy, k.gm, k.gl] : [k.py, k.pm, k.pl]
  const inc = (y: number, m: number, l: number) =>
    y * p.corn_price - Math.max(0, m - p.target_moisture) * p.drying_cost_per_point * y - (l / 100) * p.lodging_loss_fraction * y * p.corn_price
  const pred = new Float64Array(n), real = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    pred[i] = inc(py[i] / ky, pm[i] / km, pl[i] / kl)
    real[i] = inc(sl.ry[i] / k.ry, sl.rm[i] / k.rm, sl.rl[i] / k.rl)
  }
  const out: SeasonPoint[] = []
  const buf = new Float64Array(n)
  const chosen = new Uint8Array(n)
  for (const [year, fams] of familiesOf(sl)) {
    let sp = 0, sr = 0, picked = 0, ap = 0, ar = 0, all = 0
    const stairSum = [0, 0, 0, 0, 0], stairN = [0, 0, 0, 0, 0]
    for (const members of fams) {
      const size = members.length
      const q = roundHalfEven(share * size)
      // a family's best q lines are those above its q-th best prediction; lines tied with it go in file
      // order, as in the pipeline. A plain number sort finds it, far faster than sorting the lines themselves
      const v = buf.subarray(0, size)
      for (let j = 0; j < size; j++) v[j] = pred[members[j]]
      v.sort()
      const cut = q > 0 ? v[size - q] : Infinity
      let ties = q
      for (let j = size - q; j < size; j++) if (v[j] > cut) ties--
      for (let j = 0; j < size; j++) {
        const i = members[j]
        ap += pred[i]; ar += real[i]; all++
        const take = pred[i] > cut || (pred[i] === cut && ties-- > 0)
        chosen[i] = take ? 1 : 0
        if (take) { sp += pred[i]; sr += real[i]; picked++ }
      }
      // the fifths: a line's rank is how many siblings are predicted above it, read off the sorted values
      let famReal = 0
      for (let j = 0; j < size; j++) famReal += real[members[j]]
      famReal /= size
      for (let j = 0; j < size; j++) {
        const i = members[j]
        let lo = 0, hi = size
        while (lo < hi) { const mid = (lo + hi) >> 1; if (v[mid] <= pred[i]) lo = mid + 1; else hi = mid }
        const f = Math.min(4, Math.floor(((size - lo) * 5) / size))
        stairSum[f] += real[i] - famReal; stairN[f]++
      }
    }
    // the season's best lines, its top tenth by real income (found the same way), and how many got a plot
    const v = buf.subarray(0, all)
    let j = 0
    for (const members of fams) for (const i of members) v[j++] = real[i]
    v.sort()
    const best = roundHalfEven(0.1 * all)
    const top = best > 0 ? v[all - best] : Infinity
    let level = best
    for (let t = all - best; t < all; t++) if (v[t] > top) level--
    let kept = 0
    for (const members of fams) for (const i of members) if (real[i] > top || (real[i] === top && level-- > 0)) kept += chosen[i]
    const stairs = stairSum.map((s, f) => (stairN[f] ? s / stairN[f] : 0))
    if (picked) out.push({ year, predicted: sp / picked - ap / all, real: sr / picked - ar / all, best, kept, picked, lines: all, stairs })
  }
  return out
}

/** The same, read off the pipeline's record at its fixed prices (before the season lines have loaded). */
export function seasonsFromRows(rows: EngineValueRow[], engine: EngineId, share: number): SeasonPoint[] {
  const mine = rows.filter((r) => r.engine === engine && r.plan === 'conservative')
  return [...new Set(mine.map((r) => r.year))].sort((a, b) => a - b)
    .map((year) => ({ year, ...valueAt(mine.filter((r) => r.year === year), share)! }))
}

/** The decision year's forecast and the record before it. An engine's raw forecast is its own
 *  prediction for its own picks; each season's is corrected by how far the earlier seasons' forecasts
 *  missed, so a season's forecast uses only what was known before it. Its range is the raw forecast
 *  corrected as if the season went like the worst or the best of the earlier ones: if seasons are alike,
 *  a new one lands outside only when it is the worst or the best of them all, so with n earlier seasons
 *  it lands inside n - 1 times in n + 1. */
export function forecastFrom(seasons: SeasonPoint[], heldOut: number): PlanForecast | null {
  const pastRaw = seasons.filter((s) => s.year < heldOut)
  const now = seasons.find((s) => s.year === heldOut)
  if (pastRaw.length < 2 || !now) return null
  const ratio = (s: SeasonPoint) => (s.predicted > 0 ? s.real / s.predicted : NaN)
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const ratios = pastRaw.map(ratio).filter(Number.isFinite)
  if (!ratios.length) return null
  const past = pastRaw.map((s, i) => {
    const before = pastRaw.slice(0, i).map(ratio).filter(Number.isFinite)
    const ranged = before.length >= 2   // a worst and a best need two seasons
    return {
      ...s, forecast: before.length ? s.predicted * mean(before) : null,
      lo: ranged ? s.predicted * Math.min(...before) : null, hi: ranged ? s.predicted * Math.max(...before) : null,
    }
  })
  return {
    past, now, forecast: now.predicted * mean(ratios),
    lo: now.predicted * Math.min(...ratios), hi: now.predicted * Math.max(...ratios),
  }
}
