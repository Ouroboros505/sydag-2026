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
  held_out_year?: number | null   // set when the candidates are a real cohort scored after the fact
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
  tester?: string       // the line it was crossed to for its field test
  pred_erm?: number     // estimated relative maturity, days
  actual_yield?: number   // present when the cohort was held out: what the field then said
  actual_mst?: number
  actual_lodging?: number
  actual_erm?: number
  gy?: number   // benchmark engine (standard GBLUP): predicted yield, moisture, lodging
  gm?: number
  gl?: number
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
  r_between?: number                // how well family means were ranked
  r_within?: number                 // how well siblings were ranked inside their family
  r_as_planted?: number             // r against the raw testcross result, tester included
  by_year?: YearResult[]            // the same forward test repeated on earlier cohorts
  coverage90?: number               // share of held-out lines inside their 90% band
  ceiling?: number                  // best r any predictor could reach, given plot noise
  leaky_r?: number
  by_confidence?: Record<string, number | null>
  families_by_parents_on_record?: Record<string, number>
  strategies?: StrategyRow[]        // ways to spend the same plots, scored on what the field did
  plots_to_match?: PlotsToMatch[]   // what the standard ranking needs to keep as many real winners
  tuned_on?: number[]               // cohorts the settings were chosen on
  first_frozen_r?: number           // the decision year's score with the first frozen model (disclosure)
  r_ci95?: [number, number]         // bootstrap over the cohort's families
  vs_gblup_ci95?: [number, number]  // same, for our r minus standard GBLUP's
  seasons_won?: number
  seasons?: number
  engines?: EngineInfo[]           // the prediction engines the app can switch between, with track records
  site_persistence?: number        // does a test site's reliability carry over to the next season?
  location_specific?: {             // can a line's response across locations be predicted?
    r_oracle: number                // even knowing each trial's productivity
    r_history: number               // from each location's history, as known in January
    n_plots: number
    sd_within_line: number          // a line's spread across its locations, bu
    sd_between_lines: number        // spread of line means, bu
  }
}

export interface PlotsToMatch {
  year: number
  ours_kept: number        // share of the real top 10% ProMaize keeps with 30% of lines
  standard_needs: number   // share of lines standard GBLUP must plant to keep as many
  lines_saved: number
}

export interface StrategyRow {
  year: number | 'mean'
  budget: number          // share of the cohort planted
  strategy: string
  gain: number            // realised $/acre of the advanced set over the cohort average
  top10_kept: number      // share of the real top 10% that got a plot
  eff_families: number | null
  maturity_shift: number  // days of relative maturity, advanced set vs cohort
}

export interface YearResult {
  year: number
  r: number
  r_between: number
  r_within: number
  top20: number
  n_lines: number
  n_families: number
  r_gblup: number       // one ridge over all lines, the usual approach
  r_pedigree: number    // parents' earlier families only, no markers
  r_as_planted?: number         // same, against the raw result with the known tester effect added
  r_gblup_as_planted?: number
  families_none?: number        // that year's families with no parent on record, one, both
  families_one?: number
  families_both?: number
}

export interface EngineInfo {
  id: 'family' | 'gblup' | 'environment'
  name: string
  r_mean: number        // forward accuracy, mean over the tested seasons
  r_last: number        // forward accuracy in the decision year
  coverage90: number    // share of decision-year lines inside their 90% band
  half90?: number       // width of that band, bu/ac (engines with one fixed band)
}

export type EngineId = EngineInfo['id']

export interface TestSite {
  loc: string
  lat: number
  lon: number
  used: boolean         // has plots in the decision year
  r?: number            // how consistently it ranked lines in earlier seasons
  trials?: number
  level?: number        // average yield there, bu/ac
  rain?: number         // June to August rain, mm, average of earlier seasons
  heat?: number         // July mean temperature, C
  clay?: number         // topsoil clay, %
  sand?: number         // topsoil sand, %
}

export interface Recommendations {
  meta: Meta
  price_defaults: PriceDefaults
  candidates: Candidate[]
  locations?: TestSite[]
  baselines: Baseline[]
  validation: Validation
}
