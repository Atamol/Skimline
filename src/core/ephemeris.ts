import { HOUR_MS } from './const'

export const EPHEM_FIRST_YEAR = 2023
export const EPHEM_LAST_YEAR = 2035

// Year files hold hourly [sunXYZ, earthXYZ] rows in km, Moon-centered MOON_ME, Jan 1 00:00 UTC through Jan 1 of the next year
export class Ephemeris {
  private years = new Map<number, Float32Array>()

  addYear(year: number, buf: ArrayBuffer) {
    this.years.set(year, new Float32Array(buf))
  }

  hasYear(year: number) {
    return this.years.has(year)
  }

  at(tMs: number, out: Float64Array): boolean {
    const year = new Date(tMs).getUTCFullYear()
    const rows = this.years.get(year)
    if (!rows) return false
    const h = (tMs - Date.UTC(year, 0, 1)) / HOUR_MS
    const n = rows.length / 6
    let i = Math.floor(h)
    if (i > n - 2) i = n - 2
    const f = h - i
    const a = i * 6
    for (let k = 0; k < 6; k++) out[k] = rows[a + k] + (rows[a + 6 + k] - rows[a + k]) * f
    return true
  }
}

export function yearsBetween(t0: number, t1: number): number[] {
  const out: number[] = []
  const last = Math.min(new Date(t1).getUTCFullYear(), EPHEM_LAST_YEAR)
  for (let y = Math.max(new Date(t0).getUTCFullYear(), EPHEM_FIRST_YEAR); y <= last; y++) out.push(y)
  return out
}
