import { memo, useMemo, useState } from 'react'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import us from 'us-atlas/states-10m.json'
import type { TestSite } from '../lib/types'
import Info from './Info'

const W = 760
const H = 440

type Climate = 'hot-dry' | 'hot-wet' | 'cool-dry' | 'cool-wet'
const COLOR: Record<Climate, string> = {
  'hot-dry': '#d9822b', 'hot-wet': '#2e9e6a', 'cool-dry': '#b8a15a', 'cool-wet': '#3a7bd5',
}
const LABEL: Record<Climate, string> = {
  'hot-dry': 'hot, dry summers', 'hot-wet': 'hot, wet summers', 'cool-dry': 'cooler, dry summers', 'cool-wet': 'cooler, wet summers',
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

const topo = us as unknown as Topology
const states = feature(topo, topo.objects.states as GeometryCollection)
const borders = mesh(topo, topo.objects.states as GeometryCollection, (a, b) => a !== b)

function TestSites({ sites, year, persistence }: { sites: TestSite[]; year: number | null; persistence?: number | null }) {
  const [hover, setHover] = useState<TestSite | null>(null)
  const [showPast, setShowPast] = useState(false)
  // zoomed to the test network (the Corn Belt and east), so 180 sites don't sit in a thumbnail of the country
  const { projection, statePaths, borderPath } = useMemo(() => {
    const pts = { type: 'MultiPoint' as const, coordinates: sites.map((s) => [s.lon, s.lat]) }
    const projection = geoAlbersUsa().fitExtent([[24, 16], [W - 24, H - 16]], pts)
    const path = geoPath(projection)
    return { projection, statePaths: states.features.map((f) => path(f) ?? ''), borderPath: path(borders) ?? '' }
  }, [sites])
  const placed = useMemo(() => {
    const withClim = sites.filter((s) => s.rain != null && s.heat != null)
    const med = (xs: number[]) => { const v = [...xs].sort((a, b) => a - b); return v[Math.floor(v.length / 2)] ?? 0 }
    const rainMid = med(withClim.map((s) => s.rain!))
    const heatMid = med(withClim.map((s) => s.heat!))
    return sites.map((s) => {
      const xy = projection([s.lon, s.lat])
      const climate: Climate | null = s.rain == null || s.heat == null ? null
        : `${s.heat >= heatMid ? 'hot' : 'cool'}-${s.rain >= rainMid ? 'wet' : 'dry'}` as Climate
      return { s, xy, climate }
    }).filter((p) => p.xy)
  }, [sites, projection])
  const used = placed.filter((p) => p.s.used)
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const p of used) { const k = p.climate ?? 'none'; c[k] = (c[k] ?? 0) + 1 }
    return c
  }, [used])
  const best = useMemo(() => placed.filter((p) => p.s.used && (p.s.trials ?? 0) >= 3 && p.s.r != null)
    .sort((a, b) => (b.s.r ?? 0) - (a.s.r ?? 0)).slice(0, 5), [placed])

  return (
    <div className="panel" style={{ position: 'relative' }}>
      <h2>Where the {year ?? ''} plots are, and in what conditions<Info wide>
        Each dot is a test site with {year} plots, placed on the map from its coordinates. The color is the site's usual
        summer, from the organizers' weather file (June to August rain and July temperature, averaged over earlier
        seasons, split at the middle value of all sites). Hover a site for its soil and history. "Ranked lines
        consistently" is how well a plot there agreed with the same line's results elsewhere in earlier seasons; it
        carries over to the next season only weakly (r = {persistence != null ? persistence.toFixed(2) : 'n/a'}), so it
        is a hint, not a reason to drop a site.
      </Info></h2>
      <p style={{ marginTop: 0 }}>
        <b>{used.length}</b> sites test the {year} lines. A line is judged on its average across its ~7 sites, which is
        why the network should cover every kind of summer the market sees.{' '}
        <label className="small" style={{ whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} /> show earlier sites
        </label>
      </p>
      <div className="twocol" style={{ alignItems: 'start' }}>
        <div className="chartbox">
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Map of the ${year} test sites by summer climate`}
            onMouseLeave={() => setHover(null)}>
            {statePaths.map((d, i) => <path key={i} d={d} fill="var(--border)" />)}
            <path d={borderPath} fill="none" stroke="var(--surface)" strokeWidth={1.2} />
            {showPast && placed.filter((p) => !p.s.used).map((p) => (
              <circle key={p.s.loc} cx={p.xy![0]} cy={p.xy![1]} r={2.6} fill="none" stroke="var(--text-3)" strokeWidth={1}
                onMouseEnter={() => setHover(p.s)} />
            ))}
            {used.map((p) => (
              <circle key={p.s.loc} cx={p.xy![0]} cy={p.xy![1]} r={hover?.loc === p.s.loc ? 7 : 4.6}
                fill={p.climate ? COLOR[p.climate] : 'var(--text-3)'} stroke="var(--surface)" strokeWidth={1}
                onMouseEnter={() => setHover(p.s)} style={{ cursor: 'pointer' }} />
            ))}
          </svg>
        </div>
        <div>
          <div className="small muted" style={{ marginBottom: 6 }}>{year} sites by usual summer</div>
          {(Object.keys(COLOR) as Climate[]).map((c) => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
              <span style={{ width: 12, height: 12, borderRadius: 99, background: COLOR[c], display: 'inline-block' }} />
              <span style={{ color: COLOR[c], display: 'inline-flex', gap: 3, alignItems: 'center', width: 34 }}>
                {c.startsWith('hot') ? <Sun /> : <Cloud />}<Drop full={c.endsWith('wet')} />
              </span>
              <span className="small">{LABEL[c]}</span>
              <b className="small" style={{ marginLeft: 'auto' }}>{counts[c] ?? 0}</b>
            </div>
          ))}
          {(counts.none ?? 0) > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
              <span style={{ width: 12, height: 12, borderRadius: 99, background: 'var(--text-3)', display: 'inline-block' }} />
              <span style={{ width: 34 }} />
              <span className="small muted">no weather on record</span>
              <b className="small" style={{ marginLeft: 'auto' }}>{counts.none}</b>
            </div>
          )}
          {hover ? (
            <div className="lanes" style={{ marginTop: 12 }}>
              <b>{hover.loc}</b> <span className="muted small">{hover.used ? `${year} site` : 'earlier site'}</span>
              <div className="small" style={{ marginTop: 6, lineHeight: 1.6 }}>
                {hover.rain != null && <>summer rain {hover.rain} mm · July {hover.heat} °C<br /></>}
                {hover.clay != null && <>topsoil {hover.clay}% clay, {hover.sand}% sand<br /></>}
                {hover.level != null && <>average yield {hover.level} bu/ac<br /></>}
                {hover.trials != null && <>{hover.trials} earlier trials · ranked lines consistently: {hover.r?.toFixed(2)}</>}
              </div>
            </div>
          ) : (
            best.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="small muted">{year} sites that ranked lines most consistently before</div>
                {best.map((p) => (
                  <div key={p.s.loc} className="small" style={{ display: 'flex', gap: 8, margin: '3px 0' }}>
                    <span className="mono">{p.s.loc}</span><span className="muted">{p.s.trials} trials</span>
                    <b style={{ marginLeft: 'auto' }}>{p.s.r?.toFixed(2)}</b>
                  </div>
                ))}
                <div className="small muted" style={{ marginTop: 4 }}>hover a dot for its soil and history</div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(TestSites)
