import { useLayoutEffect, useRef, useState } from 'react'

export const C = {
  bg: '#0b0e14',
  panel: '#121722',
  line: '#232a3a',
  text: '#dfe6f3',
  dim: '#8a94a8',
  sun: '#ffcc4d',
  earth: '#4da3ff',
  go: '#33c27f',
  power: '#d2553f',
  comm: '#7c5cd6',
  both: '#3b4252',
  ground: '#2a2f3a',
}

// draw works in CSS pixels
export function useCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const c = ref.current!
    const ro = new ResizeObserver(() => setSize({ w: c.clientWidth, h: c.clientHeight }))
    ro.observe(c)
    return () => ro.disconnect()
  }, [])
  useLayoutEffect(() => {
    const c = ref.current!
    const w = c.clientWidth
    const h = c.clientHeight
    if (!w || !h) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(w * dpr)
    c.height = Math.round(h * dpr)
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    draw(ctx, w, h)
  }, [size, ...deps])
  return ref
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtDate(tMs: number) {
  const d = new Date(tMs)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
}

export function fmtDateTime(tMs: number) {
  const d = new Date(tMs)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`
}

export function fmtLatLon(lat: number, lon: number) {
  return `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'}, ${lon.toFixed(2)}°E`
}

export function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  const u = Math.min(1, Math.max(0, t))
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * u)).join(',')})`
}
