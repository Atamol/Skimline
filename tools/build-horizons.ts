import { readFileSync, writeFileSync } from 'node:fs'
import { PRECOMPUTED_MASTS, type PrecomputedHorizons } from '../src/core/horizon'
import { horizonFrom5m } from './node-dem'

const sites: { id: string; lat: number; lon: number }[] = JSON.parse(readFileSync('public/data/sites.json', 'utf8'))
const out: PrecomputedHorizons = {}
for (const s of sites) {
  if (s.lat > -87.1) continue
  out[s.id] = { lat: s.lat, lon: s.lon, groundM: 0, masts: {} }
  for (const mast of PRECOMPUTED_MASTS) {
    const { horizon, groundM } = await horizonFrom5m(s.lon, s.lat, mast)
    out[s.id].groundM = +groundM.toFixed(1)
    out[s.id].masts[mast] = Buffer.from(horizon.buffer).toString('base64')
  }
  console.log(s.id, out[s.id].groundM)
}
writeFileSync('public/data/horizons.json', JSON.stringify(out))
