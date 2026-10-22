# Fish Nasty

A browser-based, add-to-home-screen fishing app for Minnesota lakes. Think onX Fish / Navionics, built on free public data:

- **Depth maps** — Minnesota DNR lake bathymetry rendered live as color-coded contour lines (0–5 ft through 100+ ft), shaded depth fill, depth labels, and a depth-range highlighter. Tap anywhere on a mapped lake to read the depth at that spot.
- **Fish species** — the species list from DNR fisheries surveys, with game fish highlighted and a "stocked" badge.
- **DNR surveys** — focused on walleye, northern pike and crappie: for each survey that netted them, catch per net by gear vs. the statewide normal range, how many were measured, the longest fish, the share over 20″ / 30″ / 11″, and the full length distribution. The DNR's "Status of the Fishery" write-up is one tap away.
- **Top 20 lakes** — every surveyed lake in Minnesota (about 3,800) ranked for the biggest and the most walleye, pike and crappie, built from the DNR survey length and catch data. Trophy button in the top bar.
- **Stocking records** — year-by-year stocking table (species, size, number, pounds) with DNR footnotes.
- **Public accesses** — boat ramps and carry-ins from the DNR access inventory, mapped, with directions.
- **Bite forecast** — a 7-day, hour-by-hour bite score that blends solunar periods (moon overhead/underfoot, moonrise/set), moon phase, dawn/dusk, barometric trend, wind, cloud cover, precipitation, temperature swings and the season. Pick a species (walleye, pike, muskie, bass, crappie, panfish, perch, lake trout, trout, catfish…) and the weighting changes to match how that fish behaves.
- **Pins (waypoints)** — drop a pin at your GPS position, at a spot you tap, from the depth popup, or by long-pressing (right-click on a computer) anywhere on the map. Pins pick up the lake name and depth automatically, can be named, colored and annotated, and have one-tap directions. Saved on the device.
- **Favorite lakes, recent lakes, search** by name or DOW number, "lakes with depth maps near me", deep links (`#lake/48000200`).
- **Account & sync (Supabase)** — sign in with email + password or an emailed link. Pins, favorites and catches are backed up and synced across your phone and computer. Everything still works signed out; it just stays on that device.
- **Catch log** — log species, length, weight, bait, notes and a photo from a lake page or any pin. The weather, barometer trend, moon phase, solunar period and bite score at that moment are saved automatically. After 5+ catches of a species the forecast adds a personal adjustment from your own history, and the Forecast tab shows your best times, barometer and moon.
- **Buddies** — invite by email, accept requests, and share pins, catches (with photos) and lake reports with each other. Shared items show up in the Buddies feed with "Show on map" and "Save to my pins".
- **Lake finder** — every surveyed lake's walleye, pike and crappie metrics live in the database: rank by biggest or most, statewide, within a radius of you, or by county, with a minimum "longest netted" filter. The DNR data is re-scanned automatically once a month by a scheduled Supabase Edge Function.

**Live:** https://fishnasty.netlify.app (deploys automatically from the `main` branch of https://github.com/rTorms12/fish-nasty). Open it on your phone and use Share → Add to Home Screen.

Everything runs in the browser. There is no build step, no server-side code, and no API keys.

## Run it

**On your Mac:** double-click `serve.command` (or run `python3 serve.py` in Terminal). It starts a tiny local web server and opens http://localhost:8765. The same window prints a `http://<your-mac-ip>:8765` address you can open on your phone while it is on the same Wi-Fi.

**On your phone as a home-screen app:** the app is a Progressive Web App.

1. Open the app's URL in Safari (iPhone) or Chrome (Android).
2. iPhone: tap Share → **Add to Home Screen**. Android: menu → **Install app** / **Add to Home screen**.
3. Launch it from the icon — it opens full-screen like a native app.

For the icon to work everywhere and for offline caching to turn on, the app needs to be served over **https**. The simplest free way is GitHub Pages:

1. Create a GitHub repository and push this folder to it.
2. In the repo: Settings → Pages → Source: *Deploy from a branch* → `main` / root.
3. Open `https://<you>.github.io/<repo>/` on your phone and add it to the home screen.

Netlify Drop (drag the folder onto app.netlify.com/drop) and Cloudflare Pages work the same way.

## How the data flows

