import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const path_join = path.join;
const root = fileURLToPath(new URL("../site/", import.meta.url));
// Display units: SI data, IP display. Known reference pairs for every conversion kind.
const units = await import(new URL("../site/assets/units.js", import.meta.url));
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
for (const [x, kind, ip] of [
  [0, "temperature", 32], [100, "temperature", 212], [(54 - 32) / 1.8, "temperature", 54], [(103 - 32) / 1.8, "temperature", 103],
  [1, "temperature_delta", 1.8], [120, "degree_hours", 216], [1, "area", 10.7639104], [1, "volume", 35.3146667],
  [0.3048, "length", 1], [0.0254, "thickness", 1], [1, "u_value", 0.176110159], [1, "r_value", 5.67826334], [1, "electricity", 1], [1, "energy", 3.41214163], [1, "eui", 0.31699833],
  [1000, "load", 3.41214163], [1, "power", 3.41214163], [3516.85284, "cooling_tons", 1], [10.7639104, "power_density", 1],
  [1, "occupant_density", 92.9030400], [0.00047194745, "airflow", 1], [1699.0108, "airflow_hourly", 1000],
  [0.0047194745, "airflow_per_person", 10], [1, "airflow_per_area", 196.850394], [0.0000630901964, "water_flow", 1],
  [1, "hot_water_per_area", 24.5423867], [0.473176473, "liquid_per_day", 1], [0.00508, "speed", 1], [0.44704, "wind_speed", 1],
]) near(units.value(x, kind), ip);
assert.equal(units.prose("{temperature:22} to {temperature:26:0}; {speed:0.16}"), "72°F to 79°F; 31 fpm");
assert.throws(() => units.value(1, "furlongs"));
// SI quantities written as text (not as unit tokens) would display unconverted.
const SI_TEXT = /\d\s?(?:°C|m²|m³|m\/s|L\/s|L\/day|L\/h|W\/m²|kW\b|K·h|W(?![\w/·])|K(?![\w·])|C(?![\w·]))/;
const TOKEN = /\{([a-z_]+):(-?[\d.]+)(?::\d)?\}/g;
const PROSE_SKIP = new Set(["schedules", "loads", "internal_mass", "definition", "source", "hours", "deadly_day"]);
function* proseStrings(value, path = "") {
  if (typeof value === "string") yield [path, value];
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* proseStrings(v, `${path}[${i}]`);
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) if (!PROSE_SKIP.has(k)) yield* proseStrings(v, `${path}.${k}`);
}
for (const name of ["results.json", "resilience.json", "inputs.json"]) {
  for (const [path, text] of proseStrings(JSON.parse(await readFile(path_join(root, "data", name), "utf8")))) {
    for (const [, kind] of text.matchAll(TOKEN)) assert.ok(units.KINDS[kind], `${name}${path}: unknown unit token ${kind}`);
    assert.ok(!SI_TEXT.test(text.replace(TOKEN, "")), `${name}${path}: SI value written as text: ${text}`);
  }
}
// Renderers convert only through units.js: no SI unit strings or conversion factors elsewhere.
const SI_UNIT = /°C|m²|m³|L\/s|W\/m²|m\/s|\bkW\b|\* ?9 ?\/ ?5|\/ ?1000\b|\* ?1000\b/;
for (const file of ["assets/results.js", "assets/app.js", "assets/viewer.js"]) {
  const source = await readFile(path_join(root, file), "utf8");
  source.split("\n").forEach((line, i) => assert.ok(!SI_UNIT.test(line), `${file}:${i + 1}: SI unit or conversion outside units.js`));
}
for (const file of (await readdir(root)).filter((f) => f.endsWith(".html") && f !== "downloads.html")) {
  const text = (await readFile(path_join(root, file), "utf8")).replace(/<[^>]+>/g, " ");
  assert.ok(!SI_UNIT.test(text) && !SI_TEXT.test(text), `${file}: SI unit in static page text`);
}
const { default: worker } = await import("data:text/javascript," + encodeURIComponent(await readFile(path.join(root, "_worker.js"), "utf8")));
const inputs = JSON.parse(
  await readFile(path.join(root, "data/inputs.json"), "utf8"),
);
assert.equal(inputs.zones.length, 4);
for (const z of inputs.zones)
  for (const id of Object.values(z.schedule_refs))
    assert.ok(inputs.schedules[id], id);
