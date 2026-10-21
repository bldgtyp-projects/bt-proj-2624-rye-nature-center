# IP display units: plan

Status: proposal, 21 October 2026. Nothing is implemented. Implementation starts when Ed approves this plan and the open decisions below.

## Goal and rule

The website displays US (IP) units. Every exported data file, download and frozen source stays SI, exactly as EnergyPlus and Honeybee produce it. Conversion happens only at display time, in one shared module, so a future re-export or rerun picks up IP display with no extra work.

## Current state

Units reach the page from three places:

1. **Renderer code** (`site/assets/results.js`, `app.js`, `scripts/build.mjs`) formats numeric SI data with hard-coded unit strings: about 70 sites across °C, kWh, kW, W, m², m³, L/s, m/s, W/m², people/m² and K·h. Some text is already °F (thermostat setpoints, a few design-day notes).
2. **Exporter prose** (`export_results.py`, `export_design_days.py`, `export_resilience.py`) writes about 20 strings with SI values embedded in text, for example "indoor 22 to 26°C", "fixed 10°C mains, 60°C storage", "120 L/day dehumidifier", "0.16 m/s", "21.11 C for winter". These cannot be converted reliably after the fact.
3. **Data-borne unit labels**: schedule units ("C", "fraction"), resilience figure units ("kWh", "ACH", "C"), the geometry note ("Geometry units: meters").

## Design

### One conversion module

New `site/assets/units.js`, an ES module that both the browser and `build.mjs` import. It holds a registry keyed by **quantity kind**, not by unit string:

```js
temperature:       { si: "°C",      ip: "°F",         to: c => c * 1.8 + 32 }
temperature_delta: { si: "K",       ip: "°F",         to: k => k * 1.8 }   // differences, deadbands
area:              { si: "m²",      ip: "ft²",        to: a => a * 10.7639 }
...
```

It also exports three functions:

- `value(x, kind)` converts.
- `fmt(x, kind, digits?)` converts, rounds and appends the unit.
- `label(kind)` returns the unit string for axes and table headings.

Each kind carries its IP display precision, so rounding is set in one place.

Renderers never write a unit string or a conversion factor themselves; they call the module. Charts convert the series, the axis ticks and the threshold lines through the same kind (for example SET 12.22 °C, drawn and labelled as 54 °F).

### Prose tokens from exporters

Exporters keep writing SI, but mark each embedded quantity with a token instead of a literal unit. For example:

```
"indoor {temperature:22} to {temperature:26}; outdoor {temperature:15} to {temperature:25}"
```

The renderer's `prose()` helper replaces each token through `fmt()`. The JSON stays SI and readable, and the display converts. Thresholds that are defined in IP (NOAA heat index 80/90/103/125 °F, REVIVE 36 °F / 54 °F / 216 °F·h, thermostats 70/75 °F) stay as SI values converted from the IP definition in the exporter, so the round trip displays the exact IP number.

### Downloads and data

CSV/JSON downloads, `site/data/*.json`, `_private/` and the hourly CSVs stay SI with explicit units in column names. The Data & Sources page says so plainly: "The site displays IP units; downloads are SI."

### Guarding future exports

`check.mjs` gains three static checks, so a rerun cannot silently reintroduce SI text:

1. **Conversion tests**: known pairs (0 °C = 32 °F, 1 m² = 10.7639 ft², 1 kW = 3,412.14 Btu/h, 1 m³/s = 2,118.88 cfm, 216 °F·h = 120 K·h), plus a round trip for every kind.
2. **Prose lint**: every string field in `site/data/*.json` (except schedule definitions and raw identifiers) fails if it contains a digit followed by an SI unit outside a token, for example `22°C`, `120 L/day`, `0.16 m/s`.
3. **Renderer lint**: the renderers contain no literal SI unit strings outside `units.js`.

