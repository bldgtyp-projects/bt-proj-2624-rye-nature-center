# Refresh and release the report

[Report entry point](../README.md) · [Current release](STATUS.md) · [Project context](../../CONTEXT.md)

## Select and preserve sources

1. Review the model/result packages first. Record the exact run identities and the source hashes in the owning QA reviews. The source run folder may be overwritten on the next simulation.
2. Archive the prior coherent `site/`, scripts/docs/configuration and `_private/` snapshot under `_private/archives/`. Do not include older archives recursively. The current pre-refresh archive is `20261020-before-current-energy-design-days.zip`.
3. Set `report.json` to the reviewed Annual run, HBJSON, parameters, final IDF, Annual review and diagnostics. Select the Design-Day run/review/verification and the fresh native annual/design input-match check. All paths must remain project-local. Check that the native-match record pins both selected HBJSON hashes.
4. From `04_Web/`, run the four exporters with `--refresh`: inputs, Annual results, Design Days, then Resilience. This captures new sources in `_private/` and replaces generated client data/downloads. Without `--refresh`, the exporters reproduce their frozen snapshots.
5. Build and run all three Python verifiers plus `check.mjs` as listed in the README. A failed exporter/check leaves a partial local refresh; do not publish it. Fix the failure or restore the entire prior archive, never a mixture of input/result files.

Original modeling, SQL, OSM/IDF and weather files are read only. Only derived client data is deployed. Raw sources stay private, including result SQL, workflow/error logs and native HBJSON. Do not refresh from a run that has not been reviewed.

## Annual energy contract

The exporter groups hourly heating/cooling-coil, DHW, fan/pump, lighting and equipment electricity by reporting month. Supplemental dehumidifier electricity is available at zone timestep and is added once to Cooling. Do not also add an inclusive Cooling meter to those components. Every month reconciles to the quarter-hour facility electricity meter within 0.00001 kWh.

The current tank uses 20 W off-cycle parasitics, zero on-cycle parasitics and a 1 MW placeholder capacity. The exporter checks those exact inputs before reconstructing standby electricity from heater runtime. It rejects an unexplained balance or different tank inputs. Adapt/verify that calculation when the actual DHW equipment changes; never assign arbitrary residual energy to DHW.

Preserve the full non-leap 2026 calendar, Thursday effective January 1 and disclosure of the saved Sunday parameter. Schedule data uses 15-minute interval-start local-standard-time labels. Occupied hourly conditions mean some positive People in that hour; Restrooms has no separate People load. Hourly and 15-minute peaks are different statistics. Retain all-hour overshoot and winter comfort qualifications. Historical model changes are not a matched window-savings experiment.

## Design-Day contract

Release a separate package with its own HBJSON/IDF/OSM/SQL hashes, four annual design conditions, 12 timesteps/hour, 15-minute sizing average and reviewed operating checks. It must match the Annual model physically; regenerated identifiers need not match. The input-match record must identify both exact native exports.

Room loads are unfactored sensible thermal loads. Individual zone maxima are noncoincident. Detailed coil delivery includes system/latent effects; rated capacities and air/water flows are provisional equipment inputs. Show those quantities separately, with units. Keep the design-day windows closed and report backup heat use, air temperature and RH. Do not present this generic-model pass as equipment or borefield design.

## Resilience contract

The current package is `draft_first_pass`, frozen in `_private/resilience/` from the 21 October winter/summer runs named in `report.json`; `verify_resilience.py` checks it against native SQL and EnergyPlus Pierce SET. Promote it to reviewed only after a QA review under `11_QAQC/`. A reviewed package needs the original expanded run periods and inner seven outage days, generated EPW identity, refuge population/loads, systems on backup, active systems disabled, window/recovery operation, source hashes and reviewed temperature/humidity outputs. No placeholder zeros or certification claim. Annual HVAC measures reject Refuge programs and are not an automatic resilience-system implementation.

## Browser and release checks

Check the monthly selector, exact-value disclosure, CSV download, Peak loads design-day cards (click and arrow keys) and their panels across winter and humid summer conditions, equipment/provenance disclosures, both outage charts and the REVIVE comparison table. Check the Program week selector, weekend shading, the annual strip click-to-week, design-day profiles and geometry source identity. Inspect desktop and phone width, open the wide tables and confirm page-level overflow is absent. Collect application errors and inspect screenshots.

The available Playwright MCP browser was used for the current release because the Browser plugin was not available. No browser dependency installation is needed. Screenshots and the verification summary remain in `docs/`; they are not deployed.

Edit page text in `scripts/build.mjs`, not generated HTML. Edit behavior in `site/assets/` and rebuild. Preserve noindex metadata, same-origin viewer/data, licenses and alternate-host rejection. Update STATUS.md and project CONTEXT.md after a checked release. Publishing is a push of `main`, which deploys the whole committed `site/` as one release ([HOSTING.md](HOSTING.md)).

## Display units

All data, downloads and frozen sources are SI. The site displays US (IP) units through `site/assets/units.js` only. Design record: [UNITS_PLAN.md](UNITS_PLAN.md).

- **Renderers** (`app.js`, `results.js`, `viewer.js`, `build.mjs`) never write an SI unit string or conversion factor. The one exception is the Data & sources page, whose text describes the SI downloads. They call `units.fmt(value, kind)`, `units.number(...)`, `units.label(kind)` or `units.value(...)` with a quantity kind (`temperature`, `temperature_delta`, `area`, `load`, `airflow`, `energy`, `eui`...). A new quantity needs a new kind in `units.js` and a reference pair in `check.mjs`.
- **Exporter prose** writes SI quantities as tokens, `{kind:value}` or `{kind:value:digits}`, for example `indoor {temperature:22} to {temperature:26}`. Renderers pass prose through `units.prose()`. Thresholds defined in IP (NOAA heat index, REVIVE 36/54 °F and 216 °F·h, thermostats) are stored as exact SI conversions and display as the round IP value. Quantities that were specified or quoted in IP (for example the Kiva insulation depths in inches, REVIVE's 5 cfm/person, the 10 cfm/person design rate) may stay as IP text in the prose; the lint only rejects SI written as text.
- **Precision:** temperatures show 0.1 °F in tables and whole °F in prose and headline metrics (`units.say`, and the default for prose tokens). The summer heat-index metric and caption keep 0.1 °F because the peak sits next to the 103 °F Danger line.
- **Electricity** stays kWh (and kWh/day); EUI is kBtu/ft²·yr; thermal energy and hourly flows are kBtu; loads and capacities are kBtu/h, with tons beside cooling.
- **Guards:** `check.mjs` tests every conversion against reference pairs, fails on SI values written as text in exported prose, rejects unknown tokens, and fails on SI unit strings or conversion factors in the renderers or static pages (the Data & sources page may describe the SI downloads).
- **Release check:** with the local preview running, run `scripts/scan_units.browser.js` in the browser. Every page must list no SI units and 0 errors; `downloads.html` may list `°C`. Static checks cannot see text assembled at runtime.
