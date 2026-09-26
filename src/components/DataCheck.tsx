import { useState } from 'react'
import { checkText, NAMES, type Report } from '../lib/datacheck'

const n0 = (x: number) => x.toLocaleString()
const pct = (x: number) => `${(x * 100).toFixed(1)}%`

/** Drop a season's field results; ProMaize cleans them in the browser the way the pipeline does,
 *  and says what it found. The ranking itself runs in the pipeline. */
export default function DataCheck({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState<number | null>(null)
  const [rep, setRep] = useState<Report | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [over, setOver] = useState(false)

  async function run(file: File | undefined) {
    if (!file) return
    setErr(null); setRep(null); setBusy(0)
    try { setRep(await checkText(await file.text(), file.name, setBusy)) } catch (x) { setErr(String(x)) } finally { setBusy(null) }
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    run(file)
  }

  const imp = rep ? Object.entries(rep.impossible) : []
  return (
    <div className="datacheck">
      <label className={`dropzone${over ? ' over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); run(e.dataTransfer.files?.[0]) }}>
        <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden style={{ flex: 'none' }}>
          <path d="M9 12 V3 M5 6.5 L9 2.5 L13 6.5 M3 12.5 V15 H15 V12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{busy != null ? `Cleaning… ${Math.round(busy * 100)}%`
          : <><b>Load a new season</b>: drop its field results here (CSV), or click to choose</>}</span>
      </label>
      {!compact && !rep && busy == null && (
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          Runs in your browser, nothing is uploaded anywhere. Same steps as below: names fixed, impossible values
          removed, missing kept missing, every plot compared with its own field.
        </p>
      )}
      {err && <p className="small" style={{ color: '#d04a3a' }}>Could not read that file: {err}</p>}
      {rep && rep.missingColumns.length > 0 && (
        <p className="small" style={{ margin: '8px 0 0' }}>
          <b>{rep.file}</b> doesn't look like field results: no column for {rep.missingColumns.join(', ')}. ProMaize needs a
          line name, a year, a location and a yield for every plot.
        </p>
      )}
      {rep && rep.missingColumns.length === 0 && (
        <div className="small" style={{ marginTop: 8, lineHeight: 1.6 }}>
          <b>{rep.file}</b>: {n0(rep.rows)} plots, cleaned in {rep.seconds.toFixed(1)} s
          <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            <li>{rep.idsFixed ? <>{n0(rep.idsFixed)} line names fixed (a stray ".0").</> : <>Line names clean.</>}{' '}
              {n0(rep.lines)} lines{rep.families ? <> in {n0(rep.families)} families</> : null}.</li>
            <li>{imp.length
              ? <>Impossible values set to missing: {imp.map(([t, c]) => `${n0(c)} ${NAMES[t]}`).join(', ')}.</>
              : <>No impossible values.</>}</li>
            <li>Missing stays missing: {Object.entries(rep.recorded).map(([t, s]) => `${NAMES[t]} ${pct(s)}`).join(', ')} recorded.</li>
            <li><b>{n0(rep.trials)}</b> trials ({rep.years[0]} to {rep.years[1]}, {n0(rep.locations)} locations, about{' '}
              {n0(rep.plotsPerTrial)} plots each); every plot is compared with its own field. Field averages ran from{' '}
              {rep.trialSpread[0].toFixed(0)} to {rep.trialSpread[1].toFixed(0)} bu/ac: that gap is the field, not the line.</li>
          </ol>
          <div style={{ marginTop: 6 }}>
            <b>Clean and ready for the model.</b> With the DNA files for these lines, the pipeline ranks them in about
            five minutes (<span className="mono">scripts/build_data.py</span>).
          </div>
        </div>
      )}
    </div>
  )
}
