// The same rules the pipeline applies (analysis/bayer.py): values outside these ranges are impossible
// and become missing; nothing is guessed.
const PLAUSIBLE: Record<string, [number, number]> = {
  yield: [20, 350], mst: [5, 45], erm: [80, 140], twt: [40, 70], rtlp: [0, 100], stlp: [0, 100], lodging: [0, 100],
}
// the names other programs use for the same things (upper-cased); the first match wins
const COLUMNS: Record<string, string[]> = {
  id: ['LINE_UNIQUE_ID', 'UID', 'LINEUNIQUEID', 'ID', 'GENOTYPE', 'HYBRID', 'LINENAME', 'LINE_NAME', 'LINE_ID', 'VARIETY'],
  year: ['YEAR', 'YEAR_X', 'SEASON'], loc: ['LOC', 'LOCATION', 'FIELD', 'SITE', 'FIELD_LOCATION', 'ENV'],
  yield: ['YLD_BE', 'YIELD', 'YLD', 'YIELD_BU', 'YIELD_BU_AC', 'GRAIN_YIELD', 'YIELD_T_HA', 'YIELD_MG_HA'],
  mst: ['MST', 'MOISTURE', 'GRAIN_MOISTURE'], lodging: ['LODGING', 'LODGEDPCT', 'LODGING_PCT', 'LODGED_PCT'],
  erm: ['ERM', 'MATURITY'], twt: ['TWT', 'TEST_WEIGHT'], rtlp: ['RTLP', 'ROOT_LODGING'], stlp: ['STLP', 'STALK_LODGING'],
  family: ['FAMILY', 'CROSS', 'POPULATION', 'PEDIGREE', 'POP'],
  parent1: ['PARENT1', 'MOTHER', 'FEMALE', 'HYBRID_PARENT1'], parent2: ['PARENT2', 'FATHER', 'MALE', 'HYBRID_PARENT2'],
}
export const NAMES: Record<string, string> = {
  yield: 'yield', mst: 'harvest moisture', lodging: 'lodging', erm: 'maturity', twt: 'test weight', rtlp: 'root lodging', stlp: 'stalk lodging',
}
const TRAITS = ['yield', 'mst', 'erm', 'twt', 'rtlp', 'stlp', 'lodging']

export interface Report {
  file: string
  rows: number
  missingColumns: string[]
  idsFixed: number
  impossible: Record<string, number>
  recorded: Record<string, number>          // share of plots with a value, after cleaning
  lines: number
  families: number                         // families with at least two lines
  inFamilies: number                       // share of lines that sit in such a family
  perFamily: number                        // lines in a typical family
  years: [number, number]
  locations: number
  trials: number
  plotsPerTrial: number
  trialSpread: [number, number]             // lowest and highest trial average yield
  seconds: number
}

function splitLine(s: string): string[] {
  if (!s.includes('"')) return s.split(',')
  const out: string[] = []
  let cur = '', q = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '"') { if (q && s[i + 1] === '"') { cur += '"'; i++ } else q = !q }
    else if (ch === ',' && !q) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