A rendered-page check joins the release checklist in `UPDATE.md`. A browser snippet scans each page's visible text for SI unit patterns and must return nothing. The static checks cannot see text assembled at runtime, so this step stays manual (Playwright/Browser), consistent with the existing browser acceptance.

## Proposed IP display units

| Quantity | SI (data) | IP display | Where it appears |
| --- | --- | --- | --- |
| Air, surface, setpoint, SET, heat index temperature | °C | °F | Program schedules, outage charts, Design-Day tables, prose |
| Temperature difference | K | °F (Δ) | Window deadband, SET deficit, formula notes |
| SET degree-hours | K·h | °F·h | Resilience (already shown in °F·h) |
| Floor area | m² | ft² | Overview, Program, Annual EUI basis |
| Volume | m³ | ft³ | Program |
| Length / perimeter / opening height | m | ft (in for small) | Annual systems (Kiva perimeter), geometry note |
| Annual electricity | kWh | **kWh** (decision 1) | Annual energy, Overview |
| Energy intensity | kWh/m²·yr | **kBtu/ft²·yr** (decision 1) | Annual energy, Overview |
| Hourly zone energy flows, envelope flows | kWh per hour | kBtu (per hour) or kWh (decision 1) | Resilience detail panels |
| Room loads, coil output, rated capacity | W / kW | **kBtu/h**, cooling also in tons (decision 2) | Peak loads |
| Backup heater power, people heat | W | Btu/h | Peak loads, resilience prose |
| Lighting / equipment density | W/m² | W/ft² | Program |
| Occupant density | people/m² | people/1,000 ft² | Program |
| Outdoor air per person | m³/s·person | cfm/person | Program |
| Outdoor air per area, infiltration per exterior area | m³/s·m² | cfm/ft² | Program |
| Outdoor air per zone, unit airflow, ERV flow | m³/s, L/s, m³/h | cfm | Program, Peak loads, Resilience |
| Source-water flow | m³/s | gpm | Peak loads |
| Service hot water | L/h·m² | gal/h per 1,000 ft² | Program |
| Dehumidifier capacity | L/day | pints/day | Annual systems |
| Air speed | m/s | fpm | Resilience SET note |
| Relative humidity, ACH, fractions, clo | (none) | unchanged | |

## Order of work

1. Add `units.js` and its conversion tests. Commit by itself.
2. Convert the renderers page by page (Overview, Program, Model note, Annual energy, Peak loads, Resilience, Data & Sources), replacing literal units with module calls. Check each page in the browser.
3. Tokenize exporter prose, re-export with no `--refresh` (frozen SI inputs, byte-identical numbers), and confirm every numeric data field is unchanged except the prose fields.
4. Add the prose and renderer lints to `check.mjs`, and the rendered-page scan to `UPDATE.md`. Run all verifiers.
5. Update README/STATUS/UPDATE. Hold the push for Ed's review.

The verifiers compare SI data against the SQL, so they do not change. Step 3 must leave every SI number byte-identical; a diff of `site/data/*.json` limited to string fields proves it.

## Open decisions

1. **Energy units.** Recommended: annual electricity stays **kWh**, which matches US utility bills and the PV discussion to come. EUI becomes **kBtu/ft²·yr**, the Phius / ENERGY STAR convention. Resilience hourly flows become **kBtu**. Alternative: everything in kBtu, or everything in kWh with EUI in kWh/ft²·yr.
2. **Loads and capacities.** Recommended: **kBtu/h**, with **tons** added for cooling capacity on the Peak loads page. Alternative: Btu/h throughout.
3. **SI/IP toggle.** Recommended: **IP only** for now. The module makes a viewer toggle a small later addition, but a toggle doubles the rendered states to check before each release. Alternative: IP default with an SI toggle remembered per viewer.
4. **Precision.** Recommended: temperatures to 0.1 °F in tables and whole °F in prose and metrics; areas to whole ft²; loads to 0.1 kBtu/h; airflow to whole cfm. Ed may prefer different rounding for client copy.
