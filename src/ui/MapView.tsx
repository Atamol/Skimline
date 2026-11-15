import { useEffect, useRef, useState } from 'react'
import type { Site } from '../app/data'
import { DEG } from '../core/const'
import { MAP_HALF_M, MAP_SIZE } from '../core/dem'
import { lonLatToXY, xyToLonLat } from '../core/projection'
import type { SeriesSample } from '../core/visibility'
import { C, fmtLatLon, useCanvas } from './canvas'

interface Props {
  sites: Site[]
  compare: string[]
  activeId?: string
  now?: SeriesSample
  onActive: (id: string) => void
  onAdd: (lat: number, lon: number) => void
}

let shadeJob: Promise<HTMLCanvasElement> | undefined

function loadShade(): Promise<HTMLCanvasElement> {
  shadeJob ??= fetch(new URL('data/map/shade.bin', document.baseURI))
    .then((r) => new Response(r.body!.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())
    .then((buf) => {
      const g = new Uint8Array(buf)
      const cv = document.createElement('canvas')
      cv.width = cv.height = MAP_SIZE
      const ctx = cv.getContext('2d')!
      const im = ctx.createImageData(MAP_SIZE, MAP_SIZE)
      for (let i = 0; i < g.length; i++) {
        im.data[i * 4] = g[i] * 0.8
        im.data[i * 4 + 1] = g[i] * 0.85
        im.data[i * 4 + 2] = g[i]
        im.data[i * 4 + 3] = 255
      }
      ctx.putImageData(im, 0, 0)
      return cv
    })
  return shadeJob
}

export function MapView({ sites, compare, activeId, now, onActive, onAdd }: Props) {
  const [shade, setShade] = useState<HTMLCanvasElement>()
  const [view, setView] = useState({ cx: 0, cy: 0, zoom: 1 })
  const [hover, setHover] = useState<{ lat: number; lon: number }>()
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean }>(undefined)
  const active = sites.find((s) => s.id === activeId)

  useEffect(() => {
    loadShade().then(setShade)
  }, [])

  useEffect(() => {
    if (!active || active.lat > -84) return
    const [x, y] = lonLatToXY(active.lon, active.lat)
    setView((v) => {
      const half = MAP_HALF_M / v.zoom
      return Math.abs(x - v.cx) < half * 0.9 && Math.abs(y - v.cy) < half * 0.9 ? v : { ...v, cx: x, cy: y }
    })
  }, [active?.id])

  const ref = useCanvas(
    (ctx, w, h) => {
      const scale = (Math.min(w, h) * view.zoom) / (2 * MAP_HALF_M)
      const X = (x: number) => w / 2 + (x - view.cx) * scale
      const Y = (y: number) => h / 2 - (y - view.cy) * scale
      ctx.fillStyle = '#05070c'
      ctx.fillRect(0, 0, w, h)
      if (shade) {
        ctx.imageSmoothingQuality = 'high'
        const s = 2 * MAP_HALF_M * scale
        ctx.drawImage(shade, X(-MAP_HALF_M), Y(MAP_HALF_M), s, s)
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.18)'
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '10px system-ui, sans-serif'
      ctx.lineWidth = 1
      for (const lat of [-89, -88, -87, -86, -85]) {
        const r = lonLatToXY(0, lat)[1] * scale
        ctx.beginPath()
        ctx.arc(X(0), Y(0), r, 0, 7)
        ctx.stroke()
        ctx.fillText(`${-lat}°S`, X(0) + 3, Y(0) - r - 3)
      }
      for (let lon = 0; lon < 360; lon += 30) {
        const [x, y] = lonLatToXY(lon, -84)
        ctx.beginPath()
        ctx.moveTo(X(0), Y(0))
        ctx.lineTo(X(x), Y(y))
        ctx.stroke()
      }

      for (const s of sites) {
        if (s.lat > -83.9) continue
        const [x, y] = lonLatToXY(s.lon, s.lat)
        const on = s.id === activeId
        ctx.beginPath()
        ctx.arc(X(x), Y(y), on ? 6 : 4, 0, 7)
        ctx.fillStyle = on ? '#fff' : compare.includes(s.id) ? C.go : 'rgba(255,255,255,0.45)'
        ctx.fill()
        ctx.strokeStyle = '#05070c'
        ctx.stroke()
        if (on || view.zoom >= 3) {
          ctx.fillStyle = '#fff'
          ctx.font = '11px system-ui, sans-serif'
          ctx.fillText(s.name, X(x) + 9, Y(y) + 4)
        }
      }

      // The projection is conformal, so a ground azimuth is the same angle on the map from local north
      if (active && now && active.lat <= -83.9) {
        const [x, y] = lonLatToXY(active.lon, active.lat)
        // North points away from the pole, and east longitude runs clockwise on this map
        const north = Math.atan2(x, y)
        const arrow = (az: number, color: string, len: number, solid: boolean) => {
          const a = north + az * DEG
          const ex = X(x) + Math.sin(a) * len
          const ey = Y(y) - Math.cos(a) * len
          ctx.strokeStyle = color
          ctx.lineWidth = 2
          ctx.setLineDash(solid ? [] : [4, 4])
          ctx.beginPath()
          ctx.moveTo(X(x), Y(y))
          ctx.lineTo(ex, ey)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(ex, ey, 3.5, 0, 7)
          ctx.fill()
        }
        arrow(now.earthAz, C.earth, 46, now.earthClear >= 0)
        arrow(now.sunAz, C.sun, 60, now.sunFrac > 0)
      }
    },
    [shade, view, sites, compare, activeId, now?.sunAz, now?.earthAz, now?.sunFrac, now?.earthClear],
  )

  const toMap = (e: React.MouseEvent<HTMLCanvasElement> | React.WheelEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const scale = (Math.min(r.width, r.height) * view.zoom) / (2 * MAP_HALF_M)
    return { x: view.cx + (e.clientX - r.left - r.width / 2) / scale, y: view.cy - (e.clientY - r.top - r.height / 2) / scale, scale }
  }

  return (
    <div className="map">
      <canvas
        ref={ref}
        style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
        onWheel={(e) => {
          const p = toMap(e)
          const zoom = Math.min(40, Math.max(1, view.zoom * (e.deltaY < 0 ? 1.3 : 1 / 1.3)))
          const k = view.zoom / zoom
          setView({ zoom, cx: p.x + (view.cx - p.x) * k, cy: p.y + (view.cy - p.y) * k })
        }}
        onMouseDown={(e) => (drag.current = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy, moved: false })}
        onMouseMove={(e) => {
          const p = toMap(e)
          const [lon, lat] = xyToLonLat(p.x, p.y)
          setHover({ lat, lon })
          const d = drag.current
          if (!d || !(e.buttons & 1)) return
          if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 3) d.moved = true
          if (d.moved) setView((v) => ({ ...v, cx: d.cx - (e.clientX - d.x) / p.scale, cy: d.cy + (e.clientY - d.y) / p.scale }))
        }}
        onMouseLeave={() => setHover(undefined)}
        onMouseUp={(e) => {
          const moved = drag.current?.moved
          drag.current = undefined
          if (moved) return
          const p = toMap(e)
          const near = sites.find((s) => {
            if (s.lat > -83.9) return false
            const [x, y] = lonLatToXY(s.lon, s.lat)
            return Math.hypot(x - p.x, y - p.y) * p.scale < 8
          })
          if (near) return onActive(near.id)
          const [lon, lat] = xyToLonLat(p.x, p.y)
          if (lat <= -84) onAdd(lat, lon)
        }}
      />
      <div className="map-note">{hover ? fmtLatLon(hover.lat, hover.lon) : 'click to add a site, scroll to zoom'}</div>
    </div>
  )
}
