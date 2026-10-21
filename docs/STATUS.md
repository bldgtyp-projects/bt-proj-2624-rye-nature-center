# Client-report release status

Updated 21 October 2026: Kiva Annual and Design-Day refresh (10:45/10:46 runs) and Refuge lead-in refresh (11:13 runs), local, not yet pushed. Annual/Design-Day content from the 20 October 21:09 rerun. [Report guide](../README.md) · [Project context](../../CONTEXT.md) · [Refresh guide](UPDATE.md)

## Current local release

Annual electricity is **19,568.7 kWh/year**, **50.5 kWh/m²/year**, before PV credit, using 387.134 m² modeled floor area. The Annual model now uses the Kiva slab-ground boundary in place of the constant 18°C ground (+3.0% over 18,996.6 kWh); that is its only physical change. Monthly stacked bars and six end-use groups reconcile to the facility meter. Cooling includes the supplemental dehumidifier electricity exactly once; hot water includes checked tank parasitics. The site distinguishes hourly means and subhourly humidity peaks. Historical model iterations are not presented as current window savings.

The separate Design-Day package is reviewed: coincident sensible room heating/cooling **11.483/15.837 kW**, zone-peak bars, exact loads, selectable winter DB and summer DB/DP/WB conditions, operating checks and provisional capacity/flow tables. Individual zone peaks, detailed coil delivery and rated inputs are labeled separately. The Annual and Design-Day runs now share one HBJSON; the Design-Day run keeps the constant 18°C ground by design.

Resilience is a **first-pass** package (`draft_first_pass`) from the 21 October 11:13 REVIVE runs, which add a conditioned seasonal lead-in (`rnc_refuge_leadin`: winter Aug 1, 2019 to Jan 20, 2020, starting Thursday; summer Feb 1 to Jul 27, 2026). Both are aligned: conditioning runs through the 12 January / 19 July conditioned day, is zero for all seven outage days and resumes on the recovery day. The verifier slices the final nine days independently and checks the window start date. Against the Phius REVIVE 2024 criteria (reference only): summer heat index peaks at 39.6°C in Learning Labs with **1 hour in Danger** (23 July 18:00); other zones peak at 38.8-39.1°C with none; every zone has 3 deadly days (Mora). Heat-index bands now use the exact NOAA °F thresholds (Danger from 103°F = 39.44°C); with honeybee-REVIVE's rounded 39.4°C line an hour at 39.41°C would count as a second Danger hour. Winter SET below 54°F is 375 °F·h in Learning Labs (limit 216) and 338-354 °F·h elsewhere; every zone has 15-19 h of air below 36°F (minimum 1.05°C). Compared with the nine-day runs, the lead-in makes summer about 1.3 K warmer at peak and winter slightly better. The earlier 10:59 winter lead-in run (2021-22 calendar) had misaligned outage controls and was not used. Five collapsed supporting-graph panels (winter/summer energy flows and air change rates, winter envelope surfaces) come from the same frozen runs and load on demand from `data/resilience-details.json`. Inputs to note: windows deliver zero airflow in both outages (annual window controls); outage ventilation runs at 62.1-style rates (~980 m³/h in refuge hours) through 75% recovery versus the REVIVE 5 cfm/person; only Learning Labs is occupied. Identity/equivalence is recorded in the [refresh review](<../../11_QAQC/261021 Report Refresh Review/review.md>); no full Refuge QA review exists yet. No certification outcome, PV credit or final equipment/borefield selection is implied. Remaining questions include source-water/manufacturer performance, Lab humidity, winter dry-air/operative comfort and separate event/additional-weather sensitivities.

The seven-page layout (Overview behind the logo; Annual energy, Peak loads and Resilience as separate tabs), Program week view with annual daily-mean strip, Model roofs-on default with a shading toggle, same-origin Three.js viewer, noindex metadata, private-source boundary and alternate-host guard are preserved. The live site still serves the `121e66a` release (see Publication below); this refresh is local.

## Frozen source identity

| Package | Source reference |
| --- | --- |
| Annual run | `16_OSM/Rye_Nature_Center_261021/openstudio` |
| Annual HBJSON SHA-256 | `01bff299d9eebb83472b32a220c1d14761cfa3b00adfed09620b856cb7c4895e` |
| Annual IDF SHA-256 | `cee024d2ddd6e7bd7c5021422ecd8e3d0dabf5ba124cb02902894b22c6f4d2c6` |
| Annual SQL SHA-256 | `4c66748242cddc58b85db2ecb3001def563af8ebc16f12ed9f4b7ca2f3d80072` |
| Design-Day run | `17_OSM_DESIGN_DAY/Rye_Nature_Center_261021/openstudio` |
| Design-Day HBJSON SHA-256 | `01bff299d9eebb83472b32a220c1d14761cfa3b00adfed09620b856cb7c4895e` |
| Design-Day IDF SHA-256 | `9ab184c347d833ef8f436de29f2a4f5f74b75b7e0bd8ec9198be3ec7df2bb795` |
| Design-Day SQL SHA-256 | `0ffdb32b11b2d8db5b297015f849949d8e20ed51bb8183dcf52fdfdd33d79bc0` |
| Resilience HBJSON SHA-256 | `326db3be6435…` (11:13 lead-in runs; full hashes in `_private/resilience/source.json`) |
| QA identity record | `11_QAQC/261021 Report Refresh Review/` (annual and design_day reviewer outputs) |

