import { useEffect, useMemo, useState } from 'react'
import { DAY_MS, HOUR_MS } from '../core/const'
import { EPHEM_FIRST_YEAR, EPHEM_LAST_YEAR, yearsBetween } from '../core/ephemeris'
import { siteFrame } from '../core/frames'
import { computeMetrics, DEFAULT_REQUIREMENTS, fmtHours, type Metrics, type Requirements } from '../core/metrics'
import { computeSeries, sampleSeries, type Series } from '../core/visibility'
import { fmtDateTime, fmtLatLon } from '../ui/canvas'
import { MapView } from '../ui/MapView'
import { Panorama } from '../ui/Panorama'
import { RequirementsPanel } from '../ui/RequirementsPanel'
import { SiteList } from '../ui/SiteList'
import { type ChartRow, METRICS, type MetricKey, SlipChart } from '../ui/SlipChart'
import { Timeline } from '../ui/Timeline'
import { Validation } from '../ui/Validation'
import { SCENARIOS, type Scenario } from './scenarios'
import { ephemeris, getHorizon, horizonKey, loadSites, loadYears, type Site, type SiteHorizon } from './data'

const T_MIN = Date.UTC(EPHEM_FIRST_YEAR, 0, 1)
const T_MAX = Date.UTC(EPHEM_LAST_YEAR, 11, 1)
const VIEWS = [
  { days: 30, stepH: 6 },
  { days: 60, stepH: 12 },
  { days: 120, stepH: 24 },
  { days: 360, stepH: 72 },
]

const floorDay = (t: number) => Math.floor(t / DAY_MS) * DAY_MS
const toInput = (t: number) => new Date(t).toISOString().slice(0, 16)

function loadCustom(): Site[] {
  try {
    return JSON.parse(localStorage.getItem('custom-sites') ?? '[]')
  } catch {
    return []
  }
}

function countdown(setInH: number, riseInH: number, setWord: string, riseWord: string, beyond: (what: string) => string) {
  if (setInH > 0) return Number.isFinite(setInH) ? `${setWord} in ${fmtHours(setInH)}` : beyond(`No ${setWord.toLowerCase()}`)
  return Number.isFinite(riseInH) ? `${riseWord} in ${fmtHours(riseInH)}` : beyond(`No ${riseWord.toLowerCase()}`)
}

