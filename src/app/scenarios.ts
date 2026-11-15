import type { Requirements } from '../core/metrics'

export interface Scenario {
  id: string
  label: string
  blurb: string
  source?: string
  active: string
  // site ids, or a group name prefixed with "group:"
  compare: string[]
  // ISO time, or days from today
  landing: string | number
  req: Partial<Requirements>
  viewDays: number
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'pole',
    label: 'South pole: which site survives a slip?',
    blurb:
      'Near the pole the Sun and Earth skim the skyline, so a few days or a few kilometers decide whether a lander has power and a link. Green cells are landing times that meet the requirements on the left.',
    active: 'pgda-site01',
    compare: ['group:South pole'],
    landing: 30,
    req: {},
    viewDays: 60,
  },
  {
    id: 'slim',
    label: 'SLIM, January 2024: solar cells facing west',
    blurb:
      'SLIM touched down on 2024-01-19 15:20 UTC with its solar cells facing west while the Sun was in the east, and was powered down 2 h 37 min later. JAXA expected power to return once the Sun moved west, and operations resumed on January 28. With a fixed west-facing array, the timeline below shows that window opening.',
    source: 'https://global.jaxa.jp/press/2024/01/20240125-1_e.html',
    active: 'slim',
    compare: ['slim'],
    landing: '2024-01-19T15:20:00Z',
    req: { missionDays: 14, panel: 'fixed', panelAz: 270, panelTilt: 90, needEarthAtLanding: true },
    viewDays: 30,
  },
  {
    id: 'blue-ghost',
    label: 'Blue Ghost Mission 1, March 2025: one lunar day',
    blurb:
      'Blue Ghost landed in Mare Crisium on 2025-03-02 08:34 UTC. Firefly reports 346 hours of daylight operations before lunar night. Compare that with the sunset countdown at landing.',
    source: 'https://fireflyspace.com/missions/blue-ghost-mission-1/',
    active: 'blue-ghost-1',
    compare: ['blue-ghost-1'],
    landing: '2025-03-02T08:34:00Z',
    req: { missionDays: 16, minPower: 0.05 },
    viewDays: 30,
  },
  {
    id: 'far-side',
    label: "Chang'e 4: the far side never sees Earth",
    blurb:
      'From the far side the Earth stays below the horizon at every date, so a direct link is impossible and the mission talks through a relay satellite. Every landing time fails on the Earth link.',
    source: 'https://www.planetary.org/articles/0519-change-4-relay-satellite',
    active: 'change-4',
    compare: ['change-4', 'change-6', 'apollo-11'],
    landing: 30,
    req: {},
    viewDays: 60,
  },
]
