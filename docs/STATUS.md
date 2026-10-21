# Client-report release status

Updated 21 October 2026: Resilience refreshed from the 09:02 winter/summer reruns, published. Annual/Design-Day content from the 20 October 21:09 rerun. [Report guide](../README.md) · [Project context](../../CONTEXT.md) · [Refresh guide](UPDATE.md)

## Current local release

Annual electricity is **18,996.6 kWh/year**, **49.1 kWh/m²/year**, before PV credit, using 387.134 m² modeled floor area. Monthly stacked bars and six end-use groups reconcile to the facility meter. Cooling includes the 219.27 kWh supplemental dehumidifier electricity exactly once; hot water includes checked tank parasitics. The site distinguishes hourly means and subhourly humidity peaks. Historical model iterations are not presented as current window savings.

The separate Design-Day package is reviewed: coincident sensible room heating/cooling **11.483/15.836 kW**, zone-peak bars, exact loads, selectable winter DB and summer DB/DP/WB conditions, operating checks and provisional capacity/flow tables. Individual zone peaks, detailed coil delivery and rated inputs are labeled separately. The Annual and Design-Day physical inputs match; each export retains its own identity.

Resilience is a **first-pass** package (`draft_first_pass`) from the 21 October 09:02 REVIVE winter (Jan 12-20) and summer (Jul 19-27) reruns: one conditioned day, seven outage days, one recovery day. Against the Phius REVIVE 2024 criteria (reference only): summer heat index peaks at 38.4°C (Extreme Caution, 72 h) in Learning Labs with zero Danger hours in every zone, but every zone has 3 deadly days (Mora). The rerun corrected the summer Kiva initial indoor temperature from 21.11°C to 23.89°C, which raised summer peaks by 0.6-0.9 K; winter inputs and results are unchanged. The run HBJSON (`c9003ea0…`) has regenerated identifiers relative to `15_PHIUS_REVIVE/HBJSON/…_261021.hbjson`; normalized IDFs are otherwise identical, so the exporter now freezes the HBJSON the runs used. Winter SET below 54°F is 381 °F·h in Learning Labs (limit 216) and 344-361 °F·h elsewhere; every zone has 15-21 h of air below 36°F. Inputs to note: windows deliver zero airflow in both outages (annual window controls); outage ventilation runs at 62.1-style rates (~980 m³/h in refuge hours) through 75% recovery versus the REVIVE 5 cfm/person; only Learning Labs is occupied. No QA review under `11_QAQC/` exists yet. No certification outcome, PV credit or final equipment/borefield selection is implied. Remaining questions include source-water/manufacturer performance, Lab humidity, winter dry-air/operative comfort and separate event/additional-weather sensitivities.

The seven-page layout (Overview behind the logo; Annual energy, Peak loads and Resilience as separate tabs), Program week view with annual daily-mean strip, same-origin Three.js viewer, noindex metadata, private-source boundary and alternate-host guard are preserved. This release is live (see Publication below).

## Frozen source identity

| Package | Source reference |
| --- | --- |
| Annual run | `16_OSM/Rye_Nature_Center_261020_with_op_windows/openstudio` |
| Annual HBJSON SHA-256 | `5e459f449a4cb86c2e67642e130effe3c4f7d867195c2940346c6ec0185f392e` |
| Annual IDF SHA-256 | `11a8bac40726edd0236f41f58654dfef7c98a6e07b73786761cd6d30489eb4d2` |
| Annual SQL SHA-256 | `ec635d37aaf156ae2c11dcef6e411f2d0ea2b4371155eafb5812a88b14de7124` |
| Design-Day run | `17_OSM_DESIGN_DAY/Rye_Nature_Center_261020_with_op_windows/openstudio` |
| Design-Day HBJSON SHA-256 | `5e459f449a4cb86c2e67642e130effe3c4f7d867195c2940346c6ec0185f392e` |
| Design-Day IDF SHA-256 | `d75ce493c75ed8d12c39fa1d1c6f6a488aa5b3e38fe87f92ca88d0f468585456` |
| Design-Day SQL SHA-256 | `2cfa928fbb0589c72a9f9ed439ae00562f82401d38281777d257b65953a5210f` |

EnergyPlus 25.1 / OpenStudio 3.10.0. Annual weather is White Plains / Westchester Airport TMYx. The effective calendar is 2026 starting Thursday, with four timesteps/hour; saved HB parameters retain Sunday and that difference is disclosed. Design Days use twelve timesteps/hour and a 15-minute sizing average. Annual retains 114 autosizing days; the released Design-Day package runs its separate four conditions with no weather period.

Native sources remain ignored in `_private/`, with separate Annual and Design-Day folders. Raw SQL/OSM/IDF, weather, workflow/error logs and local evidence stay outside `site/`. The coherent pre-update archive is `_private/archives/20261020-before-current-energy-design-days.zip`. Run folders are overwritten on rerun; frozen sources and dated QA records preserve this release.

## Verification

- `verify_inputs.py`: four native zones, 25 full-year schedules, 50 design profiles, CSV round trips, 125 surface meshes and source identities.
- `verify_results.py`: all 72 monthly end-use values and twelve facility totals against frozen native SQL, proper reporting frequencies, exact CSV round trip and source hashes.
- `verify_design_days.py`: eight room loads and equipment ratings/airflow against native SQL, four CSV rows, source hashes, control/operating bounds and matching Annual identity.
- `verify_resilience.py`: zone air/RH/heat-index series against frozen native SQL, SET degree-hours recomputed and within 3% of EnergyPlus Pierce SET for Labs, heat-index band hours, deadly days, cold hours, 432-row CSV and source hashes.
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
