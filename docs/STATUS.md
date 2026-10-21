# Client-report release status

Updated 20 October 2026 after the 21:09 Annual rerun. [Report guide](../README.md) · [Project context](../../CONTEXT.md) · [Refresh guide](UPDATE.md)

## Current local release

Annual electricity is **18,996.6 kWh/year**, **49.1 kWh/m²/year**, before PV credit, using 387.134 m² modeled floor area. Monthly stacked bars and six end-use groups reconcile to the facility meter. Cooling includes the 219.27 kWh supplemental dehumidifier electricity exactly once; hot water includes checked tank parasitics. The site distinguishes hourly means and subhourly humidity peaks. Historical model iterations are not presented as current window savings.

The separate Design-Day package is reviewed: coincident sensible room heating/cooling **11.483/15.836 kW**, zone-peak bars, exact loads, selectable winter DB and summer DB/DP/WB conditions, operating checks and provisional capacity/flow tables. Individual zone peaks, detailed coil delivery and rated inputs are labeled separately. The Annual and Design-Day physical inputs match; each export retains its own identity.

Resilience remains pending. No outage thermal result, certification outcome, PV credit or final equipment/borefield selection is implied. Remaining questions include source-water/manufacturer performance, Lab humidity, winter dry-air/operative comfort and separate event/additional-weather sensitivities.

The five-page layout, Program schedules, same-origin Three.js viewer, noindex metadata, private-source boundary and alternate-host guard are preserved. This is a local release. Hosting/access setup remains recorded as not configured; no live account check, publication or cloud/account change was performed.

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
- `check.mjs`: reviewed Annual and Design-Day states, pending resilience, source/download identity, static links, monthly reconciliation, deployable-data privacy/size checks and alternate-host rejection.
- Python compilation and Node module syntax for changed exporters/renderers.
- Playwright MCP at 1280 x 900 and 390 x 844: meaningful rendered content, 72 monthly segments, eight zone-load bars, month selection, winter/DP/WB condition selection, exact twelve-row monthly table, actual Annual/Design-Day CSV downloads, Core Program-to-viewer selection and canvas. Expanded disclosures have no page-width overflow. Captured application errors and relevant console warnings/errors are empty.

The Browser plugin was unavailable; the existing Playwright MCP browser was used without installing browser/runtime dependencies. Evidence: [Annual](preview-results.png), [Design Days](preview-design-days.png), [phone Annual](preview-results-phone.png), [phone Design Days](preview-design-days-phone.png) and [check summary](annual-site-checks.json).

The source modeling/results files were preserved. [Annual QA](../../11_QAQC/261020%20Current%20Annual%20Review/review.md) and [Design-Day QA](../../11_QAQC/261020%20Sizing%20Rerun%20Review/review.md) support the release. Measure README edits required metadata refresh only; runtime logic/data and its configuration fingerprint are unchanged.

## Next release

Review the local report with Ed. Add resilience only with its own reviewed package. Before live publication, confirm the client allowlist and follow [HOSTING.md](HOSTING.md), including custom-host authentication and alternate-host/download checks. Local tests do not verify live Access.
