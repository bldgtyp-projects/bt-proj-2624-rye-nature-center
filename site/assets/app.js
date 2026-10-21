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
function showProgram(data) {
  const host = $("#program");
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
          ? `${num(l.people.people_per_area, 5)} people/m²`
          : "Not assigned",
      ],
      [
        "Lighting",
        l.lighting
          ? `${num(l.lighting.watts_per_area, 3)} W/m²`
          : "Not assigned",
      ],
      [
        "Electric equipment",
        l.electric_equipment
          ? `${num(l.electric_equipment.watts_per_area, 3)} W/m²`
          : "Not assigned",
      ],
      [
        "Gas equipment",
        l.gas_equipment
          ? `${num(l.gas_equipment.watts_per_area, 3)} W/m²`
          : "Not assigned",
      ],
      [
        "Outdoor air per person",
        l.ventilation
          ? `${num(l.ventilation.flow_per_person * 1000, 3)} L/s per person`
          : "Not assigned",
      ],
      [
        "Outdoor air per floor area",
        l.ventilation
          ? `${num(l.ventilation.flow_per_area * 1000, 4)} L/s·m²`
          : "Not assigned",
      ],
      [
        "Outdoor air per zone",
        l.ventilation
          ? `${num((l.ventilation.flow_per_zone || 0) * 1000, 3)} L/s`
          : "Not assigned",
      ],
      [
        "Outdoor air ACH",
        l.ventilation
          ? `${num(l.ventilation.air_changes_per_hour || 0, 3)} 1/h`
          : "Not assigned",
      ],
      [
        "Infiltration",
        l.infiltration
          ? `${num(l.infiltration.flow_per_exterior_area * 1000, 5)} L/s·m² exterior area`
          : "Not assigned",
      ],
      [
        "Service hot water",
        l.service_hot_water
          ? `${num(l.service_hot_water.flow_per_area, 4)} L/h·m²`
          : "Not assigned",
      ],
      ["HVAC reference", zone.hvac_id || "Not assigned"],
      ["Modeled volume", `${num(zone.volume_m3)} m³`],
      ["Program identifier", zone.program_id],
      ["Room identifier", zone.id],
    ];
    $("#zone-detail").innerHTML =
      `<div class="zone-title"><h2>${esc(zone.name)}</h2><a class="link" href="model.html?zone=${encodeURIComponent(zone.id)}">Locate in model →</a></div><div class="zone-metrics">${metric("Modeled floor area", num(zone.floor_area_m2), "m²")}${metric("Reference People", num(zone.design_people), "people")}${metric("Lighting density", l.lighting ? num(l.lighting.watts_per_area) : "None", "W/m²")}${metric("Equipment density", l.electric_equipment ? num(l.electric_equipment.watts_per_area) : "None", l.electric_equipment ? "W/m²" : "")}</div><div class="schedule-panel"><h3>Daily schedule</h3><div class="controls"><label>Input<select id="schedule">${options}</select></label><label>Scenario<select id="scenario"><option value="annual">Annual calendar</option><option value="winter_design">Winter design day</option><option value="summer_design">Summer design day</option></select></label><label id="month-label">Month<select id="month">${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((v, i) => `<option value="${i}" ${i === 6 ? "selected" : ""}>${v}</option>`).join("")}</select></label><label id="day-label">Day<select id="day"></select></label></div><div id="schedule-chart"></div><p class="caption" id="schedule-caption"></p><details><summary>Values and schedule definition</summary><div class="details-body"><p id="schedule-id"></p><div id="schedule-values"></div><details><summary>Native schedule rules</summary><pre id="schedule-definition"></pre></details></div></details></div><details><summary>All load and ventilation inputs</summary><div class="details-body">${table(loadRows)}<p class="caption">SI model inputs. Reference People is multiplied by the occupancy schedule. Shared ERV supply/extract and system controls are documented on the Results page. Heat-pump capacities remain provisional.</p></div></details><details><summary>Source and interpretation</summary><div class="details-body">${data.notes.map((n) => `<p>${esc(n)}</p>`).join("")}${provenance(data)}<details><summary>Resolved native load definitions</summary><pre>${esc(JSON.stringify(l, null, 2))}</pre></details><p><a class="link" href="downloads.html">Download inputs and full schedule CSVs →</a></p></div></details>`;
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    function fillDays() {
      const old = Number($("#day").value) || 7;
      $("#day").innerHTML = Array.from(
        { length: daysInMonth[Number($("#month").value)] },
        (_, i) =>
          `<option value="${i + 1}" ${i + 1 === Math.min(old, daysInMonth[Number($("#month").value)]) ? "selected" : ""}>${i + 1}</option>`,
      ).join("");
    }
    fillDays();
    function draw() {
      const id = $("#schedule").value,
        schedule = data.schedules[id],
        scenario = $("#scenario").value;
      const month = Number($("#month").value),
        day = Number($("#day").value),
        doy = daysInMonth.slice(0, month).reduce((a, b) => a + b, 0) + day - 1;
      const values =
        scenario === "annual"
          ? schedule.profiles[schedule.annual_days[doy]]
          : schedule[scenario];
      $("#month-label").hidden = $("#day-label").hidden = scenario !== "annual";
      const max = Math.max(...values),
        min = Math.min(0, ...values),
        top = max === min ? min + 1 : max,
        range = top - min;
      const x = (i) => 55 + (i / 96) * 710,
        y = (v) => 205 - ((v - min) / range) * 165;
      let d = `M ${x(0)} ${y(values[0])}`;
      values.forEach((v, i) => {
        if (i) d += ` H ${x(i)} V ${y(v)}`;
      });
      d += ` H ${x(96)}`;
      const title = `${$("#schedule").selectedOptions[0].textContent}: ${scenario === "annual" ? `${month + 1}/${day}` : $("#scenario").selectedOptions[0].textContent}; unit ${schedule.unit}`;
      $("#schedule-chart").innerHTML =
        `<svg class="chart" viewBox="0 0 800 250" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${[0, 0.5, 1].map((v) => `<line class="grid" x1="55" y1="${y(min + v * range)}" x2="765" y2="${y(min + v * range)}"/><text x="44" y="${y(min + v * range) + 4}" text-anchor="end">${num(min + v * range, 2)}</text>`).join("")}<path class="area" d="${d} V 205 H 55 Z"/><path class="trace" d="${d}"/>${[0, 6, 12, 18, 24].map((v) => `<text x="${x(v * 4)}" y="230" text-anchor="middle">${String(v).padStart(2, "0")}:00</text>`).join("")}<text x="55" y="20">${esc(schedule.unit)}</text></svg>`;
      $("#schedule-caption").textContent =
        `${title}. 15-minute intervals. Annual calendar: Jan 1 = ${data.calendar.jan_1_day}. Local standard time; interval-start labels.`;
      $("#schedule-id").innerHTML = `Schedule: <code>${esc(id)}</code>`;
      $("#schedule-definition").textContent = JSON.stringify(
        schedule.definition,
        null,
        2,
      );
      $("#schedule-values").innerHTML = table(
        values.map((v, i) => [
          `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`,
          String(v),
          schedule.unit,
        ]),
        ["Interval start", "Value", "Unit"],
      );
    }
    $("#month").addEventListener("change", () => {
      fillDays();
      draw();
    });
    ["schedule", "scenario", "day"].forEach((id) =>
      $("#" + id).addEventListener("change", draw),
    );
    draw();
  }
  renderZone();
}
async function showResults() {
  const results = await getData("data/results.json");
  const { renderResults } = await import("./results.js");
  renderResults(results, $("#results"), { esc, num, metric, table });
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
      const { showModel } = await import("./viewer.js");
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