EnergyPlus 25.1 / OpenStudio 3.10.0. Annual weather is White Plains / Westchester Airport TMYx. The effective calendar is 2026 starting Thursday, with four timesteps/hour; saved HB parameters retain Sunday and that difference is disclosed. Design Days use twelve timesteps/hour and a 15-minute sizing average. Annual retains 114 autosizing days; the released Design-Day package runs its separate four conditions with no weather period.

Native sources remain ignored in `_private/`, with separate Annual and Design-Day folders. Raw SQL/OSM/IDF, weather, workflow/error logs and local evidence stay outside `site/`. The coherent pre-update archive is `_private/archives/20261021-before-kiva-annual.zip`. Run folders are overwritten on rerun; frozen sources and dated QA records preserve this release.

## Verification

- `verify_inputs.py`: four native zones, 25 full-year schedules, 50 design profiles, CSV round trips, 125 surface and 341 shade mesh areas and source identities.
- `verify_results.py`: all 72 monthly end-use values and twelve facility totals against frozen native SQL, proper reporting frequencies, exact CSV round trip and source hashes.
- `verify_design_days.py`: eight room loads and equipment ratings/airflow against native SQL, four CSV rows, source hashes, control/operating bounds and matching Annual identity.
- `verify_resilience.py`: zone air/RH/heat-index series and the supporting energy-flow, ACH and 126 surface-temperature series against frozen native SQL, SET degree-hours recomputed and within 3% of EnergyPlus Pierce SET for Labs, heat-index band hours, deadly days, cold hours, 432-row CSV and source hashes.
- `check.mjs`: reviewed Annual and Design-Day states, first-pass resilience package, seven pages, source/download identity, static links, monthly reconciliation, deployable-data privacy/size checks and alternate-host rejection.
- Python compilation and Node module syntax for changed exporters/renderers.
- Playwright MCP at 1280 x 900 and 390 x 844: meaningful rendered content, 72 monthly segments, eight zone-load bars, month selection, winter/DP/WB condition selection, exact twelve-row monthly table, actual Annual/Design-Day CSV downloads, Core Program-to-viewer selection and canvas. Expanded disclosures have no page-width overflow. Captured application errors and relevant console warnings/errors are empty.

The Browser plugin was unavailable; the existing Playwright MCP browser was used without installing browser/runtime dependencies. Evidence: [Annual](preview-results.png), [Design Days](preview-design-days.png), [phone Annual](preview-results-phone.png), [phone Design Days](preview-design-days-phone.png) and [check summary](annual-site-checks.json).

The source modeling/results files were preserved. [Annual QA](../../11_QAQC/261020%20Current%20Annual%20Review/review.md) and [Design-Day QA](../../11_QAQC/261020%20Sizing%20Rerun%20Review/review.md) support the release. Measure README edits required metadata refresh only; runtime logic/data and its configuration fingerprint are unchanged.

## Publication

Current release: the "Refresh Resilience from the 09:02 reruns" commit, published 21 October 2026. Earlier releases: `07d6ff3` (page restructure, first Resilience package) and `694b121` (first draft); doc-only pushes redeploy identical `site/` content. Access mode is public; there is no Cloudflare Access gate. Live checks on the custom host:

- Program, Model, Annual energy, Peak loads, Resilience and Data & Sources return 200; `/` serves the Overview; `/results` and `/results.html` 301 to `/annual-energy`. `X-Robots-Tag: noindex, nofollow` and `robots.txt` disallow are served.
- All nine downloads match the local `site/downloads/` SHA-256.
- Browser: Resilience renders four outage charts with the first-pass status, Annual energy 72 monthly segments, Peak loads eight zone bars, Model the Three.js viewer; no console errors.
- `bt-proj-2624-rye-nature-center.pages.dev` returns 404; per-deployment URLs did not answer at check time.

## Next release

Review the restructured pages and first-pass Resilience results with Ed before pushing. Record a QA review under `11_QAQC/` before marking Resilience reviewed. Pushing `main` redeploys; follow [HOSTING.md](HOSTING.md) to switch to an OTP gate before sharing beyond the design team.
