/** Turn predicted bushels into predicted dollars per acre.
 *
 * margin = yield × price − drying − lodging loss
 *   drying  = max(0, moisture − target) × cost per point per bushel × yield
 *   lodging = lodged share × loss fraction × yield × price
 *
 * Deliberately simple and fully visible. Every term is a number the user can move.
 */
import type { Candidate, PriceDefaults } from './types'

export interface Prices extends PriceDefaults {}

export function marginPerAcre(c: Candidate, p: Prices): number {
  const gross = c.pred_yield * p.corn_price
  const drying = Math.max(0, c.pred_mst - p.target_moisture) * p.drying_cost_per_point * c.pred_yield
  const lodging = (c.pred_lodging / 100) * p.lodging_loss_fraction * c.pred_yield * p.corn_price
  return gross - drying - lodging
}

export interface Scored extends Candidate {
  margin: number
  rankByMargin: number
  rankByYield: number
}

export function score(cands: Candidate[], p: Prices): Scored[] {
  const withMargin = cands.map((c) => ({ ...c, margin: marginPerAcre(c, p) }))
  const byMargin = [...withMargin].sort((a, b) => b.margin - a.margin)
  const byYield = [...withMargin].sort((a, b) => b.pred_yield - a.pred_yield)
  const rm = new Map(byMargin.map((c, i) => [c.id, i + 1]))
  const ry = new Map(byYield.map((c, i) => [c.id, i + 1]))
  return byMargin.map((c) => ({ ...c, rankByMargin: rm.get(c.id)!, rankByYield: ry.get(c.id)! }))
}

export interface FrontierPoint {
  k: number
  byMargin: number   // $/acre: mean margin of the top-k margin-ranked set, minus the population mean
  byYield: number    // same, choosing top-k by yield
}

export function populationMean(scored: Scored[]): number {
  return scored.reduce((s, c) => s + c.margin, 0) / (scored.length || 1)
}

/** Expected gain per advanced acre versus advancing at random, for both rankings.
 *  This is the selection differential, priced. */
export function frontier(scored: Scored[], step = 1): FrontierPoint[] {
  const mean = populationMean(scored)
  const byMargin = scored // sorted by margin desc
  const byYield = [...scored].sort((a, b) => b.pred_yield - a.pred_yield)
  const out: FrontierPoint[] = []
  let cm = 0
  let cy = 0
  for (let i = 0; i < scored.length; i++) {
    cm += byMargin[i].margin
    cy += byYield[i].margin
    const k = i + 1
    if (k % step === 0 || k === scored.length || k === 1) {
      out.push({ k, byMargin: cm / k - mean, byYield: cy / k - mean })
    }
  }
  return out
}

export interface Summary {
  gainByMargin: number   // $/acre over population mean, advanced set ranked by margin
  gainByYield: number    // $/acre over population mean, advanced set ranked by yield
  gap: number            // $/acre left on the table by ranking on bushels
  swapCount: number
}

export function summarize(scored: Scored[], k: number): Summary {
  const mean = populationMean(scored)
  const byYield = [...scored].sort((a, b) => b.pred_yield - a.pred_yield)
  const m = scored.slice(0, k).reduce((s, c) => s + c.margin, 0) / k - mean
  const y = byYield.slice(0, k).reduce((s, c) => s + c.margin, 0) / k - mean
  return { gainByMargin: m, gainByYield: y, gap: m - y, swapCount: swaps(scored, k).length }
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

/** Lines the margin ranking advances that the yield ranking would have cut, at budget k. */
export function swaps(scored: Scored[], k: number): Scored[] {
  return scored.slice(0, k).filter((c) => c.rankByYield > k)
}

export const fmtUSD = (v: number, digits = 0) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits })
export const fmtNum = (v: number, digits = 0) =>
  v.toLocaleString('en-US', { maximumFractionDigits: digits })
export const fmtPct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`
