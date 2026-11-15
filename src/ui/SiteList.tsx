import { useState } from 'react'
import type { Site } from '../app/data'
import { fmtLatLon } from './canvas'

interface Props {
  sites: Site[]
  compare: string[]
  activeId?: string
  onToggle: (id: string) => void
  onActive: (id: string) => void
  onAdd: (s: Site) => void
  onRemove: (id: string) => void
}

export function SiteList({ sites, compare, activeId, onToggle, onActive, onAdd, onRemove }: Props) {
  const [name, setName] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const groups = [...new Set(sites.map((s) => s.group))]
  const la = Number(lat)
  const lo = Number(lon)
  const valid = lat !== '' && lon !== '' && la >= -90 && la <= 90 && lo >= -180 && lo <= 360

  return (
    <div className="panel">
      <h2>Sites</h2>
      {groups.map((g) => (
        <div key={g}>
          <h3>{g}</h3>
          {sites
            .filter((s) => s.group === g)
            .map((s) => (
              <div key={s.id} className={`site ${s.id === activeId ? 'active' : ''}`}>
                <input type="checkbox" checked={compare.includes(s.id)} onChange={() => onToggle(s.id)} title="Compare" />
                <button className="site-name" onClick={() => onActive(s.id)} title={s.note}>
                  {s.name}
                  <small>{fmtLatLon(s.lat, s.lon)}</small>
                </button>
                {s.source && (
                  <a href={s.source} target="_blank" rel="noreferrer" title="Source of the coordinates">
                    src
                  </a>
                )}
                {s.group === 'Custom' && (
                  <button className="x" onClick={() => onRemove(s.id)} title="Remove">
                    ×
                  </button>
                )}
              </div>
            ))}
        </div>
      ))}
      <h3>Add a site</h3>
      <form
        className="add"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          const east = ((lo % 360) + 360) % 360
          onAdd({ id: `custom-${Date.now()}`, name: name.trim() || `${la.toFixed(2)}, ${east.toFixed(2)}`, group: 'Custom', lat: la, lon: east })
          setName('')
          setLat('')
          setLon('')
        }}
      >
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Lat (°N)" value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" />
        <input placeholder="Lon (°E)" value={lon} onChange={(e) => setLon(e.target.value)} inputMode="decimal" />
        <button disabled={!valid}>Add</button>
      </form>
    </div>
  )
}
