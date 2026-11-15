---
theme: default
title: Skimline
colorSchema: dark
layout: cover
---

# Skimline

If the landing date slips, which sites still work?

<div class="abs-bl m-10 text-sm opacity-70">NASA Space Apps Challenge 2026 · Lunar Landing Site Navigator · Atamol</div>

---

## Problem: landing dates slip

```mermaid {theme: 'dark', scale: 0.95}
flowchart LR
  A[Landing date slips] --> B[Is there power?<br>Is the Sun in view?]
  A --> C[Can we talk to Earth?<br>Is the Earth in view?]
  B --> D[Recheck one site and<br>one date at a time]
  C --> D
```

- Horizons, Quickmap and Moon Trek answer one case at a time
- When the schedule moves, planners need to compare the alternatives at once

---

## Theory: the skyline decides

- Power and a direct link both need a body **above the skyline**
- At the south pole the <span class="sun">Sun</span> and the <span class="earth">Earth</span> both skim the horizon, so a few days or a few kilometers change the answer

<img src="/sky.png" class="mt-6 mx-auto w-190">

---

## Theory: three steps to a verdict

```mermaid {theme: 'dark', scale: 0.85}
flowchart LR
  H[1. Sun and Earth positions<br>JPL Horizons] --> J{3. Above<br>the skyline?}
  L[2. Skyline<br>LRO LOLA elevation] --> J
  J --> P[Power]
  J --> E[Earth link]
  P --> G[Go or no-go against<br>the requirements]
  E --> G
```

<img src="/timeline.png" class="mt-4 mx-auto w-120">

---

## Solution: one chart of sites × landing dates

<img src="/slip.png" class="mx-auto">

- Each cell is one landing time, green is a <span class="go">go</span>
- The same ridge is a <span class="go">go</span> for about ten days, then loses the Earth for two weeks

---

## Solution: the sky from the chosen cell

<div class="grid grid-cols-[2fr_3fr] gap-6 items-center">
<div>

- Skyline with the paths of the <span class="sun">Sun</span> and <span class="earth">Earth</span>
- Countdown to sunset and Earthset
- Two sites stacked

</div>
<img src="/sky2.png">
</div>

---

## Does it hold up?

<div class="grid grid-cols-4 gap-4 text-center text-sm my-10">
<div><div class="text-4xl go mb-3">0.006°</div>largest difference from JPL Horizons<br>(the Sun is 0.53° wide)</div>
<div><div class="text-4xl go mb-3">348 h</div>landing to sunset, Blue Ghost Mission 1<br>(346 h reported)</div>
<div><div class="text-4xl go mb-3">Jan 26</div>SLIM back to half output<br>(operations resumed Jan 28)</div>
<div><div class="text-4xl go mb-3">85%</div>sunlight on the connecting ridge<br>(KAGUYA: 86% at the best-lit surface)</div>
</div>

- Data: NASA (JPL Horizons, LRO LOLA), JAXA (SLIM, KAGUYA)
- Not modeled: terrain north of 82°S, ground stations, temperature, dust
