import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../site/", import.meta.url));
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
assert.equal(results.areas.find(a => a.id === "resilience").status, "pending");
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
  "PASS: static links, reviewed annual data, matched source identity, monthly totals, reviewed Design-Day data and pending resilience, Pages alternate-host rejection, asset size/privacy boundary.",
);
