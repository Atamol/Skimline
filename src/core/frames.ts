import { DEG, R_MOON_KM } from './const'

export type Vec3 = [number, number, number]

export interface SiteFrame {
  pos: Vec3
  east: Vec3
  north: Vec3
  up: Vec3
}

export function lonLatToVec(lonDeg: number, latDeg: number, r: number): Vec3 {
  const lon = lonDeg * DEG
  const lat = latDeg * DEG
  const c = Math.cos(lat)
  return [r * c * Math.cos(lon), r * c * Math.sin(lon), r * Math.sin(lat)]
}

// altKm is height above the 1737.4 km reference sphere
export function siteFrame(lonDeg: number, latDeg: number, altKm: number): SiteFrame {
  const lon = lonDeg * DEG
  const lat = latDeg * DEG
  const cl = Math.cos(lat)
  const sl = Math.sin(lat)
  const co = Math.cos(lon)
  const so = Math.sin(lon)
  const up: Vec3 = [cl * co, cl * so, sl]
  const r = R_MOON_KM + altKm
  return {
    pos: [up[0] * r, up[1] * r, up[2] * r],
    east: [-so, co, 0],
    north: [-sl * co, -sl * so, cl],
    up,
  }
}

export interface AzEl {
  az: number
  el: number
  dist: number
}

// Azimuth runs from north through east, both in degrees. No refraction on the Moon
export function azEl(f: SiteFrame, bx: number, by: number, bz: number): AzEl {
  const dx = bx - f.pos[0]
  const dy = by - f.pos[1]
  const dz = bz - f.pos[2]
  const e = dx * f.east[0] + dy * f.east[1] + dz * f.east[2]
  const n = dx * f.north[0] + dy * f.north[1] + dz * f.north[2]
  const u = dx * f.up[0] + dy * f.up[1] + dz * f.up[2]
  let az = Math.atan2(e, n) / DEG
  if (az < 0) az += 360
  return { az, el: Math.atan2(u, Math.hypot(e, n)) / DEG, dist: Math.hypot(dx, dy, dz) }
}
