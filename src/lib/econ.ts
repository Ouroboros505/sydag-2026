/** Turn predicted bushels into predicted dollars per acre, and choose what to advance.
 *
 * margin = yield × price − drying − lodging loss
 *   drying  = max(0, moisture − target) × cost per point per bushel × yield
 *   lodging = lodged share × loss fraction × yield × price
 *
 * Deliberately simple and fully visible. Every term is a number the user can move.
 */
import type { Candidate, PriceDefaults } from './types'

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
export function score(cands: Candidate[], p: Prices): Scored[] {
  const withMargin = cands.map((c) => ({ ...c, margin: marginPerAcre(c, p) }))
  const byMargin = [...withMargin].sort((a, b) => b.margin - a.margin)
  const byYield = [...withMargin].sort((a, b) => b.pred_yield - a.pred_yield)
  const rm = new Map(byMargin.map((c, i) => [c.id, i + 1]))
  const ry = new Map(byYield.map((c, i) => [c.id, i + 1]))
  return byMargin.map((c) => ({ ...c, rankByMargin: rm.get(c.id)!, rankByYield: ry.get(c.id)! }))
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
export function frontier(scored: Scored[], cap: number, step = 1): FrontierPoint[] {
  const mean = populationMean(scored)
  const m = advanceOrder(scored, cap)
  const y = advanceOrder(byYieldOrder(scored), cap)
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

export function summarize(scored: Scored[], k: number, cap: number): Summary {
  const mean = populationMean(scored)
  const avg = (xs: Scored[]) => xs.reduce((s, c) => s + c.margin, 0) / (xs.length || 1)
  const advanced = advanceOrder(scored, cap).slice(0, k)
  const yieldSet = advanceOrder(byYieldOrder(scored), cap).slice(0, k)
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
    capCost: Number.isFinite(cap) ? avg(uncapped) - avg(advanced) : 0,
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

/** Score the advancement decision against the cohort's real field results. */
export function backtest(scored: Scored[], advanced: Scored[], yieldSet: Scored[], p: Prices): Backtest | null {
  const rows: { id: string; pred: number; act: number }[] = []
  for (const c of scored) {
    const act = actualMargin(c, p)
    if (act != null) rows.push({ id: c.id, pred: c.margin, act })
  }
  if (rows.length < 20) return null
  const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / (xs.length || 1)
  const act = new Map(rows.map((r) => [r.id, r.act]))
  const mean = avg(rows.map((r) => r.act))
  const setGain = (xs: Scored[]) => {
    const v = xs.map((c) => act.get(c.id)).filter((x): x is number => x != null)
    return v.length ? avg(v) - mean : 0
  }
  const k = advanced.length
  const byActual = [...rows].sort((a, b) => b.act - a.act)
  const topK = new Set(byActual.slice(0, k).map((r) => r.id))
  const withYield = scored.filter((c) => c.actual_yield != null)
  const byPred = [...rows].sort((a, b) => b.pred - a.pred)
  const deciles: number[] = []
  for (let d = 0; d < 10; d++) {
    const slice = byPred.slice(Math.floor((d * rows.length) / 10), Math.floor(((d + 1) * rows.length) / 10))
    deciles.push(avg(slice.map((r) => r.act)) - mean)
  }
  return {
    n: rows.length, mean,
    byMargin: setGain(advanced), byYield: setGain(yieldSet),
    oracle: avg(byActual.slice(0, k).map((r) => r.act)) - mean,
    topRecovered: k ? advanced.filter((c) => topK.has(c.id)).length / k : 0,
    chance: k / rows.length,
    r: pearson(rows.map((r) => r.pred), rows.map((r) => r.act)),
    rYield: pearson(withYield.map((c) => c.pred_yield), withYield.map((c) => c.actual_yield as number)),
    deciles,
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
