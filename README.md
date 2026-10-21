# Rye Nature Center client report

[Project context](../CONTEXT.md) · [Current site status](docs/STATUS.md) · [Refresh guide](docs/UPDATE.md) · [Hosting](docs/HOSTING.md)

The deployable artifact is `site/`. It presents the reviewed annual run, the separate four-condition Design-Day study and first-pass Phius REVIVE winter/summer outage results for the architect/MEP team. This is the existing custom static-site exception to the PHPP report template and Manager. It is published as a public, noindex draft at https://project-2624.bldgtyp.com; pushing `main` redeploys ([Hosting](docs/HOSTING.md)).

Current annual electricity is **18,996.6 kWh/year**, **49.1 kWh/m²/year** modeled floor area, before PV credit. Monthly stacked bars and annual end uses reconcile to the facility meter. Cooling includes supplemental dehumidification. The Design-Day section shows **11.483 kW heating / 15.836 kW sensible cooling** coincident room loads, individual zone bars and selectable winter DB/summer DB/DP/WB operating checks. Equipment allowances are disclosed separately. The current Annual inputs match the Design-Day model physically; each export retains its own identity.

## Build and preview

Run from `04_Web/` using the installed runtimes:

```sh
/Users/em/ladybug_tools/python/bin/python3 scripts/export_inputs.py
/Users/em/ladybug_tools/python/bin/python3 scripts/export_results.py
/Users/em/ladybug_tools/python/bin/python3 scripts/export_design_days.py
/Users/em/ladybug_tools/python/bin/python3 scripts/export_resilience.py
node scripts/build.mjs
/Users/em/ladybug_tools/python/bin/python3 scripts/verify_inputs.py
/Users/em/ladybug_tools/python/bin/python3 scripts/verify_results.py
/Users/em/ladybug_tools/python/bin/python3 scripts/verify_design_days.py
/Users/em/ladybug_tools/python/bin/python3 scripts/verify_resilience.py
node scripts/check.mjs
node scripts/serve.mjs
```

The local preview is [127.0.0.1:4624](http://127.0.0.1:4624/). It serves only `site/` and does not emulate Cloudflare Access or the hostname guard. Native verification/export requires the ignored `_private/` sources; generated website assets and Node checks work without them. No runtime packages were installed or changed.

For a new coordinated snapshot, follow [UPDATE.md](docs/UPDATE.md), archive first, and add `--refresh` to all three exporters in the order above. Exporters read/freeze selected sources; they never rerun or edit simulations. Treat a partially failed refresh as unreleased until the complete suite passes.

## File ownership

| Path | Purpose |
| --- | --- |
| `report.json` | Selected project-local source/review paths, snapshot label and proposed publishing identity |
| `scripts/export_inputs.py` | Native Honeybee program, schedule and geometry projection |
| `scripts/export_results.py` | Annual monthly/end-use energy, humidity summary and provenance |
| `scripts/export_design_days.py` | Separate four-condition thermal-load/operating package and source identity |
| `scripts/export_resilience.py` | Winter SET / summer heat-index outage package, REVIVE criteria comparison, run checks and source identity (uses `honeybee_revive` from the Ladybug runtime) |
| `scripts/verify_*.py` | Independent native input/SQL/download checks |
| `scripts/build.mjs` | Shared shell/content for seven generated HTML pages |
| `site/assets/app.js`, `viewer.js`, `results.js` | Program/geometry and results interactions |
| `site/assets/site.css` | BLDGTYP report layout and responsive charts |
| `site/data/`, `site/downloads/` | Reviewed generated data and client downloads |
| `_private/` | Frozen model and simulation sources, with rollback archives; never deploy |
| `docs/STATUS.md` | Verified release identity, checks, limitations and publication state |
| `docs/UPDATE.md` | Refresh, release and rollback procedure |
| `docs/HOSTING.md` | Existing Cloudflare setup/access procedure and live acceptance boundary |
| `docs/VIEWERS.md` | Historical viewer selection research |

## Presentation and data boundaries

The seven pages are Overview (reached from the logo and project name, not a tab), Program, Model, Annual energy, Peak loads, Resilience and Data & Sources. Program supports an annual date or separate winter/summer schedule profile. The Three.js viewer serves project geometry and libraries from the same origin; it uploads no model to an external viewer. BLDGTYP CSS assets/licenses are retained; Google Fonts supplies typefaces.

Keep details behind native disclosures while the initial page shows the main results. Preserve explicit units and reporting periods. The effective calendar is 2026, beginning Thursday; saved HB parameters retain Sunday. Times are local standard time with interval-start schedule labels and no display DST inference. Modeled area differs from architectural gross area.

Use [the QA index](../11_QAQC/README.md) for model acceptance and [CONTEXT.md](../CONTEXT.md) for remaining modeling questions. Generic equipment/source-water performance, Lab humidity and winter operative/dry-air comfort remain provisional. The previous model iterations changed multiple inputs; their energy difference is not a current window-savings claim.
