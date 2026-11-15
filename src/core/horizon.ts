import { DEG, R_MOON_KM } from './const'
import { type DemWindow, sampleWindow } from './dem'
import { siteFrame } from './frames'
import { lonLatToXY } from './projection'

const R_M = R_MOON_KM * 1000

export const N_AZ = 1440

export interface HorizonLevel {
  win: DemWindow
  maxDist: number
}

export interface HorizonResult {
  // degrees, one value per 360 / N_AZ of azimuth starting at north
  horizon: Float32Array
  // above the 1737.4 km sphere
  groundM: number
}

export const PRECOMPUTED_MASTS = [1, 2, 3, 5, 10]

// Keyed by site id. Each skyline is a base64 Float32Array of N_AZ values
export type PrecomputedHorizons = Record<string, { lat: number; lon: number; groundM: number; masts: Record<string, string> }>

export function sphereHorizon(heightM: number): Float32Array {
  const dip = -Math.acos(R_M / (R_M + Math.max(heightM, 0))) / DEG
  return new Float32Array(N_AZ).fill(dip)
}

// levels must be ordered fine to coarse
export function computeHorizon(lonDeg: number, latDeg: number, mastM: number, levels: HorizonLevel[]): HorizonResult {
  const f = siteFrame(lonDeg, latDeg, 0)
  const [sx, sy] = lonLatToXY(lonDeg, latDeg)
  let groundM = NaN
  for (const l of levels) {
    groundM = sampleWindow(l.win, sx, sy)
    if (groundM === groundM) break
  }
  if (groundM !== groundM) groundM = 0
  const ro = R_M + groundM + mastM

  const dist: number[] = []
  const lvl: number[] = []
  const last = levels[levels.length - 1]
  for (let d = levels[0].win.res, li = 0; d <= last.maxDist; ) {
    while (d > levels[li].maxDist) li++
    dist.push(d)
    lvl.push(li)
    d += Math.max(levels[li].win.res, d * 0.002)
  }
  const n = dist.length
  const cd = new Float64Array(n)
  const sd = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    cd[i] = Math.cos(dist[i] / R_M)
    sd[i] = Math.sin(dist[i] / R_M)
  }

  const horizon = new Float32Array(N_AZ)
  const [ux, uy, uz] = f.up
  for (let j = 0; j < N_AZ; j++) {
    const a = ((j * 360) / N_AZ) * DEG
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const tx = f.north[0] * ca + f.east[0] * sa
    const ty = f.north[1] * ca + f.east[1] * sa
    const tz = f.north[2] * ca + f.east[2] * sa
    let best = -Infinity
    for (let i = 0; i < n; i++) {
      const pz = uz * cd[i] + tz * sd[i]
      const k = (2 * R_M) / (1 - pz)
      const x = k * (uy * cd[i] + ty * sd[i])
      const y = k * (ux * cd[i] + tx * sd[i])
      let z = NaN
      for (let li = lvl[i]; li < levels.length && z !== z; li++) z = sampleWindow(levels[li].win, x, y)
      if (z !== z) continue
      const rz = R_M + z
      const t = (rz * cd[i] - ro) / (rz * sd[i])
      if (t > best) best = t
    }
    horizon[j] = best === -Infinity ? -Math.acos(R_M / ro) / DEG : Math.atan(best) / DEG
  }
  return { horizon, groundM }
}

export function horizonAt(h: Float32Array, azDeg: number): number {
  const n = h.length
  let f = ((azDeg % 360) + 360) % 360
  f = (f * n) / 360
  const i = Math.floor(f)
  const u = f - i
  return h[i % n] * (1 - u) + h[(i + 1) % n] * u
}
