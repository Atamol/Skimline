import { useEffect, useRef, useState } from 'react'
import type { Site, SiteHorizon } from '../app/data'
import { DAY_MS } from '../core/const'
import { horizonAt } from '../core/horizon'
import type { Requirements } from '../core/metrics'
import { sampleSeries, type Series } from '../core/visibility'
import { C, fmtLatLon, useCanvas } from './canvas'

interface Props {
  site: Site
  sh?: SiteHorizon
  series?: Series
  landingMs: number
  cursorMs: number
  req: Requirements
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const PAD_L = 34
const PAD_B = 20

export function Panorama({ site, sh, series, landingMs, cursorMs, req }: Props) {
  const [center, setCenter] = useState<number>()
  const drag = useRef<{ x: number; c: number }>(undefined)

  // Start with the Earth in the middle of the view, since that is where the antenna points
  const auto = series ? sampleSeries(series, landingMs).earthAz : 0
  useEffect(() => setCenter(undefined), [site.id])
  const centerAz = center ?? auto

  const ref = useCanvas(
    (ctx, w, h) => {
      const pw = w - PAD_L
      const ph = h - PAD_B
      const hz = sh?.horizon
      let hzMin = 0
      let hzMax = 0
      if (hz) {
        hzMin = Infinity
        hzMax = -Infinity
        for (const v of hz) {
          if (v < hzMin) hzMin = v
          if (v > hzMax) hzMax = v
        }
      }
      const i0 = series ? Math.max(0, Math.round((landingMs - series.t0) / series.stepMs)) : 0
      const i1 = series ? Math.min(series.n, i0 + Math.round((req.missionDays * DAY_MS) / series.stepMs) + 1) : 0
      let top = Math.max(hzMax, 4)
      if (series) for (let i = i0; i < i1; i++) top = Math.max(top, series.sunEl[i], series.earthEl[i])
      const elMax = Math.min(90, top + (top > 30 ? 6 : 2))
      const elMin = Math.max(-12, Math.min(hzMin, -1) - 1)
      const X = (az: number) => PAD_L + ((((az - centerAz + 540) % 360) + 360) % 360) / 360 * pw
      const Y = (el: number) => ((elMax - el) / (elMax - elMin)) * ph

      const sky = ctx.createLinearGradient(0, 0, 0, ph)
      sky.addColorStop(0, '#05070c')
      sky.addColorStop(1, '#101624')
      ctx.fillStyle = sky
      ctx.fillRect(PAD_L, 0, pw, ph)

      ctx.font = '11px system-ui, sans-serif'
      ctx.textBaseline = 'middle'
      const range = elMax - elMin
      const step = range > 60 ? 15 : range > 25 ? 5 : range > 10 ? 2 : 1
      for (let e = Math.ceil(elMin / step) * step; e <= elMax; e += step) {
        ctx.fillStyle = e === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.06)'
        ctx.fillRect(PAD_L, Y(e), pw, 1)
        ctx.fillStyle = C.dim
        ctx.textAlign = 'right'
        ctx.fillText(`${e}°`, PAD_L - 5, Y(e))
      }
      ctx.textAlign = 'center'
      for (let k = 0; k < 8; k++) {
        const x = X(k * 45)
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        ctx.fillRect(x, 0, 1, ph)
        ctx.fillStyle = k % 2 ? C.dim : C.text
        ctx.fillText(COMPASS[k], x, ph + 11)
      }

      ctx.save()
      ctx.beginPath()
      ctx.rect(PAD_L, 0, pw, ph)
      ctx.clip()

      const track = (az: Float32Array, el: Float32Array, lit: (i: number) => boolean, color: string) => {
        if (!series) return
        ctx.lineWidth = 2
        for (let i = i0; i < i1 - 1; i++) {
          const xa = X(az[i])
          const xb = X(az[i + 1])
          if (Math.abs(xa - xb) > pw / 2) continue
          ctx.strokeStyle = lit(i) ? color : 'rgba(140,150,170,0.35)'
          ctx.beginPath()
          ctx.moveTo(xa, Y(el[i]))
          ctx.lineTo(xb, Y(el[i + 1]))
          ctx.stroke()
        }
        if (req.missionDays <= 40) {
          ctx.fillStyle = color
          ctx.textAlign = 'left'
          const perDay = Math.round(DAY_MS / series.stepMs)
          const label = Math.max(1, Math.ceil(req.missionDays / 12))
          for (let i = i0, d = 0; i < i1; i += perDay, d++) {
            ctx.beginPath()
            ctx.arc(X(az[i]), Y(el[i]), 2.5, 0, 7)
            ctx.fill()
            if (d % label === 0) ctx.fillText(`+${d}d`, X(az[i]) + 5, Y(el[i]) - 8)
          }
        }
      }
      if (series) {
        track(series.earthAz, series.earthEl, (i) => series.earthClear[i] >= req.earthMarginDeg, C.earth)
        track(series.sunAz, series.sunEl, (i) => series.sunFrac[i] > 0.01, C.sun)
      }

      // Terrain goes on top of the tracks so anything behind the skyline reads as hidden
      if (hz) {
        ctx.beginPath()
        ctx.moveTo(PAD_L, ph)
        for (let x = 0; x <= pw; x++) ctx.lineTo(PAD_L + x, Y(horizonAt(hz, centerAz - 180 + (360 * x) / pw)))
        ctx.lineTo(w, ph)
        ctx.closePath()
        ctx.fillStyle = 'rgba(42,47,58,0.9)'
        ctx.fill()
        ctx.strokeStyle = '#7d8799'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      if (series) {
        const now = sampleSeries(series, cursorMs)
        const body = (az: number, el: number, r: number, color: string, shown: boolean, name: string) => {
          const x = X(az)
          const y = Y(Math.max(el, elMin + 0.2))
          ctx.beginPath()
          ctx.arc(x, y, r, 0, 7)
          if (shown) {
            ctx.shadowColor = color
            ctx.shadowBlur = 14
            ctx.fillStyle = color
            ctx.fill()
            ctx.shadowBlur = 0
          } else {
            ctx.setLineDash([3, 3])
            ctx.strokeStyle = color
            ctx.lineWidth = 1.5
            ctx.stroke()
            ctx.setLineDash([])
          }
          ctx.fillStyle = color
          ctx.textAlign = 'center'
          ctx.font = '600 11px system-ui, sans-serif'
          ctx.fillText(name, x, y - r - 8)
        }
        body(now.earthAz, now.earthEl, 8, C.earth, now.earthClear >= req.earthMarginDeg, 'Earth')
        body(now.sunAz, now.sunEl, 6, C.sun, now.sunFrac > 0.01, 'Sun')
      }
      ctx.restore()
    },
    [sh, series, landingMs, cursorMs, req, centerAz],
  )

  return (
    <div className="pano">
      <div className="pano-head">
        <b>{site.name}</b>
        <span>{fmtLatLon(site.lat, site.lon)}</span>
        <span>
          {!sh
            ? 'computing skyline…'
            : sh.detail === 'sphere'
              ? 'smooth-sphere horizon (terrain is modeled south of 82°S)'
              : `skyline from ${sh.detail === '5m' ? 'the 5 m LOLA model' : '40 m LOLA tiles'}, ground at ${sh.groundM.toFixed(0)} m, array ${req.mastM} m above it`}
        </span>
        <span className="hint">drag to turn</span>
      </div>
      <canvas
        ref={ref}
        style={{ width: '100%', height: 250, cursor: 'ew-resize' }}
        onMouseDown={(e) => (drag.current = { x: e.clientX, c: centerAz })}
        onMouseMove={(e) => {
          if (!drag.current || !(e.buttons & 1)) return
          const w = e.currentTarget.clientWidth - PAD_L
          setCenter((((drag.current.c - ((e.clientX - drag.current.x) / w) * 360) % 360) + 360) % 360)
        }}
        onMouseUp={() => (drag.current = undefined)}
      />
    </div>
  )
}
