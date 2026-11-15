import { mkdirSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { fromFile, type GeoTIFFImage } from 'geotiff'
import { encodeTile, LEVELS, type Manifest, TILE } from '../src/core/dem'

const OUT = 'public/data/dem'
const manifest: Manifest = {}
let totalBytes = 0

function writeTile(level: string, tx: number, ty: number, heights: Float32Array) {
  const enc = encodeTile(heights)
  if (!enc) return
  const gz = gzipSync(enc, { level: 9 })
  writeFileSync(`${OUT}/${level}/${tx}_${ty}.dem`, gz)
  manifest[level].push(`${tx}_${ty}`)
  totalBytes += gz.length
}

async function tileImage(level: string, img: GeoTIFFImage, size: number) {
  mkdirSync(`${OUT}/${level}`, { recursive: true })
  manifest[level] = []
  const off = (img.getWidth() - size) / 2
  if (!Number.isInteger(off) || off < 0 || img.getWidth() !== img.getHeight()) throw new Error(`${level}: unexpected source size`)
  const nt = Math.ceil(size / TILE)
  for (let ty = 0; ty < nt; ty++) {
    for (let tx = 0; tx < nt; tx++) {
      const w = Math.min(TILE, size - tx * TILE)
      const h = Math.min(TILE, size - ty * TILE)
      const x = off + tx * TILE
      const y = off + ty * TILE
      const [src] = (await img.readRasters({ window: [x, y, x + w, y + h] })) as unknown as [Float32Array]
      const tile = new Float32Array(TILE * TILE).fill(NaN)
      for (let r = 0; r < h; r++) tile.set(src.subarray(r * w, (r + 1) * w), r * TILE)
      writeTile(level, tx, ty, tile)
    }
    console.log(level, `row ${ty + 1}/${nt}`)
  }
}

const [near, mid, far] = LEVELS
const t40 = await (await fromFile('data/raw/LDEM_80S_40MPP_ADJ.TIF')).getImage(0)
const t80 = await (await fromFile('data/raw/LDEM_80S_80MPP_ADJ.TIF')).getImage(0)

await tileImage(mid.name, t80, mid.size)
await tileImage(near.name, t40, near.size)

{
  mkdirSync(`${OUT}/${far.name}`, { recursive: true })
  manifest[far.name] = []
  const f = far.res / mid.res
  const n = far.size
  const grid = new Float32Array(n * n).fill(NaN)
  const band = 400
  for (let r0 = 0; r0 < n; r0 += band) {
    const rows = Math.min(band, n - r0)
    const [src] = (await t80.readRasters({ window: [0, r0 * f, n * f, (r0 + rows) * f] })) as unknown as [Float32Array]
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < n; c++) {
        let sum = 0
        let cnt = 0
        for (let dr = 0; dr < f; dr++) {
          for (let dc = 0; dc < f; dc++) {
            const v = src[(r * f + dr) * n * f + c * f + dc]
            if (v === v) {
              sum += v
              cnt++
            }
          }
        }
        if (cnt) grid[(r0 + r) * n + c] = sum / cnt
      }
    }
  }
  let min = Infinity
  let max = -Infinity
  for (const v of grid) {
    if (v === v) {
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  console.log('far height range', min, max)
  const nt = Math.ceil(n / TILE)
  for (let ty = 0; ty < nt; ty++) {
    for (let tx = 0; tx < nt; tx++) {
      const tile = new Float32Array(TILE * TILE).fill(NaN)
      const w = Math.min(TILE, n - tx * TILE)
      for (let r = 0; r < Math.min(TILE, n - ty * TILE); r++) {
        const from = (ty * TILE + r) * n + tx * TILE
        tile.set(grid.subarray(from, from + w), r * TILE)
      }
      writeTile(far.name, tx, ty, tile)
    }
  }
}

writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest))
console.log(Object.entries(manifest).map(([k, v]) => `${k}: ${v.length} tiles`).join(', '), `${(totalBytes / 1e6).toFixed(1)} MB`)
