import type { PanelMode, Requirements } from '../core/metrics'

interface Props {
  req: Requirements
  onChange: (r: Requirements) => void
}

export function RequirementsPanel({ req, onChange }: Props) {
  const num = (key: keyof Requirements, label: string, unit: string, min: number, max: number, step = 1) => (
    <label>
      {label}
      <span className="unit">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={req[key] as number}
          onChange={(e) => onChange({ ...req, [key]: Math.min(max, Math.max(min, +e.target.value || 0)) })}
        />
        {unit}
      </span>
    </label>
  )
  const check = (key: keyof Requirements, label: string) => (
    <label className="check">
      <input type="checkbox" checked={req[key] as boolean} onChange={(e) => onChange({ ...req, [key]: e.target.checked })} />
      {label}
    </label>
  )
  return (
    <div className="panel">
      <h2>Requirements</h2>
      <h3>Lander</h3>
      {num('mastM', 'Array and antenna height', 'm', 0, 50, 0.5)}
      <label>
        Solar array
        <select value={req.panel} onChange={(e) => onChange({ ...req, panel: e.target.value as PanelMode })}>
          <option value="tracking">tracks the Sun</option>
          <option value="horizontal">fixed, facing up</option>
          <option value="fixed">fixed, tilted</option>
        </select>
      </label>
      {req.panel === 'fixed' && (
        <>
          {num('panelAz', 'Array faces azimuth', '°', 0, 360)}
          {num('panelTilt', 'Tilt from horizontal', '°', 0, 90)}
        </>
      )}
      {num('loadW', 'Power draw in darkness', 'W', 0, 5000, 10)}
      <h3>Power</h3>
      {num('minPower', 'Array output needed (1 = full Sun, face on)', '', 0.05, 1, 0.05)}
      {num('maxDarkH', 'Darkness the battery can bridge', 'h', 0, 400)}
      {check('needSunAtLanding', 'Power at landing')}
      <h3>Earth link</h3>
      {num('earthMarginDeg', 'Earth above skyline by', '°', 0, 10, 0.5)}
      {num('minCommPct', 'Link available at least', '%', 0, 100, 5)}
      {check('needEarthAtLanding', 'Earth in view at landing')}
    </div>
  )
}
