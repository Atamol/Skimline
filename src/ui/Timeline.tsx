import type { Site } from '../app/data'
import { DAY_MS } from '../core/const'
import { powerFactor, type Requirements } from '../core/metrics'
import type { Series } from '../core/visibility'
import { C, fmtDate, useCanvas } from './canvas'

interface Props {
  rows: { site: Site; series?: Series }[]
  activeId?: string
  landingMs: number
  cursorMs: number
  req: Requirements
  onCursor: (tMs: number) => void
  onPickSite: (id: string) => void
}

const LABEL_W = 210
const AXIS_H = 22
const ROW_H = 30

export function Timeline({ rows, activeId, landingMs, cursorMs, req, onCursor, onPickSite }: Props) {
  const span = req.missionDays * DAY_MS
  const height = AXIS_H + rows.length * ROW_H + 4

  const ref = useCanvas(
    (ctx, w) => {
      const pw = w - LABEL_W - 8
      const xOf = (t: number) => LABEL_W + ((t - landingMs) / span) * pw
      ctx.font = '11px system-ui, sans-serif'
      ctx.textBaseline = 'middle'
      const every = Math.max(1, Math.ceil(req.missionDays / (pw / 58)))
      for (let d = 0; d <= req.missionDays; d++) {
        const x = xOf(landingMs + d * DAY_MS)
        ctx.fillStyle = d % every ? C.line : C.dim
        ctx.fillRect(x, AXIS_H - 6, 1, 6)
        // The landing label is wide, so the first few day labels give way to it
        if (d % every === 0 && x < w - 40 && (d === 0 || x > LABEL_W + 96)) ctx.fillText(d === 0 ? `Landing ${fmtDate(landingMs)}` : `+${d} d`, x + 3, 8)
      }
      rows.forEach(({ site, series }, r) => {
        const y = AXIS_H + r * ROW_H
        const active = site.id === activeId
        ctx.fillStyle = active ? C.text : C.dim
        ctx.font = `${active ? '600 ' : ''}12px system-ui, sans-serif`
        let name = site.name
        while (ctx.measureText(name).width > LABEL_W - 14 && name.length > 4) name = `${name.slice(0, -2)}…`
        ctx.fillText(name, 4, y + ROW_H / 2)
        ctx.fillStyle = '#161b27'
        ctx.fillRect(LABEL_W, y + 3, pw, 11)
        ctx.fillRect(LABEL_W, y + 16, pw, 9)
        if (!series) return
        const i0 = Math.max(0, Math.round((landingMs - series.t0) / series.stepMs))
        const n = Math.round(span / series.stepMs)
        const cw = pw / n
        for (let k = 0; k < n && i0 + k < series.n; k++) {
          const p = powerFactor(req, series, i0 + k)
          if (p > 0.005) {
            ctx.globalAlpha = 0.15 + 0.85 * Math.min(1, p)
            ctx.fillStyle = C.sun
            ctx.fillRect(LABEL_W + k * cw, y + 3, cw + 0.5, 11)
          }
          if (series.earthClear[i0 + k] >= req.earthMarginDeg) {
            ctx.globalAlpha = 1
            ctx.fillStyle = C.earth
            ctx.fillRect(LABEL_W + k * cw, y + 16, cw + 0.5, 9)
          }
        }
        ctx.globalAlpha = 1
      })
      ctx.fillStyle = '#fff'
      ctx.fillRect(xOf(cursorMs) - 0.5, AXIS_H - 6, 1.5, rows.length * ROW_H + 8)
    },
    [rows, activeId, landingMs, cursorMs, req],
  )

  const act = (e: React.MouseEvent<HTMLCanvasElement>, click: boolean) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - r.left
    if (x < LABEL_W) {
      const row = Math.floor((e.clientY - r.top - AXIS_H) / ROW_H)
      if (click && rows[row]) onPickSite(rows[row].site.id)
      return
    }
    const f = Math.min(1, Math.max(0, (x - LABEL_W) / (r.width - LABEL_W - 8)))
    onCursor(landingMs + f * span)
  }

  return (
    <div>
      <canvas
        ref={ref}
        style={{ width: '100%', height, cursor: 'col-resize' }}
        onMouseDown={(e) => act(e, true)}
        onMouseMove={(e) => e.buttons & 1 && act(e, false)}
      />
      <div className="legend">
        <i style={{ background: C.sun }} /> solar power (brightness follows the share of the Sun's disk in view and the array angle)
        <i style={{ background: C.earth }} /> Earth in view for a direct link
      </div>
    </div>
  )
}
