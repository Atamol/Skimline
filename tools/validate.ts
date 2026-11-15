import { readFileSync, writeFileSync } from 'node:fs'
import { HOUR_MS } from '../src/core/const'
import { Ephemeris } from '../src/core/ephemeris'
import { azEl, siteFrame } from '../src/core/frames'
import { computeHorizon, sphereHorizon } from '../src/core/horizon'
import { computeMetrics, DEFAULT_REQUIREMENTS, panelFactor, type Requirements } from '../src/core/metrics'
import { computeSeries } from '../src/core/visibility'
import { fileTiles, horizonFrom5m, loadLevels } from './node-dem'

const eph = new Ephemeris()
for (let y = 2023; y <= 2035; y++) {
  const b = readFileSync(`public/data/ephem/${y}.bin`)
  eph.addYear(y, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
}
const sites: { id: string; name: string; lat: number; lon: number; group: string }[] = JSON.parse(readFileSync('public/data/sites.json', 'utf8'))
const site = (id: string) => sites.find((s) => s.id === id)!
const iso = (t: number) => new Date(t).toISOString().slice(0, 16).replace('T', ' ')
const round = (v: number, d = 2) => +v.toFixed(d)

const samples: { lon: number; lat: number; alt: number; t: number; body: string; az: number; el: number }[] = JSON.parse(
  readFileSync('tests/fixtures/horizons_topo.json', 'utf8'),
)
const v = new Float64Array(6)
let worstEl = 0
let worstAz = 0
let sqEl = 0
let sqAz = 0
for (const s of samples) {
  eph.at(s.t, v)
  const o = s.body === 'sun' ? 0 : 3
  const r = azEl(siteFrame(s.lon, s.lat, s.alt), v[o], v[o + 1], v[o + 2])
  let dAz = Math.abs(r.az - s.az)
  if (dAz > 180) dAz = 360 - dAz
  dAz *= Math.cos((s.el * Math.PI) / 180)
  const dEl = Math.abs(r.el - s.el)
  worstEl = Math.max(worstEl, dEl)
  worstAz = Math.max(worstAz, dAz)
  sqEl += dEl * dEl
  sqAz += dAz * dAz
}
const geometry = {
  samples: samples.length,
  sites: new Set(samples.map((s) => `${s.lon},${s.lat}`)).size,
  firstYear: new Date(Math.min(...samples.map((s) => s.t))).getUTCFullYear(),
  lastYear: new Date(Math.max(...samples.map((s) => s.t))).getUTCFullYear(),
  worstElDeg: round(worstEl, 4),
  worstAzDeg: round(worstAz, 4),
  rmsElDeg: round(Math.sqrt(sqEl / samples.length), 4),
  rmsAzDeg: round(Math.sqrt(sqAz / samples.length), 4),
}
console.log('geometry', geometry)

const sphere = (id: string, t0: number, days: number) => {
  const s = site(id)
  return computeSeries(eph, siteFrame(s.lon, s.lat, 0.002), sphereHorizon(2), t0, days * 24 + 1, HOUR_MS)
}

const slimT = Date.UTC(2024, 0, 19, 15, 20)
const slimS = sphere('slim', slimT, 14)
const west: Requirements = { ...DEFAULT_REQUIREMENTS, missionDays: 14, panel: 'fixed', panelAz: 270, panelTilt: 90 }
let firstLight = NaN
for (let i = 0; i < slimS.n; i++) {
  if (panelFactor(west, slimS.sunAz[i], slimS.sunEl[i]) * slimS.sunFrac[i] > 0) {
    firstLight = slimT + i * HOUR_MS
    break
  }
}
const slimM = computeMetrics(slimS, west, slimT)
const jan28 = Math.round((Date.UTC(2024, 0, 28, 12) - slimT) / HOUR_MS)

const bgT = Date.UTC(2025, 2, 2, 8, 34)
const bgS = sphere('blue-ghost-1', bgT, 16)
const bgSet = (minPower: number) => computeMetrics(bgS, { ...DEFAULT_REQUIREMENTS, missionDays: 16, minPower }, bgT).sunsetInH

const ceS = sphere('change-4', Date.UTC(2023, 0, 1), 365 * 4)
let ceMax = -Infinity
for (const e of ceS.earthEl) ceMax = Math.max(ceMax, e)

const missions = [
  {
    id: 'slim',
    title: 'SLIM (JAXA), January 2024',
    reported:
      'Landed 2024-01-19 15:20 UTC with the solar cells facing west and the Sun in the east. Powered down at 17:57 UTC. JAXA expected power to return as the Sun moved west. Operations resumed on January 28.',
    computed: `Sun at azimuth ${slimS.sunAz[0].toFixed(0)}° (east), elevation ${slimS.sunEl[0].toFixed(0)}° at landing, so a west-facing array gets nothing. Light first reaches it on ${iso(firstLight)} UTC, it passes half output on ${iso(slimT + slimM.sunriseInH * HOUR_MS)} UTC, and it is at ${(panelFactor(west, slimS.sunAz[jan28], slimS.sunEl[jan28]) * 100).toFixed(0)}% on January 28 12:00 UTC.`,
    verdict: 'The power window opens in the days before operations resumed. The real attitude of the lander was more complex than a vertical west-facing plate, so this checks the geometry, not the exact date.',
    source: 'https://global.jaxa.jp/press/2024/01/20240125-1_e.html',
  },
  {
    id: 'blue-ghost',
    title: 'Blue Ghost Mission 1 (Firefly, NASA CLPS), March 2025',
    reported: 'Landed 2025-03-02 08:34 UTC. Firefly reports 346 hours of daylight operations, ending about 5 hours into the lunar night.',
    computed: `Sun's center reaches the horizon ${bgSet(0.5).toFixed(1)} h after landing, and the last 5% of the disk is gone at ${bgSet(0.05).toFixed(1)} h.`,
    verdict: `Within ${Math.abs(bgSet(0.5) - 346).toFixed(0)} to ${Math.abs(bgSet(0.05) - 346).toFixed(0)} hours of the reported daylight, on a smooth sphere without local terrain.`,
    source: 'https://fireflyspace.com/missions/blue-ghost-mission-1/',
  },
  {
    id: 'change-4',
    title: "Chang'e 4 (CNSA), lunar far side",
    reported: 'The far side never faces Earth, so the mission communicates through the Queqiao relay satellite.',
    computed: `Over four years the Earth's center never gets higher than ${ceMax.toFixed(1)}° at the landing site.`,
    verdict: 'No direct-to-Earth window at any date, as expected.',
    source: 'https://www.planetary.org/articles/0519-change-4-relay-satellite',
  },
]
for (const m of missions) console.log(m.title, '|', m.computed)

const year = Date.UTC(2027, 0, 1)
const terrain = []
for (const s of sites.filter((x) => x.id.startsWith('pgda-'))) {
  const levels = await loadLevels(s.lon, s.lat, fileTiles)
  const coarse = computeHorizon(s.lon, s.lat, 2, levels)
  const fine = await horizonFrom5m(s.lon, s.lat, 2)
  let sum = 0
  let sq = 0
  let max = 0
  for (let i = 0; i < coarse.horizon.length; i++) {
    const d = coarse.horizon[i] - fine.horizon[i]
    sum += Math.abs(d)
    sq += d * d
    max = Math.max(max, Math.abs(d))
  }
  const lit = (h: { horizon: Float32Array; groundM: number }, t0: number, hours: number, mast: number) => {
    const ser = computeSeries(eph, siteFrame(s.lon, s.lat, (h.groundM + mast) / 1000), h.horizon, t0, hours, HOUR_MS)
    let sun = 0
    let earth = 0
    for (let i = 0; i < ser.n; i++) {
      sun += ser.sunFrac[i]
      if (ser.earthClear[i] >= 0) earth++
    }
    return { sun: round((100 * sun) / ser.n, 1), earth: round((100 * earth) / ser.n, 1) }
  }
  const a = lit(coarse, year, 365 * 24, 2)
  const b = lit(fine, year, 365 * 24, 2)
  // Same window and height as the comparison in Barker et al. 2021
  const low = await horizonFrom5m(s.lon, s.lat, 1)
  const barker = lit(low, Date.UTC(2024, 0, 1), 731 * 24, 1)
  const row = {
    id: s.id,
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    groundTilesM: round(coarse.groundM, 0),
    ground5mM: round(fine.groundM, 0),
    meanAbsDeg: round(sum / coarse.horizon.length, 3),
    rmsDeg: round(Math.sqrt(sq / coarse.horizon.length), 3),
    maxAbsDeg: round(max, 2),
    sunTilesPct: a.sun,
    sun5mPct: b.sun,
    earthTilesPct: a.earth,
    earth5mPct: b.earth,
    sun2024to2026At1mPct: barker.sun,
  }
  terrain.push(row)
  console.log(row)
}

writeFileSync('public/data/validation.json', JSON.stringify({ generated: new Date().toISOString(), geometry, missions, terrain }, null, 1))
