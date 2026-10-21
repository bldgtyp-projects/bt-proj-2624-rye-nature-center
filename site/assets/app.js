// Same asset version as this module, so a new release never mixes cached scripts.
const units = await import("./units.js" + new URL(import.meta.url).search);
const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const num = (value, digits = 1) =>
  Number(value).toLocaleString("en-US", { maximumFractionDigits: digits });
const labels = {
  "people.occupancy_schedule": "Occupancy",
  "people.activity_schedule": "Activity per person",
  "lighting.schedule": "Lighting",
  "electric_equipment.schedule": "Equipment",
  "gas_equipment.schedule": "Gas equipment",
  "service_hot_water.schedule": "Service hot water",
  "ventilation.schedule": "Ventilation multiplier",
  "infiltration.schedule": "Infiltration multiplier",
  "setpoint.heating_schedule": "Heating setpoint",
  "setpoint.cooling_schedule": "Cooling setpoint",
  "setpoint.humidifying_schedule": "Humidification",
  "setpoint.dehumidifying_schedule": "Dehumidification",
};
async function getData(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}
function fail(target, error) {
  target.innerHTML = `<p class="error" role="alert">This data could not be loaded. Reload the page or use the <a href="downloads.html">data downloads</a>.</p>`;
  console.error(error);
}
function metric(label, value, unit) {
  return `<div><span class="metric-label">${label}</span><span class="metric-value">${value}</span><span class="metric-unit">${unit}</span></div>`;
}
function table(rows, head = ["Input", "Value"]) {
  return `<div class="table-wrap"><table><thead><tr>${head.map((v) => `<th scope="col">${esc(v)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function provenance(data) {
  return `<p>Source: <code>${esc(data.source.path)}</code></p><p>Snapshot SHA-256: <code class="source-hash">${esc(data.source.sha256)}</code></p><p>Exported: ${esc(data.exported_at)}<br>Honeybee Core ${esc(data.source.honeybee_core)} · Honeybee Energy ${esc(data.source.honeybee_energy)}</p><p>${esc(data.calendar.time_basis)}</p>`;
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function showProgram(data) {
  const host = $("#program");
  // Monday-start weeks over the model calendar; days outside the year are blank.
  const days365 = data.calendar.days;
  const firstDay = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(data.calendar.jan_1_day);
  const dateOf = (doy) => new Date(Date.UTC(data.calendar.year, 0, 1 + doy));
  const fmtDate = (doy) => `${MONTHS[dateOf(doy).getUTCMonth()]} ${dateOf(doy).getUTCDate()}`;
  const offset = (firstDay + 6) % 7;
  const weeks = [];
  for (let start = -offset; start < days365; start += 7)
    weeks.push({ days: Array.from({ length: 7 }, (_, n) => start + n), label: `${fmtDate(start)} – ${fmtDate(start + 6)}` });
  const october = weeks.findIndex((w) => dateOf(w.days[0]).getUTCMonth() === 9);
  const selected = new URLSearchParams(location.search).get("zone");
  let zone = data.zones.find((z) => z.id === selected) || data.zones[0];
  host.innerHTML = `<div class="zone-selector" aria-label="Choose a thermal zone">${data.zones.map((z) => `<button type="button" data-zone="${esc(z.id)}" aria-pressed="false">${esc(z.name)}</button>`).join("")}</div><section id="zone-detail" aria-label="Selected zone inputs"></section>`;
  host.querySelectorAll("[data-zone]").forEach((button) =>
    button.addEventListener("click", () => {
      zone = data.zones.find((z) => z.id === button.dataset.zone);
      const url = new URL(location);
      url.searchParams.set("zone", zone.id);
      history.replaceState(null, "", url);
      renderZone();
    }),
  );
  function renderZone() {
    host
      .querySelectorAll("[data-zone]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.zone === zone.id)),
      );
    const l = zone.loads;
    const options = Object.entries(zone.schedule_refs)
      .map(
        ([key, id]) =>
          `<option value="${esc(id)}">${esc(labels[key] || key)}</option>`,
      )
      .join("");
    const loadRows = [
      ["Reference People", `${num(zone.design_people, 2)} people`],
      [
        "People density",
        l.people
          ? units.fmt(l.people.people_per_area, "occupant_density")
          : "Not assigned",
      ],
      [
        "Lighting",
        l.lighting
          ? units.fmt(l.lighting.watts_per_area, "power_density")
          : "Not assigned",
      ],
      [
        "Electric equipment",
        l.electric_equipment
          ? units.fmt(l.electric_equipment.watts_per_area, "power_density")
          : "Not assigned",
      ],
      [
        "Gas equipment",
        l.gas_equipment
          ? units.fmt(l.gas_equipment.watts_per_area, "power_density")
          : "Not assigned",
      ],
      [
        "Outdoor air per person",
        l.ventilation
          ? units.fmt(l.ventilation.flow_per_person, "airflow_per_person")
          : "Not assigned",
      ],
      [
        "Outdoor air per floor area",
        l.ventilation
          ? units.fmt(l.ventilation.flow_per_area, "airflow_per_area")
          : "Not assigned",
      ],
      [
        "Outdoor air per zone",
        l.ventilation
          ? units.fmt(l.ventilation.flow_per_zone || 0, "airflow")
          : "Not assigned",
      ],
      [
        "Outdoor air ACH",
        l.ventilation
          ? `${num(l.ventilation.air_changes_per_hour || 0, 3)} ACH`
          : "Not assigned",
      ],
      [
        "Infiltration",
        l.infiltration
          ? `${units.fmt(l.infiltration.flow_per_exterior_area, "airflow_per_area", 4)} of exterior area`
          : "Not assigned",
      ],
      [
        "Service hot water",
        l.service_hot_water
          ? units.fmt(l.service_hot_water.flow_per_area, "hot_water_per_area", 2)
          : "Not assigned",
      ],
      ["HVAC reference", zone.hvac_id || "Not assigned"],
      ["Modeled volume", units.fmt(zone.volume_m3, "volume")],
      ["Program identifier", zone.program_id],
      ["Room identifier", zone.id],
    ];
    $("#zone-detail").innerHTML =
      `<div class="zone-title"><h2>${esc(zone.name)}</h2><a class="link" href="model.html?zone=${encodeURIComponent(zone.id)}">Locate in model →</a></div><div class="zone-metrics">${metric("Modeled floor area", units.number(zone.floor_area_m2, "area"), units.label("area"))}${metric("Reference People", num(zone.design_people), "people")}${metric("Lighting density", l.lighting ? units.number(l.lighting.watts_per_area, "power_density") : "None", l.lighting ? units.label("power_density") : "")}${metric("Equipment density", l.electric_equipment ? units.number(l.electric_equipment.watts_per_area, "power_density") : "None", l.electric_equipment ? units.label("power_density") : "")}</div><div class="schedule-panel"><h3>Schedule</h3><div class="controls"><label>Input<select id="schedule">${options}</select></label><label>Scenario<select id="scenario"><option value="annual">Annual calendar</option><option value="winter_design">Winter design day</option><option value="summer_design">Summer design day</option></select></label><label id="week-label">Week<select id="week">${weeks.map((w, i) => `<option value="${i}" ${i === october ? "selected" : ""}>${esc(w.label)}</option>`).join("")}</select></label></div><div id="schedule-chart"></div><div id="schedule-year"></div><p class="caption" id="schedule-caption"></p><details><summary>Values and schedule definition</summary><div class="details-body"><p id="schedule-id"></p><div id="schedule-values"></div><details><summary>Native schedule rules</summary><pre id="schedule-definition"></pre></details></div></details></div><details><summary>All load and ventilation inputs</summary><div class="details-body">${table(loadRows)}<p class="caption">Shown in US units; the model inputs and downloads are SI. Reference People is multiplied by the occupancy schedule. Shared ERV supply/extract and system controls are documented on the Annual energy page. Heat-pump capacities remain provisional.</p></div></details><details><summary>Source and interpretation</summary><div class="details-body">${data.notes.map((n) => `<p>${esc(n)}</p>`).join("")}${provenance(data)}<details><summary>Resolved native load definitions</summary><pre>${esc(JSON.stringify(l, null, 2))}</pre></details><p><a class="link" href="downloads.html">Download inputs and full schedule CSVs →</a></p></div></details>`;
    // Fractions start at zero; schedules that never approach zero (setpoints) start just below their minimum.
    function chartValues(values) {
      const min = Math.min(...values), hi = Math.max(...values);
      const lo = min > 0 && min >= 0.5 * hi ? Math.floor(min) - 1 : Math.min(0, min);
      return [lo, hi === lo ? lo + 1 : hi];
    }
    // Step trace and filled area; null values (days outside the year) break the line.
    function stepPaths(values, x, y, base) {
      const segments = [];
      values.forEach((v, i) => {
        if (v === null) return;
        if (values[i - 1] == null) segments.push({ start: x(i), d: `M ${x(i)} ${y(v)}` });
        else segments.at(-1).d += ` H ${x(i)} V ${y(v)}`;
        if (values[i + 1] == null) segments.at(-1).d += ` H ${x(i + 1)}`;
      });
      return {
        trace: segments.map((s) => s.d).join(" "),
        area: segments.map((s) => `${s.d} V ${base} H ${s.start} Z`).join(" "),
      };
    }
    function drawDesignDay(schedule, values, title) {
      const [min, top] = chartValues(values), range = top - min;
      const x = (i) => 55 + (i / 96) * 710,
        y = (v) => 205 - ((v - min) / range) * 165;
      const path = stepPaths(values, x, y, 205);
      $("#schedule-chart").innerHTML =
        `<svg class="chart" viewBox="0 0 800 250" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${[0, 0.5, 1].map((v) => `<line class="grid" x1="55" y1="${y(min + v * range)}" x2="765" y2="${y(min + v * range)}"/><text x="44" y="${y(min + v * range) + 4}" text-anchor="end">${num(min + v * range, 2)}</text>`).join("")}<path class="area" d="${path.area}"/><path class="trace" d="${path.trace}"/>${[0, 6, 12, 18, 24].map((v) => `<text x="${x(v * 4)}" y="230" text-anchor="middle">${String(v).padStart(2, "0")}:00</text>`).join("")}<text x="55" y="20">${esc(schedule.unit)}</text></svg>`;
      $("#schedule-year").innerHTML = "";
      $("#schedule-values").innerHTML = table(
        values.map((v, i) => [
          `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`,
          num(v, 2),
          schedule.unit,
        ]),
        ["Interval start", "Value", "Unit"],
      );
    }
    function drawWeek(schedule, week, title) {
      const days = week.days.map((doy) => (doy >= 0 && doy < days365 ? schedule.profiles[schedule.annual_days[doy]] : null));
      const values = days.flatMap((p) => p ?? Array(96).fill(null));
      const [min, top] = chartValues(values.filter((v) => v !== null)), range = top - min;
      const x = (i) => 55 + (i / 672) * 830,
        y = (v) => 205 - ((v - min) / range) * 165;
      const path = stepPaths(values, x, y, 205);
      const labels = week.days.map((doy, n) => {
        const date = dateOf(doy), weekend = n >= 5;
        return `${weekend ? `<rect class="weekend" x="${x(n * 96)}" y="40" width="${x(96) - x(0)}" height="165"/>` : ""}<line class="grid" x1="${x(n * 96)}" x2="${x(n * 96)}" y1="40" y2="214"/><text x="${x(n * 96 + 48)}" y="230" text-anchor="middle">${DAY_NAMES[n]} ${date.getUTCDate()}</text>${doy < 0 || doy >= days365 ? `<text x="${x(n * 96 + 48)}" y="128" text-anchor="middle">Outside ${data.calendar.year}</text>` : ""}`;
      }).join("");
      $("#schedule-chart").innerHTML =
        `<div class="schedule-chart-wrap"><svg class="chart week-chart" viewBox="0 0 900 250" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${labels}${[0, 0.5, 1].map((v) => `<line class="grid" x1="55" y1="${y(min + v * range)}" x2="885" y2="${y(min + v * range)}"/><text x="44" y="${y(min + v * range) + 4}" text-anchor="end">${num(min + v * range, 2)}</text>`).join("")}<path class="area" d="${path.area}"/><path class="trace" d="${path.trace}"/><text x="55" y="20">${esc(schedule.unit)}</text></svg></div><p class="caption chart-scroll-hint">Scroll the chart horizontally to see all seven days.</p>`;
      drawYear(schedule, week);
      $("#schedule-values").innerHTML = table(
        week.days.flatMap((doy, n) => {
          if (doy < 0 || doy >= days365) return [];
          const v = schedule.profiles[schedule.annual_days[doy]];
          return [[fmtDate(doy), DAY_NAMES[n], num(Math.min(...v), 2), num(v.reduce((a, b) => a + b, 0) / 96, 3), num(Math.max(...v), 2), schedule.unit]];
        }),
        ["Date", "Day", "Minimum", "Daily mean", "Maximum", "Unit"],
      );
    }
    function drawYear(schedule, week) {
      const means = schedule.annual_days.map((id) => schedule.profiles[id].reduce((a, b) => a + b, 0) / 96);
      const [lo, hi] = chartValues(means);
      const x = (doy) => 55 + (doy / days365) * 830, y = (v) => 95 - ((v - lo) / (hi - lo)) * 75, w = 830 / days365;
      const monthStarts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
      const bars = means.map((v, doy) => `<rect x="${x(doy).toFixed(2)}" y="${y(v).toFixed(2)}" width="${Math.max(w - 0.4, 0.8).toFixed(2)}" height="${(95 - y(v)).toFixed(2)}"/>`).join("");
      const ws = Math.max(week.days[0], 0), we = Math.min(week.days[6] + 1, days365);
      $("#schedule-year").innerHTML =
        `<h4 class="year-title">Through the year · daily mean</h4><svg class="chart year-chart" viewBox="0 0 900 125" role="img" aria-label="Daily mean of the selected schedule for each day of ${data.calendar.year}. Select a point to show that week."><title>Daily mean through the year</title><rect class="week-mark" x="${x(ws)}" y="14" width="${x(we) - x(ws)}" height="86"/><g class="year-bars">${bars}</g><line class="grid" x1="55" x2="885" y1="95" y2="95"/><text x="44" y="${y(hi) + 4}" text-anchor="end">${num(hi, 2)}</text><text x="44" y="99" text-anchor="end">${num(lo, 2)}</text>${monthStarts.map((s, i) => `<line class="grid" x1="${x(s)}" x2="${x(s)}" y1="95" y2="101"/><text x="${x(s) + 3}" y="116">${MONTHS[i]}</text>`).join("")}</svg><p class="caption">Each bar is one day's average. Select a point on the strip to show that week above.</p>`;
      $("#schedule-year svg").addEventListener("click", (event) => {
        const box = event.currentTarget.getBoundingClientRect();
        const doy = Math.floor(((event.clientX - box.left) / box.width * 900 - 55) / 830 * days365);
        if (doy < 0 || doy >= days365) return;
        $("#week").value = String(weeks.findIndex((w) => w.days.includes(doy)));
        draw();
      });
    }
    // Schedules are SI in the data; temperature and per-person power schedules display in IP.
    function displaySchedule(s) {
      const kind = units.SCHEDULE_KINDS[s.unit];
      if (!kind) return s;
      const c = (v) => units.value(v, kind);
      const profiles = Array.isArray(s.profiles) ? s.profiles.map((p) => p.map(c)) : Object.fromEntries(Object.entries(s.profiles).map(([k, p]) => [k, p.map(c)]));
      return { ...s, unit: units.label(kind), profiles, winter_design: s.winter_design.map(c), summer_design: s.summer_design.map(c) };
    }
    function draw() {
      const id = $("#schedule").value,
        schedule = displaySchedule(data.schedules[id]),
        scenario = $("#scenario").value;
      $("#week-label").hidden = scenario !== "annual";
      const week = weeks[Number($("#week").value)];
      const title = `${$("#schedule").selectedOptions[0].textContent}: ${scenario === "annual" ? `week of ${week.label}` : $("#scenario").selectedOptions[0].textContent}; unit ${schedule.unit}`;
      if (scenario === "annual") drawWeek(schedule, week, title);
      else drawDesignDay(schedule, schedule[scenario], title);
      $("#schedule-caption").textContent =
        `${title}. 15-minute intervals${scenario === "annual" ? "; weekends shaded" : ""}. Annual calendar: Jan 1 = ${data.calendar.jan_1_day}. Local standard time; interval-start labels.`;
      $("#schedule-id").innerHTML = `Schedule: <code>${esc(id)}</code>`;
      $("#schedule-definition").textContent = JSON.stringify(
        schedule.definition,
        null,
        2,
      );
    }
    ["schedule", "scenario", "week"].forEach((id) =>
      $("#" + id).addEventListener("change", draw),
    );
    draw();
  }
  renderZone();
}
async function showResults() {
  const host = $("#results");
  const area = host.dataset.area;
  const results = await getData(area === "resilience" ? "data/resilience.json" : "data/results.json");
  const renderers = await import("./results.js" + new URL(import.meta.url).search);
  const render = { annual: renderers.renderAnnual, peaks: renderers.renderPeaks, resilience: renderers.renderResilience }[area];
  render(results, host, { esc, num, metric, table, units });
  if (location.hash)
    document.getElementById(location.hash.slice(1))?.scrollIntoView();
}
async function start() {
  if ($("#results")) await showResults().catch((e) => fail($("#results"), e));
  if (!$("#program") && !$("#viewer") && !$("#provenance")) return;
  let data;
  try {
    data = await getData("data/inputs.json");
  } catch (e) {
    fail($("#program") || $("#viewer") || $("#provenance"), e);
    return;
  }
  if ($("#program")) showProgram(data);
  if ($("#provenance")) $("#provenance").innerHTML = provenance(data);
  if ($("#viewer")) {
    try {
      const { showModel } = await import("./viewer.js" + new URL(import.meta.url).search);
      await showModel(data);
    } catch (e) {
      fail($("#viewer"), e);
    }
  }
}
start().catch((e) => {
  console.error(e);
  const host = $("#zone-detail") || $("#main");
  fail(host, e);
});