export function App() {
  const [builtin, setBuiltin] = useState<Site[]>([])
  const [custom, setCustom] = useState<Site[]>(loadCustom)
  const [compare, setCompare] = useState<string[]>([])
  const [activeId, setActiveId] = useState<string>()
  const [landingMs, setLandingMs] = useState(() => floorDay(Date.now()) + 30 * DAY_MS)
  const [viewStart, setViewStart] = useState(() => floorDay(Date.now()) + 15 * DAY_MS)
  const [viewDays, setViewDays] = useState(60)
  const [cursorH, setCursorH] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [req, setReq] = useState<Requirements>(DEFAULT_REQUIREMENTS)
  const [metric, setMetric] = useState<MetricKey>('go')
  const [horizons, setHorizons] = useState<Record<string, SiteHorizon>>({})
  const [ephVersion, setEphVersion] = useState(0)
  const [page, setPage] = useState<'navigator' | 'validation'>('navigator')
  const [pinId, setPinId] = useState('')
  const [scenario, setScenario] = useState<Scenario | undefined>(SCENARIOS[0])

  const sites = useMemo(() => [...builtin, ...custom], [builtin, custom])
  const active = sites.find((s) => s.id === activeId)
  const shown = useMemo(() => sites.filter((s) => compare.includes(s.id) || s.id === activeId || s.id === pinId), [sites, compare, activeId, pinId])
  const view = VIEWS.find((v) => v.days === viewDays)!
  const missionH = req.missionDays * 24
  const cursorMs = landingMs + Math.min(cursorH, missionH) * HOUR_MS

  useEffect(() => {
    loadSites().then((list) => {
      setBuiltin(list)
      applyScenario(SCENARIOS[0], list)
    })
  }, [])

  useEffect(() => localStorage.setItem('custom-sites', JSON.stringify(custom)), [custom])

  const seriesStart = Math.min(viewStart, floorDay(landingMs))
  const seriesEnd = Math.max(viewStart + viewDays * DAY_MS, landingMs) + (req.missionDays + 1) * DAY_MS
  useEffect(() => {
    let live = true
    loadYears(yearsBetween(seriesStart, seriesEnd)).then(() => live && setEphVersion((v) => v + 1))
    return () => {
      live = false
    }
  }, [seriesStart, seriesEnd])

  useEffect(() => {
    for (const s of shown) {
      const key = horizonKey(s, req.mastM)
      if (horizons[key]) continue
      getHorizon(s, req.mastM).then((h) => setHorizons((m) => (m[key] ? m : { ...m, [key]: h })))
    }
  }, [shown, req.mastM, horizons])

  const series = useMemo(() => {
    const out = new Map<string, Series>()
    if (!yearsBetween(seriesStart, seriesEnd).every((y) => ephemeris.hasYear(y))) return out
    const n = Math.round((seriesEnd - seriesStart) / HOUR_MS) + 1
    for (const s of shown) {
      const h = horizons[horizonKey(s, req.mastM)]
      if (h) out.set(s.id, computeSeries(ephemeris, siteFrame(s.lon, s.lat, (h.groundM + req.mastM) / 1000), h.horizon, seriesStart, n, HOUR_MS))
    }
    return out
    // ephVersion stands in for the ephemeris contents
  }, [shown, horizons, req.mastM, seriesStart, seriesEnd, ephVersion])

  const colTimes = useMemo(() => {
    const out: number[] = []
    for (let t = viewStart; t < viewStart + viewDays * DAY_MS; t += view.stepH * HOUR_MS) out.push(t)
    return out
  }, [viewStart, viewDays, view.stepH])

  const compared = useMemo(() => sites.filter((s) => compare.includes(s.id)), [sites, compare])
  const chartRows: ChartRow[] = useMemo(
    () =>
      compared.map((site) => {
        const s = series.get(site.id)
        return { site, cells: s && colTimes.map((t) => computeMetrics(s, req, t)) }
      }),
    [compared, series, colTimes, req],
  )

  const atLanding = useMemo(() => {
    const out = new Map<string, Metrics>()
    for (const [id, s] of series) out.set(id, computeMetrics(s, req, landingMs))
    return out
  }, [series, req, landingMs])

  useEffect(() => {
    if (!playing) return
    const step = Math.max(0.5, missionH / 300)
    const timer = setInterval(() => {
      setCursorH((h) => {
        if (h + step >= missionH) {
          setPlaying(false)
          return missionH
        }
        return h + step
      })
    }, 60)
    return () => clearInterval(timer)
  }, [playing, missionH])

  const moveLanding = (t: number) => {
    const c = Math.min(T_MAX, Math.max(T_MIN, t))
    setLandingMs(c)
    setCursorH(0)
    if (c < viewStart || c >= viewStart + viewDays * DAY_MS) setViewStart(floorDay(c) - Math.floor(viewDays / 4) * DAY_MS)
  }
  const shiftView = (dir: number) => setViewStart((v) => Math.min(T_MAX, Math.max(T_MIN, v + dir * Math.floor(viewDays / 2) * DAY_MS)))

  const applyScenario = (sc: Scenario, list: Site[] = sites) => {
    setScenario(sc)
    setPinId('')
    setCompare(sc.compare.flatMap((c) => (c.startsWith('group:') ? list.filter((s) => s.group === c.slice(6)).map((s) => s.id) : [c])))
    setActiveId(sc.active)
    setReq({ ...DEFAULT_REQUIREMENTS, ...sc.req })
    const t = typeof sc.landing === 'number' ? floorDay(Date.now()) + sc.landing * DAY_MS : Date.parse(sc.landing)
    setLandingMs(t)
    setCursorH(0)
    setPlaying(false)
    setViewDays(sc.viewDays)
    setViewStart(floorDay(t) - Math.floor(sc.viewDays / 4) * DAY_MS)
  }

  const addSite = (s: Site) => {
    setCustom((c) => [...c, s])
    setCompare((c) => [...c, s.id])
    setActiveId(s.id)
  }

  const beyond = (what: string) => `${what} for the next ${Math.round((seriesEnd - cursorMs) / DAY_MS)} d or more`
  const pin = sites.find((s) => s.id === pinId && s.id !== activeId)
  const tracking = req.panel === 'tracking'
  const activeSeries = active && series.get(active.id)
  const activeHorizon = active && horizons[horizonKey(active, req.mastM)]
  const now = activeSeries && sampleSeries(activeSeries, cursorMs)
  const nowM = activeSeries && computeMetrics(activeSeries, req, cursorMs)
  const landM = active && atLanding.get(active.id)

  return (
    <div className="app">
      <header>
        <div className="brand">
          <h1>Skimline</h1>
          <p>If the landing date slips, which sites still work?</p>
        </div>
        <div className="tabs">
          <button className={page === 'navigator' ? 'on' : ''} onClick={() => setPage('navigator')}>
            Navigator
          </button>
          <button className={page === 'validation' ? 'on' : ''} onClick={() => setPage('validation')}>
            Validation
          </button>
        </div>
        <label>
          Example
          <select value={scenario?.id ?? ''} onChange={(e) => applyScenario(SCENARIOS.find((x) => x.id === e.target.value)!)}>
            {!scenario && <option value="">custom</option>}
            {SCENARIOS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Landing (UTC)
          <input type="datetime-local" value={toInput(landingMs)} onChange={(e) => e.target.value && moveLanding(Date.parse(`${e.target.value}:00Z`))} />
        </label>
        <label>
          Mission length
          <span className="unit">
            <input
              type="number"
              min={1}
              max={60}
              value={req.missionDays}
              onChange={(e) => setReq({ ...req, missionDays: Math.min(60, Math.max(1, Math.round(+e.target.value) || 1)) })}
            />
            Earth days
          </span>
        </label>
        <div className="player">
          <button onClick={() => (cursorH >= missionH ? (setCursorH(0), setPlaying(true)) : setPlaying(!playing))}>{playing ? 'Pause' : 'Play'}</button>
          <input type="range" min={0} max={missionH} step={0.25} value={Math.min(cursorH, missionH)} onChange={(e) => setCursorH(+e.target.value)} />
          <span className="clock">
            {fmtDateTime(cursorMs)} <em>T+{fmtHours(Math.min(cursorH, missionH))}</em>
          </span>
        </div>
      </header>

      <aside>
        <SiteList
          sites={sites}
          compare={compare}
          activeId={activeId}
          onToggle={(id) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))}
          onActive={setActiveId}
          onAdd={addSite}
          onRemove={(id) => {
            setCustom((c) => c.filter((s) => s.id !== id))
            setCompare((c) => c.filter((x) => x !== id))
          }}
        />
        <RequirementsPanel req={req} onChange={setReq} />
      </aside>

      <main hidden={page !== 'validation'}>
        <Validation />
      </main>
      <main hidden={page !== 'navigator'}>
        {scenario && (
          <p className="blurb">
            {scenario.blurb}{' '}
            {scenario.source && (
              <a href={scenario.source} target="_blank" rel="noreferrer">
                source
              </a>
            )}
          </p>
        )}
        <section>
          <div className="sec-head">
            <h2>Slip chart</h2>
            <select value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)}>
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <span className="spacer" />
            <button onClick={() => shiftView(-1)}>◀</button>
            <select value={viewDays} onChange={(e) => setViewDays(+e.target.value)}>
              {VIEWS.map((v) => (
                <option key={v.days} value={v.days}>
                  {v.days} days of landing dates
                </option>
              ))}
            </select>
            <button onClick={() => shiftView(1)}>▶</button>
          </div>
          {chartRows.length ? (
            <SlipChart
              rows={chartRows}
              colTimes={colTimes}
              colStepMs={view.stepH * HOUR_MS}
              metric={metric}
              missionDays={req.missionDays}
              landingMs={landingMs}
              activeId={activeId}
              onPick={(id, t) => {
                setActiveId(id)
                moveLanding(t)
              }}
            />
          ) : (
            <p className="empty">Tick sites on the left to compare them.</p>
          )}
        </section>

        {active && (
          <section>
            <div className="cards">
              <div className={`card ${landM ? (landM.go ? 'ok' : 'bad') : ''}`}>
                <small>Landing {fmtDateTime(landingMs)}</small>
                <strong>{landM ? (landM.go ? 'GO' : 'NO-GO') : '…'}</strong>
                <span>{landM ? (landM.go ? `Power and Earth link hold for ${req.missionDays} days` : landM.reasons.join('. ')) : ''}</span>
              </div>
              <div className="card sun">
                <small>{tracking ? 'Sun now' : 'Solar power now'}</small>
                <strong>{nowM ? countdown(nowM.sunsetInH, nowM.sunriseInH, tracking ? 'Sunset' : 'Power loss', tracking ? 'Sunrise' : 'Power back', beyond) : '…'}</strong>
                <span>{now ? `elevation ${now.sunEl.toFixed(2)}°, ${(now.sunFrac * 100).toFixed(0)}% of the disk in view` : ''}</span>
              </div>
              <div className="card earth">
                <small>Earth now</small>
                <strong>{nowM ? countdown(nowM.earthsetInH, nowM.earthriseInH, 'Earthset', 'Earthrise', beyond) : '…'}</strong>
                <span>{now ? `elevation ${now.earthEl.toFixed(2)}°, ${now.earthClear.toFixed(2)}° above the skyline` : ''}</span>
              </div>
              <div className="card">
                <small>Battery to bridge the longest darkness</small>
                <strong>{landM ? `${(landM.batteryWh / 1000).toFixed(landM.batteryWh < 10000 ? 2 : 1)} kWh` : '…'}</strong>
                <span>{landM ? `${fmtHours(landM.longestDarkH)} dark at ${req.loadW} W` : ''}</span>
              </div>
            </div>
            <div className="detail">
              <div>
                <Panorama site={active} sh={activeHorizon} series={activeSeries} landingMs={landingMs} cursorMs={cursorMs} req={req} />
                {pin && <Panorama site={pin} sh={horizons[horizonKey(pin, req.mastM)]} series={series.get(pin.id)} landingMs={landingMs} cursorMs={cursorMs} req={req} />}
                <label className="pin">
                  Compare the sky with
                  <select value={pin ? pinId : ''} onChange={(e) => setPinId(e.target.value)}>
                    <option value="">no other site</option>
                    {sites
                      .filter((s) => s.id !== activeId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <MapView
                sites={sites}
                compare={compare}
                activeId={activeId}
                now={now}
                onActive={setActiveId}
                onAdd={(lat, lon) => addSite({ id: `custom-${Date.now()}`, name: `Pick ${fmtLatLon(lat, lon)}`, group: 'Custom', lat, lon })}
              />
            </div>
          </section>
        )}

        {shown.length > 0 && (
          <section>
            <div className="sec-head">
              <h2>Mission timeline</h2>
            </div>
            <Timeline
              rows={shown.map((site) => ({ site, series: series.get(site.id) }))}
              activeId={activeId}
              landingMs={landingMs}
              cursorMs={cursorMs}
              req={req}
              onCursor={(t) => setCursorH((t - landingMs) / HOUR_MS)}
              onPickSite={setActiveId}
            />
            <table className="compare">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Verdict</th>
                  <th>Power after landing</th>
                  <th>Powered</th>
                  <th>Earth link</th>
                  <th>Longest darkness</th>
                  <th>Longest link gap</th>
                  <th>Mean power</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => {
                  const m = atLanding.get(s.id)
                  return (
                    <tr key={s.id} className={s.id === activeId ? 'active' : ''} onClick={() => setActiveId(s.id)}>
                      <td>
                        {s.name} <small>{fmtLatLon(s.lat, s.lon)}</small>
                      </td>
                      {m ? (
                        <>
                          <td className={m.go ? 'ok' : 'bad'} title={m.reasons.join('. ')}>
                            {m.go ? 'GO' : 'NO-GO'}
                          </td>
                          <td>{m.sunAtLanding ? fmtHours(Math.min(m.sunsetInH, missionH)) : 'none at landing'}</td>
                          <td>{m.sunlitPct.toFixed(0)}%</td>
                          <td>{m.commPct.toFixed(0)}%</td>
                          <td>{fmtHours(m.longestDarkH)}</td>
                          <td>{fmtHours(m.longestCommGapH)}</td>
                          <td>{(m.meanPower * 100).toFixed(0)}%</td>
                        </>
                      ) : (
                        <td colSpan={7}>computing…</td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )}

        <footer>
          Sun and Earth positions: JPL Horizons. Terrain: LRO LOLA polar elevation models (NASA GSFC PGDA). Times are UTC.
        </footer>
      </main>
    </div>
  )
}
