import { useState } from 'react'
import type { Site } from '../app/data'
import { DAY_MS } from '../core/const'
import { fmtHours, type Metrics } from '../core/metrics'
import { C, fmtDate, fmtDateTime, mix, useCanvas } from './canvas'

export type MetricKey = 'go' | 'contSun' | 'sunlit' | 'comm' | 'dark'

export const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'go', label: 'Go / no-go' },
  { key: 'contSun', label: 'Power after landing' },
  { key: 'sunlit', label: 'Powered share of mission' },
  { key: 'comm', label: 'Earth link share of mission' },
  { key: 'dark', label: 'Longest darkness' },
]

export interface ChartRow {
  site: Site
  // one entry per column, undefined while the skyline is still being computed
  cells?: Metrics[]
}

interface Props {
  rows: ChartRow[]
  colTimes: number[]
  colStepMs: number
  metric: MetricKey
  missionDays: number
  landingMs: number
  activeId?: string
  onPick: (siteId: string, tMs: number) => void
}

const LABEL_W = 210
const AXIS_H = 26
const EMPTY = '#1a1f2b'

function cellColor(m: Metrics, metric: MetricKey, missionH: number) {
  switch (metric) {
    case 'go':
      return m.go ? C.go : !m.powerOk && !m.commOk ? C.both : m.powerOk ? C.comm : C.power
    case 'contSun':
      return mix(EMPTY, C.sun, Math.min(m.sunsetInH, missionH) / missionH)
    case 'sunlit':
      return mix(EMPTY, C.sun, m.sunlitPct / 100)
    case 'comm':
      return mix(EMPTY, C.earth, m.commPct / 100)
    case 'dark':
      return mix(C.go, '#3a1218', m.longestDarkH / missionH)
  }
}

export function SlipChart({ rows, colTimes, colStepMs, metric, missionDays, landingMs, activeId, onPick }: Props) {
  const [hover, setHover] = useState<{ row: number; col: number; x: number; y: number }>()
  const rowH = rows.length > 14 ? 20 : 26
  const height = AXIS_H + rows.length * rowH + 6
  const missionH = missionDays * 24
  const t0 = colTimes[0]
  const span = colTimes.length * colStepMs

  const ref = useCanvas(
    (ctx, w) => {
      const cw = (w - LABEL_W - 8) / colTimes.length
      const xOf = (t: number) => LABEL_W + ((t - t0) / span) * (w - LABEL_W - 8)

      ctx.font = '11px system-ui, sans-serif'
      ctx.textBaseline = 'middle'
      const days = span / DAY_MS
      const every = Math.max(1, Math.ceil(days / ((w - LABEL_W) / 58)))
      const firstDay = Math.ceil(t0 / DAY_MS)
      for (let d = firstDay; d * DAY_MS < t0 + span; d++) {
        const x = xOf(d * DAY_MS)
        const major = (d - firstDay) % every === 0
        ctx.fillStyle = major ? C.dim : C.line
        ctx.fillRect(x, major ? AXIS_H - 8 : AXIS_H - 4, 1, major ? 8 : 4)
        if (major) ctx.fillText(fmtDate(d * DAY_MS), x + 3, 9)
      }

      rows.forEach((row, i) => {
        const y = AXIS_H + i * rowH
        const active = row.site.id === activeId
        ctx.fillStyle = active ? C.text : C.dim
        ctx.font = `${active ? '600 ' : ''}12px system-ui, sans-serif`
        let name = row.site.name
        while (ctx.measureText(name).width > LABEL_W - 14 && name.length > 4) name = `${name.slice(0, -2)}…`
        ctx.fillText(name, 4, y + rowH / 2)
        if (!row.cells) {
          ctx.fillStyle = EMPTY
          ctx.fillRect(LABEL_W, y + 1, w - LABEL_W - 8, rowH - 2)
          ctx.fillStyle = C.dim
          ctx.font = '11px system-ui, sans-serif'
          ctx.fillText('computing skyline from terrain…', LABEL_W + 8, y + rowH / 2)
          return
        }
        row.cells.forEach((m, c) => {
          ctx.fillStyle = cellColor(m, metric, missionH)
          ctx.fillRect(LABEL_W + c * cw, y + 1, Math.max(1, cw - 0.6), rowH - 2)
        })
      })

      const xa = xOf(landingMs)
      const xb = Math.min(w - 8, xOf(landingMs + missionDays * DAY_MS))
      if (xa >= LABEL_W && xa <= w - 8) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)'
        ctx.fillRect(xa, AXIS_H - 3, Math.max(2, xb - xa), 2)
        ctx.fillRect(xa - 0.5, AXIS_H - 3, 1.5, rows.length * rowH + 6)
        const ai = rows.findIndex((r) => r.site.id === activeId)
        if (ai >= 0) {
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2
          ctx.strokeRect(xa - 1, AXIS_H + ai * rowH, Math.max(cw, 5) + 1, rowH)
        }
      }
    },
    [rows, colTimes, colStepMs, metric, missionDays, landingMs, activeId],
  )

  const locate = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const row = Math.floor((y - AXIS_H) / rowH)
    const col = Math.floor(((x - LABEL_W) / (r.width - LABEL_W - 8)) * colTimes.length)
    if (row < 0 || row >= rows.length || col >= colTimes.length) return undefined
    return { row, col: Math.max(col, -1), x, y }
  }

  const h = hover && hover.col >= 0 ? rows[hover.row]?.cells?.[hover.col] : undefined
  return (
    <div className="chart-wrap">
      <canvas
        ref={ref}
        style={{ width: '100%', height, cursor: 'pointer' }}
        onMouseMove={(e) => setHover(locate(e))}
        onMouseLeave={() => setHover(undefined)}
        onClick={(e) => {
          const p = locate(e)
          if (!p) return
          onPick(rows[p.row].site.id, p.col >= 0 ? colTimes[p.col] : landingMs)
        }}
      />
      {hover && h && (
        <div className="tip" style={{ left: Math.min(hover.x + 14, 9999), top: hover.y + 16 }}>
          <b>{rows[hover.row].site.name}</b>
          <div>Landing {fmtDateTime(colTimes[hover.col])}</div>
          <div className={h.go ? 'ok' : 'bad'}>{h.go ? 'GO' : `NO-GO: ${h.reasons.join('; ')}`}</div>
          <div>
            Power for {h.sunAtLanding ? fmtHours(Math.min(h.sunsetInH, missionH)) : '0 h'} after landing, {h.sunlitPct.toFixed(0)}% of mission
          </div>
          <div>
            Earth link {h.commPct.toFixed(0)}% of mission, longest darkness {fmtHours(h.longestDarkH)}
          </div>
        </div>
      )}
      <div className="legend">
        {metric === 'go' ? (
          <>
            <i style={{ background: C.go }} /> go
            <i style={{ background: C.power }} /> power fails
            <i style={{ background: C.comm }} /> Earth link fails
            <i style={{ background: C.both }} /> both fail
          </>
        ) : metric === 'dark' ? (
          <>
            <i style={{ background: C.go }} /> no darkness
            <i style={{ background: '#3a1218' }} /> dark for the whole mission
          </>
        ) : (
          <>
            <i style={{ background: EMPTY }} /> 0
            <i style={{ background: metric === 'comm' ? C.earth : C.sun }} /> {metric === 'contSun' ? `${missionDays} d or more` : '100%'}
          </>
        )}
        <span className="hint">Each cell is one landing time. Click a cell to inspect it below.</span>
      </div>
    </div>
  )
}
