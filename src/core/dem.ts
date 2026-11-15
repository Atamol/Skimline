export const TILE = 512

// maxDist is how far from the observer a level is used before the next coarser one takes over
export interface LevelDef {
  name: string
  res: number
  size: number
  maxDist: number
}

export const LEVELS: LevelDef[] = [
  { name: 'near', res: 40, size: 9216, maxDist: 10_000 },
  { name: 'mid', res: 80, size: 7600, maxDist: 40_000 },
  { name: 'far', res: 320, size: 1900, maxDist: 300_000 },
]

// Sites north of this have too little terrain coverage toward the equator to trust the skyline
export const TERRAIN_MAX_LAT = -82

export const MAP_HALF_M = 184_320
export const MAP_SIZE = 2304

export type Manifest = Record<string, string[]>

export type TileSource = (level: string, tx: number, ty: number) => Promise<Float32Array | null>

const NODATA = 65535

export function encodeTile(heights: Float32Array): Uint8Array | null {
  let min = Infinity
  let max = -Infinity
  for (const h of heights) {
    if (h === h) {
      if (h < min) min = h
      if (h > max) max = h
    }
  }
  if (min === Infinity) return null
  const scale = Math.max((max - min) / 65534, 1e-3)
  const out = new Uint8Array(8 + heights.length * 2)
  const view = new DataView(out.buffer)
  view.setFloat32(0, min, true)
  view.setFloat32(4, scale, true)
  for (let r = 0; r < TILE; r++) {
    let prev = 0
    for (let c = 0; c < TILE; c++) {
      const h = heights[r * TILE + c]
      const q = h === h ? Math.round((h - min) / scale) : NODATA
      view.setUint16(8 + (r * TILE + c) * 2, (q - prev) & 0xffff, true)
      prev = q
    }
  }
  return out
}

export function decodeTile(buf: ArrayBuffer): Float32Array {
  const view = new DataView(buf)
  const min = view.getFloat32(0, true)
  const scale = view.getFloat32(4, true)
  const out = new Float32Array(TILE * TILE)
  for (let r = 0; r < TILE; r++) {
    let prev = 0
    for (let c = 0; c < TILE; c++) {
      const i = r * TILE + c
      prev = (prev + view.getUint16(8 + i * 2, true)) & 0xffff
      out[i] = prev === NODATA ? NaN : min + prev * scale
    }
  }
  return out
}

// (x0, y0) is the center of pixel (0, 0). x grows with the column, y shrinks with the row
export interface DemWindow {
  res: number
  x0: number
  y0: number
  w: number
  h: number
  data: Float32Array
}

export async function loadWindow(level: LevelDef, cx: number, cy: number, radius: number, src: TileSource): Promise<DemWindow | null> {
  const half = (level.res * level.size) / 2
  const c0 = Math.max(0, Math.floor((cx - radius + half) / level.res))
  const c1 = Math.min(level.size - 1, Math.ceil((cx + radius + half) / level.res))
  const r0 = Math.max(0, Math.floor((half - cy - radius) / level.res))
  const r1 = Math.min(level.size - 1, Math.ceil((half - cy + radius) / level.res))
  if (c1 < c0 || r1 < r0) return null
  const w = c1 - c0 + 1
  const h = r1 - r0 + 1
  const data = new Float32Array(w * h).fill(NaN)
  let any = false
  const jobs: Promise<void>[] = []
  for (let ty = Math.floor(r0 / TILE); ty <= Math.floor(r1 / TILE); ty++) {
    for (let tx = Math.floor(c0 / TILE); tx <= Math.floor(c1 / TILE); tx++) {
      jobs.push(
        src(level.name, tx, ty).then((tile) => {
          if (!tile) return
          any = true
          const ra = Math.max(r0, ty * TILE)
          const rb = Math.min(r1, ty * TILE + TILE - 1)
          const ca = Math.max(c0, tx * TILE)
          const cb = Math.min(c1, tx * TILE + TILE - 1)
          for (let r = ra; r <= rb; r++) {
            const from = (r - ty * TILE) * TILE + (ca - tx * TILE)
            data.set(tile.subarray(from, from + (cb - ca + 1)), (r - r0) * w + (ca - c0))
          }
        }),
      )
    }
  }
  await Promise.all(jobs)
  if (!any) return null
  return { res: level.res, x0: -half + (c0 + 0.5) * level.res, y0: half - (r0 + 0.5) * level.res, w, h, data }
}

// NaN outside the window or next to missing data
export function sampleWindow(win: DemWindow, x: number, y: number): number {
  const fx = (x - win.x0) / win.res
  const fy = (win.y0 - y) / win.res
  if (!(fx >= 0 && fy >= 0 && fx <= win.w - 1 && fy <= win.h - 1)) return NaN
  let c = Math.floor(fx)
  let r = Math.floor(fy)
  if (c > win.w - 2) c = win.w - 2
  if (r > win.h - 2) r = win.h - 2
  const u = fx - c
  const v = fy - r
  const i = r * win.w + c
  const d = win.data
  return (d[i] * (1 - u) + d[i + 1] * u) * (1 - v) + (d[i + win.w] * (1 - u) + d[i + win.w + 1] * u) * v
}
