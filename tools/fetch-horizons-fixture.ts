import { writeFileSync } from 'node:fs'
import { DAY_MS, HOUR_MS } from '../src/core/const'
import { horizons, horizonsDate, parseHorizonsDate } from './horizons'

// [east longitude deg, latitude deg, altitude km]
const sites: [number, number, number][] = [
  [25.2, -13.3, 0],
  [0, 0, 0],
  [222.69, -89.45, 1.2],
  [0, -89.9, 0],
  [357.07, -85.99, 4.5],
  [31.73, -85.42, 1.5],
  [32.32, -69.37, 0],
  [61.81, 18.56, -3.5],
  [177.6, -45.44, -5.9],
  [270, 60, 0],
  [123.64, -88.81, 1.0],
  [90, -80.5, 0],
]

let seed = 20261114
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 2 ** 32
}

const out: { lon: number; lat: number; alt: number; t: number; body: string; az: number; el: number }[] = []
for (const [lon, lat, alt] of sites) {
  const start = Date.UTC(2023, 0, 2) + Math.floor(rand() * 12.8 * 365) * DAY_MS
  for (const [body, cmd] of [['sun', '10'], ['earth', '399']] as const) {
    const rows = await horizons({
      COMMAND: cmd,
      CENTER: 'coord@301',
      COORD_TYPE: 'GEODETIC',
      SITE_COORD: `${lon},${lat},${alt}`,
      EPHEM_TYPE: 'OBSERVER',
      START_TIME: horizonsDate(start),
      STOP_TIME: horizonsDate(start + 29 * DAY_MS),
      STEP_SIZE: '67 h',
      QUANTITIES: '4',
    })
    for (const r of rows) {
      const nums = r.slice(1).filter((x) => x !== '' && !Number.isNaN(Number(x))).map(Number)
      out.push({ lon, lat, alt, t: parseHorizonsDate(r[0]), body, az: nums[0], el: nums[1] })
    }
    console.log(lon, lat, body, rows.length, rows[0].join('|'))
  }
}
if (out.some((o) => o.t % HOUR_MS !== 0)) throw new Error('fixture times must fall on the hour')
writeFileSync('tests/fixtures/horizons_topo.json', JSON.stringify(out))
console.log(out.length, 'samples')
