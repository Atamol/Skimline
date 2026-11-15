import { mkdirSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { fromFile } from 'geotiff'
import { MAP_HALF_M, MAP_SIZE } from '../src/core/dem'

const SRC_RES = 80
const f = (2 * MAP_HALF_M) / MAP_SIZE / SRC_RES
if (!Number.isInteger(f)) throw new Error('map pixel must be a whole multiple of the source pixel')

const img = await (await fromFile('data/raw/LDEM_80S_80MPP_ADJ.TIF')).getImage(0)
const off = (img.getWidth() - MAP_SIZE * f) / 2
const z = new Float32Array(MAP_SIZE * MAP_SIZE)
const band = 256
for (let r0 = 0; r0 < MAP_SIZE; r0 += band) {
  const rows = Math.min(band, MAP_SIZE - r0)
  const [src] = (await img.readRasters({ window: [off, off + r0 * f, off + MAP_SIZE * f, off + (r0 + rows) * f] })) as unknown as [Float32Array]
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < MAP_SIZE; c++) {
      let sum = 0
      for (let dr = 0; dr < f; dr++) for (let dc = 0; dc < f; dc++) sum += src[(r * f + dr) * MAP_SIZE * f + c * f + dc]
      z[(r0 + r) * MAP_SIZE + c] = sum / (f * f)
    }
  }
}

const cell = SRC_RES * f
const light = [-1, 1, 1.1]
const ln = Math.hypot(...light)
const out = new Uint8Array(MAP_SIZE * MAP_SIZE)
for (let r = 0; r < MAP_SIZE; r++) {
  for (let c = 0; c < MAP_SIZE; c++) {
    const cl = Math.max(0, c - 1)
    const cr = Math.min(MAP_SIZE - 1, c + 1)
    const ru = Math.max(0, r - 1)
    const rd = Math.min(MAP_SIZE - 1, r + 1)
    const dzdx = ((z[r * MAP_SIZE + cr] - z[r * MAP_SIZE + cl]) / ((cr - cl) * cell)) * 1.5
    const dzdy = ((z[ru * MAP_SIZE + c] - z[rd * MAP_SIZE + c]) / ((rd - ru) * cell)) * 1.5
    const shade = (-dzdx * light[0] - dzdy * light[1] + light[2]) / (Math.hypot(dzdx, dzdy, 1) * ln)
    out[r * MAP_SIZE + c] = Math.round(255 * Math.min(1, Math.max(0, shade)))
  }
}

mkdirSync('public/data/map', { recursive: true })
const gz = gzipSync(out, { level: 9 })
writeFileSync('public/data/map/shade.bin', gz)
console.log(`${MAP_SIZE} px, ${(gz.length / 1e6).toFixed(2)} MB`)