/** A season's field results, cleaned the way the pipeline cleans them, summed up as a report. */
export async function checkText(text: string, fileName: string, onProgress: (f: number) => void = () => {}): Promise<Report> {
  const t0 = performance.now()
  let pos = text.indexOf('\n')
  const header = splitLine(text.slice(0, pos).replace(/\r$/, '')).map((h) => h.trim().replace(/^"|"$/g, '').toUpperCase())
  const col: Record<string, number> = {}
  for (const [k, names] of Object.entries(COLUMNS)) {
    const i = names.map((n) => header.indexOf(n)).find((j) => j >= 0)
    if (i != null) col[k] = i
  }
  const missingColumns = ['id', 'year', 'loc', 'yield'].filter((k) => col[k] == null)
  // yields in t/ha (or Mg/ha, kg/ha) are converted to bu/ac before the plausibility check
  const yname = col.yield != null ? header[col.yield] : ''
  const yscale = /(^|_)(T|MG)_HA$/.test(yname) ? 15.93 : /KG_HA$/.test(yname) ? 0.01593 : 1
  const base: Report = {
    file: fileName, rows: 0, missingColumns, idsFixed: 0, impossible: {}, recorded: {}, lines: 0, families: 0, inFamilies: 0, perFamily: 0,
    years: [0, 0], locations: 0, trials: 0, plotsPerTrial: 0, trialSpread: [0, 0], seconds: 0,
  }
  if (missingColumns.length) return base

  const impossible: Record<string, number> = {}, have: Record<string, number> = {}
  const ids = new Set<string>(), locs = new Set<string>()
  const lineFam = new Map<string, string>()   // each line's family: its name, a family column, or its two parents
  const trial = new Map<string, [number, number]>()   // sum and count of yield per trial
  let rows = 0, fixed = 0, y0 = Infinity, y1 = -Infinity
  const n = text.length
  while (pos < n) {
    let end = text.indexOf('\n', pos + 1)
    if (end < 0) end = n
    const line = text.slice(pos + 1, end).replace(/\r$/, '')
    pos = end
    if (!line) continue
    const f = splitLine(line)
    rows++
    let id = (f[col.id] ?? '').trim().replace(/^"|"$/g, '')
    if (id.endsWith('.0')) { id = id.slice(0, -2); fixed++ }       // a spreadsheet wrote the name as a number
    ids.add(id)
    const fam = /^(C\d+\.\d+)\./.exec(id)
    if (!lineFam.has(id)) {
      let key = fam ? fam[1] : ''
      if (!key && col.family != null) key = (f[col.family] ?? '').trim()
      if (!key && col.parent1 != null && col.parent2 != null) {
        const a = (f[col.parent1] ?? '').trim(), b = (f[col.parent2] ?? '').trim()
        if (a && b) key = [a, b].sort().join(' x ')
      }
      if (key) lineFam.set(id, key)
    }
    const year = Number(f[col.year])
    if (Number.isFinite(year)) { y0 = Math.min(y0, year); y1 = Math.max(y1, year) }
    const loc = (f[col.loc] ?? '').trim()
    locs.add(loc)
    for (const t of TRAITS) {
      if (col[t] == null) continue
      const raw = f[col[t]]
      if (raw == null || raw.trim() === '' || raw === 'NA') continue
      const v = Number(raw) * (t === 'yield' ? yscale : 1)
      if (!Number.isFinite(v)) continue
      const [lo, hi] = PLAUSIBLE[t]
      if (v < lo || v > hi) { impossible[t] = (impossible[t] ?? 0) + 1; continue }   // impossible: missing, not guessed
      have[t] = (have[t] ?? 0) + 1
      if (t === 'yield') {
        // each plot is judged against its own field: the trial is year x location x group
        const key = `${year}_${loc}_${fam ? fam[1].split('.')[0] : ''}`
        const s = trial.get(key) ?? [0, 0]
        s[0] += v; s[1]++
        trial.set(key, s)
      }
    }
    if (rows % 50000 === 0) { onProgress(pos / n); await new Promise((r) => setTimeout(r)) }
  }
  const famSize = new Map<string, number>()
  for (const k of lineFam.values()) famSize.set(k, (famSize.get(k) ?? 0) + 1)
  const sizes = [...famSize.values()].filter((k) => k >= 2).sort((a, b) => a - b)
  const means = [...trial.values()].map(([s, c]) => s / c)
  const counts = [...trial.values()].map(([, c]) => c).sort((a, b) => a - b)
  const recorded: Record<string, number> = {}
  for (const t of TRAITS) if (col[t] != null) recorded[t] = (have[t] ?? 0) / (rows || 1)
  return {
    ...base, rows, idsFixed: fixed, impossible, recorded, lines: ids.size, families: sizes.length,
    inFamilies: sizes.reduce((a, k) => a + k, 0) / (ids.size || 1), perFamily: sizes[Math.floor(sizes.length / 2)] ?? 0,
    years: [y0, y1], locations: locs.size, trials: trial.size, plotsPerTrial: counts[Math.floor(counts.length / 2)] ?? 0,
    trialSpread: [Math.min(...means), Math.max(...means)], seconds: (performance.now() - t0) / 1000,
  }
}

