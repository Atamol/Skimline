import { DEG, R_MOON_KM } from './const'

const R_M = R_MOON_KM * 1000

// LOLA south polar stereographic in meters: true scale at the pole, longitude 0 toward +y, east longitude clockwise
export function lonLatToXY(lonDeg: number, latDeg: number): [number, number] {
  const lon = lonDeg * DEG
  const lat = latDeg * DEG
  const k = (2 * R_M * Math.cos(lat)) / (1 - Math.sin(lat))
  return [k * Math.sin(lon), k * Math.cos(lon)]
}

export function xyToLonLat(x: number, y: number): [number, number] {
  const r = Math.hypot(x, y)
  let lon = Math.atan2(x, y) / DEG
  if (lon < 0) lon += 360
  return [lon, (2 * Math.atan(r / (2 * R_M))) / DEG - 90]
}
