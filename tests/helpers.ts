import { readFileSync } from 'node:fs'
import { Ephemeris } from '../src/core/ephemeris'

export function loadEphemeris(years: Iterable<number>) {
  const eph = new Ephemeris()
  for (const y of years) {
    const b = readFileSync(`public/data/ephem/${y}.bin`)
    eph.addYear(y, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
  }
  return eph
}
