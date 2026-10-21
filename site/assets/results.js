// One renderer per result page; each package keeps its own status and provenance.
const refs = await import("./references.js" + new URL(import.meta.url).search);
export function renderAnnual(data, host, { esc, num, metric, table, units }) {
  const say = text => esc(units.prose(text));
  const a = data.annual;
  const release = data.release;
  if (release?.status !== "reviewed_design_model" || !a) throw Error("Missing reviewed annual package");
  const uses = a.end_uses;
  const download = `<p class="result-downloads"><a href="downloads/monthly-energy.csv" download>Monthly energy CSV ↓</a><a href="downloads/annual-results.json" download>Results and source references JSON ↓</a></p>`;
  const legend = `<ul class="energy-legend" aria-label="Energy uses">${uses.map(u => `<li><span style="background:${esc(u.color)}"></span>${esc(u.label)}</li>`).join("")}</ul>`;
  const max = Math.ceil(Math.max(...a.monthly.map(m => m.total_kWh)) / 500) * 500;
  const y = v => 310 - v / max * 260;
  const chart = `<svg class="energy-chart" viewBox="0 0 920 365" role="img" aria-label="Monthly purchased electricity in kWh, stacked by end use. Exact values are available in the table below."><title>Monthly electricity by end use</title><text x="66" y="23">kWh / month</text>${[0, .25, .5, .75, 1].map(f => `<line class="grid" x1="66" x2="900" y1="${y(max*f)}" y2="${y(max*f)}"/><text x="55" y="${y(max*f)+4}" text-anchor="end">${num(max*f,0)}</text>`).join("")}${a.monthly.map((m,i) => {
    let bottom = 0;
    const stack = uses.map(u => {
      const value = m.end_uses_kWh[u.id];
      const rect = `<rect x="${80+i*68}" y="${y(bottom+value)}" width="40" height="${value/max*260}" fill="${esc(u.color)}"><title>${esc(m.label)} · ${esc(u.label)}: ${num(value,1)} kWh</title></rect>`;
      bottom += value;
      return rect;
    }).join("");
    return `<g>${stack}<text x="${100+i*68}" y="337" text-anchor="middle">${esc(m.label)}</text></g>`;
  }).join("")}</svg>`;
  const annualBars = uses.map(u => {
    const value = a.end_uses_kWh[u.id], share = value/a.total_kWh*100;
    return `<div class="use-row"><span>${esc(u.label)}</span><div class="use-track"><span style="width:${share}%;background:${esc(u.color)}"></span></div><span>${num(value,0)} <small>kWh</small></span><span class="use-share">${num(share,1)}%</span></div>`;
  }).join("");
  const months = table(a.monthly.map(m => [m.label,...uses.map(u => num(m.end_uses_kWh[u.id],1)),num(m.total_kWh,1)]),["Month",...uses.map(u => `${u.label}, kWh`),"Total, kWh"]);
  const humidity = table(a.humidity.map(z => [z.label,z.occupied_hourly_max_RH_percent == null ? "No separate People load" : `${num(z.occupied_hourly_max_RH_percent,1)}%`,`${num(z.all_hourly_max_RH_percent,1)}%`,z.all_quarter_hour_max_RH_percent == null ? "Not reported" : `${num(z.all_quarter_hour_max_RH_percent,2)}%`]),["Zone","Occupied hourly peak RH","All-hour hourly peak RH","All-hour 15-minute peak RH"]);
  host.innerHTML = `<section class="result-section" id="annual"><p>Ground-source heat pumps, a separate shared ERV and electric hot water. Operable windows use temperature and outdoor dew-point limits. Visitor Center and Core have supplemental humidity control.</p><div class="zone-metrics annual-metrics">${metric("Annual purchased electricity",num(a.total_kWh,0),"kWh/year")}${metric("Site energy intensity",units.number(a.eui_kWh_m2_year,"eui"),units.label("eui"))}${metric("Heating + cooling electricity",num(a.end_uses_kWh.heating+a.end_uses_kWh.cooling,0),"kWh/year")}</div><p class="caption">Before PV credit. Energy intensity uses ${units.fmt(a.floor_area_m2,"area")} of modeled floor area. Heating and cooling are the electricity the equipment uses, not thermal loads.</p>
    <div class="energy-panel"><h3>Monthly electricity</h3>${legend}<div class="energy-chart-wrap">${chart}</div><div class="month-inspector"><label>Inspect a month<select id="energy-month">${a.monthly.map((m,i)=>`<option value="${i}">${esc(m.label)}</option>`).join("")}</select></label><div id="month-summary" aria-live="polite"></div></div><details><summary>Exact monthly values</summary><div class="details-body">${months}<p class="caption">Totals may differ from the sum of rounded values.</p>${download}</div></details></div>
    <section class="annual-breakdown"><h3>Annual electricity by end use</h3>${annualBars}<p class="caption">Cooling includes supplemental dehumidifier electricity, ${num(a.dehumidification_kWh,1)} kWh/year. Hot water includes tank standby electricity. Fans and pumps include the shared ERV and heating/cooling equipment.</p></section>
    <details><summary>Humidity and comfort</summary><div class="details-body"><p>Visitor Center and Core dehumidifiers hold 60% RH, with brief overshoot. Learning Labs has no dehumidifier. Occupied hours are hours with scheduled people; Restrooms has none.</p>${humidity}<p>Occupied hourly operative temperature stays at or below ${units.say(26,"temperature")}. The cooling setpoint is unmet for ${num(a.review.occupied_cooling_unmet_hours,2)} occupied hours. Winter dry air and operative comfort are not yet assessed.</p></div></details>
    <details><summary>Systems and controls</summary><div class="details-body">${table(a.systems.map(([k,v]) => [k,{ html: refs.cite(esc(units.prose(v))) }]),["System","Model input"])}<p>Fan performance, heat-pump curves and ground-loop temperatures need MEP equipment selections.</p></div></details>
    <details><summary>Calculation and sources</summary><div class="details-body"><p>${say(a.calculation)}</p><p>Weather: ${refs.link("tmyx", release.source.weather_description)}.</p>${table([["EnergyPlus",{ html: refs.link("energyplus", release.source.energyplus) }],["OpenStudio",{ html: refs.link("openstudio", release.source.openstudio) }],["Weather file",{ html: refs.link("tmyx", release.source.weather) }],["HBJSON SHA-256",release.source.hbjson_sha256]],["Source","Value"])}${download}</div></details></section>`;
  const hint = document.createElement('p');
  hint.className = 'caption chart-scroll-hint';
  hint.textContent = 'Scroll the chart horizontally to see all 12 months. Exact values are available below.';
  host.querySelector('.energy-chart-wrap').after(hint);
  const select = host.querySelector("#energy-month");
  function inspectMonth() {
    const m = a.monthly[Number(select.value)];
    host.querySelector("#month-summary").innerHTML = `<p><strong>${esc(m.label)} · ${num(m.total_kWh,0)} kWh</strong></p><p>${uses.map(u=>`${esc(u.label)} ${num(m.end_uses_kWh[u.id],0)}`).join(" · ")} kWh</p>`;
  }
  select.addEventListener("change",inspectMonth);
  inspectMonth();
}

