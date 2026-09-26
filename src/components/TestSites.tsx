import { memo, useMemo, useState } from 'react'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import us from 'us-atlas/states-10m.json'
import { fmtUSD, plotMargins, siteResults, type Prices, type Scored, type SiteResult } from '../lib/econ'
import type { Candidate, SeasonPlots, TestSite } from '../lib/types'
import Info from './Info'

const W = 760
const H = 440
const WON = '#2e9e4a'
const LOST = '#d04a3a'

type Climate = 'hot-dry' | 'hot-wet' | 'cool-dry' | 'cool-wet'
const CLIMATES: Climate[] = ['hot-dry', 'hot-wet', 'cool-dry', 'cool-wet']
const COLOR: Record<Climate, string> = {
  'hot-dry': '#d9822b', 'hot-wet': '#2e9e6a', 'cool-dry': '#b8a15a', 'cool-wet': '#3a7bd5',
}
const LABEL: Record<Climate, string> = {
  'hot-dry': 'hot and dry', 'hot-wet': 'hot and wet', 'cool-dry': 'cooler and dry', 'cool-wet': 'cooler and wet',
}

function Sun() {
  return <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><circle cx="7" cy="7" r="3" fill="currentColor" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <line key={a} x1="7" y1="1" x2="7" y2="2.6" stroke="currentColor" strokeWidth="1.3" transform={`rotate(${a} 7 7)`} />)}</svg>
}
function Cloud() {
  return <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden><path d="M4.5 11.5 A3 3 0 0 1 4.8 5.6 A4 4 0 0 1 12.4 6.4 A2.6 2.6 0 0 1 12.2 11.5 Z" fill="currentColor" /></svg>
}
function Drop({ full }: { full: boolean }) {
  return <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden><path d="M6 1.5 C6 1.5 1.8 7 1.8 9.2 A4.2 4.2 0 0 0 10.2 9.2 C10.2 7 6 1.5 6 1.5Z"
    fill={full ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.3" /></svg>
}
function Icons({ c }: { c: Climate }) {
  return (
    <span style={{ color: COLOR[c], display: 'inline-flex', gap: 3, alignItems: 'center', width: 34 }}>
      {c.startsWith('hot') ? <Sun /> : <Cloud />}<Drop full={c.endsWith('wet')} />
    </span>
  )
}

const topo = us as unknown as Topology
const states = feature(topo, topo.objects.states as GeometryCollection)
const borders = mesh(topo, topo.objects.states as GeometryCollection, (a, b) => a !== b)

interface Props {
  sites: TestSite[]
  year: number | null
  candidates: Candidate[]         // in the order the season's plots refer to
  plots: SeasonPlots
  prices: Prices
  advanced: Scored[]
}

type Mode = 'won' | 'summer'

/** The plan on the map: where its lines beat the ones it leaves out (what the held-out season really
 *  paid, field by field), and what kind of summer its tests fall in. */
function TestSites({ sites, year, candidates, plots, prices, advanced }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const [mode, setMode] = useState<Mode>('won')
  const idIndex = useMemo(() => new Map(candidates.map((c, i) => [c.id, i])), [candidates])

  // zoomed to the test network (the Corn Belt and east), so 180 sites don't sit in a thumbnail of the country
  const { projection, statePaths, borderPath } = useMemo(() => {
    const pts = { type: 'MultiPoint' as const, coordinates: sites.filter((s) => s.used).map((s) => [s.lon, s.lat]) }
    const projection = geoAlbersUsa().fitExtent([[24, 16], [W - 24, H - 16]], pts)
    const path = geoPath(projection)
    return { projection, statePaths: states.features.map((f) => path(f) ?? ''), borderPath: path(borders) ?? '' }
  }, [sites])
  const placed = useMemo(() => {
    const withClim = sites.filter((s) => s.rain != null && s.heat != null)
    const med = (xs: number[]) => { const v = [...xs].sort((a, b) => a - b); return v[Math.floor(v.length / 2)] ?? 0 }
    const rainMid = med(withClim.map((s) => s.rain!))
    const heatMid = med(withClim.map((s) => s.heat!))
    return sites.map((s, i) => {
      const xy = s.used ? projection([s.lon, s.lat]) : null
      const climate: Climate | null = s.rain == null || s.heat == null ? null
        : `${s.heat >= heatMid ? 'hot' : 'cool'}-${s.rain >= rainMid ? 'wet' : 'dry'}` as Climate
      return { s, i, xy, climate }
    }).filter((p) => p.xy)
  }, [sites, projection])

  // what the field paid, plot by plot, at your prices; then your plan against the rest, site by site
  const margins = useMemo(() => plotMargins(plots, prices), [plots, prices])
  const chosen = useMemo(() => {
    const m = new Uint8Array(candidates.length)
    for (const c of advanced) { const i = idIndex.get(c.id); if (i != null) m[i] = 1 }
    return m
  }, [advanced, idIndex, candidates.length])
  const res: SiteResult[] = useMemo(() => siteResults(plots, margins, chosen, sites.length), [plots, margins, chosen, sites.length])
  const maxPlots = useMemo(() => Math.max(1, ...res.map((r) => r.chosen + r.others)), [res])

  const byClimate = useMemo(() => {
    const out: Record<string, { scored: number; won: number; gain: number; tests: number; all: number }> = {}
    let tests = 0, allTests = 0
    for (const p of placed) {
      const r = res[p.i]
      const k = p.climate ?? 'none'
      const o = (out[k] ??= { scored: 0, won: 0, gain: 0, tests: 0, all: 0 })
      o.tests += r.chosen; o.all += r.chosen + r.others; tests += r.chosen; allTests += r.chosen + r.others
      if (r.gain != null) { o.scored++; o.gain += r.gain; if (r.gain > 0) o.won++ }
    }
    for (const k in out) out[k].gain /= out[k].scored || 1
    return { out, tests, allTests }
  }, [placed, res])
  const total = useMemo(() => {
    let scored = 0, won = 0
    for (const p of placed) { const g = res[p.i].gain; if (g != null) { scored++; if (g > 0) won++ } }
    return { scored, won }
  }, [placed, res])
  const withSites = CLIMATES.filter((c) => (byClimate.out[c]?.scored ?? 0) > 0)
  const everywhere = withSites.every((c) => byClimate.out[c].gain > 0)
  const worst = [...withSites].sort((a, b) => byClimate.out[a].gain - byClimate.out[b].gain)[0]
  // the kind of summer the plan's tests move furthest toward or away from, against all new lines
  const share = (k: string, which: 'tests' | 'all') =>
    (byClimate.out[k]?.[which] ?? 0) / ((which === 'tests' ? byClimate.tests : byClimate.allTests) || 1)
  const tilt = CLIMATES.map((c) => ({ c, gap: share(c, 'tests') - share(c, 'all') }))
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0]
  const pct = (x: number) => `${Math.round(x * 100)}%`

  const hs = hover != null ? sites[hover] : null
  const hr = hover != null ? res[hover] : null
  const radius = (i: number) => (res[i].chosen > 0 ? 2.5 + 11 * Math.sqrt(res[i].chosen / maxPlots) : 2.5)

  return (
    <div className="panel" style={{ position: 'relative' }}>
      <h2>Where your plan wins, and in what conditions<Info wide>
        Each dot is a test site with {year} plots, placed from its coordinates; a bigger dot means more of your lines are
        tested there. <b>Where it won:</b> a site is green when the lines your current plan advances earned more per acre
        there than the lines it leaves out, in the same fields, on what the field really paid in {year} at your prices
        (each plot compared within its own trial; a site needs five plots of each to count). <b>Kind of summer:</b> the
        site's usual June to August rain and July temperature from the organizers' weather file, averaged over earlier
        seasons and split at the middle value of all sites. Hover a site for its details.
      </Info></h2>
      <p style={{ marginTop: 0 }}>
        {mode === 'won'
          ? <>Green: at that site, the lines your plan picks beat the lines it leaves out, in the same fields, on what
            the field really paid in {year}. Switch the engine or the plan and watch the map change.</>
          : <>Your plan's tests, by the kind of summer each site usually gets, against all new lines. A plan that tilts
            toward one kind of summer is betting on it.</>}
      </p>
      <div className="toggle" style={{ marginBottom: 8 }}>
        <button className={mode === 'won' ? 'on' : ''} onClick={() => setMode('won')}>where it won</button>
        <button className={mode === 'summer' ? 'on' : ''} onClick={() => setMode('summer')}>kind of summer</button>
      </div>
      <div className="twocol" style={{ alignItems: 'start' }}>
        <div className="chartbox">
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
            aria-label={mode === 'won' ? `Map of the ${year} test sites where the plan's lines won` : `Map of the ${year} test sites by summer climate`}
            onMouseLeave={() => setHover(null)}>
            {statePaths.map((d, i) => <path key={i} d={d} fill="var(--border)" />)}
            <path d={borderPath} fill="none" stroke="var(--surface)" strokeWidth={1.2} />
            {placed.map((p) => {
              const r = res[p.i]
              const col = mode === 'won'
                ? (r.gain == null ? 'var(--text-3)' : r.gain > 0 ? WON : LOST)
                : (p.climate ? COLOR[p.climate] : 'var(--text-3)')
              const empty = r.chosen === 0 || (mode === 'won' && r.gain == null)
              return (
                <circle key={p.s.loc} cx={p.xy![0]} cy={p.xy![1]} r={radius(p.i) + (hover === p.i ? 2 : 0)}
                  fill={empty ? 'none' : col} fillOpacity={0.82} stroke={empty ? col : 'var(--surface)'} strokeWidth={1}
                  onMouseEnter={() => setHover(p.i)} style={{ cursor: 'pointer' }} />
              )
            })}
          </svg>
        </div>
        <div>
          {mode === 'won' ? (
            <>
              <div className="small muted">{year}: your plan against the lines it left out</div>
              <div style={{ margin: '4px 0 8px' }}>
                <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--good)' }}>{total.won}</span>
                <span className="small"> of {total.scored} sites won ({pct(total.won / (total.scored || 1))})</span>
              </div>
              <div className="small muted" style={{ display: 'flex' }}>
                <span>kind of summer</span><span style={{ marginLeft: 'auto' }}>$/ac ahead · sites won</span>
              </div>
              {CLIMATES.map((c) => {
                const o = byClimate.out[c]
                return (
                  <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
                    <Icons c={c} />
                    <span className="small" style={{ whiteSpace: 'nowrap' }}>{LABEL[c]}</span>
                    <span className="small" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                      {o && o.scored ? <><b style={{ color: o.gain > 0 ? 'var(--good)' : LOST }}>{o.gain > 0 ? '+' : ''}{fmtUSD(o.gain, 1)}</b>
                        <span className="muted"> · {pct(o.won / o.scored)}</span></> : <span className="muted">no sites</span>}
                    </span>
                  </div>
                )
              })}
              <p className="small" style={{ margin: '10px 0 0' }}>
                {everywhere
                  ? <><b>Your plan won in every kind of summer:</b> hot or cool, wet or dry, its lines out-earned the ones it
                    left out.</>
                  : <><b>Weakest in {LABEL[worst]} summers</b>: there its lines earned {fmtUSD(byClimate.out[worst].gain, 1)}/ac against the
                    rest.</>}
              </p>
            </>
          ) : (
            <>
              <div className="small muted">your plan's tests, by usual summer <span style={{ whiteSpace: 'nowrap' }}>(all new lines)</span></div>
              {CLIMATES.map((c) => (
                <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
                  <span style={{ width: 12, height: 12, borderRadius: 99, background: COLOR[c], display: 'inline-block' }} />
                  <Icons c={c} />
                  <span className="small" style={{ whiteSpace: 'nowrap' }}>{LABEL[c]}</span>
                  <span className="small" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                    <b>{pct(share(c, 'tests'))}</b> <span className="muted">({pct(share(c, 'all'))})</span>
                  </span>
                </div>
              ))}
              <p className="small" style={{ margin: '10px 0 0' }}>
                {tilt && Math.abs(tilt.gap) >= 0.05
                  ? <><b>Your plan tilts {tilt.gap > 0 ? 'toward' : 'away from'} {LABEL[tilt.c]} summers:</b> {pct(share(tilt.c, 'tests'))} of
                    its tests, against {pct(share(tilt.c, 'all'))} for all new lines. The conservative plan keeps the full mix.</>
                  : <><b>Your plan keeps the full mix of summers</b>, within five points of all new lines everywhere.</>}
              </p>
            </>
          )}
          {hs && hr && (
            <div className="lanes" style={{ marginTop: 12 }}>
              <b>{hs.loc}</b>
              <div className="small" style={{ marginTop: 6, lineHeight: 1.6 }}>
                {hr.gain != null
                  ? <>your lines here: <b style={{ color: hr.gain > 0 ? 'var(--good)' : LOST }}>{hr.gain > 0 ? '+' : ''}{fmtUSD(hr.gain, 1)}/ac</b> against the rest<br /></>
                  : <>too few of your lines here to compare<br /></>}
                {hr.chosen.toLocaleString('en-US')} of your plots, {hr.others.toLocaleString('en-US')} others<br />
                {hs.rain != null && <>summer rain {hs.rain} mm · July {hs.heat} °C<br /></>}
                {hs.clay != null && <>topsoil {hs.clay}% clay, {hs.sand}% sand</>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(TestSites)
