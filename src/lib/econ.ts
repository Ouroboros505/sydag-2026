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
  byMargin: number   // share of total achievable margin captured by the top-k margin-ranked set
  byYield: number    // same, but choosing top-k by yield
}

/** Cumulative margin captured as a share of advancing everything, for both rankings. */
export function frontier(scored: Scored[], step = 1): FrontierPoint[] {
  const total = scored.reduce((s, c) => s + Math.max(0, c.margin), 0) || 1
  const byMargin = scored // already sorted by margin desc
  const byYield = [...scored].sort((a, b) => b.pred_yield - a.pred_yield)
  const out: FrontierPoint[] = [{ k: 0, byMargin: 0, byYield: 0 }]
  let cm = 0
  let cy = 0
  for (let i = 0; i < scored.length; i++) {
    cm += Math.max(0, byMargin[i].margin)
    cy += Math.max(0, byYield[i].margin)
    if ((i + 1) % step === 0 || i === scored.length - 1) {
      out.push({ k: i + 1, byMargin: cm / total, byYield: cy / total })
    }
  }
  return out
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