for (const file of (await readdir(root)).filter((f) => f.endsWith(".html"))) {
  const html = await readFile(path.join(root, file), "utf8");
  assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
  for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const target = match[1];
    if (target.startsWith("http")) continue;
    await stat(path.join(root, target.split(/[?#]/)[0]));
  }
}
const results = JSON.parse(
  await readFile(path.join(root, "data/results.json"), "utf8"),
);
assert.equal(results.areas.length, 3);
assert.equal(results.areas.find(a => a.id === "annual").status, "reviewed");
assert.equal(results.areas.find(a => a.id === "peaks").status, "reviewed");
assert.equal(results.areas.find(a => a.id === "resilience").status, "draft_first_pass");
const resilience = JSON.parse(await readFile(path.join(root, "data/resilience.json"), "utf8"));
assert.equal(resilience.release.status, "draft_first_pass");
assert.deepEqual(JSON.parse(await readFile(path.join(root, "downloads/resilience-results.json"), "utf8")), resilience);
for (const season of ["winter", "summer"]) {
  assert.equal(resilience[season].hours.length, 216);
  assert.equal(resilience[season].checks.outage_conditioning_kWh, 0);
  for (const z of Object.values(resilience[season].zones)) assert.equal(z.air_C.length, 216);
}
for (const page of ["index.html", "program.html", "model.html", "annual-energy.html", "peak-loads.html", "resilience.html", "downloads.html"]) await stat(path.join(root, page));
await assert.rejects(stat(path.join(root, "results.html")));
const moved = await worker.fetch(new Request("https://project-2624.bldgtyp.com/results.html"), { ASSETS: { fetch() { throw Error("Unexpected asset access"); } } });
assert.equal(moved.status, 301);
assert.equal(moved.headers.get("location"), "https://project-2624.bldgtyp.com/annual-energy");
assert.equal(results.design_days.conditions.length, 4);
assert.equal(results.design_days.release.source.annual_hbjson_sha256, inputs.source.sha256);
assert.equal(results.design_days.controls.sizing_average_minutes, 15);
assert.equal(results.design_days.zones.length, 4);
assert.deepEqual(JSON.parse(await readFile(path.join(root, "downloads/design-day-results.json"), "utf8")), results.design_days);
assert.equal(results.release.status, "reviewed_design_model");
assert.equal(results.release.source.hbjson_sha256, inputs.source.sha256);
assert.equal(results.release.source.idf_sha256, inputs.source.final_idf_sha256);
assert.equal(inputs.calendar.jan_1_day, "Thursday");
assert.equal(results.annual.monthly.length, 12);
for (const month of results.annual.monthly) {
  assert.ok(Math.abs(Object.values(month.end_uses_kWh).reduce((a,b) => a+b,0) - month.total_kWh) < 1e-5);
  assert.ok(Object.values(month.end_uses_kWh).every(v => Number.isFinite(v) && v >= 0));
}
assert.ok(Math.abs(results.annual.monthly.reduce((a,m)=>a+m.total_kWh,0) - results.annual.total_kWh) < 1e-6);
assert.deepEqual(JSON.parse(await readFile(path.join(root, "downloads/annual-results.json"), "utf8")), results);
await stat(path.join(root, "downloads/monthly-energy.csv"));
await stat(path.join(root, "assets/results.js"));
for (const host of [
  "bt-proj-2624-rye-nature-center.pages.dev",
  "abc.bt-proj-2624-rye-nature-center.pages.dev",
  "other.example",
]) {
  const response = await worker.fetch(
    new Request(`https://${host}/downloads/program-definitions.json`),
    {
      ASSETS: {
        fetch() {
          throw Error("Unexpected asset access");
        },
      },
    },
  );
  assert.equal(response.status, 404);
}
const response = await worker.fetch(
  new Request("https://project-2624.bldgtyp.com/program.html"),
  {
    ASSETS: {
      fetch() {
        return new Response("asset");
      },
    },
  },
);
assert.equal(await response.text(), "asset");
async function walk(dir) {
  for (const name of await readdir(dir)) {
    const file = path.join(dir, name),
      s = await stat(file);
    if (s.isDirectory()) await walk(file);
    else {
      assert.ok(s.size < 25 * 1024 * 1024, file);
      assert.ok(!/\.(?:hbjson|osm|idf|sql|epw|eso|err)$/.test(file), file);
      if (file.endsWith(".json")) assert.ok(!(await readFile(file, "utf8")).includes("/Users/"), file);
    }
  }
}
await walk(root);
console.log(
  "PASS: static links, reviewed annual data, matched source identity, monthly totals, reviewed Design-Day data, first-pass resilience package and seven pages, Pages alternate-host rejection, asset size/privacy boundary.",
);