export function renderPeaks(data, host, helpers) {
  const d = data.design_days;
  const order = [...d.conditions].sort((a, b) => (a.season === "heating" ? 0 : 1) - (b.season === "heating" ? 0 : 1));
  host.innerHTML = renderDesignDays(d, helpers, order);
  // Design-day cards act as tabs: one condition's detail panel is open at a time.
  const cards = [...host.querySelectorAll(".condition-card")];
  const panel = host.querySelector("#condition-panel");
  function select(index) {
    cards.forEach((c, i) => c.setAttribute("aria-selected", String(i === index)));
    panel.innerHTML = conditionPanel(d, order[index], helpers);
  }
  cards.forEach((card, i) => card.addEventListener("click", () => select(i)));
  host.querySelector(".condition-cards").addEventListener("keydown", (event) => {
    const now = cards.findIndex(c => c.getAttribute("aria-selected") === "true");
    const next = { ArrowRight: now + 1, ArrowLeft: now - 1 }[event.key];
    if (next === undefined) return;
    const i = (next + cards.length) % cards.length;
    select(i);
    cards[i].focus();
  });
  select(0);
}

// What each standard design day is for, keyed by its short label.
const CONDITION_ROLE = {
  "Winter DB": ["Winter, coldest dry bulb", "The coldest design hour, held all day with no sun. Sets the heating load."],
  "Summer DB": ["Summer, hottest dry bulb", "Peak air temperature with its typical humidity. Usually sets sensible cooling."],
  "Summer DP": ["Summer, most humid", "Peak dew point with its typical temperature. Tests moisture removal."],
  "Summer WB": ["Summer, highest wet bulb", "The most heat and moisture together. Usually sets total cooling."],
};
const sameCondition = (a, b) => a.toUpperCase() === b.toUpperCase();
const clockOf = (hour, minute) => hour === 24 && !minute ? "midnight" : `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
const minutes = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// Which building peaks each design day produced.
function peaksOn(d, condition, units) {
  const c = d.coil_peaks, comp = d.room_load_components, out = [];
  if (sameCondition(comp.heating_condition, condition.name)) out.push(`room heating ${units.fmt(d.coincident_room_loads_W.heating, "load")}`);
  if (sameCondition(c.heating_condition, condition.name)) out.push(`heat-pump heating ${units.fmt(c.heating_W, "load")}`);
  if (sameCondition(comp.cooling_condition, condition.name)) out.push(`room sensible cooling ${units.fmt(d.coincident_room_loads_W.cooling, "load")}`);
  if (sameCondition(c.sensible_cooling_condition, condition.name)) out.push(`heat-pump sensible cooling ${units.fmt(c.sensible_cooling_W, "load")}`);
  if (sameCondition(c.total_cooling_condition, condition.name)) out.push(`heat-pump total cooling ${units.fmt(c.total_cooling_W, "load")}`);
  return out;
}

// The 24 hours of outdoor air a design day ran with, in display units, with the heat-pump peak marked.
function dayChart(d, cond, { esc, num, units }) {
  const T = v => units.value(v, "temperature"), F = units.label("temperature");
  const db = cond.outdoor_hourly.dry_bulb_C.map(T), dp = cond.outdoor_hourly.dew_point_C.map(T);
  // Whole 5-degree steps with headroom, so a flat winter day still gets a readable axis.
  const all = [...db, ...dp], yStep = Math.max(...all) - Math.min(...all) > 30 ? 10 : 5;
  const yMin = Math.floor((Math.min(...all) - 2) / yStep) * yStep, yMax = Math.ceil((Math.max(...all) + 2) / yStep) * yStep;
  const x = h => 52 + h / 24 * 528, y = v => 180 - (v - yMin) / (yMax - yMin) * 150;
  const line = values => values.map((v, i) => `${i ? "L" : "M"}${x(i + 0.5).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const ticks = []; for (let v = yMin; v <= yMax + 1e-9; v += yStep) ticks.push(v);
  const c = d.coil_peaks, marks = [];
  if (sameCondition(c.heating_condition, cond.name)) marks.push([c.heating_hour, c.heating_minute, "Heat-pump heating peak"]);
  if (sameCondition(c.total_cooling_condition, cond.name)) marks.push([c.total_cooling_hour, c.total_cooling_minute, "Heat-pump cooling peak"]);
  const hourLabels = [[0, "12 am"], [6, "6 am"], [12, "noon"], [18, "6 pm"], [24, "12 am"]];
  return `<div class="day-chart"><ul class="energy-legend" aria-label="Chart series"><li><span style="background:var(--highlight)"></span>Outdoor dry bulb</li><li><span style="background:var(--accent)"></span>Outdoor dew point</li></ul>
  <svg class="chart" viewBox="0 0 600 215" role="img" aria-label="${esc(`Hourly outdoor dry bulb and dew point on the ${cond.label} design day, ${F}.`)}"><title>${esc(`Outdoor air over the ${cond.label} design day`)}</title>
  ${ticks.map(v => `<line class="grid" x1="52" x2="580" y1="${y(v)}" y2="${y(v)}"/><text x="44" y="${y(v) + 4}" text-anchor="end">${num(v, 0)}</text>`).join("")}<text x="8" y="16">${esc(F)}</text>
  ${hourLabels.map(([h, l]) => `<line class="grid" x1="${x(h)}" x2="${x(h)}" y1="180" y2="186"/><text x="${x(h)}" y="202" text-anchor="middle">${l}</text>`).join("")}
  ${marks.map(([h, m, l]) => { const px = x(Math.min(24, h + m / 60)); return `<line class="limit" x1="${px}" x2="${px}" y1="30" y2="180"/><text class="limit-label" x="${px - 6}" y="26" text-anchor="end">${esc(l)}, ${clockOf(h, m)}</text>`; }).join("")}
  <path d="${line(db)}" fill="none" style="stroke:var(--highlight)" stroke-width="2.4"><title>Outdoor dry bulb</title></path><path d="${line(dp)}" fill="none" style="stroke:var(--accent)" stroke-width="2.4" stroke-dasharray="5 4"><title>Outdoor dew point</title></path></svg>
  <p class="caption">Hourly averages of the outdoor air the model used: dry bulb at the ERV outdoor-air inlet and site dew point.${cond.daily_range_K > 0 ? ` Temperature follows ASHRAE's ${refs.link("design_day", "standard daily curve")}; the dew point falls overnight only where the air reaches saturation.` : " The winter design day holds one temperature, saturated, all day."}</p></div>`;
}

