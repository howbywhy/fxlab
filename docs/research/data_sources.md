# Public data sources and data-handling practice for a client-only Data feature (fxlab)

Verification date: 2026-09-21, from a macOS sandbox with live network. "V" = verified by curl in this session, sending `Origin: null` (what file:// sends) and `Origin: https://example.com`, with a User-Agent of `fxlab-research/1.0`. "C" = claim from documentation, not verified here.

Not verified: real in-browser behaviour from file://. The Browser pane opens file:// pages as static snapshots (scripts do not run), so error text below comes from MDN, not from a run. A test page exists at `/private/tmp/claude-501/-Users-markblackler-Documents-GitHub-fxlab/5936c5f8-0ccd-441b-a3f1-a39ac06ab471/scratchpad/corstest.html` and should be opened in real Chrome/Safari/Firefox from disk to confirm.

## Which public APIs and datasets work from a browser with no key (or an easy key)?

### Takeaway
About 20 endpoints passed the CORS check with both `Origin: null` and `Origin: https://example.com`. Most send `Access-Control-Allow-Origin: *`, which covers file:// and Vercel alike. Cleveland Museum (no ACAO header), OpenAQ v3 (key required), SpaceX v4 (HTTP 525) and REST Countries (legacy API deprecated) failed. The recommended 15 are below, with a short list of caveats on each.

### Cited Findings

All rows: HTTP 200 for both Origins, unless stated. Sizes are the size of the test request. Live "Freshness" is how the data changes.

**A. Recommended list (15), all V**

| # | id | URL template (tested) | ACAO (null / example.com) | Content-type | Size | Records path | Freshness |
|---|----|-----------------------|---------------------------|--------------|------|--------------|-----------|
| 1 | om-forecast | `https://api.open-meteo.com/v1/forecast?latitude=51.5,40.7,35.7,-33.9&longitude=-0.12,-74,139.7,151.2&hourly=temperature_2m,wind_speed_10m,precipitation,relative_humidity_2m&forecast_days=3` | `*` / `*` | application/json | 12 KB | **columnar**: per location `hourly.{time[],temperature_2m[],...}`. Multi-location returns a top-level ARRAY of one object per location; single location returns one object | hourly, updated continuously |
| 2 | om-archive | `https://archive-api.open-meteo.com/v1/archive?latitude=51.5&longitude=-0.12&start_date=2024-01-01&end_date=2024-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` | `*` / `*` | application/json | 12 KB | columnar `daily.{time[],...}` (366 rows) | static history |
| 3 | om-air | `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=51.5&longitude=-0.12&hourly=pm10,pm2_5,ozone,nitrogen_dioxide` | `*` / `*` | application/json | 5 KB | columnar `hourly` (120 rows; 11 nulls per series) | hourly |
| 4 | om-marine | `https://marine-api.open-meteo.com/v1/marine?latitude=54.5&longitude=-4&hourly=wave_height,wave_period,wave_direction` | `*` / `*` | application/json | 6 KB | columnar `hourly` (168 rows) | hourly |
| 5 | usgs-quakes | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson` (also `2.5_month`, `all_week`, ...) | `*` / `*` | application/json | day 156 KB (218 events); 2.5_month 1.4 MB (1,986) | `features[]` -> `properties.*`, `geometry.coordinates=[lon,lat,depthKm]` (GeoJSON) | `Cache-Control: public, max-age=60` |
| 6 | nasa-eonet | `https://eonet.gsfc.nasa.gov/api/v3/events?limit=100` | `*` / `*` | application/json | 72 KB | `events[]`; nested `geometry[]` (date, magnitudeValue, coordinates) and `categories[]` | live, `no-cache`; header `X-RateLimit-Limit: 60` |
| 7 | iss-live | `https://api.wheretheiss.at/v1/satellites/25544` | `*` / `*` | application/json | 0.3 KB | single object (poll it to build a track); `X-Rate-Limit-Limit: 350` per 5 min | every second |
| 8 | worldbank | `https://api.worldbank.org/v2/country/GBR;USA;CHN;IND;BRA/indicator/NY.GDP.PCAP.CD?format=json&date=1990:2023&per_page=500` | `*` / `*` | application/json | 37 KB | **`[1]`** (response is `[meta, records]`) | annual; `[0].lastupdated`=2026-07-13 |
| 9 | wikimedia-views | `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Albert_Einstein/daily/20240101/20241231` | `*` / `*` | application/json | 56 KB | `items[]` (366 rows: `timestamp` "2024010100", `views` 10,077..115,530) | daily |
| 10 | aic-artworks | `https://api.artic.edu/api/v1/artworks?limit=100&fields=id,title,date_start,date_end,color,artist_title,style_title,department_title,is_public_domain` | `*` / `*` | application/json | 30 KB | `data[]`; pagination in `pagination.next_url` (132,747 works) | static |
| 11 | coingecko | `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=90` | `*` / `*` | application/json | 223 KB | `prices[]` = `[ms, price]` pairs (2,161 hourly points); also `market_caps`, `total_volumes` | `max-age=30` |
| 12 | frankfurter | `https://api.frankfurter.dev/v1/2024-01-01..2024-12-31?base=EUR&symbols=USD,GBP,JPY,CHF,AUD` | `*` / `*` | application/json | 21 KB | **object keyed by date**: `rates{"2024-01-02":{USD:..}}` (257 days) | daily, `max-age=86400`. Needs re-shaping into rows |
| 13 | citybikes | `https://api.citybik.es/v2/networks/santander-cycles` | `*` / `*` | application/json | 313 KB | `network.stations[]` (799 rows; lat/lon, free_bikes 0..49, empty_slots 0..54) | live; `RateLimit-Limit: 300` per hour |
| 14 | owid-co2 | `https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv` | `*` / `*` | text/plain (CSV) | 14.4 MB (50,411 rows, ~80 columns) | CSV rows | yearly; `max-age=300` |
| 15 | vega-datasets | `https://cdn.jsdelivr.net/npm/vega-datasets@2/data/{cars.json,gapminder.json,seattle-weather.csv,stocks.csv,earthquakes.json}` | `*` / `*` | json / csv | 12 KB to 1.2 MB | array of objects / CSV / GeoJSON | static, `max-age=604800` |

**B. Column detail (V, from the tested responses)**

- om-forecast (per location): `time` ISO-8601 local string (no offset, e.g. `2026-09-21T00:00`), `temperature_2m` 11.5..24.0 C, `wind_speed_10m` 0.4..22.7 km/h, `precipitation` 0..1.2 mm, `relative_humidity_2m` 36..79 %. Units in `hourly_units`. Also `latitude`, `longitude`, `elevation`, `timezone`.
- om-archive: `temperature_2m_max` 2.4..31.3, `temperature_2m_min` -5.1..18.3, `precipitation_sum` 0..51.6, `wind_speed_10m_max` 3.5..52.3.
- om-air: `pm10` 4.1..30.4, `pm2_5` 2.6..23.3, `ozone` 1..95, `nitrogen_dioxide` 6.7..76 (ug/m3; nulls present).
- om-marine: `wave_height` 0.18..1.6 m, `wave_period` 2.65..5.2 s, `wave_direction` 167..304 deg.
- usgs (month feed): `mag` 2.45..6.5, `time` epoch ms (number), `sig` 92..657, depth (coordinates[2]) km, `felt` 0..1,843 (86% null), `cdi`, `mmi`, `alert` (string, mostly null), `tsunami` 0/1, `place` (string). Day feed mag 0.07..5.7.
- eonet: `id`, `title`, `categories[0].title` (e.g. Wildfires), `geometry[].date` ISO with Z, `geometry[].magnitudeValue` (e.g. 500 acres), `geometry[].coordinates` [lon,lat].
- iss-live: `latitude`, `longitude`, `altitude` ~422 km, `velocity` ~27,573 km/h, `visibility` (string category), `footprint`, `timestamp` epoch s, `solar_lat`, `solar_lon`.
- worldbank: `country.value` (string), `countryiso3code`, `date` (STRING year), `value` 302.9..82,586.8 (GDP per capita, US$), 1 null in the all-countries population query. Note `unit`, `obs_status` are all-null.
- wikimedia: `timestamp` (YYYYMMDD00 string), `views` int; top-articles endpoint `.../metrics/pageviews/top/en.wikipedia/all-access/2024/01/all-days` gives `items[0].articles[]` with `article`, `views` 347,923..152,225,418, `rank` 1..1000 (V, 57 KB).
- aic: `date_start` -883..2016 (int, null in 1), `date_end`, `color.h` 0..356, `color.s` 0..97, `color.l` 13..94, `color.percentage`, `color.population`, `department_title` (category), `style_title` (33% null), `artist_title`, `is_public_domain` bool. Real dominant colour data: rare and directly useful for palette-driven visuals.
- coingecko: price 58,244..84,887 over the 90 days, hourly (3,600,000 ms step).
- frankfurter: `AUD` ~1.6, `CHF` ~0.93, `GBP` ~0.87, `JPY` ~156, `USD` ~1.10 (early Jan 2024). Business days only (gaps at weekends).
- citybikes: `latitude` 51.45..51.55, `longitude` -0.24..0.005, `free_bikes` 0..49, `empty_slots` 0..54, `timestamp` ISO, `extra.installDate` epoch ms as a STRING, 88 nulls.
- owid-co2: `country`, `year`, `iso_code`, `population`, `gdp`, `co2`, `co2_per_capita`, ... Most cells empty for early years/small entities.
- vega cars: `Miles_per_Gallon` 9..46.6 (8 null), `Cylinders` 3..8, `Displacement` 68..455, `Horsepower` 46..230 (6 null), `Weight_in_lbs` 1613..5140, `Acceleration` 8..24.8, `Year` "1970-01-01" string, `Origin` category (406 rows). gapminder: `year` 1955..2005, `country`, `cluster` 0..5, `pop`, `life_expect` 27.8..82.5, `fertility` 0.96..8.23 (682 rows). seattle-weather.csv: `date,precipitation,temp_max,temp_min,wind,weather` (1,461 rows). stocks.csv: `symbol,date,price` with dates like "Jan 1 2000" (non-ISO! needs a fallback parser).

**C. Also passed CORS (V), keep as extras**

- `https://api.open-notify.org/iss-now.json`: ACAO `*`, but **HTTP only**; blocked as mixed content from the Vercel https page, works from file://. Lat/lon are STRINGS. Prefer wheretheiss.at.
- `https://api.coinbase.com/v2/prices/BTC-USD/spot` and `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400`: ACAO `*`; candles are arrays `[time,low,high,open,close,volume]` (350 rows) with no header row, newest first.
- `https://api.github.com/repos/torvalds/linux/stats/commit_activity`: ACAO `*`; 52 weekly objects `{total 15..1794, week (epoch s), days[7]}`. Unauthenticated limit 60/h (`x-ratelimit-limit: 60`). Statistics endpoints can return 202 while GitHub computes them (C).
- `https://api.tfl.gov.uk/BikePoint`: ACAO `*`, 2.2 MB, ~800+ docks, `additionalProperties[]` holds NbBikes/NbEmptyDocks as name/value pairs (needs flattening). `.../Line/Mode/tube/Status` 9.7 KB.
- `https://gbfs.citibikenyc.com/gbfs/en/station_status.json`: ACAO `*`, 968 KB, `data.stations[]` 2,520 rows, `num_bikes_available` 0..112, `num_docks_available` 0..107, `last_reported` epoch s; `ttl: 60`.
- `https://api.carbonintensity.org.uk/intensity/date/2025-06-01`: ACAO `*`, `data[]` half-hourly `{from,to,intensity{forecast,actual,index}}`; 8 KB (48 rows a day, sharp daily rhythm).
- `https://data.cityofnewyork.us/resource/erm2-nwe9.json?$limit=100` (311 requests): ACAO `*`, all-string values, `created_date` ISO.
- `https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=20`: ACAO `*`, 101 KB, nested objects; free tier is throttled (C).
- `https://gbif.org` occurrences (`https://api.gbif.org/v1/occurrence/search?limit=100&hasCoordinate=true&country=GB`, 681 KB, `results[]`) and iNaturalist (`https://api.inaturalist.org/v1/observations?per_page=100&order_by=created_at`, 1.8 MB): ACAO `*`; very large nested records, poor for direct mapping.
- `https://date.nager.at/api/v3/PublicHolidays/2025/GB`: ACAO `*`, 13 rows; too small to be interesting.
- `https://pokeapi.co/api/v2/pokemon?limit=100`: ACAO `*`, list is only name+url; needs 100 follow-up calls. Poor fit.
- `https://randomuser.me/api/?results=100&seed=fxlab`: ACAO `*`, `results[]`, nested; `location.coordinates.*` are STRINGS. Low visual value.
- `https://api.sunrise-sunset.org/json?...&formatted=0`: ACAO `*`, single object; `astronomical_twilight_begin` returns 1970-01-01 at high latitude in summer (V, sentinel value).
- Met Museum `https://collectionapi.metmuseum.org/public/collection/v1/objects/436535`: ACAO `*`; one object per call, search returns only ID lists, so it needs N requests. Not good for a records-array picker.
- `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=51.5&lon=-0.12`: ACAO `*`, 40 KB, `properties.timeseries[]` (90 rows) with nested `data.instant.details.*`. The MET Norway terms require an identifying User-Agent, which a browser fetch cannot set. Treat as unverified-for-browser.
- `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=9414290&product=water_level&date=latest&datum=MLLW&time_zone=gmt&units=metric&format=json&range=48`: ACAO `*`. `data[]` with `t`,`v` (strings). NOAA tide request returned only one reading at the time of test (172 bytes), so `range=48` did not produce 48 hours; not verified as a series.
- `https://ourworldindata.org/grapher/life-expectancy.csv`: ACAO `*`, 605 KB, 21,564 rows, columns `Entity,Code,Year,Life expectancy`. Long (tidy) form; tidy-to-wide pivot is user work.

**D. Needs a key (V for CORS unless stated)**

- NASA APOD `https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&count=10`, DONKI flares `https://api.nasa.gov/DONKI/FLR?startDate=2024-01-01&endDate=2024-12-31&api_key=DEMO_KEY` (614 KB, 1,128 rows; `beginTime`, `peakTime`, `classType` "M2.3", `sourceLocation` "N03E70"), NeoWs `https://api.nasa.gov/neo/rest/v1/feed?start_date=2025-01-01&end_date=2025-01-07&api_key=DEMO_KEY` (39 KB; `near_earth_objects` is an object keyed by date). ACAO is `*` on DONKI/NeoWs. **APOD echoes the request Origin** (`null` -> `null`, `https://example.com` -> `https://example.com`), so it works from file://, but only because it reflects. With the key: `x-ratelimit-limit: 10` was observed on DEMO_KEY in this session after repeated calls; NASA's page states limits that I could not extract (WebFetch returned only the sign-up form). A bad key returns HTTP 403 with `access-control-allow-origin: *`, so the browser can read and show the error. Free personal key: https://api.nasa.gov/.
- OpenAQ v3 `https://api.openaq.org/v3/locations`: HTTP 401 `"A valid API key must be provided in the X-API-Key header"`, and no ACAO header on the 401, so from a browser this shows as a CORS failure, not an auth message. Not verifiable without a key. It needs a custom header, which triggers a preflight; the preflight also returned 401 without ACAO (V).
- CoinGecko: works keyless at low volume (see #11). The demo key header is `x-cg-demo-api-key`, and the preflight allows it (V).

**E. Failed (V)**

- Cleveland Museum of Art `https://openaccess-api.clevelandart.org/api/artworks/?limit=100&has_image=1`: 200 OK, 2.2 MB, but **no `Access-Control-Allow-Origin` header at all** with either Origin. Not usable from a browser.
- SpaceX v4 `https://api.spacexdata.com/v4/launches`: HTTP 525 from the edge (down at test time).
- REST Countries `https://restcountries.com/v3.1/all?fields=...`: returned `{"success":false,"errors":[{"message":"This API version has been deprecated..."}]}` (legacy API deprecation notice, v5 migration). Not usable as-is.
- Open Notify from https: works only from file:// (see C).

**F. Custom-header preflight results (V, `OPTIONS` with `Origin: null`)**

An API key header makes the request non-simple, so the browser sends a preflight first. Results for `Access-Control-Request-Headers`:
- Open-Meteo `authorization`: 200, allow-headers list includes `authorization`; `x-api-key` not tested.
- GitHub `authorization`: 204, allowed (max-age 86400).
- CoinGecko `x-cg-demo-api-key`: allowed. Frankfurter `x-api-key`: allowed. USGS `x-api-key`: allowed (`*`). TfL `app_key`: allowed. NASA `x-api-key`: allowed (echoes origin). Met Museum `x-api-key`: allowed.
- **raw.githubusercontent.com `x-api-key`: HTTP 403** (preflight rejected), so a header can never be used against GitHub raw; plain GET still works.
- **api.citybik.es preflight: HTTP 405**, so any custom header breaks CityBikes; plain GET works.

**G. Licences and attribution (C from provider pages unless noted)**

- Open-Meteo: CC BY 4.0, attribution required; free use non-commercial only; limits 600/min, 5,000/h, 10,000/day — [Open-Meteo terms](https://open-meteo.com/en/terms) (fetched in this session). Commercial use (ads, subscriptions) needs a paid plan.
- USGS: US public domain; credit requested — [USGS copyrights and credits](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits) (fetched).
- NASA EONET/DONKI/NeoWs/APOD: US government data, generally public domain; APOD images can carry third-party copyright (APOD credits per image) (C) — https://api.nasa.gov/
- World Bank: CC BY 4.0 (C) — https://data.worldbank.org/summary-terms-of-use
- Wikimedia pageviews: CC0 (C) — https://dumps.wikimedia.org/legal.html and https://wikitech.wikimedia.org/wiki/Data_Platform/AQS/Pageviews. Wikimedia asks for a descriptive User-Agent or `Api-User-Agent`; browsers cannot set User-Agent, and `Api-User-Agent` triggers a preflight (I did not test it).
- Art Institute of Chicago: CC0 for API data; images by public-domain flag (C) — https://api.artic.edu/docs/
- CoinGecko: free demo tier requires attribution and has rate limits (C) — https://www.coingecko.com/en/api/documentation
- Frankfurter: exchange rates from the European Central Bank reference rates; ECB reuse terms (C) — https://frankfurter.dev
- CityBikes: data belongs to each network operator (licence per network) (C) — https://citybik.es/
- TfL: Open Government Licence style terms; TfL Open Data Terms (C) — https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service
- OWID CO2: CC BY 4.0 (C) — https://github.com/owid/co2-data
- vega-datasets: BSD-3-Clause for the package; each dataset has its own origin (cars from UCI/StatLib, gapminder from Gapminder, seattle-weather from NOAA) (C) — https://github.com/vega/vega-datasets
- wheretheiss.at: free, 1 request/second suggested (C) — https://wheretheiss.at/w/developer

### Inferences
- The strongest visual sets are: Open-Meteo multi-city hourly (rhythm, 4 series, ready to loop), USGS quakes (geographic scatter with a heavy-tailed magnitude), AIC (real colour fields), Carbon Intensity (clean daily rhythm), CityBikes/GBFS (live geographic values), Frankfurter and CoinGecko (irregular series), vega gapminder/cars (classic multi-column tables).
- Bundle a few of these (cars, gapminder, seattle-weather, a USGS month snapshot) inside the file as offline samples, since a file:// user may be offline and third-party endpoints can change or die within a year (SpaceX and REST Countries already have).
- The records picker must handle four shapes seen here: array of objects (vega, AIC, USGS after flatten), columnar object (Open-Meteo), object keyed by date (Frankfurter, NeoWs), array of arrays (CoinGecko, Coinbase), and `[meta, records]` (World Bank). Open-Meteo multi-location is an array of columnar objects.
- Because APOD echoes `null`, "ACAO: null" is a valid pass for file://, but a strict `*` check would miss it; the test must be done by an actual request with the target Origin.

### Gaps
- No real-browser run from file:// (Browser pane does not execute scripts on file:// pages). Header evidence only.
- Licence lines marked (C) come from memory of provider pages, not verified this session; only Open-Meteo and USGS were fetched.
- NASA's own DEMO_KEY limits could not be read (page returned only the form). Observed `x-ratelimit-limit: 10`.
- Wikimedia User-Agent handling from a browser not tested. NOAA tide `range` behaviour not resolved. No exhaustive check of Eurostat, ONS or data.gov endpoints (not attempted for lack of time).

## How does CORS behave from file:// (Origin: null), and how should the tool explain and recover from failures?

### Takeaway
A page opened from disk sends `Origin: null`. A server passes only if it answers `Access-Control-Allow-Origin: *` or reflects `null`. On failure, `fetch()` rejects with a generic `TypeError` that gives the code no reason, so the tool must infer the likely cause and offer plain fallbacks: download the file and drop it in, or a user-supplied proxy.

### Cited Findings
- `Origin` is `null` for file:// (the scheme is not http/https/ftp/ws/wss/gopher), data: URLs and sandboxed iframes without allow-same-origin — [MDN Origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin) (fetched).
- On a CORS failure the code only learns that an error occurred; details are visible only in the browser console — [MDN CORS errors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS/Errors) (fetched).
- Wildcard `*` cannot be used with credentials; a `null` origin has no credentialed route either — same MDN page (partly inferred by the fetch tool; the MDN page itself only shows the wildcard message).
- Verified server behaviour with `Origin: null` (V, this session): `*` from Open-Meteo, USGS, EONET, World Bank, Wikimedia, AIC, Met, GitHub API, CoinGecko, Coinbase, Frankfurter, CityBikes, GBFS, raw.githubusercontent.com, jsDelivr, OWID, TfL, NOAA; origin-reflecting from NASA APOD; no ACAO from Cleveland Museum and OpenAQ (401).
- Custom request headers force a preflight; raw.githubusercontent.com (403) and CityBikes (405) reject it, so those sources work only without an API-key header (V, section F above).
- A 4xx/5xx response from a server that sends ACAO is readable (NASA bad key: 403 with `*`), but a 401 with no ACAO (OpenAQ) appears to the code as a CORS failure (V).
- HTTP endpoints from the https Vercel page are blocked as mixed content (Open Notify is HTTP only) — [MDN Mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content) (C).
- Browser error text (C): Chrome logs "Access to fetch at ... from origin 'null' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present", and the promise rejects with `TypeError: Failed to fetch`; Firefox rejects with `TypeError: NetworkError when attempting to fetch resource`; Safari with `TypeError: Load failed`. These strings are not verified here.

### Inferences
- Suggested wording when `fetch` rejects with `TypeError`: "The browser blocked this request, or the server could not be reached. Many sites do not allow requests from pages opened from a file. Download the data and drop the file onto Data, or try the hosted version." Do not claim a specific cause, because code cannot tell CORS from offline, DNS failure, mixed content or an ad blocker. A useful hint: if `navigator.onLine` is false, say offline; if the URL starts with `http:` and the page is https, say so.
- For 401/403/429 responses that are readable, show the status and, if present, the provider message; for `Retry-After` show the wait.
- Fallbacks in order: (1) "Download the response, then drop it in" (a link that opens the URL in a new tab, since top-level navigation is not subject to CORS); (2) a user-configurable proxy URL prefix (stored on the device, empty by default); (3) the hosted Vercel version, which has a real origin (still needs the server to allow it).
- Never ship a shared proxy: it would carry every user's keys and requests through infrastructure the project would then have to run, secure and pay for, and it would turn an offline single-file tool into a hosted service. Hosting a proxy per user (a Cloudflare Worker, for example) is the user's choice.

### Gaps
- No actual browser run; error strings are documentation-level claims.
- Firefox/Safari treatment of `Origin: null` on file:// (Firefox has had `privacy.file_unique_origin` changes; Safari may block file:// network access differently) not tested.

## How should a client-only tool handle user API keys?

### Takeaway
Keep keys in memory by default, offer an opt-in "remember on this device" that uses localStorage, and never write a key into a saved project file or an exported URL. Send keys in headers when the server allows, because query-string keys leak into more places.

### Cited Findings
- Many APIs accept the key in a query string (NASA `api_key=`); some in a header (`x-api-key`, `Authorization`, `x-cg-demo-api-key`) and preflights for those headers passed on the servers I tested (V, section F).
- Query strings are recorded in browser history, server access logs, intermediary logs, screenshots and `Referer` headers unless the Referrer-Policy prevents it — [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) (C; guidance is to avoid sensitive info in URLs) and [OWASP Session/URL guidance](https://owasp.org/www-community/vulnerabilities/Information_exposure_through_query_strings_in_url) (C).
- Any value in localStorage is readable by any script that runs on that origin, including a compromised dependency or XSS — [OWASP HTML5 Security Cheat Sheet: Local Storage](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html) (C).
- For a file:// page, browsers treat each file as its own or a shared opaque origin depending on browser, so localStorage may be unavailable or shared across all local files (C, not tested).
- A free key that is public by design (NASA DEMO_KEY, CoinGecko demo) is low-risk; a paid key in a browser tool is never secret from the user's own machine.

### Inferences
- Design: (1) key field shown as a password input, held in memory; (2) checkbox "Remember on this device" writes only to localStorage under a separate key, never into project JSON; (3) project files and shared exports store the URL template and header NAME but a blank value, and say so on save; (4) warn once: "Anyone with access to this browser profile can read a saved key. Use a key limited to reading, and revoke it if you share this computer."; (5) strip key-like query params (`api_key`, `key`, `token`, `apikey`) from URLs before saving to a project or history, with an explicit "the key was removed" message; (6) in the UI encourage the header field; (7) never log keys to the console or error messages; (8) never send a key to a host other than the one the user typed, including after redirects (fetch follows redirects with custom headers to another origin only in some cases; safest to set `redirect:'error'` or check `response.url`).
- Do not use `credentials:'include'` or cookies; it also cannot work with `*`.

### Gaps
- No verification of localStorage semantics on file:// per browser.
- No fetched OWASP pages this session; the OWASP lines are unfetched claims.

## Parsing and data-shape rules

### Takeaway
Robust CSV parsing needs quote handling, delimiter sniffing, BOM stripping and locale-aware numbers. JSON needs a small set of shape detectors. Cap rows and size, and normalise robustly, because real data (all seen above) has nulls, string numbers and heavy tails.

### Cited Findings
- CSV rules: RFC 4180 defines comma-separated fields, CRLF row ends, fields with commas/quotes/newlines enclosed in double quotes, embedded quote doubled `""` — [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180) (C; standard text, not fetched here).
- Verified real-world CSV features in this session: OWID grapher CSV has `Entity,Code,Year,<Metric>` header, comma delimiter; OWID CO2 CSV has ~80 columns with many empty cells; vega `stocks.csv` uses non-ISO dates "Jan 1 2000" (V); vega `seattle-weather.csv` is ISO dates with a category column `weather` (V).
- Verified JSON shapes (V): array of objects (vega cars, gapminder, NYC 311, nager, DONKI, TfL); GeoJSON FeatureCollection (USGS, vega earthquakes); columnar object of parallel arrays (Open-Meteo `hourly`, `daily`); top-level array of columnar objects (Open-Meteo multi-location); tuple arrays (CoinGecko `[ms,price]`, Coinbase candles); object keyed by date (Frankfurter, NeoWs); `[meta, records]` (World Bank); wrapper `{results:[...]}` (RandomUser, GBIF, LL2, PokeAPI); wrapper `{data:[...]}` (AIC, Carbon Intensity); deep wrapper `network.stations` (CityBikes), `data.stations` (GBFS), `items[0].articles` (Wikimedia top).
- Type traps found (V): numbers as strings (RandomUser coordinates, Open Notify lat/lon, NOAA `v`, NYC 311 values, World Bank `date` year); epoch in ms (USGS `time`, CoinGecko) vs seconds (GBFS `last_reported`, wheretheiss `timestamp`, GitHub `week`, Coinbase candles); a year as an int (AIC `date_start` negative for BCE); epoch as string (CityBikes `installDate`); sentinel dates (`1970-01-01` in Sunrise-Sunset); nulls within numeric arrays (Open-Meteo air, 11 of 120); `last_reported` min value 86,400 (a sentinel-like value) in GBFS.
- NDJSON/JSON Lines: one JSON value per line, `\n` separated — [jsonlines.org](https://jsonlines.org/) (C).
- Decimal comma and `;` delimiters are common in European CSV exports (Excel in many locales writes `;` with `1,5`) (C).
- UTF-8 BOM: Excel's "CSV UTF-8" starts with U+FEFF, which corrupts the first header name if not stripped (C).

### Inferences
- Parser checklist: strip BOM; detect line ending; sniff delimiter among `,` `;` tab `|` by consistent column counts across the first ~20 rows outside quotes; handle `""`, quoted newlines, ragged rows (pad or truncate and count them); trim header, dedupe blank/duplicate names (`col_2`); treat `""`, `NA`, `N/A`, `null`, `-`, `NaN` as missing.
- Number inference: decide per column by majority (>=90% of non-missing). If commas appear as decimal separators with `;` delimiter or with no `.` in the column, treat `,` as the decimal; strip thousands separators and currency/percent only when the pattern is consistent. Integer when all values are integers.
- Date inference: ISO 8601 (`2026-09-21`, `...T00:00`, `...Z`); epoch only when the column name or magnitude suggests it (1e9..2e9 seconds, 1e12..2e12 ms, and not when it is a plain measurement); month-name formats as a fallback for vega stocks. Treat offset-less ISO (Open-Meteo local times) as local, not UTC, and say so.
- Category when distinct values are <= ~50 or <= 5% of rows for strings; boolean for true/false/yes/no/0/1 pairs. Keep a per-column `missing` count for the UI.
- JSON detection order: (1) array of objects; (2) GeoJSON (`type:'FeatureCollection'` -> flatten `properties` + `lon`,`lat`,`depth`); (3) top-level array of columnar objects (Open-Meteo multi-location -> one row per timestamp per location with a `location` column); (4) columnar object (all values arrays of equal length, and one looks like time); (5) object-of-objects keyed by date/ID (add a `key` column); (6) array of arrays (with optional header row; else `c0..cN`); (7) otherwise list every path that resolves to an array of length > 1 with a preview of the first record and let the user pick. Flatten nested objects with dot paths to a small depth (2 or 3) and skip arrays of objects.
- Suggested caps (engineering judgement, not from a source): parse up to ~50 MB of text but warn above ~10 MB; draw at most ~100k rows for point/particle visuals in WebGL and ~5k in Canvas 2D per frame; downsample larger sets (stride or LTTB for series, random with a fixed seed for scatter) and say "Showing 20,000 of 50,411 rows". The OWID CO2 file (14.4 MB, 50k rows, 80 columns) is a good stress test for the cap; USGS month (1.4 MB) is fine.
- Normalisation: min-max default; robust clip to the 2nd..98th (or 1st..99th) percentile for heavy tails (earthquake energy, followers, Wikipedia views, populations); log/`log1p` for values spanning orders of magnitude (population 10^4..10^9, Wikipedia views 3.5e5..1.5e8); ignore nulls and place them at a chosen default; treat constant columns (min==max) as 0.5; keep the mapping from data to 0..1 visible (min/max shown with units).
- Time series: sort by time; for smooth animation interpolate linearly between rows (or monotone cubic to avoid overshoot); for irregular gaps (Frankfurter weekends) either hold last value or interpolate on the real time axis; for loops, blend the last->first rather than jumping; drive playback from the project's progress (`uProgress`) and map the data time range to it.

### Gaps
- Sizes/caps are recommendations, not measured on fxlab. No benchmark run.
- RFC 4180, jsonlines and OWASP pages were not fetched in this session; those lines are claims.

## Etiquette: rate limits, caching, refresh, attribution

### Takeaway
Most listed services are free but rate-limited. Cache in memory (and optionally IndexedDB), refresh no faster than the service updates, and show an attribution line and link per source.

### Cited Findings
- Open-Meteo free tier: 600/min, 5,000/h, 10,000/day, non-commercial, CC BY 4.0 attribution — [Open-Meteo terms](https://open-meteo.com/en/terms) (fetched). Multi-location calls (comma lists, seen returning an array, V) count as one request in structure but Open-Meteo weights calls by the number of locations/variables (C).
- Observed limits (V, response headers): GitHub unauthenticated 60/h; NASA EONET 60 (`X-RateLimit-Limit: 60`); NASA API DEMO_KEY `X-RateLimit-Limit: 10` at the time of test; CityBikes 300/h (`RateLimit-Limit: 300`, `ratelimit-reset: 781`); wheretheiss.at 350 per 5 min (`X-Rate-Limit-Limit: 350`, `X-Rate-Limit-Interval: 5 minutes`).
- Cache/refresh hints in headers (V): USGS `max-age=60`; Frankfurter `max-age=86400`; OWID raw `max-age=300`; jsDelivr vega `max-age=604800`; CoinGecko `max-age=30` on market_chart; GBFS `ttl: 60`; Open-Meteo `Cache-Control` not present in my header grep. EONET and wheretheiss are `no-cache`.
- Only some rate-limit headers are readable from a cross-origin page: a response header is visible to JS only if it is listed in `Access-Control-Expose-Headers`; GitHub exposes `X-RateLimit-*` and `Retry-After`, NASA exposes `X-RateLimit-Limit/Remaining` (V from headers), others do not (V: CityBikes and Open-Meteo exposed none in my grep).
- USGS data is public domain, credit requested — [USGS](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits) (fetched).

### Inferences
- Defaults: cache each URL response in memory for a session, with a "Refresh" button, and disable auto-refresh unless the user turns it on; minimum refresh 60 s for live feeds (USGS 60, GBFS 60), 5 min for weather, none for static sets; back off and stop on 429 (honour `Retry-After` when readable). Avoid polling on every animation frame; fetch once and interpolate.
- Store the last good response (IndexedDB) so the project opens offline, and label it "Saved copy from <date>".
- Every source card should carry: provider name, licence, link, and a required-attribution string (e.g. "Weather data by Open-Meteo.com (CC BY 4.0)"); show the attribution in export metadata as text, not in the image, unless the user opts in.
- Do not include a shared API key in the file; DEMO_KEY is public by NASA's design but rate-limited per IP, so ship it only as a prefilled example that the user can replace.

### Gaps
- Provider rate limits for Wikimedia, AIC, World Bank, CoinGecko, TfL and Frankfurter were not verified; only headers observed above.
- Open-Meteo call weighting is a claim.

## Machine-readable verified sources

```json
{
  "verified_on": "2026-09-21",
  "method": "curl with Origin: null and Origin: https://example.com; ACAO '*' on both unless noted",
  "sources": [
    {"id":"om-forecast","name":"Open-Meteo forecast (hourly, multi-city)","url":"https://api.open-meteo.com/v1/forecast?latitude={lat1,lat2}&longitude={lon1,lon2}&hourly=temperature_2m,wind_speed_10m,precipitation,relative_humidity_2m&forecast_days=3","recordsPath":"columnar: [].hourly (array when multiple locations; object when one) - zip time[] with each series","columns":[{"name":"time","type":"datetime","min":"2026-09-21T00:00","max":"2026-09-23T23:00"},{"name":"temperature_2m","type":"number","min":11.5,"max":24.0},{"name":"wind_speed_10m","type":"number","min":0.4,"max":22.7},{"name":"precipitation","type":"number","min":0,"max":1.2},{"name":"relative_humidity_2m","type":"number","min":36,"max":79}],"notes":"ACAO *. Multi-location returns top-level array. Times are local, no offset. Authorization header preflight allowed. Non-commercial free tier: 600/min, 5000/h, 10000/day.","licence":"CC BY 4.0, attribution required; non-commercial free use"},
    {"id":"om-archive","name":"Open-Meteo historical daily","url":"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}&start_date=2024-01-01&end_date=2024-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max","recordsPath":"columnar: daily","columns":[{"name":"time","type":"date","min":"2024-01-01","max":"2024-12-31"},{"name":"temperature_2m_max","type":"number","min":2.4,"max":31.3},{"name":"temperature_2m_min","type":"number","min":-5.1,"max":18.3},{"name":"precipitation_sum","type":"number","min":0,"max":51.6},{"name":"wind_speed_10m_max","type":"number","min":3.5,"max":52.3}],"notes":"ACAO *. 366 rows.","licence":"CC BY 4.0, attribution required; non-commercial free use"},
    {"id":"om-air","name":"Open-Meteo air quality","url":"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&hourly=pm10,pm2_5,ozone,nitrogen_dioxide","recordsPath":"columnar: hourly","columns":[{"name":"time","type":"datetime"},{"name":"pm10","type":"number","min":4.1,"max":30.4},{"name":"pm2_5","type":"number","min":2.6,"max":23.3},{"name":"ozone","type":"number","min":1,"max":95},{"name":"nitrogen_dioxide","type":"number","min":6.7,"max":76}],"notes":"ACAO *. Nulls present (11 of 120).","licence":"CC BY 4.0"},
    {"id":"om-marine","name":"Open-Meteo marine waves","url":"https://marine-api.open-meteo.com/v1/marine?latitude={lat}&longitude={lon}&hourly=wave_height,wave_period,wave_direction","recordsPath":"columnar: hourly","columns":[{"name":"time","type":"datetime"},{"name":"wave_height","type":"number","min":0.18,"max":1.6},{"name":"wave_period","type":"number","min":2.65,"max":5.2},{"name":"wave_direction","type":"number","min":167,"max":304}],"notes":"ACAO *. Ocean coordinates only.","licence":"CC BY 4.0"},
    {"id":"usgs-quakes","name":"USGS earthquakes (GeoJSON)","url":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{all_day|all_week|2.5_month}.geojson","recordsPath":"features","columns":[{"name":"properties.mag","type":"number","min":0.07,"max":6.5},{"name":"properties.time","type":"epoch_ms"},{"name":"geometry.coordinates[0]","type":"number","min":-180,"max":180},{"name":"geometry.coordinates[1]","type":"number","min":-90,"max":90},{"name":"geometry.coordinates[2]","type":"number","min":0,"max":700},{"name":"properties.sig","type":"integer","min":0,"max":657},{"name":"properties.place","type":"string"}],"notes":"ACAO *. all_day 156 KB/218 events; 2.5_month 1.4 MB/1986 events. Cache max-age 60. Coordinate and depth ranges are nominal, not measured.","licence":"US public domain; credit requested"},
    {"id":"nasa-eonet","name":"NASA EONET natural events","url":"https://eonet.gsfc.nasa.gov/api/v3/events?limit=100","recordsPath":"events","columns":[{"name":"title","type":"string"},{"name":"categories[0].title","type":"category"},{"name":"geometry[0].date","type":"datetime"},{"name":"geometry[0].magnitudeValue","type":"number"},{"name":"geometry[0].coordinates","type":"[lon,lat]"}],"notes":"ACAO *. Nested arrays; flatten first geometry. 60 requests limit header.","licence":"NASA, US government data"},
    {"id":"iss-live","name":"ISS position (wheretheiss.at)","url":"https://api.wheretheiss.at/v1/satellites/25544","recordsPath":"$ (single object; poll to build a track)","columns":[{"name":"latitude","type":"number","min":-52,"max":52},{"name":"longitude","type":"number","min":-180,"max":180},{"name":"altitude","type":"number","min":415,"max":425},{"name":"velocity","type":"number","min":27500,"max":27600},{"name":"visibility","type":"category"}],"notes":"ACAO *. 350 requests per 5 minutes. Column ranges are approximate from one sample, not measured.","licence":"free; see provider terms"},
    {"id":"worldbank","name":"World Bank indicators","url":"https://api.worldbank.org/v2/country/{ISO;ISO}/indicator/NY.GDP.PCAP.CD?format=json&date=1990:2023&per_page=500","recordsPath":"[1]","columns":[{"name":"country.value","type":"category"},{"name":"countryiso3code","type":"category"},{"name":"date","type":"string_year"},{"name":"value","type":"number","min":302.9,"max":82586.8}],"notes":"ACAO *. Response is [meta, records]. Some values null. date is a string.","licence":"CC BY 4.0"},
    {"id":"wikimedia-views","name":"Wikimedia pageviews (daily)","url":"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/{Article}/daily/{YYYYMMDD}/{YYYYMMDD}","recordsPath":"items","columns":[{"name":"timestamp","type":"string_yyyymmddhh"},{"name":"views","type":"integer","min":10077,"max":115530}],"notes":"ACAO *. Top articles: .../top/en.wikipedia/all-access/{YYYY}/{MM}/all-days -> items[0].articles (article, views, rank 1..1000). UA guidance from Wikimedia cannot be met from a browser.","licence":"CC0 (claim)"},
    {"id":"aic-artworks","name":"Art Institute of Chicago artworks with colour","url":"https://api.artic.edu/api/v1/artworks?limit=100&fields=id,title,date_start,date_end,color,artist_title,style_title,department_title,is_public_domain","recordsPath":"data","columns":[{"name":"date_start","type":"integer","min":-883,"max":2016},{"name":"color.h","type":"number","min":0,"max":356},{"name":"color.s","type":"number","min":0,"max":97},{"name":"color.l","type":"number","min":13,"max":94},{"name":"color.population","type":"integer","min":1,"max":4567},{"name":"department_title","type":"category"},{"name":"artist_title","type":"category"}],"notes":"ACAO *. Paginate with pagination.next_url. 132,747 works. Some nulls.","licence":"CC0 for API data (claim)"},
    {"id":"coingecko","name":"CoinGecko price history","url":"https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=90","recordsPath":"prices (array of [epoch_ms, price])","columns":[{"name":"[0]","type":"epoch_ms"},{"name":"[1]","type":"number","min":58244,"max":84887}],"notes":"ACAO *. total_volumes and market_caps parallel arrays. Demo key header x-cg-demo-api-key passes preflight.","licence":"free tier with attribution (claim)"},
    {"id":"frankfurter","name":"Frankfurter exchange rates","url":"https://api.frankfurter.dev/v1/2024-01-01..2024-12-31?base=EUR&symbols=USD,GBP,JPY,CHF,AUD","recordsPath":"rates (object keyed by date; each value is {CCY:rate})","columns":[{"name":"date_key","type":"date"},{"name":"USD","type":"number","min":1.05,"max":1.12},{"name":"GBP","type":"number","min":0.84,"max":0.88},{"name":"JPY","type":"number","min":154,"max":175},{"name":"CHF","type":"number","min":0.92,"max":0.98},{"name":"AUD","type":"number","min":1.58,"max":1.68}],"notes":"ACAO *. 257 business days. Ranges other than early-Jan values are approximate, not measured. max-age 86400.","licence":"ECB reference rates (claim)"},
    {"id":"citybikes","name":"CityBikes live bike stations (London)","url":"https://api.citybik.es/v2/networks/santander-cycles","recordsPath":"network.stations","columns":[{"name":"latitude","type":"number","min":51.453,"max":51.549},{"name":"longitude","type":"number","min":-0.237,"max":0.005},{"name":"free_bikes","type":"integer","min":0,"max":49},{"name":"empty_slots","type":"integer","min":0,"max":54},{"name":"timestamp","type":"datetime"}],"notes":"ACAO *. 799 stations. 300 requests/h. Custom headers fail (preflight 405).","licence":"per network operator (claim)"},
    {"id":"owid-co2","name":"Our World in Data CO2 (GitHub raw CSV)","url":"https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv","recordsPath":"csv rows","columns":[{"name":"country","type":"category"},{"name":"year","type":"integer","min":1750,"max":2024},{"name":"population","type":"number"},{"name":"gdp","type":"number"},{"name":"co2","type":"number"},{"name":"co2_per_capita","type":"number"}],"notes":"ACAO *. 14.4 MB, 50,411 rows, ~80 columns, many empty cells; needs row cap. Column min/max not measured except year range, which is approximate. Custom headers fail (preflight 403).","licence":"CC BY 4.0 (claim)"},
    {"id":"vega-datasets","name":"vega-datasets (cars, gapminder, seattle-weather, stocks)","url":"https://cdn.jsdelivr.net/npm/vega-datasets@2/data/{cars.json|gapminder.json|seattle-weather.csv|stocks.csv|earthquakes.json}","recordsPath":"$ (array of objects) or csv rows","columns":[{"name":"cars.Miles_per_Gallon","type":"number","min":9,"max":46.6},{"name":"cars.Horsepower","type":"number","min":46,"max":230},{"name":"cars.Weight_in_lbs","type":"number","min":1613,"max":5140},{"name":"gapminder.life_expect","type":"number","min":27.79,"max":82.5},{"name":"gapminder.fertility","type":"number","min":0.96,"max":8.23},{"name":"gapminder.pop","type":"integer","min":82656,"max":1304887562},{"name":"gapminder.year","type":"integer","min":1955,"max":2005}],"notes":"ACAO *. Long cache (max-age 604800). stocks.csv dates are 'Jan 1 2000' style. Good bundled offline samples.","licence":"BSD-3 package; per-dataset origin"}
  ],
  "needs_key": [
    {"id":"nasa-donki","name":"NASA DONKI solar flares","url":"https://api.nasa.gov/DONKI/FLR?startDate=2024-01-01&endDate=2024-12-31&api_key={key}","recordsPath":"$","columns":[{"name":"beginTime","type":"datetime"},{"name":"peakTime","type":"datetime"},{"name":"classType","type":"string"},{"name":"sourceLocation","type":"string"},{"name":"activeRegionNum","type":"integer","min":13536,"max":13997}],"notes":"ACAO * verified with DEMO_KEY; 1128 rows, 614 KB.","licence":"US government data"},
    {"id":"nasa-neows","name":"NASA near-Earth objects","url":"https://api.nasa.gov/neo/rest/v1/feed?start_date={d}&end_date={d}&api_key={key}","recordsPath":"near_earth_objects (object keyed by date; each an array)","columns":[{"name":"name","type":"string"},{"name":"absolute_magnitude_h","type":"number"},{"name":"estimated_diameter.kilometers.estimated_diameter_max","type":"number"}],"notes":"ACAO * verified with DEMO_KEY; 7-day window limit is a claim.","licence":"US government data"},
    {"id":"openaq","name":"OpenAQ v3 locations","url":"https://api.openaq.org/v3/locations","recordsPath":"unverified","columns":[],"notes":"HTTP 401 without X-API-Key and no ACAO on the error; CORS with a key not verified.","licence":"per data provider"}
  ],
  "failed": [
    {"id":"cleveland-art","url":"https://openaccess-api.clevelandart.org/api/artworks/","reason":"200 OK but no Access-Control-Allow-Origin header"},
    {"id":"spacex-v4","url":"https://api.spacexdata.com/v4/launches","reason":"HTTP 525 at test time"},
    {"id":"restcountries-v3.1","url":"https://restcountries.com/v3.1/all","reason":"legacy API deprecated, returns error object"},
    {"id":"open-notify-iss","url":"http://api.open-notify.org/iss-now.json","reason":"ACAO * but HTTP only; blocked as mixed content on https hosting"}
  ]
}
```
