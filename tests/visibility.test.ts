import { describe, expect, it } from 'vitest'
import { HOUR_MS } from '../src/core/const'
import { decodeTile, encodeTile, TILE } from '../src/core/dem'
import { siteFrame } from '../src/core/frames'
import { N_AZ, sphereHorizon } from '../src/core/horizon'
import { computeMetrics, DEFAULT_REQUIREMENTS, panelFactor, type Requirements } from '../src/core/metrics'
import { computeSeries, sunFraction } from '../src/core/visibility'
import { horizonFromTiles } from '../tools/node-dem'
import { loadEphemeris } from './helpers'

const flat = new Float32Array(N_AZ)

describe('solar disk against the skyline', () => {
  it('is fully visible above, hidden below and half visible when centered on a flat skyline', () => {
    expect(sunFraction(flat, 100, 1, 0.266)).toBe(1)
    expect(sunFraction(flat, 100, -1, 0.266)).toBe(0)
    expect(sunFraction(flat, 100, 0, 0.266)).toBeCloseTo(0.5, 2)
  })

  it('dips below zero on a sphere when seen from a height', () => {
    expect(sphereHorizon(2)[0]).toBeCloseTo(-0.0869, 3)
  })
})

describe('array orientation', () => {
  const west: Requirements = { ...DEFAULT_REQUIREMENTS, panel: 'fixed', panelAz: 270, panelTilt: 90 }
  it('gives a vertical west-facing array full output from the west and none from the east', () => {
    expect(panelFactor(west, 270, 0)).toBeCloseTo(1)
    expect(panelFactor(west, 90, 20)).toBe(0)
  })
  it('follows the sine of the elevation for an array facing up', () => {
    expect(panelFactor({ ...DEFAULT_REQUIREMENTS, panel: 'horizontal' }, 0, 30)).toBeCloseTo(0.5)
  })
})

describe('tile encoding', () => {
  it('round-trips heights to within 0.2 m and keeps missing data', () => {
    const h = new Float32Array(TILE * TILE)
    for (let i = 0; i < h.length; i++) h[i] = -4000 + 9000 * Math.abs(Math.sin(i * 0.37))
    h[5] = NaN
    const back = decodeTile(encodeTile(h)!.buffer as ArrayBuffer)
    let worst = 0
    for (let i = 0; i < h.length; i++) if (i !== 5) worst = Math.max(worst, Math.abs(back[i] - h[i]))
    expect(worst).toBeLessThan(0.2)
    expect(back[5]).toBeNaN()
  })
})

describe('past missions', () => {
  const eph = loadEphemeris([2023, 2024, 2025])
  const series = (lon: number, lat: number, t0: number, days: number) =>
    computeSeries(eph, siteFrame(lon, lat, 0.002), sphereHorizon(2), t0, days * 24 + 1, HOUR_MS)

  it('SLIM: no power from a west-facing array at landing, power back before operations resumed on Jan 28', () => {
    const landing = Date.UTC(2024, 0, 19, 15, 20)
    const s = series(25.24889, -13.31549, landing, 14)
    expect(s.sunAz[0]).toBeGreaterThan(45)
    expect(s.sunAz[0]).toBeLessThan(135)
    const req: Requirements = { ...DEFAULT_REQUIREMENTS, missionDays: 14, panel: 'fixed', panelAz: 270, panelTilt: 90 }
    const m = computeMetrics(s, req, landing)
    expect(m.sunAtLanding).toBe(false)
    const back = landing + m.sunriseInH * HOUR_MS
    console.log(`SLIM: array above 50% output from ${new Date(back).toISOString()}`)
    expect(back).toBeGreaterThan(Date.UTC(2024, 0, 24))
    expect(back).toBeLessThan(Date.UTC(2024, 0, 28))
  })

  it('Blue Ghost Mission 1: sunset close to the reported 346 h of daylight operations', () => {
    const landing = Date.UTC(2025, 2, 2, 8, 34)
    const s = series(61.81, 18.56, landing, 16)
    const m = computeMetrics(s, { ...DEFAULT_REQUIREMENTS, missionDays: 16, minPower: 0.05 }, landing)
    console.log(`Blue Ghost: sunset ${m.sunsetInH.toFixed(1)} h after landing`)
    expect(Math.abs(m.sunsetInH - 346)).toBeLessThan(12)
  })

  it("Chang'e 4: the Earth never rises", () => {
    const t0 = Date.UTC(2024, 0, 1)
    const s = series(177.5885, -45.4561, t0, 60)
    const m = computeMetrics(s, { ...DEFAULT_REQUIREMENTS, missionDays: 60 }, t0)
    expect(m.commPct).toBe(0)
  })
})

describe('terrain skyline', () => {
  it('finds a low, open skyline on the connecting ridge and a much higher one inside Shackleton', async () => {
    const ridge = await horizonFromTiles(222.9036, -89.439, 2)
    const crater = await horizonFromTiles(129.78, -89.67, 2)
    const mean = (h: Float32Array) => h.reduce((a, b) => a + b, 0) / h.length
    expect(ridge.groundM).toBeGreaterThan(1500)
    expect(crater.groundM).toBeLessThan(-2000)
    expect(mean(ridge.horizon)).toBeLessThan(0.5)
    expect(mean(crater.horizon)).toBeGreaterThan(10)
  })

  it('makes the connecting ridge better lit than the crater floor over a year', async () => {
    const eph = loadEphemeris([2027])
    const t0 = Date.UTC(2027, 0, 1)
    const lit = async (lon: number, lat: number) => {
      const { horizon, groundM } = await horizonFromTiles(lon, lat, 2)
      const s = computeSeries(eph, siteFrame(lon, lat, (groundM + 2) / 1000), horizon, t0, 360 * 24, HOUR_MS)
      return s.sunFrac.reduce((a, b) => a + b, 0) / s.n
    }
    const ridge = await lit(222.9036, -89.439)
    const floor = await lit(129.78, -89.67)
    console.log(`mean visible share of the solar disk in 2027: ridge ${(ridge * 100).toFixed(1)}%, Shackleton floor ${(floor * 100).toFixed(1)}%`)
    expect(ridge).toBeGreaterThan(0.6)
    expect(ridge).toBeLessThan(0.95)
    expect(floor).toBe(0)
  })
})
