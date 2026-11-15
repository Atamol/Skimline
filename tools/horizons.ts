const API = 'https://ssd.jpl.nasa.gov/api/horizons.api'

export async function horizons(params: Record<string, string>): Promise<string[][]> {
  const q = new URLSearchParams({ format: 'text', MAKE_EPHEM: "'YES'", CSV_FORMAT: "'YES'" })
  for (const [k, v] of Object.entries(params)) q.set(k, `'${v}'`)
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}?${q}`)
    const text = await res.text()
    const s = text.indexOf('$$SOE')
    const e = text.indexOf('$$EOE')
    if (res.ok && s >= 0 && e > s) {
      return text
        .slice(s + 5, e)
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.split(',').map((x) => x.trim()))
    }
    if (attempt >= 3) throw new Error(`Horizons failed: ${text.slice(0, 600)}`)
    await new Promise((r) => setTimeout(r, 3000))
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function parseHorizonsDate(s: string): number {
  const m = /^(\d{4})-(\w{3})-(\d{2}) (\d{2}):(\d{2})/.exec(s)
  if (!m) throw new Error(`bad date: ${s}`)
  return Date.UTC(+m[1], MONTHS.indexOf(m[2]), +m[3], +m[4], +m[5])
}

export function horizonsDate(tMs: number): string {
  return new Date(tMs).toISOString().slice(0, 16).replace('T', ' ')
}
