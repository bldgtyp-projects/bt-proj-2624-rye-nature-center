import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { link, referenceList } from "../site/assets/references.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const inputs = JSON.parse(
  await readFile(path.join(root, "site/data/inputs.json"), "utf8"),
);
// Scripts and styles get a long browser cache, so their URLs carry a content version.
const assetHash = createHash("sha256");
for (const name of (await readdir(path.join(root, "site/assets"), { recursive: true })).filter((f) => /\.(js|css)$/.test(f) && !f.startsWith("vendor")).sort())
  assetHash.update(name).update(await readFile(path.join(root, "site/assets", name)));
const v = `?v=${assetHash.digest("hex").slice(0, 10)}`;
const pages = [
  [
    "index.html",
    "Overview",
    `<div class="page-heading"><h1>Rye Nature Center</h1><p class="lead">Discovery Center energy model</p><p>EnergyPlus simulations of the Discovery Center, built from the documents Allen + Killcoyne Architects provided on 30 September 2026. The results cover annual energy use, peak heating and cooling loads, and resilience through seven-day winter and summer power outages. The program and model inputs behind them, and the data, are here too.</p><p>Prepared for design coordination with Allen + Killcoyne Architects and Kendall Engineering. The heat pumps and ERV in the model are allowances, not equipment selections.</p></div>
 <section><div class="section-title"><h2>Results</h2></div><div class="results-grid"><a class="result-link" href="annual-energy.html"><h3>Annual energy</h3><p>Electricity use by month and end use, with the systems and controls modeled.</p></a><a class="result-link" href="peak-loads.html"><h3>Peak loads</h3><p>Heating and cooling loads on the ASHRAE design days, by room and by heat pump.</p></a><a class="result-link" href="resilience.html"><span class="status draft">First pass</span><h3>Resilience</h3><p>Indoor conditions through seven-day winter and summer outages, against Phius REVIVE.</p></a></div></section>
 <section><div class="section-title"><h2>Inputs and data</h2></div><div class="results-grid"><a class="result-link" href="program.html"><h3>Program</h3><p>Zone loads, setpoints, ventilation and schedules.</p></a><a class="result-link" href="model.html"><h3>Model</h3><p>The four thermal zones and the modeled envelope, in 3D.</p></a><a class="result-link" href="downloads.html"><h3>Data &amp; sources</h3><p>Downloads, source files and references.</p></a></div></section>`,
  ],
  [
    "program.html",
    "Program",
    `<div class="page-heading"><h1>Program</h1><p class="lead">Loads and schedules, by thermal zone.</p><p>Select a zone to see its inputs.</p></div><div id="program"><p role="status">Loading zone inputs…</p></div>`,
  ],
  [
    "model.html",
    "Model",
    `<div class="page-heading"><h1>Model</h1><p class="lead">The energy model in 3D, by thermal zone.</p></div><div class="viewer-toolbar"><label>Show zone <select id="model-zone"><option value="all">All zones</option></select></label><label class="check"><input type="checkbox" id="roofs" checked> Show roofs</label><label class="check"><input type="checkbox" id="shades"> Show shading</label><button class="btn-ghost small" id="reset-view">Reset view</button></div><div id="viewer" tabindex="0" aria-label="Interactive 3D energy model. Drag to orbit, scroll to zoom, right drag to pan. Arrow keys rotate; plus and minus zoom."><p role="status">Loading geometry…</p></div><p class="caption">Drag to orbit · Scroll to zoom · Right-drag to pan · Arrow keys to rotate · + / − to zoom</p><div id="model-legend" class="zone-legend"></div><details><summary>About the geometry</summary><div class="details-body"><p>Clear Show roofs to see into the zones. Show shading adds roof overhangs, site elements and neighboring masses in gray. Zone boundaries follow the energy model, not the construction drawings.</p><div id="geometry-info"></div><a class="link" href="program.html">Inspect zone inputs →</a></div></details>`,
  ],
  [
    "annual-energy.html",
    "Annual energy",
    `<div class="page-heading"><h1>Annual energy</h1><p class="lead">Purchased electricity by month and end use.</p></div><div id="results" data-area="annual"><p role="status">Loading annual results…</p></div>`,
  ],
  [
    "peak-loads.html",
    "Peak loads",
    `<div class="page-heading"><h1>Peak loads</h1><p class="lead">The heating and cooling the zone heat pumps must deliver on design days.</p><p>Four standard ${link("ashrae", "ASHRAE design days")} for White Plains, one winter and three summer, with no sizing margin.</p></div><div id="results" data-area="peaks"><p role="status">Loading design-day results…</p></div>`,
  ],
  [
    "resilience.html",
    "Resilience",
    `<div class="page-heading"><h1>Resilience</h1><p class="lead">Seven-day winter and summer power outages.</p><p>${link("revive", "Phius REVIVE 2024")} method, measured by summer heat index and winter standard effective temperature (SET).</p></div><div id="results" data-area="resilience"><p role="status">Loading outage results…</p></div>`,
  ],
  [
    "downloads.html",
    "Data & sources",
    `<div class="page-heading"><h1>Data &amp; sources</h1><p class="lead">Model inputs and result data.</p><p>The site shows US (IP) units. Downloads are SI, with units in each column heading or field name.</p></div><div class="download-list"><a href="downloads/monthly-energy.csv" download><div><h2>Monthly electricity by end use</h2><p>Heating, cooling, hot water, fans and pumps, lighting and equipment. Monthly and annual values in kWh.</p></div><span>CSV ↓</span></a><a href="downloads/annual-results.json" download><div><h2>Annual results and sources</h2><p>Annual values, system assumptions and source file hashes.</p></div><span>JSON ↓</span></a><a href="downloads/design-day-loads.csv" download><div><h2>Design-day room loads and equipment inputs</h2><p>Room and coil loads by zone, provisional equipment allowances and operating checks.</p></div><span>CSV ↓</span></a><a href="downloads/design-day-results.json" download><div><h2>Design-day results and sources</h2><p>Four design conditions, operating results, controls and source file hashes.</p></div><span>JSON ↓</span></a><a href="downloads/resilience-hourly.csv" download><div><h2>Outage hourly data</h2><p>Nine-day winter and summer runs: zone air temperature, humidity, SET (winter) and heat index (summer), with outdoor conditions.</p></div><span>CSV ↓</span></a><a href="downloads/resilience-results.json" download><div><h2>Outage results and sources</h2><p>First-pass REVIVE criteria comparison, daily deadly-day check, run checks and source hashes.</p></div><span>JSON ↓</span></a><a href="downloads/zone-inputs.csv" download><div><h2>Zone input summary</h2><p>Floor areas, reference occupancy, load densities and ventilation inputs. Blank cells mean not assigned.</p></div><span>CSV ↓</span></a><a href="downloads/schedules.zip" download><div><h2>Schedule data</h2><p>Annual 15-minute values and separate winter/summer design-day profiles. One CSV per schedule and scenario.</p></div><span>ZIP ↓</span></a><a href="downloads/program-definitions.json" download><div><h2>Program definitions</h2><p>Zone loads, schedule definitions and source identifiers.</p></div><span>JSON ↓</span></a></div><details open><summary>Using the data</summary><div class="details-body"><p>Schedules use a 2026 calendar starting on a Thursday. Times mark the start of each 15-minute interval, in local standard time with no daylight saving and no holidays. The saved ${link("honeybee", "Honeybee")} parameters list Sunday as the start day; the simulation runs on Thursday.</p><p>Occupancy schedules multiply Reference People; lighting and equipment schedules multiply their load densities. Setpoint schedules are in °C and activity in W per person.</p><p>Zone outdoor-air values are model inputs, not ERV design airflows or heat-pump capacities. The ERV and controls are on the Annual energy page.</p></div></details><details><summary>References</summary><div class="details-body"><p>Weather data, standards and software the model and this report rely on. Links open the original source.</p>${referenceList()}</div></details><details><summary>Source file</summary><div class="details-body" id="provenance"></div></details>`,
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
