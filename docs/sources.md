# Sources

Everything the app and its checks rely on. Add an entry here whenever new data, a paper or a library comes in.

## Data

| What | Used for | Source |
|---|---|---|
| JPL Horizons API | Sun and Earth positions in the Moon-fixed MOON_ME frame, 2023 to 2035, hourly. Also the reference for the geometry test | https://ssd.jpl.nasa.gov/horizons/ |
| LOLA south pole elevation models, 80S at 80 m and 40 m (`LDEM_80S_80MPP_ADJ.TIF`, `LDEM_80S_40MPP_ADJ.TIF`) | Terrain skyline, site map | https://pgda.gsfc.nasa.gov/products/90 |
| LOLA south pole mosaic, 87S at 5 m (`ldem_87s_5mpp.tif`) | Skylines of the listed polar sites, check of the 40 m tiles | https://pgda.gsfc.nasa.gov/products/81 |
| High-resolution LOLA topography for south pole sites (Site01, Site04, Site07) | Location of the candidate sites | https://pgda.gsfc.nasa.gov/products/78 |
| PGDA lunar landing site list | Coordinates of recent landers | https://pgda.gsfc.nasa.gov/products/101 |

## Papers

- Barker, M. K. et al. (2021). Improved LOLA elevation maps for south pole landing sites: error estimates and their impact on illumination conditions. Planetary and Space Science 203, 105119. https://doi.org/10.1016/j.pss.2020.105119
- Noda, H. et al. (2008). Illumination conditions at the lunar polar regions by KAGUYA (SELENE) laser altimeter. Geophysical Research Letters 35, L24203. https://doi.org/10.1029/2008GL035692
- Mazarico, E. et al. (2011). Illumination conditions of the lunar polar regions using LOLA topography. Icarus 211, 1066-1081. https://doi.org/10.1016/j.icarus.2010.10.030

## Sites

| Site | Latitude | East longitude | Source | Note |
|---|---|---|---|---|
| Connecting ridge (PGDA Site01) | -89.439 | 222.9036 | https://pgda.gsfc.nasa.gov/products/78 | Highest LOLA point (1959 m) within 3 km of the center of the PGDA Site01 elevation model |
| Shackleton rim (PGDA Site04) | -89.7813 | 204.7872 | https://pgda.gsfc.nasa.gov/products/78 | Highest LOLA point (1737 m) within 3 km of the center of the PGDA Site04 elevation model |
| Peak near Shackleton (PGDA Site07) | -88.8083 | 123.7165 | https://pgda.gsfc.nasa.gov/products/78 | Highest LOLA point (1648 m) within 3 km of the center of the PGDA Site07 elevation model |
| IM-2 Athena, Mons Mouton | -84.7754 | 29.1264 | https://pgda.gsfc.nasa.gov/products/101 | Landed 2025-03-06 on Mons Mouton. Coordinates from the PGDA landing site list |
| SLIM | -13.31549 | 25.24889 | https://www.isas.jaxa.jp/en/outreach/announcements/files/SLIM-pressconf-20240125.pdf | Coordinates of the JAXA target point. SLIM came down about 55 m east of it |
| Chandrayaan-3 | -69.3735 | 32.3199 | https://pgda.gsfc.nasa.gov/products/101 | Landed 2023-08-23. Coordinates from the PGDA landing site list |
| IM-1 Odysseus | -80.1277 | 1.4357 | https://pgda.gsfc.nasa.gov/products/101 | Landed near Malapert A. Coordinates from the PGDA landing site list |
| Blue Ghost Mission 1 | 18.56 | 61.81 | https://lroc.im-ldi.com/images/1400 | Center of the landing region in Mare Crisium given by LROC |
| Apollo 11 | 0.6742 | 23.4731 | https://lroc.im-ldi.com/posts/1122 | Coordinates from LROC |
| Apollo 17 | 20.18809 | 30.77475 | https://apollojournals.org/alsj/a17/a17ov.html | Coordinates from the Apollo Lunar Surface Journal |
| Chang'e 4 (far side) | -45.4561 | 177.5885 | https://ntrs.nasa.gov/api/citations/20250002845/downloads/M2M-30044%20Lunar%20Surface%20Data%20Book%20Baseline_Final.pdf | Von Karman crater. Earth is never in view, so the mission relies on a relay satellite |
| Chang'e 6 (far side) | -41.6385 | 206.0148 | https://ntrs.nasa.gov/api/citations/20250002845/downloads/M2M-30044%20Lunar%20Surface%20Data%20Book%20Baseline_Final.pdf | Apollo basin on the far side. Longitude converted from 153.9852 W |

## Mission events used in the examples and tests

| Mission | When | What | Source |
|---|---|---|---|
| SLIM | 2024-01-19T15:20:00Z | Touchdown, 0:20 JST on 2024-01-20 | https://global.jaxa.jp/press/2024/01/20240125-1_e.html |
| SLIM | 2024-01-19T17:57:00Z | Spacecraft power cut by ground command (battery disconnected), 2:57 JST on 2024-01-20 | https://www.isas.jaxa.jp/en/outreach/announcements/files/SLIM-pressconf-20240125.pdf |
| SLIM | 2024-01-28 | Communication re-established and operations resumed, announced by JAXA's SLIM account on 2024-01-28 ('last night'); ISAS status log lists Day-1 as 2024-01-28 to 01-31 | https://www.isas.jaxa.jp/home/slim/SLIM/operation_status/index.html |
| SLIM | 2024-01-25 | JAXA's stated reason for the power loss: solar cells faced west after landing, power generation expected to recover as the Sun moves west | https://global.jaxa.jp/press/2024/01/20240125-1_e.html |
| Blue Ghost Mission 1 | 2025-03-16 | Mission concluded about 5 hours into the lunar night after more than 14 days (346 hours of daylight) of surface operations; exact sunset time not stated on the page | https://fireflyspace.com/missions/blue-ghost-mission-1/ |
| Chang'e 4 (far side) | 2018-05-19 | Far side always faces away from Earth, so a relay satellite (Queqiao) is needed to communicate with the lander | https://www.planetary.org/articles/0519-change-4-relay-satellite |

## Software

- React, Vite, TypeScript, Vitest
- geotiff.js, to read the elevation GeoTIFFs when building the tiles
