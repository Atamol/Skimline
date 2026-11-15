import { readFileSync, writeFileSync } from 'node:fs'
import { LEVELS, loadWindow } from '../src/core/dem'
import { lonLatToXY, xyToLonLat } from '../src/core/projection'
import { fileTiles } from './node-dem'

// PGDA box centers can sit on a slope or a crater wall, so each site moves to the highest LOLA point within 3 km
const path = 'public/data/sites.json'
const sites = JSON.parse(readFileSync(path, 'utf8'))
const centers: Record<string, [number, number]> = {
  'pgda-site01': [-89.4632, 222.5104],
  'pgda-site04': [-89.7668, 188.1301],
  'pgda-site07': [-88.811, 123.6901],
}
for (const s of sites) {
  const c = centers[s.id]
  if (!c) continue
  const [cx, cy] = lonLatToXY(c[1], c[0])
  const win = (await loadWindow(LEVELS[0], cx, cy, 3000, fileTiles))!
  let best = 0
  for (let i = 1; i < win.data.length; i++) if (win.data[i] > win.data[best]) best = i
  const x = win.x0 + (best % win.w) * win.res
  const y = win.y0 - Math.floor(best / win.w) * win.res
  const [lon, lat] = xyToLonLat(x, y)
  s.lat = +lat.toFixed(4)
  s.lon = +lon.toFixed(4)
  s.note = `Highest LOLA point (${win.data[best].toFixed(0)} m) within 3 km of the center of the PGDA S${s.id.slice(6)} elevation model`
  console.log(s.id, s.lat, s.lon, win.data[best].toFixed(0), 'm', `${(Math.hypot(x - cx, y - cy) / 1000).toFixed(1)} km from box center`)
}
writeFileSync(path, JSON.stringify(sites, null, 1))