| Feature | Source | Endpoint |
|---|---|---|
| Lake search, species list, size/depth, special regs, invasives | MN DNR LakeFinder | `maps.dnr.state.mn.us/cgi-bin/lakefinder/search.cgi` |
| Fisheries surveys, catch tables, lengths, narrative, clarity | MN DNR LakeFinder | `maps.dnr.state.mn.us/cgi-bin/lakefinder/detail.cgi?type=lake_survey` |
| Stocking records | MN DNR LakeFinder | `maps.dnr.state.mn.us/cgi-bin/lakefinder/fish_stocking.cgi` |
| Depth contours, lake outlines, depth at a point | MN Geospatial Commons (DNR Lake Bathymetry) | `enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/water_lake_bathymetry/MapServer` |
| Shaded depth fill | MN Geospatial Commons | `.../water_lake_bathy_shaded_relief/ImageServer` |
| Public water accesses (looked up by lake id and by the lake's bounding box, since ~550 DNR access records carry no lake id) | MN Geospatial Commons | `.../struc_water_access_sites/FeatureServer` |
| Weather (hourly, 7 days + 2 days history for pressure trend) | Open-Meteo | `api.open-meteo.com/v1/forecast` |
| Sun, moon phase, moonrise/set, moon transit | SunCalc (computed on device) | — |
| Basemaps | Esri World Imagery / Topo, OpenStreetMap, CARTO | tiles |
| Species artwork | U.S. Fish & Wildlife Service (Timothy Knepp) and NOAA GLERL, public domain | `img/species/` (see CREDITS.txt) |

All of these are public endpoints that allow browser requests. They are undocumented conveniences of the DNR's own LakeFinder site, so if the DNR changes them the app will need an update (`js/config.js` holds every URL).

## Bite score, briefly

Each hour starts at 50 and is adjusted by:

| Factor | Effect |
|---|---|
| Solunar major period (moon overhead / underfoot, ±1 h) | up to +16 |
| Solunar minor period (moonrise / moonset, ±45 min) | up to +10 |
| New or full moon (±2 days) | up to +8; quarter moons −1 |
| Within 90 min of sunrise / sunset | up to +12 |
| Full night / midday bright sun | −8 / −5 |
| Barometer falling slowly (−1 to −4 hPa per 3 h) | +10 (fast fall +5, rising fast −10, steady high −5) |
| Post-frontal jump (+6 hPa in 24 h) with clear skies | −8 |
| Wind 7–15 mph "chop" | +6 (flat calm −3, 20–28 mph −8, more −15) |
| Overcast / partly cloudy by day | +6 / +2; clear midday −4 |
| Light rain +4; rain −4; heavy rain −10; thunderstorms −20 | |
| Air temperature drop >15 °F vs. yesterday | −10 (−5 for 8–15 °F); warming +3 |
| Season | per-species monthly curve |
| Modeled surface water temperature vs. the species' preferred range | +6 in range, down to −10 when too warm or too cold |
| Spring spawn windows (crappie 55–66 °F, bass 58–68 °F, bluegill 65–75 °F, post-spawn walleye 48–58 °F…) | +3 to +6 while water is rising through the window |
| Fall turnover (deep lake, surface cooling through the 50s) | −6 |
| Water clarity (DNR Secchi depth) | scales the bright-sun penalty and low-light bonus: stronger on clear lakes, weaker on stained ones |
| Lake size | wind chop counts for less on tiny lakes; 15+ mph on big water (5,000+ acres) adds −4 to −10 |

Water temperature is modeled, not measured: 45 days of daily mean air temperature (Open-Meteo) are run through a lagged response whose speed depends on the lake's maximum depth and size (shallow lakes follow the air within days, big deep lakes lag by weeks), floored at freezing. Sunlight uses Open-Meteo's shortwave radiation when available, so sun angle and season are built in. Solunar and moon-phase weights are deliberately modest (max +12 and +6) because the evidence for them is thin.

Species profiles in `js/species.js` multiply each factor (e.g. walleye care more about low light and chop, muskies about moon events, bass about cold fronts, catfish like night and rain). It is guidance, not a guarantee.

## Supabase backend

Project **Fish Nasty** in the "Ryan's Apps" organization (`kmfyzjasrtpgdjcybqtr`, us-east-2). The browser talks to it with the publishable key in `js/config.js`; every table has row-level security, so users only ever see their own rows plus what buddies chose to share.

| Table | What it holds |
|---|---|
| `profiles` | one row per account (display name, email); created by a trigger on sign-up |
| `pins`, `favorites`, `catches`, `reports` | per-user data; `shared = true` rows are visible to accepted buddies |
| `friendships` | invites and buddy links (by email; auto-linked when the invitee signs up) |
| `lakes`, `lake_species_metrics` | all 3,800+ surveyed lakes and their walleye / pike / crappie size and catch-rate metrics (public read) |
| `refresh_jobs`, `refresh_queue` | progress of the monthly DNR re-scan |

Photos live in the private `catch-photos` storage bucket (`{user id}/{catch id}.jpg`, resized to 1280 px on the phone before upload).

The Edge Function `refresh-lakes` re-scans LakeFinder in batches of 60 lakes; a pg_cron job (`refresh-lakes-tick`, every 2 minutes) keeps it moving while a job is running and starts a new one when the last finished more than 30 days ago. `?action=status` on the function reports progress.

A GitHub Actions workflow (`.github/workflows/keepalive.yml`) reads one row from the database every Monday and Thursday so the free-tier project never pauses for inactivity. GitHub turns off scheduled workflows in a repository that has had no commits for 60 days; pushing any change (or running the workflow by hand from the Actions tab) switches it back on.

Auth settings to keep correct in the Supabase dashboard (Authentication → URL Configuration): Site URL `https://fishnasty.netlify.app`, redirect URLs `https://fishnasty.netlify.app/**` and `http://localhost:8765/**`. Supabase's built-in mailer is rate-limited (a few emails per hour); add custom SMTP if buddies sign up in bulk.

## Rebuilding the Top 20 rankings

`data/rankings.json` is generated, not live. To refresh it after the DNR posts new surveys (once a year is plenty):

```bash
python3 tools/build_rankings.py
```

It lists every lake with a survey (87 county queries), fetches each lake's survey JSON (about 3,800 requests, 3–5 minutes), keeps surveys from the last 12 years, and ranks:

- **Biggest fish** — share of netted fish at or above 20″ (walleye), 30″ (pike), 11″ (crappie) across the two most recent surveys with length data; at least 40 / 25 / 40 fish measured; lakes over 50 acres.
- **Most fish** — catch per net in the most recent survey using standard gill nets (walleye, pike) or standard trap nets (crappie); at least 2 nets; lakes over 50 acres.

A normal run refetches every lake so new surveys are included. If a run gets interrupted, `--resume` continues it; `--quick` only re-ranks the previous run's cached metrics without fetching.

## Project layout

```
index.html            app shell
manifest.webmanifest  PWA manifest (name, icons, standalone display)
sw.js                 service worker: offline shell + cached DNR/weather data
serve.command         double-click launcher for the Mac (runs serve.py)
serve.py              local web server with no-cache headers
tools/build_rankings.py  builds data/rankings.json (Top 20 lakes) from DNR surveys
data/rankings.json    generated Top 20 rankings
css/app.css           styles (dark, mobile-first; side panel on desktop)
js/config.js          endpoints, depth bands, counties, helpers
js/species.js         DNR species codes + species behavior profiles
js/dnr.js             LakeFinder + ArcGIS data access
js/weather.js         Open-Meteo
js/solunar.js         sun / moon / solunar periods
js/forecast.js        bite score model
js/map.js             Leaflet map, DNR depth layers, tap-to-depth
js/ui.js              rendering
js/app.js             state, events, loading, bottom sheet, sync
js/views.js           account, catch log, buddies, lake finder views
js/cloud.js           Supabase client (auth, sync, catches, buddies, lake metrics)
icons/                app icons
```

## Performance notes

- Depth tiles are rendered live by the state ArcGIS server (no CDN), so they are the slowest thing in the app. The app asks for one combined image per tile (contours, outline and depth labels together), at 1× resolution for the shaded fill and 1.5× for lines, and skips requests while a pinch-zoom is in progress. The service worker keeps the last ~600 depth tiles on the device for 30 days, so places you've looked at before draw instantly and work offline.
- DNR survey, stocking and access data are served from the device cache first and refreshed in the background (7-day window); weather is always fetched fresh when online.
- The panel re-renders at most once per animation frame, the sign-in library loads in the background, and the page preconnects to every data host at startup.

## Notes and limits

- Depth data is the DNR's bathymetry and is **not for navigation**. Not every lake has a depth map (about 4,500 do); un-mapped lakes still show surveys and stocking.
- Very large lakes (Mille Lacs, Leech, Lake of the Woods) draw contours only once you are zoomed in (zoom 10+), to keep the DNR map server happy.
- The weather forecast is for the lake's location in Central time.
- Offline: after you have opened a lake once, its survey/stocking/weather are cached by the service worker (https or localhost only). Map tiles are not cached.
- Not affiliated with the Minnesota DNR. Always check current fishing regulations.
