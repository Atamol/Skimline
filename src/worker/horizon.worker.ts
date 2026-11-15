import { decodeTile, LEVELS, loadWindow, type Manifest, type TileSource } from '../core/dem'
import { computeHorizon, type HorizonLevel } from '../core/horizon'
import { lonLatToXY } from '../core/projection'

export interface HorizonRequest {
  id: number
  base: string
  lon: number
  lat: number
  mastM: number
}

export interface HorizonResponse {
  id: number
  horizon?: Float32Array
  groundM?: number
  error?: string
}

const MAX_TILES = 160
const tiles = new Map<string, Promise<Float32Array | null>>()
let manifest: Promise<Record<string, Set<string>>> | undefined

function source(base: string): TileSource {
  manifest ??= fetch(`${base}dem/manifest.json`)
    .then((r) => r.json() as Promise<Manifest>)
    .then((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, new Set(v)])))
  return async (level, tx, ty) => {
    const have = (await manifest!)[level]
    if (!have?.has(`${tx}_${ty}`)) return null
    const key = `${level}/${tx}_${ty}`
    let t = tiles.get(key)
    if (!t) {
      t = fetch(`${base}dem/${key}.dem`).then(async (r) => {
        if (!r.ok || !r.body) return null
        const buf = await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
        return decodeTile(buf)
      })
      tiles.set(key, t)
      if (tiles.size > MAX_TILES) tiles.delete(tiles.keys().next().value!)
    }
    return t
  }
}

self.onmessage = async (e: MessageEvent<HorizonRequest>) => {
  const { id, base, lon, lat, mastM } = e.data
  try {
    const src = source(base)
    const [x, y] = lonLatToXY(lon, lat)
    const levels: HorizonLevel[] = []
    for (const level of LEVELS) {
      const win = await loadWindow(level, x, y, level.maxDist + 2 * level.res, src)
      if (win) levels.push({ win, maxDist: level.maxDist })
    }
    if (!levels.length) throw new Error('no terrain data here')
    const { horizon, groundM } = computeHorizon(lon, lat, mastM, levels)
    const res: HorizonResponse = { id, horizon, groundM }
    self.postMessage(res, { transfer: [horizon.buffer] })
  } catch (err) {
    self.postMessage({ id, error: String(err) } satisfies HorizonResponse)
  }
}
