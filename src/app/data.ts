import { TERRAIN_MAX_LAT } from '../core/dem'
import { Ephemeris } from '../core/ephemeris'
import { type PrecomputedHorizons, sphereHorizon } from '../core/horizon'
import type { HorizonRequest, HorizonResponse } from '../worker/horizon.worker'

export interface Site {
  id: string
  name: string
  group: string
  lat: number
  // east longitude, 0 to 360
  lon: number
  agency?: string
  landed?: string
  source?: string
  note?: string
}

export interface SiteHorizon {
  horizon: Float32Array
  // 0 when the skyline is a plain sphere
  groundM: number
  detail: '5m' | 'tiles' | 'sphere'
}

const dataBase = new URL('data/', document.baseURI).href

export async function loadSites(): Promise<Site[]> {
  return (await fetch(`${dataBase}sites.json`)).json()
}

export const ephemeris = new Ephemeris()
const yearJobs = new Map<number, Promise<void>>()

export function loadYears(years: number[]): Promise<unknown> {
  return Promise.all(
    years.map((y) => {
      let job = yearJobs.get(y)
      if (!job) {
        job = fetch(`${dataBase}ephem/${y}.bin`)
          .then((r) => r.arrayBuffer())
          .then((b) => ephemeris.addYear(y, b))
        yearJobs.set(y, job)
      }
      return job
    }),
  )
}

export function usesTerrain(site: Site) {
  return site.lat <= TERRAIN_MAX_LAT
}

let precomputed: Promise<PrecomputedHorizons> | undefined

async function fromPrecomputed(site: Site, mastM: number): Promise<SiteHorizon | undefined> {
  precomputed ??= fetch(`${dataBase}horizons.json`)
    .then((r) => r.json())
    .catch(() => ({}))
  const p = (await precomputed)[site.id]
  const b64 = p?.masts[mastM]
  if (!b64 || p.lat !== site.lat || p.lon !== site.lon) return undefined
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return { horizon: new Float32Array(bytes.buffer), groundM: p.groundM, detail: '5m' }
}

function fromWorker(site: Site, mastM: number, sphere: SiteHorizon): Promise<SiteHorizon> {
  if (!worker) {
    worker = new Worker(new URL('../worker/horizon.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<HorizonResponse>) => {
      pending.get(e.data.id)?.(e.data)
      pending.delete(e.data.id)
    }
  }
  const id = nextId++
  const job = new Promise<SiteHorizon>((resolve) => {
    pending.set(id, (r) => {
      if (r.horizon) resolve({ horizon: r.horizon, groundM: r.groundM ?? 0, detail: 'tiles' })
      else {
        console.warn(`terrain skyline failed for ${site.name}: ${r.error}`)
        resolve(sphere)
      }
    })
  })
  worker.postMessage({ id, base: dataBase, lon: site.lon, lat: site.lat, mastM } satisfies HorizonRequest)
  return job
}

let worker: Worker | undefined
let nextId = 1
const pending = new Map<number, (r: HorizonResponse) => void>()
const cache = new Map<string, Promise<SiteHorizon>>()

export function horizonKey(site: Site, mastM: number) {
  return `${site.lon.toFixed(5)},${site.lat.toFixed(5)},${mastM}`
}

export function getHorizon(site: Site, mastM: number): Promise<SiteHorizon> {
  const key = horizonKey(site, mastM)
  let job = cache.get(key)
  if (job) return job
  const sphere: SiteHorizon = { horizon: sphereHorizon(mastM), groundM: 0, detail: 'sphere' }
  job = usesTerrain(site) ? fromPrecomputed(site, mastM).then((h) => h ?? fromWorker(site, mastM, sphere)) : Promise.resolve(sphere)
  cache.set(key, job)
  return job
}
