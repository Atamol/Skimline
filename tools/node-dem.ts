import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { fromFile, type GeoTIFFImage } from 'geotiff'
import { decodeTile, type DemWindow, LEVELS, loadWindow, type TileSource } from '../src/core/dem'
import { computeHorizon, type HorizonLevel, type HorizonResult } from '../src/core/horizon'
import { lonLatToXY } from '../src/core/projection'

const cache = new Map<string, Float32Array | null>()

export const fileTiles: TileSource = async (level, tx, ty) => {
  const key = `${level}/${tx}_${ty}`
  let t = cache.get(key)
  if (t === undefined) {
    const path = `public/data/dem/${key}.dem`
    if (existsSync(path)) {
      const raw = gunzipSync(readFileSync(path))
      t = decodeTile(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer)
    } else t = null
    cache.set(key, t)
  }
  return t
}

export async function loadLevels(lon: number, lat: number, src: TileSource): Promise<HorizonLevel[]> {
  const [x, y] = lonLatToXY(lon, lat)
  const out: HorizonLevel[] = []
  for (const level of LEVELS) {
    const win = await loadWindow(level, x, y, level.maxDist + 2 * level.res, src)
    if (win) out.push({ win, maxDist: level.maxDist })
  }
  return out
}

export async function horizonFromTiles(lon: number, lat: number, mastM: number): Promise<HorizonResult> {
  return computeHorizon(lon, lat, mastM, await loadLevels(lon, lat, fileTiles))
}

let tiff5: GeoTIFFImage | undefined

export async function window5m(lon: number, lat: number, radius: number): Promise<DemWindow> {
  tiff5 ??= await (await fromFile('data/raw/ldem_87s_5mpp.tif')).getImage()
  const [ox, oy] = tiff5.getOrigin()
  const [x, y] = lonLatToXY(lon, lat)
  const c0 = Math.max(0, Math.floor((x - radius - ox) / 5))
  const c1 = Math.min(tiff5.getWidth(), Math.ceil((x + radius - ox) / 5))
  const r0 = Math.max(0, Math.floor((oy - y - radius) / 5))
  const r1 = Math.min(tiff5.getHeight(), Math.ceil((oy - y + radius) / 5))
  const [data] = (await tiff5.readRasters({ window: [c0, r0, c1, r1] })) as unknown as [Float32Array]
  return { res: 5, x0: ox + (c0 + 0.5) * 5, y0: oy - (r0 + 0.5) * 5, w: c1 - c0, h: r1 - r0, data }
}

export async function horizonFrom5m(lon: number, lat: number, mastM: number): Promise<HorizonResult> {
  const levels = await loadLevels(lon, lat, fileTiles)
  return computeHorizon(lon, lat, mastM, [{ win: await window5m(lon, lat, 10_100), maxDist: 10_000 }, ...levels.slice(1)])
}