function conditionPanel(d, cond, { esc, num, table, units }) {
  const [title, role] = CONDITION_ROLE[cond.label] ?? [cond.label, ""];
  const date = `${MONTHS[cond.month - 1]} ${cond.day}`;
  const sun = cond.sky_model === "ASHRAEClearSky" && cond.sky_clearness === 0 ? "no sun (sky clearness 0)" : "clear-sky sun (ASHRAE tau model)";
  const temperature = cond.daily_range_K > 0
    ? `${units.fmt(cond.dry_bulb_C, "temperature")} afternoon peak, ${units.fmt(cond.dry_bulb_C - cond.daily_range_K, "temperature")} overnight low (daily range ${units.fmt(cond.daily_range_K, "temperature_delta")})`
    : `${units.fmt(cond.dry_bulb_C, "temperature")} all day and night (no daily range)`;
  const moisture = `${cond.humidity_basis === "Dewpoint" ? "dew point" : "wet bulb"} ${units.fmt(cond.humidity_value_C, "temperature")}`;
  const setpoints = `${units.say(d.controls.heating_setpoint_C, "temperature")} / ${units.say(d.controls.cooling_setpoint_C, "temperature")}`;
  const program = cond.season === "heating"
    ? `Winter design-day program: nobody in the building, lights and equipment off, the ERV supplying its full outdoor-air schedule all day, setpoints held at ${setpoints}.`
    : `Summer design-day program: every zone at its full design occupancy through its program hours, with lights, equipment and ERV airflow following occupancy, setpoints held at ${setpoints}.`;
  const peaks = peaksOn(d, cond, units);
  const checks = table(d.zones.map(z => {
    const v = z.conditions.find(x => sameCondition(x.name, cond.name));
    return [z.label, units.number(v.min_air_C, "temperature"), units.number(v.max_air_C, "temperature"), `${num(v.max_RH_percent, 1)}%`, units.number(v.max_backup_W, "power")];
  }), ["Zone", `Lowest air ${units.label("temperature")}`, `Highest air ${units.label("temperature")}`, "Peak RH", `Backup heat ${units.label("power")}`]);
  return `<h3>${esc(title)} · ${esc(date)}</h3><p>${esc(role)}</p>
  <dl class="facts condition-facts"><div><dt>Outdoor air</dt><dd>${esc(temperature)}</dd></div><div><dt>Coincident moisture</dt><dd>${esc(moisture)}</dd></div><div><dt>Sun and wind</dt><dd>${esc(sun)}; wind ${esc(units.fmt(cond.wind_m_s, "wind_speed"))}</dd></div><div><dt>How rare</dt><dd>${cond.season === "heating" ? `Colder than this about 35 hours in a typical year (${esc(cond.annual_percentile)} of hours)` : `Exceeded about 35 hours in a typical year (${esc(cond.annual_percentile)} of hours)`}</dd></div><div><dt>Peaks set on this day</dt><dd>${peaks.length ? esc(peaks.join("; ")) : "None of the building peaks"}</dd></div></dl>
  ${dayChart(d, cond, { esc, num, units })}
  <p class="caption">${esc(program)}</p>
  <details><summary>Zone conditions on this day</summary><div class="details-body">${checks}<p class="caption">Zone air temperature and humidity with the modeled heat pumps running at their provisional capacities. Backup electric heat is available in every zone.</p></div></details>`;
}

