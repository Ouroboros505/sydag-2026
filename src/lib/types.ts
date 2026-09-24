/** The contract between analysis and the app.
 *
 * scripts/build_data.py writes public/recommendations.json in this shape; the app reads
 * it and never touches raw data. Whatever the input data looks like, the analysis side
 * adapts and this file stays fixed.
 */

export interface Meta {
  synthetic: boolean
  target: string          // trait predicted, e.g. "YLD_BE"
  unit: string            // "bu/ac"
  generated: string       // ISO timestamp
  n_candidates: number
  notes?: string
}

export interface PriceDefaults {
  corn_price: number              // $/bu
  drying_cost_per_point: number   // $/bu per percentage point of moisture removed
  target_moisture: number         // %, drying stops here
  lodging_loss_fraction: number   // share of yield lost on a lodged plant
}

export interface Candidate {
  id: string            // C1.12.007
  group: string         // C1 | C2
  family: string        // C1.12
  pred_yield: number    // bu/ac
  lo: number            // 90% interval
  hi: number
  pred_mst: number      // % grain moisture at harvest
  pred_lodging: number  // % plants lodged (stalk + root)
  confidence: 'high' | 'medium' | 'low'
  pc1?: number          // genomic map coordinates (top two marker PCs)
  pc2?: number
}

export interface Baseline {
  name: string
  metric: string
  value: number
}

export interface Validation {
  scheme: string
  r: number
  top20_recovery: number   // fraction of true top-20% recovered, chance = 0.20
  n_test: number
  traits?: Record<string, number>   // forward-validation r per trait the ranking uses
}

export interface Recommendations {
  meta: Meta
  price_defaults: PriceDefaults
  candidates: Candidate[]
  baselines: Baseline[]
  validation: Validation
}
