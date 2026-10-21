import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const inputs = JSON.parse(
  await readFile(path.join(root, "site/data/inputs.json"), "utf8"),
);
const results = JSON.parse(await readFile(path.join(root, "site/data/results.json"), "utf8"));
// Scripts and styles get a long browser cache, so their URLs carry a content version.
const assetHash = createHash("sha256");
for (const name of (await readdir(path.join(root, "site/assets"), { recursive: true })).filter((f) => /\.(js|css)$/.test(f) && !f.startsWith("vendor")).sort())
  assetHash.update(name).update(await readFile(path.join(root, "site/assets", name)));
const v = `?v=${assetHash.digest("hex").slice(0, 10)}`;
const energy = results.annual;
const whole = value => Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 });
const annualSummary = `<div class="zone-metrics annual-metrics"><div><span class="metric-label">Annual purchased electricity</span><span class="metric-value">${whole(energy.total_kWh)}</span><span class="metric-unit">kWh/year</span></div><div><span class="metric-label">Modeled site energy intensity</span><span class="metric-value">${energy.eui_kWh_m2_year.toFixed(1)}</span><span class="metric-unit">kWh/m²/year</span></div><div><span class="metric-label">Current scenario</span><span class="metric-value">Operable windows</span><span class="metric-unit">with temperature + moisture limits</span></div></div>`;
const pages = [
  [
    "index.html",
    "Overview",
    `<div class="page-heading"><h1>Rye Nature Center</h1><p class="lead">Discovery Center energy model</p><p>Model inputs and simulation results for the design team.</p></div>
 <div class="notice"><strong>Working model · 20 October 2026</strong><span>Annual energy and four Design-Day conditions are reviewed for design coordination. Winter and summer outage results are a first pass for design review. Equipment selections and remaining humidity/comfort questions are provisional.</span></div>
 ${annualSummary}<p class="caption">Purchased electricity before PV credit. First-pass design model with a shared ERV and ground-source heat pumps. <a href="annual-energy.html">Monthly energy use and model assumptions →</a></p>
 <section aria-labelledby="model-heading" class="overview-grid"><div><h2 id="model-heading">A shared basis for design</h2><p>This report records the assumptions behind the energy model and the results used for coordination with Allen + Killcoyne Architects and Kendall Engineering.</p><dl class="facts"><div><dt>Project</dt><dd>2624 · Discovery Center</dd></div><div><dt>Location</dt><dd>873 Boston Post Road, Rye, NY</dd></div><div><dt>Thermal zones</dt><dd>4 · Learning labs, visitor center, core, restrooms</dd></div><div><dt>Model inputs</dt><dd>Honeybee snapshot · 20 October 2026</dd></div></dl></div>
 <div class="directory"><a href="program.html"><span class="type-mono-label">01 / Inputs</span><h3>Program</h3><p>Zone loads, setpoints, ventilation assumptions and schedules.</p><span class="go">Explore the inputs →</span></a><a href="model.html"><span class="type-mono-label">02 / Geometry</span><h3>Model</h3><p>Explore the four thermal zones and modeled envelope.</p><span class="go">Open the model →</span></a></div></section>
 <section><div class="section-title"><h2>Simulation results</h2></div><div class="results-grid"><a class="result-link" href="annual-energy.html"><span class="status reviewed">Reviewed design model</span><h3>Annual energy use</h3><p>${whole(energy.total_kWh)} kWh/year · Monthly end-use breakdown</p></a><a class="result-link" href="peak-loads.html"><span class="status reviewed">Reviewed design model</span><h3>Design-day loads</h3><p>Winter, summer sensible and humid-weather checks</p></a><a class="result-link" href="resilience.html"><span class="status draft">First-pass results</span><h3>Resilience</h3><p>Seven-day winter and summer outages · Heat index and SET</p></a></div></section>
 <details><summary>Model scope and input status</summary><div class="details-body"><p>Energy and performance analysis during design, including annual energy, design-day loads and a Phius REVIVE resiliency study. This report supports design coordination; Passive House certification and mechanical-system design are outside the consulting scope.</p><p>The Program page describes the HBJSON input snapshot. Downstream OpenStudio measures can change system airflows and controls. The Annual energy page records the reviewed shared ERV configuration and window/heat-pump controls applied downstream. Equipment selections remain provisional.</p></div></details>`,
  ],
  [
    "program.html",
    "Program",
    `<div class="page-heading"><h1>Program</h1><p class="lead">Loads and schedules, by thermal zone.</p><p>Select a zone to inspect its current model inputs.</p></div><div class="notice compact"><strong>Annual-run input snapshot</strong><span>20 October 2026 · Matches the reviewed run. <a href="annual-energy.html">Shared ERV and operating controls →</a></span></div><div id="program"><p role="status">Loading zone inputs…</p></div>`,
  ],
  [
    "model.html",
    "Model",
    `<div class="page-heading"><h1>Model</h1><p class="lead">Four thermal zones. One building.</p><p>Explore the Honeybee geometry used for the input snapshot.</p></div><div class="viewer-toolbar"><label>Show zone <select id="model-zone"><option value="all">All zones</option></select></label><label class="check"><input type="checkbox" id="roofs" checked> Show roofs</label><label class="check"><input type="checkbox" id="shades"> Show shading</label><button class="btn-ghost small" id="reset-view">Reset view</button></div><div id="viewer" tabindex="0" aria-label="Interactive 3D energy model. Drag to orbit, scroll to zoom, right drag to pan. Arrow keys rotate; plus and minus zoom."><p role="status">Loading geometry…</p></div><p class="caption">Drag to orbit · Scroll to zoom · Right-drag to pan · Arrow keys to rotate · + / − to zoom</p><div id="model-legend" class="zone-legend"></div><details><summary>Geometry and source details</summary><div class="details-body"><p>Surfaces, windows and doors come from the HBJSON snapshot. Roofs are shown initially; clear Show roofs to see into the zones. Room boundaries describe the energy model; they are not construction drawings. Show shading adds the detached shading and site-context surfaces from the same HBJSON (roof overhangs, site elements and neighboring masses) in gray.</p><div id="geometry-info"></div><a class="link" href="program.html">Inspect zone inputs →</a></div></details>`,
  ],
  [
    "annual-energy.html",
    "Annual energy",
    `<div class="page-heading"><h1>Annual energy</h1><p class="lead">Seasonal electricity demand by end use.</p><p>Monthly and annual purchased electricity from the reviewed annual run.</p></div><div id="results" data-area="annual"><p role="status">Loading annual results…</p></div>`,
  ],
  [
    "peak-loads.html",
    "Peak loads",
    `<div class="page-heading"><h1>Peak loads</h1><p class="lead">Winter heating, summer sensible cooling and humid-weather operation.</p><p>Room loads and operating checks from the separate four-condition design-day study.</p></div><div id="results" data-area="peaks"><p role="status">Loading design-day results…</p></div>`,
  ],
  [
    "resilience.html",
    "Resilience",
    `<div class="page-heading"><h1>Resilience</h1><p class="lead">Seven-day winter and summer power outages.</p><p>Phius REVIVE 2024 outage method. Summer heat index and winter standard effective temperature (SET) are the headline measures.</p></div><div id="results" data-area="resilience"><p role="status">Loading outage results…</p></div>`,
  ],
  [
    "downloads.html",
    "Data & sources",
    `<div class="page-heading"><h1>Data &amp; sources</h1><p class="lead">Model inputs and result data.</p><p>Downloads include annual energy, the separate Design-Day package, the first-pass outage study and the matching zone inputs shown on the Program page.</p></div><div class="download-list"><a href="downloads/monthly-energy.csv" download><div><h2>Monthly electricity by end use</h2><p>Heating, cooling, hot water, fans and pumps, lighting and equipment. Monthly and annual values in kWh.</p></div><span>CSV ↓</span></a><a href="downloads/annual-results.json" download><div><h2>Annual results and run references</h2><p>Reviewed annual values, operating assumptions and model/output source hashes.</p></div><span>JSON ↓</span></a><a href="downloads/design-day-loads.csv" download><div><h2>Design-day room loads and equipment inputs</h2><p>Zone sensible thermal loads, provisional equipment allowances and operating checks. Units are in the column headings.</p></div><span>CSV ↓</span></a><a href="downloads/design-day-results.json" download><div><h2>Design-day results and run references</h2><p>Four design conditions, detailed operating results, controls and separate source identity.</p></div><span>JSON ↓</span></a><a href="downloads/resilience-hourly.csv" download><div><h2>Outage hourly data</h2><p>Nine-day winter and summer runs: zone air temperature, humidity, SET (winter) and heat index (summer), with outdoor conditions. Units in column headings.</p></div><span>CSV ↓</span></a><a href="downloads/resilience-results.json" download><div><h2>Outage results and run references</h2><p>First-pass REVIVE criteria comparison, daily deadly-day check, run checks and source hashes.</p></div><span>JSON ↓</span></a><a href="downloads/zone-inputs.csv" download><div><h2>Zone input summary</h2><p>Floor areas, reference occupancy, load densities and ventilation inputs. SI units in column headings. Blank cells mean not assigned.</p></div><span>CSV ↓</span></a><a href="downloads/schedules.zip" download><div><h2>Schedule data</h2><p>Annual 15-minute values and separate winter/summer design-day profiles. One CSV per schedule and scenario.</p></div><span>ZIP ↓</span></a><a href="downloads/program-definitions.json" download><div><h2>Program definitions</h2><p>Resolved zone loads, schedule definitions and source identifiers for technical coordination.</p></div><span>JSON ↓</span></a></div><details open><summary>Read before using the data</summary><div class="details-body"><p>Schedules use the final run&#39;s 2026 calendar, starting on Thursday. The saved Honeybee parameters say Sunday; downstream measures set the effective calendar to Thursday. Times label the start of each 15-minute interval in local standard time. No separate holiday calendar is supplied and the display does not apply daylight saving adjustments.</p><p>Occupancy schedules multiply the reference People value. Lighting and equipment schedules multiply their load densities. Heating and cooling schedules use °C. Consult the schedule unit and native definition for other values.</p><p>Outdoor-air entries are HBJSON zone inputs. They do not establish final ERV supply/extract quantities, diversity or heat-pump equipment capacities. The Annual energy page records the downstream shared ERV and window/heat-pump controls from the reviewed run.</p></div></details><details><summary>Input provenance</summary><div class="details-body" id="provenance"></div></details>`,
  ],
];
for (const [filename, title, body] of pages) {
  const nav = pages
    .filter(([file]) => file !== "index.html")
    .map(
      ([file, label]) =>
        `<a class="type-mono-nav" href="${file}" ${file === filename ? 'aria-current="page"' : ""}>${label}</a>`,
    )
    .join("");
  const content = body.replaceAll(
    "20 October 2026",
    inputs.snapshot_label.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    ),
  ).replaceAll('starting on Sunday', `starting on ${inputs.calendar.jan_1_day}`);
  await writeFile(
    path.join(root, "site", filename),
    `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="description" content="Rye Nature Center design energy model: inputs, geometry and simulation results."><title>${title} | Rye Nature Center | BLDGTYP</title><link rel="icon" href="assets/brand/favicon.svg"><link rel="stylesheet" href="assets/brand/tokens.css${v}"><link rel="stylesheet" href="assets/brand/components.css${v}"><link rel="stylesheet" href="assets/site.css${v}"><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&family=Geist:wght@400;500&family=Geist+Mono:wght@400&display=swap" rel="stylesheet"><script type="importmap">{"imports":{"three":"./assets/vendor/three/three.module.min.js"}}</script><script type="module" src="assets/app.js${v}"></script></head><body><a class="skip" href="#main">Skip to content</a><header><div class="header-inner"><a class="brand" href="index.html"><img src="assets/brand/bldgtyp-icon.svg" alt="" width="31" height="31"><span>BLDG<span class="brand-light">TYP</span></span></a><a class="project-id" href="index.html">2624 / RYE NATURE CENTER</a><nav aria-label="Main navigation">${nav}</nav></div></header><main id="main">${content}<noscript><p>JavaScript is needed for the interactive model and schedule charts. <a href="downloads/zone-inputs.csv">Download the zone inputs</a> or <a href="downloads/schedules.zip">schedule CSV files</a>.</p></noscript></main><footer><span>BLDGTYP · Building performance consulting</span><span>2624 · Draft for design coordination</span></footer></body></html>`,
  );
}
console.log(`Built ${pages.length} static pages in site/.`);
