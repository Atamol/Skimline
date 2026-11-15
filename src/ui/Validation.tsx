import { useEffect, useState } from 'react'

interface Report {
  generated: string
  geometry: {
    samples: number
    sites: number
    firstYear: number
    lastYear: number
    worstElDeg: number
    worstAzDeg: number
    rmsElDeg: number
    rmsAzDeg: number
  }
  missions: { id: string; title: string; reported: string; computed: string; verdict: string; source: string }[]
  terrain: {
    id: string
    name: string
    meanAbsDeg: number
    rmsDeg: number
    maxAbsDeg: number
    sunTilesPct: number
    sun5mPct: number
    earthTilesPct: number
    earth5mPct: number
    sun2024to2026At1mPct: number
  }[]
}

export function Validation() {
  const [r, setR] = useState<Report>()
  useEffect(() => {
    fetch(new URL('data/validation.json', document.baseURI))
      .then((x) => x.json())
      .then(setR)
  }, [])
  if (!r) return <p className="empty">Loading…</p>
  const g = r.geometry
  return (
    <div className="validation">
      <section>
        <h2>1. Sun and Earth directions against JPL Horizons</h2>
        <p>
          The app does not call Horizons at run time. It ships hourly Sun and Earth positions in the Moon-fixed frame and works out azimuth and
          elevation for any site itself. To check that step, Horizons was asked directly for the azimuth and elevation seen from {g.sites} sites
          on the lunar surface, from the equator to within 0.1° of the pole, at dates spread over {g.firstYear} to {g.lastYear}.
        </p>
        <table className="compare plain">
          <thead>
            <tr>
              <th>Samples</th>
              <th>Largest elevation error</th>
              <th>Largest azimuth error</th>
              <th>RMS elevation error</th>
              <th>RMS azimuth error</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{g.samples}</td>
              <td>{g.worstElDeg}°</td>
              <td>{g.worstAzDeg}°</td>
              <td>{g.rmsElDeg}°</td>
              <td>{g.rmsAzDeg}°</td>
            </tr>
          </tbody>
        </table>
        <p className="note">The Sun is 0.53° across as seen from the Moon, so these errors are about 1% of its disk.</p>
      </section>

      <section>
        <h2>2. Missions that already flew</h2>
        <table className="compare plain wrap">
          <thead>
            <tr>
              <th>Mission</th>
              <th>What was reported</th>
              <th>What this tool computes</th>
              <th>Reading</th>
            </tr>
          </thead>
          <tbody>
            {r.missions.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.title}{' '}
                  <a href={m.source} target="_blank" rel="noreferrer">
                    source
                  </a>
                </td>
                <td>{m.reported}</td>
                <td>{m.computed}</td>
                <td>{m.verdict}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>3. Terrain skyline near the south pole</h2>
        <p>
          The three listed polar sites use a skyline computed ahead of time from the 5 m LOLA model. Any other point, including the ones you add
          on the map, is computed in the browser from 40 m tiles. The table shows what the coarser tiles cost at the same three sites over the
          year 2027, with the array 2 m above the ground.
        </p>
        <table className="compare plain">
          <thead>
            <tr>
              <th>Site</th>
              <th>Skyline difference, mean</th>
              <th>largest</th>
              <th>Sun in view, 40 m tiles</th>
              <th>Sun in view, 5 m model</th>
              <th>Earth in view, tiles / 5 m</th>
              <th>Sun in view 2024 to 2026, 1 m high</th>
            </tr>
          </thead>
          <tbody>
            {r.terrain.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.meanAbsDeg}°</td>
                <td>{t.maxAbsDeg}°</td>
                <td>{t.sunTilesPct}%</td>
                <td>{t.sun5mPct}%</td>
                <td>
                  {t.earthTilesPct}% / {t.earth5mPct}%
                </td>
                <td>{t.sun2024to2026At1mPct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note">
          "Sun in view" is the mean share of the solar disk above the skyline. Published values to compare with: Barker et al. (2021) find that
          Site 1 has the most area with average illumination above 70% at 1 m height between 2024 and 2026 (
          <a href="https://doi.org/10.1016/j.pss.2020.105119" target="_blank" rel="noreferrer">
            doi
          </a>
          ). Noda et al. (2008), from the KAGUYA (SELENE) laser altimeter, report 86% for the most continuously lit surface at the south pole (
          <a href="https://doi.org/10.1029/2008GL035692" target="_blank" rel="noreferrer">
            doi
          </a>
          ). Those studies cover different periods and heights, so only the level is comparable, not the digits.
        </p>
      </section>

      <section>
        <h2>4. What the tool does not model</h2>
        <ul>
          <li>North of 82°S the horizon is a smooth sphere. Local hills and crater rims are ignored there.</li>
          <li>The LOLA 5 m model is mostly interpolated between laser tracks, so features smaller than a few tens of meters are not resolved.</li>
          <li>An Earth link means the Earth's center clears the skyline by the chosen margin. Ground station visibility on Earth is not checked.</li>
          <li>Power is the visible share of the Sun's disk times the cosine of the angle on the array. Temperature, dust and shadowing by the lander are left out.</li>
          <li>States are sampled every hour and event times are interpolated between samples.</li>
        </ul>
      </section>

      <section>
        <h2>5. Run the checks yourself</h2>
        <pre>
          npm test{'\n'}npx tsx tools/validate.ts
        </pre>
        <p className="note">
          The first runs the unit tests, including the Horizons comparison. The second rebuilds every number on this page and needs the LOLA
          GeoTIFFs listed in docs/sources.md. Last run: {r.generated.slice(0, 16).replace('T', ' ')} UTC.
        </p>
      </section>
    </div>
  )
}
