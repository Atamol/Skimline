---
theme: default
title: Skimline
colorSchema: dark
layout: cover
---

# Skimline

If the landing date slips, which sites still work?

<div class="abs-bl m-10 text-sm opacity-70">NASA Space Apps Challenge 2026 · Lunar Landing Site Navigator</div>

---

## Problem: landing dates slip

- Missions rarely land on the date they first planned
- Every change reopens two questions
  - Is there <span class="sun">power</span>? The lander needs the Sun
  - Can we <span class="earth">talk to Earth</span>? A direct link needs the Earth in view
- Horizons, Quickmap and Moon Trek hold the data, but they answer one site and one date at a time
- When the schedule moves, planners need to compare every alternative at once

---

## Theory: the skyline decides

- Power and a direct link both need a body **above the local skyline**
- Near the equator the Sun climbs high, so terrain hardly matters
- At the south pole the <span class="sun">Sun</span> stays within about 1.5° of the horizon, and the <span class="earth">Earth</span> drifts across it once a month
- One distant ridge, a few days or a few kilometers change the answer

<img src="/sky.png" class="mt-4 mx-auto w-175">

---

## Theory: three steps to a verdict

1. **Where are the Sun and Earth?**
   Hourly positions from JPL Horizons, 2023 to 2035
2. **What does the skyline look like?**
   LRO LOLA elevation, rays cast 300 km out for every 0.25° of azimuth
3. **Are they above it?**
   Share of the <span class="sun">Sun</span>'s disk in view × angle on the array = power.
   <span class="earth">Earth</span>'s center above the skyline = link

For any site and landing time this gives the hours until sunset, the longest darkness and the share of the mission with a link. Compared with the mission requirements, that is a <span class="go">go</span> or a no-go.

<img src="/timeline.png" class="mt-4 mx-auto w-140">

---

## Solution: one chart of sites × landing dates

<img src="/slip.png" class="mx-auto">

- Each cell is one landing time, judged against the mission requirements
- Read along a row to see what a delay costs
- Here the same ridge is a <span class="go">go</span> for about ten days, then loses the Earth for two weeks

---
layout: two-cols
---

## Solution: click a cell, see the sky

- Skyline from LOLA terrain with the paths of the <span class="sun">Sun</span> and <span class="earth">Earth</span>
- Countdown to sunset and Earthset
- Two sites at the same moment
- Change the mission length, array or battery and the verdict follows
- Click the map to test any point near the pole

::right::

<img src="/sky2.png" class="ml-4 mt-16">

---

## Does it hold up?

| Check | Reported | Skimline |
|---|---|---|
| Directions, 264 samples at 12 sites | JPL Horizons | largest error <span class="go">0.006°</span> (the Sun is 0.53° wide) |
| Blue Ghost Mission 1, 2025 | 346 h of daylight operations | sunset <span class="go">348 h</span> after landing |
| SLIM, 2024, solar cells facing west | operations resumed Jan 28 | light returns Jan 23, half output <span class="go">Jan 26</span> |
| Best-lit surface at the south pole | 86% sunlit (KAGUYA, Noda et al. 2008) | <span class="go">85%</span> on the connecting ridge |

- Data: NASA JPL Horizons and LRO LOLA, JAXA SLIM and KAGUYA
- A static web page with no server, Apache-2.0
- Not modeled: terrain north of 82°S, ground stations, temperature, dust
