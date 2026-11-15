import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { AU_KM, HOUR_MS } from '../src/core/const'
import { EPHEM_FIRST_YEAR, EPHEM_LAST_YEAR } from '../src/core/ephemeris'
import { lonLatToVec } from '../src/core/frames'
import { horizons, horizonsDate, parseHorizonsDate } from './horizons'

const dir = 'public/data/ephem'
mkdirSync(dir, { recursive: true })

for (let year = EPHEM_FIRST_YEAR; year <= EPHEM_LAST_YEAR; year++) {
  const path = `${dir}/${year}.bin`
  if (existsSync(path)) continue
  const t0 = Date.UTC(year, 0, 1)
  const t1 = Date.UTC(year + 1, 0, 1)
  // Moon seen from the geocenter: the sub-observer point gives the Earth direction, the sub-solar point the Sun direction
  const rows = await horizons({
    COMMAND: '301',
    CENTER: '500@399',
    EPHEM_TYPE: 'OBSERVER',
    START_TIME: horizonsDate(t0),
    STOP_TIME: horizonsDate(t1),
    STEP_SIZE: '1 h',
    QUANTITIES: '14,15,19,20',
  })
  const n = (t1 - t0) / HOUR_MS + 1
  if (rows.length !== n) throw new Error(`${year}: expected ${n} rows, got ${rows.length}`)
  const out = new Float32Array(n * 6)
  rows.forEach((r, i) => {
    if (parseHorizonsDate(r[0]) !== t0 + i * HOUR_MS) throw new Error(`${year}: unexpected time ${r[0]}`)
    const [obsLon, obsLat, sunLon, sunLat, rAu, , deltaAu] = r.slice(3).map(Number)
    out.set(lonLatToVec(sunLon, sunLat, rAu * AU_KM), i * 6)
    out.set(lonLatToVec(obsLon, obsLat, deltaAu * AU_KM), i * 6 + 3)
  })
  writeFileSync(path, Buffer.from(out.buffer))
  console.log(year, n)
}
