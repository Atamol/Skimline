import { DEG, R_SUN_KM } from './const'
import type { Ephemeris } from './ephemeris'
import { azEl, type SiteFrame } from './frames'
import { horizonAt } from './horizon'

const STRIPS = 16

export function sunFraction(horizon: Float32Array, az: number, el: number, radius: number): number {
  const top = el + radius
  const bottom = el - radius
  // Skyline only varies slowly across half a degree, so two cheap bounds settle most cases
  const hc = horizonAt(horizon, az)
  if (bottom > hc + 3) return 1
  if (top < hc - 3) return 0
  const stretch = 1 / Math.max(Math.cos(el * DEG), 0.05)
  let sum = 0
  let weight = 0
  for (let k = 0; k < STRIPS; k++) {
    const dx = (-1 + (2 * k + 1) / STRIPS) * radius
    const half = Math.sqrt(radius * radius - dx * dx)
    const hz = horizonAt(horizon, az + dx * stretch)
    const vis = Math.min(1, Math.max(0, (el + half - hz) / (2 * half)))
    sum += vis * half
    weight += half
  }
  return sum / weight
}

export interface Series {
  t0: number
  stepMs: number
  n: number
  sunAz: Float32Array
  sunEl: Float32Array
  sunFrac: Float32Array
  earthAz: Float32Array
  earthEl: Float32Array
  // elevation of the Earth's center above the skyline at its azimuth, degrees
  earthClear: Float32Array
}

export function computeSeries(eph: Ephemeris, frame: SiteFrame, horizon: Float32Array, t0: number, n: number, stepMs: number): Series {
  const s: Series = {
    t0,
    stepMs,
    n,
    sunAz: new Float32Array(n),
    sunEl: new Float32Array(n),
    sunFrac: new Float32Array(n),
    earthAz: new Float32Array(n),
    earthEl: new Float32Array(n),
    earthClear: new Float32Array(n),
  }
  const v = new Float64Array(6)
  for (let i = 0; i < n; i++) {
    if (!eph.at(t0 + i * stepMs, v)) {
      s.sunFrac[i] = NaN
      s.earthClear[i] = NaN
      continue
    }
    const sun = azEl(frame, v[0], v[1], v[2])
    const earth = azEl(frame, v[3], v[4], v[5])
    s.sunAz[i] = sun.az
    s.sunEl[i] = sun.el
    s.sunFrac[i] = sunFraction(horizon, sun.az, sun.el, Math.asin(R_SUN_KM / sun.dist) / DEG)
    s.earthAz[i] = earth.az
    s.earthEl[i] = earth.el
    s.earthClear[i] = earth.el - horizonAt(horizon, earth.az)
  }
  return s
}

export interface SeriesSample {
  sunAz: number
  sunEl: number
  sunFrac: number
  earthAz: number
  earthEl: number
  earthClear: number
}

function lerpAz(a: number, b: number, f: number) {
  let d = b - a
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return (a + d * f + 360) % 360
}

export function sampleSeries(s: Series, tMs: number): SeriesSample {
  const h = Math.min(s.n - 1, Math.max(0, (tMs - s.t0) / s.stepMs))
  const i = Math.min(s.n - 2, Math.floor(h))
  const f = h - i
  const l = (a: Float32Array) => a[i] + (a[i + 1] - a[i]) * f
  return {
    sunAz: lerpAz(s.sunAz[i], s.sunAz[i + 1], f),
    sunEl: l(s.sunEl),
    sunFrac: l(s.sunFrac),
    earthAz: lerpAz(s.earthAz[i], s.earthAz[i + 1], f),
    earthEl: l(s.earthEl),
    earthClear: l(s.earthClear),
  }
}