function renderDesignDays(d, { esc, num, metric, table, units }, order = d.conditions) {
  const kbtuh = units.label("load");
  if (d?.release?.status !== "reviewed_design_model") throw Error("Missing reviewed Design-Day package");
  const condition = name => d.conditions.find(c => sameCondition(c.name, name));
  const at = p => `${condition(p.condition)?.label ?? p.condition}, ${clockOf(p.hour, p.minute)}`;
  const room = d.coincident_room_loads_W, coil = d.coil_peaks, h = d.room_to_coil.heating, cl = d.room_to_coil.cooling, comp = d.room_load_components;
  const COLOR = { heat: "#b65e38", heatLight: "#c98a6c", cool: "#527f9b", coolLight: "#7fa3b9", latent: "#7f8f6a", other: "var(--text-secondary)" };
  const bars = (rows, max) => rows.map(([name, value, color, sign = ""]) => `<div class="peak-row"><span>${name}</span><div class="use-track"><span style="width:${Math.abs(value) / max * 100}%;background:${color}"></span></div><span>${sign}${units.fmt(Math.abs(value), "load")}</span></div>`).join("");
  const signed = v => v < 0 ? "−" : "+";
  const full = step => step.runtime_fraction >= 0.999; // The coil runs the whole timestep: output is capped by the modeled unit.
  const limited = d.zones.filter(z => full(z.coil.total_cooling)), heatLimited = d.zones.filter(z => full(z.coil.heating));
  const names = list => list.map(z => z.label).join(list.length > 2 ? ", " : " and ").replace(/, ([^,]*)$/, " and $1");
  const heatingCondition = condition(coil.heating_condition), coolingCondition = condition(coil.total_cooling_condition);

  // 1. Headline: what the heat pumps must deliver, and the room loads behind it.
  const headline = `<section class="result-section peak-summary"><span class="status reviewed">Reviewed four-condition design study</span>
  <div class="zone-metrics peak-metrics">${metric("Heat-pump heating peak", units.number(coil.heating_W, "load"), `${kbtuh} · ${esc(heatingCondition.label)} day, ${clockOf(coil.heating_hour, coil.heating_minute)}`)}${metric("Heat-pump cooling peak", units.number(coil.total_cooling_W, "load"), `${kbtuh} · ${units.fmt(coil.total_cooling_W, "cooling_tons")} · ${esc(coolingCondition.label)} day, ${clockOf(coil.total_cooling_hour, coil.total_cooling_minute)}`)}</div>
  <p>All four zones together at the same moment, with no sizing margin. The room loads alone are <strong>${units.fmt(room.heating, "load")}</strong> heating and <strong>${units.fmt(room.cooling, "load")}</strong> sensible cooling. The heat pumps also condition the ERV supply air and remove moisture, so their peaks are larger.</p>
  ${limited.length ? `<p class="caption">${esc(names(limited))} ${limited.length === 1 ? "reaches" : "reach"} full heat-pump capacity at ${limited.length === 1 ? "its" : "their"} cooling peak, so actual cooling demand there may be higher than shown.${heatLimited.length ? ` ${esc(names(heatLimited))} heating also runs at full capacity at the winter peak.` : ""}</p>` : ""}
  <details><summary>Room load or heat-pump load: which to use</summary><div class="details-body">${table([
    ["What it is", `Heat the room gains or loses with its air held at ${units.say(d.controls.heating_setpoint_C, "temperature")} in winter and ${units.say(d.controls.cooling_setpoint_C, "temperature")} in summer`, "Heat the four zone heat pumps deliver in the simulation"],
    ["Includes", "Envelope conduction, infiltration, solar, people, lighting and equipment. Sensible heat only", "The room load, plus the ERV supply air, moisture removal and heat-pump fan heat"],
    ["Leaves out", "Ventilation air and moisture", "The ERV fans and heat-recovery core, which sit upstream of the rooms"],
    ["Use it for", "Comparison with a conventional block load", "Sizing the zone heat pumps"],
  ], ["", "Room load", "Heat-pump coil load"])}</div></details></section>`;

  // 2. The four design days, as cards that open one condition at a time.
  const cards = order.map((c, i) => {
    const [title] = CONDITION_ROLE[c.label] ?? [c.label];
    const peaks = peaksOn(d, c, units);
    return `<button type="button" class="condition-card" role="tab" aria-selected="false" aria-controls="condition-panel" tabindex="${i ? -1 : 0}"><span class="type-mono-label">${esc(c.season === "heating" ? `${c.annual_percentile} heating` : `${c.annual_percentile} cooling`)} · ${esc(MONTHS[c.month - 1])} ${c.day}</span><strong>${esc(title)}</strong><span class="condition-temp">${units.fmt(c.dry_bulb_C, "temperature")}</span><span class="condition-peak">${peaks.length ? `Sets: ${esc(peaks.map(p => p.replace(/ [\d,.]+ .*$/, "")).join(", "))}` : "No building peak"}</span></button>`;
  }).join("");
  const programRows = d.zones.map(z => {
    const p = d.design_day_programs[z.id], s = p.summer;
    return [z.label, s.people_peak ? `${num(s.people_peak, 0)} people, ${minutes(s.occupied[0])}–${minutes(s.occupied[1])}` : "None",
      units.fmt(s.lighting_peak_W, "load"), units.fmt(s.equipment_peak_W, "load"),
      s.ventilation === null ? "Extract only" : s.ventilation === "all_day" ? "All day" : `${minutes(s.ventilation[0])}–${minutes(s.ventilation[1])}`,
      p.winter.ventilation === null ? "Extract only" : p.winter.ventilation === "all_day" ? "All day" : `${minutes(p.winter.ventilation[0])}–${minutes(p.winter.ventilation[1])}`];
  });
  const winterGains = d.zones.every(z => !d.design_day_programs[z.id].winter.people_peak && !d.design_day_programs[z.id].winter.lighting_peak_W && !d.design_day_programs[z.id].winter.equipment_peak_W);
  const setup = [
    ["Model", "The same HBJSON as the annual run, with the same geometry, constructions, internal mass, programs and shared ERV. Only the weather and the schedules change."],
    ["Weather", { html: `No weather year. Four standard 24-hour days for White Plains / Westchester County Airport from ${refs.link("ashrae", "ASHRAE climatic design data")}, taken from the station's ${refs.link("tmyx", "design-day (DDY) file")}. EnergyPlus ${refs.link("design_day", "builds each day")}, repeats it until the building settles into a steady daily cycle, then reports that day.` }],
    ["Programs", "Every schedule has a winter and a summer design-day profile. Each winter design day uses the winter profile and each summer design day the summer profile. The daily-week calendar does not apply."],
    ["Timestep", `${d.controls.timesteps_per_hour} per hour (5 minutes). Room loads are averaged over ${d.controls.sizing_average_minutes} minutes before the peak is taken.`],
    ["Sizing margin", `None. Heating and cooling sizing factors are ${num(d.controls.heating_factor, 1)}.`],
    ["Systems", `Each zone has a water-source heat pump at its provisional capacity; the shared ERV runs first, then the heat pump, then the supplemental dehumidifier. Windows stay closed.`],
    ["Ground", { html: `Constant ${units.say(d.controls.slab_ground_C, "temperature")} slab ground. The annual run uses ${refs.link("kiva", "Kiva")}; Kiva's start-up state does not represent a design day.` }],
    ["Two kinds of load", "Room loads come from EnergyPlus zone sizing: the heat each room needs at its setpoint. Coil loads come from simulating the modeled heat pumps and ERV through the same days."],
  ];
  const conditionsSection = `<section class="result-section"><h2>The four design days</h2><p class="lead">Loads are calculated on four standard ${refs.link("ashrae", "ASHRAE design days")} for White Plains, not on a weather year.</p><p>One winter day tests heating. Three summer days test cooling: the hottest air, the most humid air and the most heat and moisture together. Each runs the building's design-day program. Select a day for its conditions and the peaks it produced.</p>
  <div class="condition-cards" role="tablist" aria-label="Design days">${cards}</div><div id="condition-panel" class="condition-panel" role="tabpanel" aria-live="polite"></div>
  <details><summary>How the daily programs apply on design days</summary><div class="details-body"><p>Design days do not follow the weekly calendar on the Program page. Each schedule carries a separate winter and summer design-day profile, chosen to bound the load.</p><ul><li><strong>Winter:</strong> ${winterGains ? "no people, lighting or equipment in any zone, so no internal heat offsets the heating load." : "internal gains as scheduled."} The ERV runs its full outdoor-air schedule all day. Setpoints stay at ${units.say(d.controls.heating_setpoint_C, "temperature")} heating and ${units.say(d.controls.cooling_setpoint_C, "temperature")} cooling with no night setback.</li><li><strong>Summer:</strong> each zone at its full design occupancy over its program hours, with lighting, equipment and ERV airflow following occupancy. Setpoints stay the same.</li></ul>${table(programRows, ["Zone", "Summer: people", `Summer: lighting peak`, `Summer: equipment peak`, "Summer: ERV outdoor air", "Winter: ERV outdoor air"])}<p class="caption">Peaks are the full design values from each program. Restrooms has no supply air; it is exhausted through the ERV. <a href="program.html">See the design-day profiles on the Program page →</a></p></div></details>
  <details><summary>How the simulation is set up</summary><div class="details-body">${table(setup, ["Setting", "Design-day study"])}</div></details></section>`;

  // 3. Zone breakdown.
  const zmax = Math.max(...d.zones.flatMap(z => [z.heating_room_load_W, z.coil.heating.W, z.sensible_cooling_room_load_W, z.coil.total_cooling.W]));
  const chart = d.zones.map(z => `<div class="peak-zone"><h4>${esc(z.label)}</h4>${bars([["Room heating", z.heating_room_load_W, COLOR.heatLight], ["Heat-pump heating", z.coil.heating.W, COLOR.heat], ["Room sensible cooling", z.sensible_cooling_room_load_W, COLOR.coolLight], ["Heat-pump total cooling", z.coil.total_cooling.W, COLOR.cool]], zmax)}</div>`).join("");
  const zoneHeating = table(d.zones.map(z => [z.label, units.number(z.heating_room_load_W, "load", 1), `${units.number(z.coil.heating.W, "load", 1)}${full(z.coil.heating) ? " · full capacity" : ""}`, units.number(z.equipment.rated_heating_W, "load", 1)]),
    ["Heating", `Room load ${kbtuh}`, `Heat-pump output ${kbtuh}`, `Rated capacity ${kbtuh}`]);
  const zoneCooling = table(d.zones.map(z => [z.label, units.number(z.sensible_cooling_room_load_W, "load", 1), units.number(z.coil.sensible_cooling.W, "load", 1), `${units.number(z.coil.total_cooling.W, "load", 1)} (${units.fmt(z.coil.total_cooling.W, "cooling_tons")})${full(z.coil.total_cooling) ? " · full capacity" : ""}`, at(z.coil.total_cooling), units.number(z.equipment.rated_total_cooling_W, "load", 1)]),
    ["Cooling", `Room sensible ${kbtuh}`, `Heat-pump sensible ${kbtuh}`, `Heat-pump total ${kbtuh}`, "Heat-pump total peak", `Rated total capacity ${kbtuh}`]);
  const equipment = table(d.zones.map(z => [z.label, units.number(z.equipment.rated_heating_W, "load"), units.number(z.equipment.rated_total_cooling_W, "load"), units.number(z.equipment.rated_total_cooling_W, "cooling_tons"), units.number(z.equipment.rated_sensible_cooling_W, "load"), units.number(z.equipment.airflow_m3_s, "airflow"), units.number(z.equipment.source_water_flow_m3_s, "water_flow")]),
    ["Zone", `Rated heating ${kbtuh}`, `Rated total cooling ${kbtuh}`, "Rated total cooling tons", `Rated sensible cooling ${kbtuh}`, `Unit air ${units.label("airflow")}`, `Water ${units.label("water_flow")}`]);
  const zonesSection = `<section class="result-section"><h2>By zone</h2><p>Each zone's own room and heat-pump peaks. Zones peak at different times, so these do not add up to the building totals.</p><div class="energy-panel"><div class="peak-chart zone-grid" role="img" aria-label="Room and heat-pump heating and cooling peaks for each zone in ${kbtuh}; exact values are in the tables below.">${chart}</div></div>
  <details><summary>Exact zone loads and rated capacities</summary><div class="details-body">${zoneHeating}${zoneCooling}<p class="caption">Rated capacities are the model's provisional heat-pump allowances at rated conditions; output at design conditions can exceed them. Heat-pump peaks are 5-minute values, timed at the end of the timestep.</p></div></details>
  <details><summary>Heat-pump allowances in the model</summary><div class="details-body"><p>Provisional allowances, not selections. Unit air is recirculated, separate from ERV outdoor air.</p>${equipment}</div></details></section>`;

  // 4. Why the heat-pump load exceeds the room load, and what the room load is made of.
  const heatMax = Math.max(h.room_sensible_W, h.ventilation_sensible_W, h.coil_W);
  const heating = bars([["Room load", h.room_sensible_W, COLOR.heat], ["ERV supply air", h.ventilation_sensible_W, COLOR.heatLight, signed(h.ventilation_sensible_W)], ["Fan heat and other", h.fan_and_other_W, COLOR.other, signed(h.fan_and_other_W)], ["Heat-pump output", h.coil_W, COLOR.heat, "= "]], heatMax);
  const cooling = bars([["Room sensible load", cl.room_sensible_W, COLOR.cool], ["ERV supply air, sensible", cl.ventilation_sensible_W, COLOR.coolLight, signed(cl.ventilation_sensible_W)], ["Fan heat and other", cl.fan_and_other_W, COLOR.other, signed(cl.fan_and_other_W)], ["Heat-pump sensible output", cl.coil_sensible_W, COLOR.cool, "= "], ["Room moisture, by difference", cl.room_latent_W, COLOR.latent, signed(cl.room_latent_W)], ["ERV supply air, moisture", cl.ventilation_latent_W, COLOR.coolLight, signed(cl.ventilation_latent_W)], ["Heat-pump total output", cl.coil_total_W, COLOR.cool, "= "]], cl.coil_total_W);
  const NAMES = { "People": "People", "Lights": "Lighting", "Equipment": "Equipment", "Infiltration": "Infiltration", "Interzone Mixing": "Air transfer between zones", "Roof": "Roof", "Exterior Wall": "Exterior walls", "Interzone Wall": "Interior walls", "Ground Contact Floor": "Slab on grade", "Fenestration Conduction": "Window conduction", "Fenestration Solar": "Window solar" };
  const rows = comp.cooling.map((c, i) => [c, comp.heating[i]]).filter(([c, w]) => [c.sensible_W, c.latent_W, w.sensible_W].some(v => Math.abs(v) > 1));
  const total = (list, f) => list.reduce((a, r) => a + r[f], 0);
  const load = v => Math.abs(units.value(v, "load")) < 0.05 ? units.number(0, "load", 1) : units.number(v, "load", 1); // Rounds to zero without a sign.
  const clock = t => { const [hh, mm] = t.split(" ")[1].split(":").map(Number); return clockOf(hh, mm); };
  const components = table([...rows.map(([c, w]) => [NAMES[c.component], load(-w.sensible_W), load(c.sensible_W), load(c.latent_W)]), ["Total", load(-total(comp.heating, "sensible_W")), load(total(comp.cooling, "sensible_W")), load(total(comp.cooling, "latent_W"))]],
    ["Component", `Heating, sensible ${kbtuh}`, `Cooling, sensible ${kbtuh}`, `Cooling, moisture ${kbtuh}`]);
  const infiltration = comp.heating.find(c => c.component === "Infiltration").sensible_W / total(comp.heating, "sensible_W");
  const series = list => `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
  const largestCooling = [...rows].sort((a, b) => b[0].sensible_W - a[0].sensible_W).slice(0, 3).map(([c]) => NAMES[c.component].toLowerCase());
  const largestHeating = [...rows].sort((a, b) => a[1].sensible_W - b[1].sensible_W).slice(0, 3).map(([, w]) => NAMES[w.component].toLowerCase());
  const loadSection = `<section class="result-section"><h2>Where the load comes from</h2><p>In winter the largest heat losses are ${esc(series(largestHeating))}; infiltration alone is ${num(infiltration * 100, 0)}% of the heating load. In summer, ${esc(series(largestCooling))} lead the sensible cooling load.</p>
  <details><summary>Room-load components at each peak</summary><div class="details-body">${components}<p class="caption">At the building room-load peaks: ${esc(clock(comp.heating_time))} on the ${esc(condition(comp.heating_condition).label)} day and ${esc(clock(comp.cooling_time))} on the ${esc(condition(comp.cooling_condition).label)} day. Totals are within 0.5% of the sizing totals. Negative cooling values reduce the load.</p></div></details>
  <details><summary>From room load to heat-pump load</summary><div class="details-body"><p>The shared ERV recovers heat but has no heating or cooling coil. Its supply air reaches each room cooler than the room in winter and warmer and more humid in summer, and the zone heat pumps make up the difference.</p><p><strong>Heating, ${esc(at(h))}.</strong> The ERV delivers ${units.fmt(h.erv_supply_m3_s, "airflow")} at ${units.say(h.erv_supply_C, "temperature")} after heat recovery.</p><div class="peak-chart steps">${heating}</div><p><strong>Cooling, ${esc(at(cl))}, the heat-pump total peak.</strong> The ERV delivers ${units.fmt(cl.erv_supply_m3_s, "airflow")} at ${units.say(cl.erv_supply_C, "temperature")}, scheduled by occupancy.</p><div class="peak-chart steps">${cooling}</div><p class="caption">Values at the heat-pump peaks, so the room loads differ slightly from the sizing totals. ERV values are hourly averages of the supply air entering each zone. Fan heat and other is the remainder; the heat-pump fans draw ${units.fmt(h.unit_fan_W, "load")} and ${units.fmt(cl.unit_fan_W, "load")} at these moments. Room moisture is heat-pump moisture removal minus ERV moisture.</p></div></details></section>`;

  // 5. Caveats and sources, closed by default.
  const src = d.release.source;
  const caveats = `<section class="result-section"><h2>Before sizing equipment</h2><p>These are design-analysis loads with generic heat pumps and a provisional ERV. They inform, but do not replace, the MEP engineer's equipment and borefield selections.</p>
  <details><summary>What to confirm before sizing</summary><div class="details-body"><ul>${d.sizing_notes.map(n => `<li>${esc(units.prose(n))}</li>`).join("")}</ul></div></details>
  <details><summary>Downloads and sources</summary><div class="details-body"><p>${esc(units.prose(d.basis))}</p>${table([["HBJSON SHA-256", src.hbjson_sha256], ["Annual HBJSON SHA-256", src.annual_hbjson_sha256], ["Final IDF SHA-256", src.idf_sha256], ["Result SQL SHA-256", src.sql_sha256], ["EnergyPlus / OpenStudio", { html: `${refs.link("energyplus", src.energyplus)} / ${refs.link("openstudio", src.openstudio)}` }], ["Design conditions", { html: refs.link("ashrae", "2025 ASHRAE Handbook, Fundamentals, WMO 725037") }]], ["Source", "Value"])}<p class="result-downloads"><a href="downloads/design-day-loads.csv" download>Design-day loads CSV ↓</a><a href="downloads/design-day-results.json" download>Design-day results and source references JSON ↓</a></p></div></details></section>`;
  return headline + conditionsSection + zonesSection + loadSection + caveats;
}


const ZONE_COLORS = ["var(--accent)", "var(--highlight)", "var(--text-secondary)", "var(--accent-dark)"];
const HI_FILL = { caution: "#f2e19a", extreme_caution: "#f0b46e", danger: "#e07a5f", extreme_danger: "#b84a3e" };
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const dayLabel = stamp => `${MONTHS[Number(stamp.slice(0, 2)) - 1]} ${Number(stamp.slice(3, 5))}`;

function lineChart({ hours, series, yMin, yMax, yStep, unit, title, aria, bands = [], lines = [], outage, digits = 0 }, { esc, num }) {
  const x = h => 60 + h / (hours.length - 1) * 840, y = v => 320 - (Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin) * 290;
  const ticks = [];
  for (let v = yMin; v <= yMax + 1e-9; v += yStep) ticks.push(v);
  const days = hours.map((h, i) => [h, i]).filter(([h]) => h.endsWith("00:00"));
  return `<svg class="energy-chart outage-chart" viewBox="0 0 920 370" role="img" aria-label="${esc(aria)}"><title>${esc(title)}</title>
  ${bands.filter(b => b.from < yMax).map(b => `<rect x="60" width="840" y="${y(Math.min(b.to, yMax))}" height="${y(b.from) - y(Math.min(b.to, yMax))}" fill="${b.fill}" opacity=".35"/><text x="895" y="${y(Math.min(b.to, yMax)) + 14}" text-anchor="end">${esc(b.label)}</text>`).join("")}
  <rect class="outage-window" x="${x(outage[0])}" width="${x(outage[1]) - x(outage[0])}" y="30" height="290"/><text x="${x(outage[0]) + 6}" y="24">Power outage · 7 days</text>
  ${ticks.map(v => `<line class="grid" x1="60" x2="900" y1="${y(v)}" y2="${y(v)}"/><text x="52" y="${y(v) + 4}" text-anchor="end">${num(v, digits)}</text>`).join("")}<text x="8" y="12">${esc(unit)}</text>
  ${days.map(([h, i]) => `<line class="grid" x1="${x(i)}" x2="${x(i)}" y1="320" y2="326"/><text x="${x(i) + 3}" y="342">${esc(dayLabel(h))}</text>`).join("")}
  ${lines.map(l => `<line class="limit" x1="60" x2="900" y1="${y(l.value)}" y2="${y(l.value)}"/><text class="limit-label" x="66" y="${y(l.value) - 6}">${esc(l.label)}</text>`).join("")}
  ${series.map(s => `<path d="${s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")}" fill="none" style="stroke:${s.color}" stroke-width="${s.width ?? 2}" ${s.dash ? 'stroke-dasharray="4 4"' : ""}><title>${esc(s.label)}</title></path>`).join("")}</svg>`;
}

function legend(series, esc) {
  return `<ul class="energy-legend" aria-label="Chart series">${series.map(s => `<li><span style="background:${s.color}"></span>${esc(s.label)}</li>`).join("")}</ul>`;
}

// Axis range with about five ticks on a 1/2/2.5/5 step.
function niceRange(values) {
  let lo = Math.min(...values), hi = Math.max(...values);
  if (hi - lo < 1e-9) { lo -= 0.5; hi += 0.5; }
  const raw = (hi - lo) / 5, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => s >= raw);
  return { yMin: Math.floor(lo / step) * step, yMax: Math.ceil(hi / step) * step, yStep: step, digits: Math.max(0, -Math.floor(Math.log10(step) + 1e-9)) };
}

const DETAIL_GROUPS = [
  ["winter", "energy", "Winter outage · zone energy flows", "Hourly heat gains to each zone. Window, infiltration and window-ventilation flows are net; negative values are losses."],
  ["winter", "air_changes", "Winter outage · air change rates", "Air changes per hour by zone from infiltration, window ventilation and the ERV."],
  ["winter", "envelope", "Winter outage · envelope surfaces", "One line per surface, colored by zone; select a line to see its name. Energy values are kBtu per hour, positive toward the zone. Kiva slabs report inside-face conduction and no heat storage."],
  ["summer", "energy", "Summer outage · zone energy flows", "Hourly heat gains to each zone. Window, infiltration and window-ventilation flows are net; negative values are losses."],
  ["summer", "air_changes", "Summer outage · air change rates", "Air changes per hour by zone from infiltration, window ventilation and the ERV."],
];

function renderDetailFigures(details, season, group, zones, outage, helpers) {
  const { esc } = helpers;
  const color = zone => ZONE_COLORS[Math.max(0, zones.findIndex(z => z.id === zone))];
  const { units } = helpers;
  const KIND = { kWh: "energy", C: "temperature" };
  return details[season][group].map(fig => {
    const kind = KIND[fig.unit], unit = kind ? units.label(kind) : fig.unit;
    const convert = values => kind ? values.map(v => units.value(v, kind)) : values;
    const many = fig.series.length > zones.length;
    const rank = s => zones.findIndex(z => z.id === s.zone);
    const series = [...fig.series].sort((a, b) => rank(a) - rank(b)).map(s => ({ label: s.name, color: s.zone ? color(s.zone) : "var(--text-primary)", values: convert(s.values), width: many ? 1 : 1.8 }));
    const all = series.flatMap(s => s.values);
    const allZero = all.every(v => v === 0);
    const chart = lineChart({ hours: details.hours[season], series, unit, outage, ...niceRange(all),
      title: `${fig.title} (${unit})`, aria: `${fig.title}, hourly, ${unit}. Exact values are in the hourly data download.` }, helpers);
    const key = many ? zones.map((z, i) => ({ label: z.label, color: ZONE_COLORS[i] })) : series;
    return `<h4 class="detail-title">${esc(fig.title)} <small>${esc(unit)}</small></h4>${allZero ? `<p class="caption">Zero for every hour of this run.</p>` : ""}${legend(key, esc)}<div class="energy-chart-wrap">${chart}</div>`;
  }).join("");
}

export function renderResilience(data, host, helpers) {
  const { esc, num, metric, table, units } = helpers;
  const T = v => units.value(v, "temperature"), tF = (v, d) => units.fmt(v, "temperature", d), F = units.label("temperature");
  if (data?.release?.status !== "draft_first_pass" || !data.winter || !data.summer) throw Error("Missing resilience package");
  const { winter: w, summer: s, criteria: c, zones } = data;
  const outage = [data.outage.buffer_hours, data.outage.buffer_hours + data.outage.outage_hours];
  const refuge = zones.find(z => w.zones[z.id].refuge_occupied);
  const zoneSeries = (block, field) => zones.map((z, i) => ({ label: z.label + (z.id === refuge.id ? " (refuge)" : ""), color: ZONE_COLORS[i], values: block.zones[z.id][field].map(T), width: z.id === refuge.id ? 2.6 : 1.6 }));
  const outdoor = block => ({ label: "Outdoor air", color: "var(--border-strong)", values: block.outdoor_air_C.map(T), dash: true, width: 1.4 });
  const range = (values, step) => [Math.floor(Math.min(...values) / step) * step, Math.ceil(Math.max(...values) / step) * step];
  const wrap = (chart, series) => `${legend(series, esc)}<div class="energy-chart-wrap">${chart}</div><p class="caption chart-scroll-hint">Scroll the chart horizontally to see all nine days.</p>`;
  const sz = s.zones[refuge.id], wz = w.zones[refuge.id];
  const coldest = zones.map(z => ({ z, v: w.zones[z.id] })).sort((a, b) => a.v.air_min_C - b.v.air_min_C)[0];
  const bandLabel = id => c.heat_index_bands_C.find(b => b.id === id).label;
  const peakBand = [...c.heat_index_bands_C].reverse().find(b => sz.heat_index_max_C >= b.from_C);

  const hiSeries = zoneSeries(s, "heat_index_C");
  const hiBands = c.heat_index_bands_C.map((b, i, all) => ({ from: T(b.from_C), to: all[i + 1] ? T(all[i + 1].from_C) : 999, label: `${b.label} · ${tF(b.from_C, 0)}+`, fill: HI_FILL[b.id] }));
  const hiChart = lineChart({ hours: s.hours, series: hiSeries, yMin: 60, yMax: 120, yStep: 10, unit: `Heat index ${F}`, outage, bands: hiBands,
    title: "Summer outage: hourly zone heat index", aria: "Hourly heat index for each zone through the nine-day summer run, with NOAA heat-index bands. Exact values are in the hourly CSV download." }, helpers);
  const setSeries = zoneSeries(w, "set_C");
  const [setMin, setMax] = range(setSeries.flatMap(v => v.values), 10);
  const setChart = lineChart({ hours: w.hours, series: setSeries, yMin: Math.min(30, setMin), yMax: Math.max(80, setMax), yStep: 10, unit: `SET ${F}`, outage,
    lines: [{ value: T(c.set_threshold_C), label: `${tF(c.set_threshold_C, 0)} SET threshold` }],
    title: "Winter outage: hourly standard effective temperature", aria: "Hourly standard effective temperature for each zone through the nine-day winter run, with the 54°F threshold. Exact values are in the hourly CSV download." }, helpers);
  const airW = [...zoneSeries(w, "air_C"), outdoor(w)], airS = [...zoneSeries(s, "air_C"), outdoor(s)];
  const [wMin, wMax] = range(airW.flatMap(v => v.values), 10), [sMin, sMax] = range(airS.flatMap(v => v.values), 10);
  const airWinter = lineChart({ hours: w.hours, series: airW, yMin: wMin, yMax: wMax, yStep: 10, unit: `Air ${F}`, outage,
    lines: [{ value: T(c.cold_air_limit_C), label: tF(c.cold_air_limit_C, 0) }], title: "Winter outage: zone and outdoor air temperature", aria: "Hourly zone mean air temperature and outdoor dry-bulb temperature, winter run." }, helpers);
  const airSummer = lineChart({ hours: s.hours, series: airS, yMin: sMin, yMax: sMax, yStep: 10, unit: `Air ${F}`, outage,
    title: "Summer outage: zone and outdoor air temperature", aria: "Hourly zone mean air temperature and outdoor dry-bulb temperature, summer run." }, helpers);

  const yes = v => v ? "Yes" : "No";
  // Summarize the criteria comparison from the data rather than fixed wording.
  const names = list => list.length === zones.length ? "every zone" : list.map(z => z.label).join(", ");
  const singular = list => list.length === 1 || list.length === zones.length;
  const Names = list => names(list)[0].toUpperCase() + names(list).slice(1);
  const danger = zones.filter(z => s.zones[z.id].band_hours.danger + s.zones[z.id].band_hours.extreme_danger > 0);
  const deadly = zones.filter(z => s.zones[z.id].deadly_days > 0);
  const setOver = zones.filter(z => w.zones[z.id].refuge_occupied && w.zones[z.id].set_degree_hours_F_h > c.set_limit_F_h);
  const cold = zones.filter(z => w.zones[z.id].hours_below_cold_limit > 0);
  const outcome = [
    danger.length ? `Summer heat index reaches Danger in ${names(danger)} (${danger.map(z => `${s.zones[z.id].band_hours.danger + s.zones[z.id].band_hours.extreme_danger} h`).join(", ")})${danger.length < zones.length ? "; the other zones stay below it" : ""}.` : "Summer heat index stays below the Danger band in every zone.",
    deadly.length ? `${Names(deadly)} ${singular(deadly) ? "has" : "have"} deadly days in the summer outage.` : "No zone has a deadly day.",
    setOver.length ? `The occupied refuge exceeds the winter SET limit (${setOver.map(z => `${z.label} ${num(w.zones[z.id].set_degree_hours_F_h, 0)} °F·h`).join(", ")}).` : "The occupied refuge meets the winter SET limit.",
    cold.length ? `${Names(cold)} ${singular(cold) ? "falls" : "fall"} below 36°F air during the winter outage.` : "No zone falls below 36°F air.",
  ].join(" ");
  const criteria = table(zones.map(z => {
    const a = w.zones[z.id], b = s.zones[z.id];
    return [z.label, yes(a.refuge_occupied), `${num(a.set_degree_hours_F_h, 0)}${a.refuge_occupied ? "" : " (exempt if unoccupied)"}`, `${a.hours_below_cold_limit} h · min ${tF(a.air_min_C)}`,
      tF(b.heat_index_max_C), `${b.band_hours.danger + b.band_hours.extreme_danger} h`, `${b.deadly_days} of 7`];
  }), ["Zone", "Refuge occupancy", `Winter SET below 54°F, °F·h (limit ${num(c.set_limit_F_h, 0)})`, "Winter air below 36°F (limit 0 h)", "Summer peak heat index", "Hours in Danger or above (limit 0)", "Deadly days (limit 0)"]);
  const days = table(sz.days.map((d, i) => [dayLabel(s.hours[outage[0] + i * 24]), units.number(d.mean_air_C, "temperature"), num(d.mean_RH * 100, 0), units.number(d.t_dead_C, "temperature"), d.deadly ? "Above" : "Below"]),
    ["Outage day", `Mean air ${F}`, "Mean RH %", `Tdead ${F}`, "Mean air vs Tdead"]);
  const bands = table(zones.map(z => [z.label, ...c.heat_index_bands_C.map(b => `${s.zones[z.id].band_hours[b.id]} h`), `${168 - Object.values(s.zones[z.id].band_hours).reduce((a, b) => a + b, 0)} h`]),
    ["Zone", ...c.heat_index_bands_C.map(b => b.label), "Below Caution"]);
  const checks = block => [["Run period", `${dayLabel(block.run_period[0])} to ${dayLabel(block.run_period[1])} · ${block.hours.length} hours`],
    ["Heating and cooling delivered during outage", `${units.fmt(block.checks.outage_conditioning_kWh, "energy", 1)} (conditioned day: ${units.fmt(block.checks.conditioning_day1_kWh, "energy", 0)}, recovery day: ${units.fmt(block.checks.conditioning_day9_kWh, "energy", 0)})`],
    ["Backup electricity during outage", `${num(block.checks.outage_electricity_kWh_per_day, 1)} kWh/day`],
    ["ERV outdoor air during outage", `${units.fmt(block.checks.outage_mechanical_ventilation_m3 / block.checks.outage_ventilated_hours, "airflow_hourly")} for ${block.checks.outage_ventilated_hours} refuge hours`],
    ["Window ventilation during outage", units.fmt(block.checks.outage_window_ventilation_m3, "volume")]];
  const src = data.release.source;
  const sources = table([["HBJSON SHA-256", src.hbjson_sha256], ["Weather file", src.weather_file], ["Base weather", { html: refs.link("tmyx", "White Plains TMYx (EPW)") }], ["EnergyPlus / OpenStudio", { html: `${refs.link("energyplus", src.energyplus)} / ${refs.link("openstudio", src.openstudio)}` }]], ["Source", "Value"]);
  const download = `<p class="result-downloads"><a href="downloads/resilience-hourly.csv" download>Hourly outage data CSV ↓</a><a href="downloads/resilience-results.json" download>Outage results and source references JSON ↓</a></p>`;

  let detailData;
  async function openDetail(panel) {
    const target = panel.querySelector(".detail-figures");
    if (target.dataset.loaded) return;
    try {
      detailData ??= await fetch("data/resilience-details.json", { cache: "no-cache" }).then(r => { if (!r.ok) throw Error(`HTTP ${r.status}`); return r.json(); });
      if (detailData.release !== data.release.id) throw Error("Supporting graphs belong to a different release");
      target.innerHTML = renderDetailFigures(detailData, panel.dataset.season, panel.dataset.group, zones, outage, helpers);
      target.removeAttribute("role");
      target.dataset.loaded = "true";
    } catch (error) {
      target.innerHTML = `<p class="error" role="alert">These graphs could not be loaded. Use the hourly data download instead.</p>`;
      console.error(error);
    }
  }
  host.innerHTML = `<section class="result-section" id="resilience"><span class="status draft">First-pass results for design review</span>
  <div class="zone-metrics annual-metrics">${metric(`Summer peak heat index · ${esc(refuge.label)}`, tF(sz.heat_index_max_C), `${esc(peakBand.label)} band · ${sz.band_hours.danger + sz.band_hours.extreme_danger} h in Danger or above`)}${metric(`Winter SET below 54°F · ${esc(refuge.label)}`, num(wz.set_degree_hours_F_h, 0), `°F·h · REVIVE limit ${num(c.set_limit_F_h, 0)} °F·h`)}${metric("Coldest zone air", units.say(coldest.v.air_min_C, "temperature"), `${esc(coldest.z.label)} · ${coldest.v.hours_below_cold_limit} h below ${tF(c.cold_air_limit_C, 0)}`)}</div>
  <p class="caption">Each run covers nine days: one conditioned day, seven days with no heating, cooling or water heating, and one recovery day.${w.checks.lead_in_hours ? " A conditioned lead-in first brings the ground to its seasonal temperature." : ""} Results cover the seven outage days. ${esc(refuge.label)} is the occupied refuge, ${esc(data.outage.refuge_hours.split(",")[0])}; the other zones are unoccupied.</p>
  <div class="energy-panel"><h3>Summer outage · heat index</h3><p>Hourly heat index, ${esc(dayLabel(s.run_period[0]))} to ${esc(dayLabel(s.run_period[1]))}. Shaded bands are the ${refs.link("heat_index", "NOAA categories")}; REVIVE allows no hours in Danger or Extreme Danger.</p>${wrap(hiChart, hiSeries)}<p class="caption">EnergyPlus zone heat index, hourly mean. Extreme Danger starts at ${tF(c.heat_index_bands_C[3].from_C, 0)}, above the chart. ${esc(refuge.label)} peaks at ${tF(sz.heat_index_max_C)}, in ${esc(bandLabel(peakBand.id))}.</p></div>
  <div class="energy-panel"><h3>Winter outage · standard effective temperature</h3><p>Hourly SET, ${esc(dayLabel(w.run_period[0]))} to ${esc(dayLabel(w.run_period[1]))}. REVIVE allows at most ${num(c.set_limit_F_h, 0)} °F·h below 54°F SET over the outage.</p>${wrap(setChart, setSeries)}<p class="caption">SET at ${num(c.set_conditions.clo, 1)} clo, ${units.fmt(c.set_conditions.W_per_person, "power")} per person and ${units.fmt(c.set_conditions.air_speed_m_s, "speed")} air speed, calculated from zone air temperature, mean radiant temperature and humidity. Degree-hours sum the shortfall below 54°F for every outage hour.</p></div>
  <h3>REVIVE 2024 criteria</h3><p>${esc(outcome)} This is a reference comparison, not a certification result.</p>${criteria}<p class="caption">Summer outage hours by heat-index band:</p>${bands}
  <details><summary>Summer deadly days · ${esc(refuge.label)}</summary><div class="details-body">${days}<p>A deadly day is one where the zone's mean daily air temperature exceeds Tdead, a humidity-dependent limit in REVIVE ${refs.section("6.4.2")} after ${refs.link("mora", "Mora et al.")} The other zones' values are in the downloads.</p></div></details>
  <details><summary>Zone air temperature</summary><div class="details-body"><p class="caption">Winter</p>${wrap(airWinter, airW)}<p class="caption">Summer</p>${wrap(airSummer, airS)}<p class="caption">Zone mean air temperature; outdoor dry bulb is dashed. The 36°F limit is checked against zone mean air temperature.</p></div></details>
  ${DETAIL_GROUPS.map(([season, group, title, note], i) => `<details class="outage-detail" data-season="${season}" data-group="${group}"><summary>${esc(title)}</summary><div class="details-body"><p>${esc(note)}</p><div class="detail-figures" role="status">Loading graphs…</div></div></details>`).join("")}
  <details><summary>Assumptions and run checks</summary><div class="details-body">${table(checks(w).map(([k, v], i) => [k, v, checks(s)[i][1]]), ["Check", "Winter", "Summer"])}<ul>${data.limitations.map(l => `<li>${refs.cite(esc(units.prose(l)))}</li>`).join("")}</ul></div></details>
  <details><summary>Method and sources</summary><div class="details-body"><p>${refs.cite(esc(c.basis))}</p><p>Weather: Phius REVIVE 2024 extreme-week file for White Plains / Westchester County Airport. ${refs.link("honeybee_revive")} made it from the ${refs.link("tmyx", "TMYx file")}, adjusting dry bulb and dew point over the extreme winter and summer weeks with the REVIVE ${refs.section("6.1.2.1")} algorithm. The building matches the annual model; programs and controls are outage-specific.</p>${sources}${download}</div></details></section>`;
  host.querySelectorAll(".outage-detail").forEach(panel => panel.addEventListener("toggle", () => panel.open && openDetail(panel)));
}
