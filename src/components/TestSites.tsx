import { memo, useMemo, useRef, useState } from 'react'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import us from 'us-atlas/states-10m.json'
// Canada and Mexico near the border (Natural Earth, lakes cut out), so the Ontario sites sit on land
import neighbors from '../lib/neighbors.json'
import { fmtUSD, plotMargins, siteResults, type Prices, type Scored, type SiteResult } from '../lib/econ'
import type { Candidate, SeasonPlots, TestSite } from '../lib/types'
import Info from './Info'

const W = 760
const H = 440
const WON = '#2e9e4a'
const LOST = '#d04a3a'
const EVEN = '#9a988f'
// a site's colour runs from red through grey ($0) to green with the size of its gain, not just its sign
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a: string, b: string, t: number) => {
  const A = rgb(a), B = rgb(b)
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`
}
const gainColor = (g: number, lim: number) => {
  const t = Math.max(-1, Math.min(1, g / lim))
  return t >= 0 ? mix(EVEN, WON, t) : mix(EVEN, LOST, -t)
}

type Climate = 'hot-dry' | 'hot-wet' | 'cool-dry' | 'cool-wet'
const CLIMATES: Climate[] = ['hot-dry', 'hot-wet', 'cool-dry', 'cool-wet']
const COLOR: Record<Climate, string> = {
  'hot-dry': '#d9822b', 'hot-wet': '#2e9e6a', 'cool-dry': '#b8a15a', 'cool-wet': '#3a7bd5',
}
const LABEL: Record<Climate, string> = {
  'hot-dry': 'Hot, dry', 'hot-wet': 'Hot, wet', 'cool-dry': 'Cool, dry', 'cool-wet': 'Cool, wet',
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
const coast = mesh(topo, topo.objects.states as GeometryCollection, (a, b) => a === b)

interface Props {
  sites: TestSite[]
  year: number | null
  candidates: Candidate[]         // in the order the season's plots refer to
  plots: SeasonPlots
  prices: Prices
  advanced: Scored[]
}


/** The plan on the map: where its lines beat the ones it leaves out (what the held-out season really
 *  paid, field by field), and what kind of summer its tests fall in. */
function TestSites({ sites, year, candidates, plots, prices, advanced }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const idIndex = useMemo(() => new Map(candidates.map((c, i) => [c.id, i])), [candidates])

  // the whole country, so it reads as the US at a glance; the zoom buttons bring the Corn Belt close
  const { projection, statePaths, borderPath, coastPath, neighborPaths } = useMemo(() => {
    const projection = geoAlbersUsa().fitExtent([[12, 12], [W - 12, H - 12]], states)
    const path = geoPath(projection)
    return {
      projection, statePaths: states.features.map((f) => path(f) ?? ''), borderPath: path(borders) ?? '', coastPath: path(coast) ?? '',
      neighborPaths: (neighbors as GeoJSON.FeatureCollection).features.map((f) => path(f) ?? ''),
    }
  }, [])
  const { placed, cut } = useMemo(() => {
    const withClim = sites.filter((s) => s.rain != null && s.heat != null)
    const med = (xs: number[]) => { const v = [...xs].sort((a, b) => a - b); return v[Math.floor(v.length / 2)] ?? 0 }
    const rainMid = med(withClim.map((s) => s.rain!))
    const heatMid = med(withClim.map((s) => s.heat!))
    const list = sites.map((s, i) => {
      const xy = s.used ? projection([s.lon, s.lat]) : null
      const climate: Climate | null = s.rain == null || s.heat == null ? null
        : `${s.heat >= heatMid ? 'hot' : 'cool'}-${s.rain >= rainMid ? 'wet' : 'dry'}` as Climate
      return { s, i, xy, climate }
    }).filter((p) => p.xy)
    return { placed: list, cut: { heat: heatMid, rain: rainMid } }
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
  // the colour scale's end: nine sites in ten fall inside it, rounded to $5
  const lim = useMemo(() => {
    const a = res.flatMap((r) => (r.gain == null ? [] : [Math.abs(r.gain)])).sort((x, y) => x - y)
    return a.length ? Math.max(5, Math.round(a[Math.floor(0.9 * (a.length - 1))] / 5) * 5) : 20
  }, [res])

  // each kind of summer: the average of its sites' gains
  const byClimate = useMemo(() => {
    const out: Record<string, { scored: number; gain: number }> = {}
    for (const p of placed) {
      const r = res[p.i]
      const o = (out[p.climate ?? 'none'] ??= { scored: 0, gain: 0 })
      if (r.gain != null) { o.scored++; o.gain += r.gain }
    }
    for (const k in out) out[k].gain /= out[k].scored || 1
    return out
  }, [placed, res])
  const total = useMemo(() => {
    let scored = 0, won = 0
    for (const p of placed) { const g = res[p.i].gain; if (g != null) { scored++; if (g > 0) won++ } }
    return { scored, won }
  }, [placed, res])
  const pct = (x: number) => `${Math.round(x * 100)}%`
  // the weather file is metric; a US audience reads Fahrenheit and inches
  const toF = (c: number) => Math.round((c * 9) / 5 + 32)
  const toIn = (mm: number) => Math.round(mm / 25.4)

  // zoom and pan, in the map's own units; dots keep their size as it zooms, so crowded sites separate
  const [view, setView] = useState({ k: 1, x: W / 2, y: H / 2 })
  const centre = useMemo(() => {
    const xy = placed.map((p) => p.xy!)
    return xy.length ? [xy.reduce((a, p) => a + p[0], 0) / xy.length, xy.reduce((a, p) => a + p[1], 0) / xy.length] : [W / 2, H / 2]
  }, [placed])
  const whole = { k: 1, x: W / 2, y: H / 2 }
  const zoom = (f: number) => setView((v) => {
    const k = Math.min(12, Math.max(1, v.k * f))
    if (k <= 1.01) return whole
    return v.k === 1 ? { k, x: centre[0], y: centre[1] } : { ...v, k }   // the first step zooms onto the test network
  })
  const drag = useRef<{ px: number; py: number; x: number; y: number; unit: number } | null>(null)
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (view.k === 1) return
    drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y, unit: W / e.currentTarget.getBoundingClientRect().width }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    if (!d) return
    const x = d.x - ((e.clientX - d.px) * d.unit) / view.k, y = d.y - ((e.clientY - d.py) * d.unit) / view.k
    setView((v) => ({ ...v, x: Math.min(W, Math.max(0, x)), y: Math.min(H, Math.max(0, y)) }))
  }

  const hs = hover != null ? sites[hover] : null
  const hr = hover != null ? res[hover] : null
  const radius = (i: number) => (res[i].chosen > 0 ? 2.5 + 11 * Math.sqrt(res[i].chosen / maxPlots) : 2.5) / Math.sqrt(view.k)

  return (
    <div className="panel" style={{ position: 'relative' }}>
      <h2>Payoff by test site<Info wide>
        Each dot is a test site with {year} plots, placed from its coordinates; a bigger dot means more of your lines are
        tested there. Its colour is how much more per acre the lines your plan advances earned there than the lines it
        leaves out, in the same fields, on what the field really paid in {year} at your prices (each plot compared within
        its own trial; a site needs five plots of each to count).<br /><br />
        <b>The rows</b> average those sites by their usual summer: June to August rain and July temperature from the
        organizers' weather file, averaged over earlier seasons. Hot and wet are the warmer and wetter half of all sites.
        Hover a site for its details; zoom with + and −, then drag to move around.
      </Info></h2>
      <div className="twocol" style={{ alignItems: 'start' }}>
        <div className="chartbox">
          <div style={{ position: 'relative' }}>
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
            aria-label={`Map of the ${year} test sites: how much your picks out-earned the dropped lines at each`}
            onMouseLeave={() => setHover(null)} onPointerDown={onDown} onPointerMove={onMove}
            onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
            style={{ cursor: view.k > 1 ? 'grab' : undefined, touchAction: view.k > 1 ? 'none' : undefined }}>
            <g style={{ transform: `translate(${W / 2}px, ${H / 2}px) scale(${view.k}) translate(${-view.x}px, ${-view.y}px)`,
              transition: drag.current ? 'none' : 'transform .35s ease' }}>
            {neighborPaths.map((d, i) => <path key={`n${i}`} d={d} fill="var(--map-land)" opacity={0.55} />)}
            {statePaths.map((d, i) => <path key={i} d={d} fill="var(--map-land)" />)}
            <path d={borderPath} fill="none" stroke="var(--map-line)" strokeWidth={0.9} vectorEffect="non-scaling-stroke" />
            <path d={coastPath} fill="none" stroke="var(--map-edge)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
            {placed.map((p) => {
              const r = res[p.i]
              const col = r.gain == null ? 'var(--text-3)' : gainColor(r.gain, lim)
              const empty = r.chosen === 0 || r.gain == null
              return (
                <circle key={p.s.loc} cx={p.xy![0]} cy={p.xy![1]} r={radius(p.i) + (hover === p.i ? 2 / Math.sqrt(view.k) : 0)}
                  fill={empty ? 'none' : col} fillOpacity={0.88} stroke={empty ? col : 'var(--surface)'} strokeWidth={1}
                  vectorEffect="non-scaling-stroke" onMouseEnter={() => setHover(p.i)} style={{ cursor: 'pointer' }} />
              )
            })}
            </g>
          </svg>
          <div className="legend" style={{ marginTop: 4, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <span style={{ whiteSpace: 'normal' }}>Selected lines' profit in each location, over the dropped lines ($/acre)</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                −${lim}
                <i style={{ width: 120, height: 8, margin: 0, borderRadius: 4, background: `linear-gradient(to right, ${LOST}, ${EVEN}, ${WON})` }} />
                +${lim}
              </span>
          </div>
          <div className="mapzoom">
            <button onClick={() => zoom(1.6)} aria-label="Zoom in" title="Zoom in" disabled={view.k >= 12}>+</button>
            <button onClick={() => zoom(1 / 1.6)} aria-label="Zoom out" title="Zoom out" disabled={view.k === 1}>−</button>
            <button onClick={() => setView(whole)} aria-label="Whole country" title="Whole country" disabled={view.k === 1}>↺</button>
          </div>
          </div>
        </div>
        <div>
          <div style={{ margin: '4px 0 12px' }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--good)' }}>{total.won}</span>
            <span className="small"> of {total.scored} locations above $0 ({pct(total.won / (total.scored || 1))})</span>
          </div>
          <div className="small muted">Your picks' edge, by the site's usual summer</div>
          {CLIMATES.map((c) => {
            const o = byClimate[c]
            return (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
                <Icons c={c} />
                <span className="small" style={{ whiteSpace: 'nowrap' }}>{LABEL[c]}</span>
                <span className="small" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  {o && o.scored
                    ? <b style={{ color: o.gain > 0 ? 'var(--good)' : LOST }}>{o.gain > 0 ? '+' : ''}{fmtUSD(o.gain, 1)} /acre</b>
                    : <span className="muted">no sites</span>}
                </span>
              </div>
            )
          })}
          <div className="small muted" style={{ marginTop: 8 }}>
            Hot: July averages about {toF(cut.heat)}°F or more. Wet: about {toIn(cut.rain)} in or more of rain, June to August.
          </div>
          {hs && hr && (
            <div className="lanes" style={{ marginTop: 12 }}>
              <b>{hs.loc}</b>
              <div className="small" style={{ marginTop: 6, lineHeight: 1.6 }}>
                {hr.gain != null
                  ? <>your lines here: <b style={{ color: hr.gain > 0 ? 'var(--good)' : LOST }}>{hr.gain > 0 ? '+' : ''}{fmtUSD(hr.gain, 1)}/ac</b> against the rest<br /></>
                  : <>too few of your lines here to compare<br /></>}
                {hr.chosen.toLocaleString('en-US')} of your plots, {hr.others.toLocaleString('en-US')} others<br />
                {hs.rain != null && hs.heat != null && <>summer rain {(hs.rain / 25.4).toFixed(1)} in · July {toF(hs.heat)}°F<br /></>}
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
