import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { azEl, siteFrame } from '../src/core/frames'
import { loadEphemeris } from './helpers'

interface Sample { lon: number; lat: number; alt: number; t: number; body: 'sun' | 'earth'; az: number; el: number }

const samples: Sample[] = JSON.parse(readFileSync('tests/fixtures/horizons_topo.json', 'utf8'))

describe('topocentric geometry vs JPL Horizons', () => {
  const eph = loadEphemeris(new Set(samples.map((s) => new Date(s.t).getUTCFullYear())))
  const v = new Float64Array(6)

  it('matches azimuth and elevation within 0.02 deg', () => {
    let worstEl = 0
    let worstAz = 0
    for (const s of samples) {
      expect(eph.at(s.t, v)).toBe(true)
      const o = s.body === 'sun' ? 0 : 3
      const r = azEl(siteFrame(s.lon, s.lat, s.alt), v[o], v[o + 1], v[o + 2])
      // Compare azimuth as an arc on the sky so it stays meaningful near the zenith
      let dAz = Math.abs(r.az - s.az)
      if (dAz > 180) dAz = 360 - dAz
      dAz *= Math.cos((s.el * Math.PI) / 180)
      worstEl = Math.max(worstEl, Math.abs(r.el - s.el))
      worstAz = Math.max(worstAz, dAz)
    }
    console.log(`samples ${samples.length}, worst el ${worstEl.toFixed(5)} deg, worst az ${worstAz.toFixed(5)} deg`)
    expect(samples.length).toBeGreaterThan(150)
    expect(worstEl).toBeLessThan(0.02)
    expect(worstAz).toBeLessThan(0.02)
  })
})
