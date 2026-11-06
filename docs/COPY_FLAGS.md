# Open copy flags (local 261103 build)

Raised 3 November, rechecked and extended 6 November 2026 against the rendered local site. Ed rewrites these; do not push `main` until they are closed. Sources: page text in `scripts/build.mjs`, renderer text in `site/assets/results.js`, exporter prose in `scripts/export_*.py` (rerun the exporter without `--refresh` after editing it).

## Stale or inaccurate

| # | Page | Current text | Issue | Source |
|---|---|---|---|---|
| 1 | Overview | "built from the documents Allen + Killcoyne Architects provided on 30 September 2026" | Model now also reflects the 28 Oct review (office windows, skylights, trees) and AKA's 29 Oct / 3 Nov occupancy numbers. | `build.mjs:19` |
| 2 | Peak loads, room-to-coil bridge | "Values at the heat-pump peaks, so the room loads differ slightly from the sizing totals." | True for heating only. Cooling bridge sits at the room-load peak (Summer DB 14:15) and ends at 95.9 kBtu/h; headline cooling peak is 111.4 kBtu/h (Summer WB 13:05). Needs one sentence on why. | `results.js:225` |
| 3 | Peak loads, same caption | "the heat-pump fans draw 2.9 kBtu/h and 3.8 kBtu/h" | Cooling remainder is 2.9 vs 3.8 fan draw: Labs is at full capacity at 14:15 (~1.0 kBtu/h unmet). Caption doesn't say so. | `results.js:225` |
| 4 | Peak loads, room-load components | "Totals are within 0.5% of the sizing totals." | Cooling components sum to 1.3% above the sizing total (17.19 vs 16.97 kW); heating is within 0.2%. | `results.js:224` |
| 5 | Peak loads, Before sizing | "Community-event occupancy and additional summer weather cases are not yet run." | Four 100-person events are now in the Annual run. Still absent from design days. | `export_design_days.py:229` |
| 6 | Model | "Show shading adds roof overhangs, site elements and neighboring masses in gray." | Omits the trees (1,222 of the 1,563 shading surfaces), modeled at 0.25 leaf-on / 0.70 leaf-off transmittance. | `build.mjs:31` |
| 7 | Annual results JSON (download) | `release.scenario`: "Current materials, internal mass and sized GSHPs; Kiva…" | Doesn't name the occupancy revision, office windows or trees; "sized GSHPs" overstates generic allowances. | `export_results.py:148` |

## Missing disclosures

| # | Item | Where it would go |
|---|---|---|
| 8 | 39 non-convex casting surfaces (PolygonClipping severe; accepted 3 Nov). Recorded in the JSON downloads, not stated on any page. | Annual energy / Peak loads calculation notes |
| 9 | Tree canopy transmittance 0.25 leaf-on / 0.70 leaf-off, rule-of-thumb values. | Model, Annual systems table |
| 10 | Annual autosizing now uses the 4 curated design days, not 114. | Annual calculation and sources |

## Out of step with Kendall's 29 Oct proposal (model unchanged)

Kendall's 29 Oct email and cutsheets (`01_Reference/261029 Mech/`) propose one AHU + ERV + side-stream dehumidifier per zone on shared ducts, three zones (Labs 2 × 4.0 t, one unit per lab; offices/corridor/restroom 2.5 t; Visitor 3.0 t; 13.5 t connected), and a 12–14 t central Mitsubishi water-source unit. The report states the model's own design, correctly labeled as allowances, but a reader comparing will see these differences:

| # | Page | Current text | Difference |
|---|---|---|---|
| 11 | Annual energy, Peak loads | "a separate shared ERV", "One shared ERV", "the shared ERV runs first" | Kendall: one ERV per zone. | 
| 12 | Annual energy, Peak loads | "A water-source heat pump in each of the four zones" | Kendall: three ducted indoor units on a central water-source VRF; Core and Restrooms share one. |
| 13 | Annual energy | "Learning Labs has no dehumidifier"; "Learning Labs and Restrooms have none"; dehumidifier "254 pints/day" | Kendall suggests Aprilaire units throughout; the E100 is a ~100 pint/day unit. Labs RH reaches 65.5% occupied. |
| 14 | Peak loads, allowances table | Labs 3.12 t, Visitor 3.84 t, Core 3.06 t, Restrooms 0.45 t rated | Kendall: Labs 2 × 4.0 = 8.0 (the 13.5 t total only sums with two lab units; the cutsheet "LEARNING LAB 1 & LEARNING LAB 2" page is one sheet for both), Visitor 3.0, Core+Restrooms 2.5. Labs is the largest gap: 8.0 t vs our 3.12 t. Labs and Core hit full capacity in our design days; Visitor has spare. Coincident model peak 9.28 t vs Kendall 10–13.5 t. Worth one comparison line, or a model update to Kendall's capacities (separate modeling task). |

## Question rather than error

| # | Page | Current text | Question |
|---|---|---|---|
| 15 | Resilience | "Only Learning Labs is occupied: 22 people, 09:00 to 18:00." | Refuge population predates the occupancy revision (Labs 34 school year / 50 summer). Keep 22? |
| 16 | Resilience, Method | "The building matches the annual model" | Geometry and constructions match. Refuge runs use FullExterior solar distribution; Annual and Design-Day use FullExteriorWithReflections. |
