import { DEG, HOUR_MS } from './const'
import type { Series } from './visibility'

export type PanelMode = 'tracking' | 'horizontal' | 'fixed'

export interface Requirements {
  missionDays: number
  // height of the solar array and antenna above the ground
  mastM: number
  // share of full array output needed to count as powered
  minPower: number
  earthMarginDeg: number
  panel: PanelMode
  // fixed panel: azimuth of its normal and tilt from horizontal, degrees
  panelAz: number
  panelTilt: number
  loadW: number
  maxDarkH: number
  minCommPct: number
  needSunAtLanding: boolean
  needEarthAtLanding: boolean
}

export const DEFAULT_REQUIREMENTS: Requirements = {
  missionDays: 10,
  mastM: 2,
  minPower: 0.5,
  earthMarginDeg: 0,
  panel: 'tracking',
  panelAz: 270,
  panelTilt: 90,
  loadW: 200,
  maxDarkH: 4,
  minCommPct: 50,
  needSunAtLanding: true,
  needEarthAtLanding: true,
}

export function panelFactor(req: Requirements, sunAz: number, sunEl: number): number {
  if (req.panel === 'tracking') return 1
  if (req.panel === 'horizontal') return Math.max(0, Math.sin(sunEl * DEG))
  const t = req.panelTilt * DEG
  const e = sunEl * DEG
  return Math.max(0, Math.cos(t) * Math.sin(e) + Math.sin(t) * Math.cos(e) * Math.cos((sunAz - req.panelAz) * DEG))
}

export function powerFactor(req: Requirements, s: Series, i: number): number {
  return s.sunFrac[i] * panelFactor(req, s.sunAz[i], s.sunEl[i])
}

export interface Metrics {
  sunAtLanding: boolean
  earthAtLanding: boolean
  // 0 when already lost, Infinity when it outlasts the data
  sunsetInH: number
  earthsetInH: number
  // 0 when currently up
  sunriseInH: number
  earthriseInH: number
  sunlitPct: number
  commPct: number
  longestDarkH: number
  longestCommGapH: number
  meanPower: number
  batteryWh: number
  powerOk: boolean
  commOk: boolean
  go: boolean
  reasons: string[]
}

// The crossing is placed by linear interpolation of g against level
function hoursUntil(s: Series, i: number, lost: (k: number) => boolean, g: (k: number) => number, level: number): number {
  if (lost(i)) return 0
  for (let k = i + 1; k < s.n; k++) {
    if (lost(k)) {
      const a = g(k - 1)
      const b = g(k)
      const f = a === b ? 0 : (a - level) / (a - b)
      return ((k - 1 - i + Math.min(1, Math.max(0, f))) * s.stepMs) / HOUR_MS
    }
  }
  return Infinity
}

function longestRun(s: Series, i0: number, i1: number, bad: (k: number) => boolean): number {
  let best = 0
  let run = 0
  for (let k = i0; k < i1; k++) {
    run = bad(k) ? run + 1 : 0
    if (run > best) best = run
  }
  return (best * s.stepMs) / HOUR_MS
}

export function seriesIndex(s: Series, tMs: number): number {
  return Math.min(s.n - 1, Math.max(0, Math.round((tMs - s.t0) / s.stepMs)))
}

export function computeMetrics(s: Series, req: Requirements, landingMs: number): Metrics {
  const i0 = seriesIndex(s, landingMs)
  const i1 = Math.min(s.n, i0 + Math.max(1, Math.round((req.missionDays * 24 * HOUR_MS) / s.stepMs)))
  const power = (k: number) => powerFactor(req, s, k)
  const dark = (k: number) => !(power(k) >= req.minPower)
  const noEarth = (k: number) => !(s.earthClear[k] >= req.earthMarginDeg)
  const earthClear = (k: number) => s.earthClear[k]

  let lit = 0
  let comm = 0
  let powerSum = 0
  for (let k = i0; k < i1; k++) {
    if (!dark(k)) lit++
    if (!noEarth(k)) comm++
    powerSum += power(k)
  }
  const n = i1 - i0
  const m: Metrics = {
    sunAtLanding: !dark(i0),
    earthAtLanding: !noEarth(i0),
    sunsetInH: hoursUntil(s, i0, dark, power, req.minPower),
    earthsetInH: hoursUntil(s, i0, noEarth, earthClear, req.earthMarginDeg),
    sunriseInH: hoursUntil(s, i0, (k) => !dark(k), power, req.minPower),
    earthriseInH: hoursUntil(s, i0, (k) => !noEarth(k), earthClear, req.earthMarginDeg),
    sunlitPct: (100 * lit) / n,
    commPct: (100 * comm) / n,
    longestDarkH: longestRun(s, i0, i1, dark),
    longestCommGapH: longestRun(s, i0, i1, noEarth),
    meanPower: powerSum / n,
    batteryWh: 0,
    powerOk: true,
    commOk: true,
    go: true,
    reasons: [],
  }
  m.batteryWh = m.longestDarkH * req.loadW
  const powerFail: string[] = []
  const commFail: string[] = []
  if (req.needSunAtLanding && !m.sunAtLanding) powerFail.push('No power at landing')
  if (m.longestDarkH > req.maxDarkH) powerFail.push(`Darkness lasts ${fmtHours(m.longestDarkH)}`)
  if (req.needEarthAtLanding && !m.earthAtLanding) commFail.push('No Earth link at landing')
  if (m.commPct < req.minCommPct) commFail.push(`Earth link only ${m.commPct.toFixed(0)}% of the mission`)
  m.powerOk = powerFail.length === 0
  m.commOk = commFail.length === 0
  m.reasons = [...powerFail, ...commFail]
  m.go = m.powerOk && m.commOk
  return m
}

export function fmtHours(h: number): string {
  if (!Number.isFinite(h)) return 'beyond data'
  if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0)} h`
  const d = Math.floor(h / 24)
  return `${d} d ${Math.round(h - d * 24)} h`
}
