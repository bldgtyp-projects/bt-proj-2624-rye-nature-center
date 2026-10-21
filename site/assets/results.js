// One renderer per result page; each package keeps its own status and provenance.
const longDate = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
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
  const history = table(a.history.map(s => [units.prose(s.label),num(s.total_kWh,1)]),["Model iteration","Electricity, kWh/year"]);
  const humidity = table(a.humidity.map(z => [z.label,z.occupied_hourly_max_RH_percent == null ? "No separate People load" : `${num(z.occupied_hourly_max_RH_percent,1)}%`,`${num(z.all_hourly_max_RH_percent,1)}%`,z.all_quarter_hour_max_RH_percent == null ? "Not reported" : `${num(z.all_quarter_hour_max_RH_percent,2)}%`]),["Zone","Occupied hourly peak RH","All-hour hourly peak RH","All-hour 15-minute peak RH"]);
  host.innerHTML = `<section class="result-section" id="annual"><span class="status reviewed">Reviewed design model · ${esc(longDate(release.review_date))}</span><p>Ground-source heat pumps, a separate shared ERV and electric hot water. Operable windows use temperature and outdoor dew-point limits. Visitor Center and Core have supplemental humidity control.</p><div class="zone-metrics annual-metrics">${metric("Annual purchased electricity",num(a.total_kWh,0),"kWh/year")}${metric("Site energy intensity",units.number(a.eui_kWh_m2_year,"eui"),units.label("eui"))}${metric("Heating + cooling electricity",num(a.end_uses_kWh.heating+a.end_uses_kWh.cooling,0),"kWh/year")}</div><p class="caption">Before PV credit. Energy intensity uses ${units.fmt(a.floor_area_m2,"area")} of modeled floor area, which differs from the architectural gross-area schedule. Heating and cooling here are electricity consumed, not delivered heat or equipment capacity.</p>
    <div class="energy-panel"><h3>Monthly electricity</h3><p>Each column is one month. Colors show how the electricity is used.</p>${legend}<div class="energy-chart-wrap">${chart}</div><div class="month-inspector"><label>Inspect a month<select id="energy-month">${a.monthly.map((m,i)=>`<option value="${i}">${esc(m.label)}</option>`).join("")}</select></label><div id="month-summary" aria-live="polite"></div></div><details><summary>Exact monthly values</summary><div class="details-body">${months}<p class="caption">Small differences in displayed sums reflect rounding. The unrounded data reconciles to the facility electricity meter for every month.</p>${download}</div></details></div>
    <section class="annual-breakdown"><h3>Where the annual electricity goes</h3>${annualBars}<p class="caption">Cooling includes supplemental dehumidifier electricity, ${num(a.dehumidification_kWh,1)} kWh/year. Hot water includes tank standby electricity. Fans and pumps include the shared ERV and heating/cooling equipment.</p></section>
    <div class="notice compact"><strong>Humidity control verified; some comfort questions remain</strong><span>Visitor Center/Core use a 60% RH control target, with brief subhourly overshoot. Labs has no supplemental humidity control. Low winter humidity and cool operative temperatures remain under review.</span></div>
    <details><summary>Humidity, comfort and model changes</summary><div class="details-body">${humidity}<p>Hourly values are means. Occupied hours contain some scheduled People; Restrooms has no separate People load. The finer 15-minute peaks are reported for Visitor Center/Core. A 60% control target permits small transient overshoot; it is not a hard clamp.</p><p>No occupied hourly operative temperature exceeds ${units.say(26,"temperature")} in this run. Occupied cooling-setpoint-not-met time is ${num(a.review.occupied_cooling_unmet_hours,2)} hours with the model's reporting tolerance. Winter dry-air conditions and operative comfort still need assessment.</p><h3>Previous model iteration</h3>${history}<p>${say(a.history_note)}</p></div></details>
    <details><summary>Mechanical systems and operating inputs</summary><div class="details-body">${table(a.systems.map(([k,v]) => [k,units.prose(v)]),["Model input","Current assumption"])}<p>Fan performance, heat-pump curves and source-loop temperatures require equipment and MEP design inputs. The <a href="peak-loads.html">Peak loads</a> page reports room loads beside heat-pump coil loads, with operating checks and provisional equipment allowances. Outage results are on the <a href="resilience.html">Resilience</a> page. <a href="program.html">Inspect the zone programs and schedules →</a></p></div></details>
    <details><summary>Run information, calculation and downloads</summary><div class="details-body"><p>${say(a.reporting_basis)}</p><p>Weather: ${esc(release.source.weather_description)}. The 2026 calendar organizes operating schedules; typical-year weather does not represent a prediction of actual 2026 conditions.</p><p>EnergyPlus completes with zero severe errors. Known heat-pump part-load, ventilation-controller, heat-recovery low-flow and isolated psychrometric warnings remain documented in the model review. Annual moisture controls and all four zone availability interlocks pass; scheduled mechanical flows match.</p>${table([["Scenario",units.prose(release.scenario)],["Review date",release.review_date],["EnergyPlus",release.source.energyplus],["OpenStudio",release.source.openstudio],["Weather file",release.source.weather],["HBJSON SHA-256",release.source.hbjson_sha256],["Final IDF SHA-256",release.source.idf_sha256],["Final OSM SHA-256",release.source.osm_sha256],["Result SQL SHA-256",release.source.sql_sha256]],["Run reference","Value"])}<p>${esc(release.source.calendar.time_basis)}</p><p>${say(a.calculation)}</p><p>The current annual outputs were checked against the facility meter and control traces. Prior model totals come from preserved reviewed records because the same simulation folder was overwritten on rerun.</p>${download}</div></details></section>`;
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
  const { esc, num, table, units } = helpers;
  host.innerHTML = renderDesignDays(data.design_days, helpers);
  const condition = host.querySelector('#design-condition');
  function inspectCondition() {
    const c = data.design_days.conditions[Number(condition.value)];
    const zones = data.design_days.zones;
    host.querySelector('#condition-summary').innerHTML = `<p><strong>${esc(c.label)}</strong> · Outdoor dry bulb ${units.fmt(c.dry_bulb_C,"temperature")} · ${esc(c.humidity_basis)} ${units.fmt(c.humidity_value_C,"temperature")}</p>${table(zones.map(z => {const v = z.conditions.find(x => x.name.toUpperCase() === c.name.toUpperCase()); return [z.label, units.number(v.min_air_C,"temperature",2), units.number(v.max_air_C,"temperature",2), num(v.max_RH_percent,2), units.number(v.max_backup_W,"power")];}), ['Zone',`Minimum air ${units.label("temperature")}`,`Maximum air ${units.label("temperature")}`,'Peak RH %',`Backup heat ${units.label("power")}`])}`;
  }
  condition.addEventListener('change', inspectCondition);
  inspectCondition();
}


function renderDesignDays(d, { esc, num, metric, table, units }) {
  const kbtuh = units.label("load"), F = units.label("temperature");
  if (d?.release?.status !== 'reviewed_design_model') throw Error('Missing reviewed Design-Day package');
  const label = name => d.conditions.find(c => c.name.toUpperCase() === name.toUpperCase())?.label ?? name;
  const at = p => `${label(p.condition)} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
  const room = d.coincident_room_loads_W, coil = d.coil_peaks, h = d.room_to_coil.heating, cl = d.room_to_coil.cooling;
  const COLOR = { heat: '#b65e38', heatLight: '#c98a6c', cool: '#527f9b', coolLight: '#7fa3b9', latent: '#7f8f6a', other: 'var(--text-secondary)' };
  const bars = (rows, max) => rows.map(([name, value, color, sign = '']) => `<div class="peak-row"><span>${name}</span><div class="use-track"><span style="width:${Math.abs(value) / max * 100}%;background:${color}"></span></div><span>${sign}${units.fmt(Math.abs(value), "load")}</span></div>`).join('');
  const signed = v => v < 0 ? '−' : '+';
  const definitions = table([
    ['What it is', `Heat the room gains or loses with its air held at ${units.say(d.controls.heating_setpoint_C, 'temperature')} in winter and ${units.say(d.controls.cooling_setpoint_C, 'temperature')} in summer`, 'Heat the four zone heat pumps deliver in the simulation'],
    ['Includes', 'Envelope conduction, infiltration, solar, people, lighting and equipment. Sensible heat only', 'The room load, plus the ERV supply air, moisture removal and heat-pump fan heat'],
    ['Leaves out', 'Ventilation air and moisture', 'The ERV fans and heat-recovery core, which sit upstream of the rooms'],
    ['Use it for', 'Comparison with a conventional room or block load before outdoor air is added', 'Sizing the zone heat pumps. The ERV has no heating or cooling coil, so the heat pumps carry the ventilation load'],
  ], ['Peak load', 'Room load', 'Heat-pump coil load']);
  const heatMax = Math.max(h.room_sensible_W, h.ventilation_sensible_W, h.coil_W);
  const heating = bars([['Room load', h.room_sensible_W, COLOR.heat], ['ERV supply air', h.ventilation_sensible_W, COLOR.heatLight, signed(h.ventilation_sensible_W)], ['Fan heat and other', h.fan_and_other_W, COLOR.other, signed(h.fan_and_other_W)], ['Heat-pump coil output', h.coil_W, COLOR.heat, '= ']], heatMax);
  const coolMax = cl.coil_total_W;
  const cooling = bars([['Room sensible load', cl.room_sensible_W, COLOR.cool], ['ERV supply air, sensible', cl.ventilation_sensible_W, COLOR.coolLight, signed(cl.ventilation_sensible_W)], ['Fan heat and other', cl.fan_and_other_W, COLOR.other, signed(cl.fan_and_other_W)], ['Coil sensible output', cl.coil_sensible_W, COLOR.cool, '= '], ['Room moisture, by difference', cl.room_latent_W, COLOR.latent, signed(cl.room_latent_W)], ['ERV supply air, moisture', cl.ventilation_latent_W, COLOR.coolLight, signed(cl.ventilation_latent_W)], ['Coil total output', cl.coil_total_W, COLOR.cool, '= ']], coolMax);
  const zmax = Math.max(...d.zones.flatMap(z => [z.heating_room_load_W, z.coil.heating.W, z.sensible_cooling_room_load_W, z.coil.total_cooling.W]));
  const chart = d.zones.map(z => `<div class="peak-zone"><h4>${esc(z.label)}</h4>${bars([['Room heating', z.heating_room_load_W, COLOR.heatLight], ['Coil heating', z.coil.heating.W, COLOR.heat], ['Room sensible cooling', z.sensible_cooling_room_load_W, COLOR.coolLight], ['Coil total cooling', z.coil.total_cooling.W, COLOR.cool]], zmax)}</div>`).join('');
  const full = step => step.runtime_fraction >= 0.999; // The coil runs the whole timestep: output is capped by the modeled unit.
  const atCapacity = z => full(z.coil.total_cooling);
  const limited = d.zones.filter(atCapacity), heatLimited = d.zones.filter(z => full(z.coil.heating));
  const names = list => list.map(z => esc(z.label)).join(list.length > 2 ? ', ' : ' and ').replace(/, ([^,]*)$/, ' and $1');
  const zoneHeating = table(d.zones.map(z => [z.label, units.number(z.heating_room_load_W, "load", 1), `${units.number(z.coil.heating.W, "load", 1)}${full(z.coil.heating) ? " · full capacity" : ""}`, units.number(z.equipment.rated_heating_W, "load", 1)]),
    ['Heating', `Room load ${kbtuh}`, `Coil output ${kbtuh}`, `Rated capacity ${kbtuh}`]);
  const zoneCooling = table(d.zones.map(z => [z.label, units.number(z.sensible_cooling_room_load_W, "load", 1), units.number(z.coil.sensible_cooling.W, "load", 1), `${units.number(z.coil.total_cooling.W, "load", 1)} (${units.fmt(z.coil.total_cooling.W, "cooling_tons")})${atCapacity(z) ? ' · full capacity' : ''}`, at(z.coil.total_cooling), units.number(z.equipment.rated_total_cooling_W, "load", 1)]),
    ['Cooling', `Room sensible load ${kbtuh}`, `Coil sensible ${kbtuh}`, `Coil total ${kbtuh}`, 'Coil total peak', `Rated total capacity ${kbtuh}`]);
  const capacityNote = `${limited.length ? ` ${names(limited)} run at full capacity at ${limited.length > 1 ? 'their cooling peaks' : 'its cooling peak'}: the coil runs the whole timestep, so the output shown is capped by the modeled unit and the cooling demand may be higher. Learning Labs also reaches ${num(d.zones.find(z => z.id === 'labs').summer_max_RH_percent, 1)}% RH on these days.` : ''}${heatLimited.length ? ` ${names(heatLimited)} heating also runs at full capacity at the winter peak while holding the setpoint.` : ''}`;
  const NAMES = { 'People': 'People', 'Lights': 'Lighting', 'Equipment': 'Equipment', 'Infiltration': 'Infiltration', 'Interzone Mixing': 'Air transfer between zones', 'Roof': 'Roof', 'Exterior Wall': 'Exterior walls', 'Interzone Wall': 'Interior walls', 'Ground Contact Floor': 'Slab on grade', 'Fenestration Conduction': 'Window conduction', 'Fenestration Solar': 'Window solar' };
  const comp = d.room_load_components;
  const rows = comp.cooling.map((c, i) => [c, comp.heating[i]]).filter(([c, w]) => [c.sensible_W, c.latent_W, w.sensible_W].some(v => Math.abs(v) > 1));
  const total = (list, f) => list.reduce((a, r) => a + r[f], 0);
  const load = v => Math.abs(units.value(v, "load")) < 0.05 ? units.number(0, "load", 1) : units.number(v, "load", 1); // Rounds to zero without a sign.
  const clock = t => t.split(' ')[1].slice(0, 5);
  const components = table([...rows.map(([c, w]) => [NAMES[c.component], load(-w.sensible_W), load(c.sensible_W), load(c.latent_W)]), ['Total', load(-total(comp.heating, 'sensible_W')), load(total(comp.cooling, 'sensible_W')), load(total(comp.cooling, 'latent_W'))]],
    ['Component', `Heating, sensible ${kbtuh}`, `Cooling, sensible ${kbtuh}`, `Cooling, moisture ${kbtuh}`]);
  const infiltration = comp.heating.find(c => c.component === 'Infiltration').sensible_W / total(comp.heating, 'sensible_W');
  const equipment = table(d.zones.map(z => [z.label,units.number(z.equipment.rated_heating_W,"load"),units.number(z.equipment.rated_total_cooling_W,"load"),units.number(z.equipment.rated_total_cooling_W,"cooling_tons"),units.number(z.equipment.rated_sensible_cooling_W,"load"),units.number(z.equipment.airflow_m3_s,"airflow"),units.number(z.equipment.source_water_flow_m3_s,"water_flow")]),['Zone',`Rated heating ${kbtuh}`,`Rated total cooling ${kbtuh}`,'Rated total cooling tons',`Rated sensible cooling ${kbtuh}`,`Unit air ${units.label("airflow")}`,`Water ${units.label("water_flow")}`]);
  const src = d.release.source;
  const visitor = d.zones.find(z => z.id === 'visitor');
  const labs = d.zones.find(z => z.id === 'labs');
  return `<section class="result-section" id="peaks"><span class="status reviewed">Reviewed four-condition design study</span>
  <div class="zone-metrics">${metric('Room heating load', units.number(room.heating, 'load'), kbtuh)}${metric('Heat-pump coil heating', units.number(coil.heating_W, 'load'), kbtuh)}${metric('Room sensible cooling load', units.number(room.cooling, 'load'), `${kbtuh} · ${units.fmt(room.cooling, 'cooling_tons')}`)}${metric('Heat-pump coil total cooling', units.number(coil.total_cooling_W, 'load'), `${kbtuh} · ${units.fmt(coil.total_cooling_W, 'cooling_tons')}`)}</div>
  <p class="caption">Coincident building totals: all four zones at the same moment, with 1.0 sizing factors and no safety margin. Room loads come from the EnergyPlus zone sizing calculation with a 15-minute average. Coil loads are the simulated heat-pump output on the same four design days${limited.length ? `; ${names(limited)} run at full capacity at their cooling peaks, so their coil cooling figures are capped by the modeled units` : ''}. The coil sensible cooling peak is ${units.fmt(coil.sensible_cooling_W, 'load')} at ${esc(at({ condition: coil.sensible_cooling_condition, hour: coil.sensible_cooling_hour, minute: coil.sensible_cooling_minute }))}.</p>
  <h3>Room load and coil load</h3><p>This page gives two peak loads because the heat pumps carry more than the room load. The shared ERV is ventilation only, with heat recovery and no heating or cooling coil. Its supply air reaches each room cooler than the room in winter and warmer and more humid in summer, and the zone heat pumps make up the difference.</p><div class="load-definitions">${definitions}</div>
  <div class="energy-panel"><h3>From room load to coil load</h3><p><strong>Heating, ${esc(at(h))}.</strong> The ERV delivers ${units.fmt(h.erv_supply_m3_s, "airflow")} at ${units.say(h.erv_supply_C, "temperature")} after heat recovery.</p><div class="peak-chart steps">${heating}</div>
  <p><strong>Cooling, ${esc(at(cl))}, the total coil peak.</strong> The ERV delivers ${units.fmt(cl.erv_supply_m3_s, "airflow")} at ${units.say(cl.erv_supply_C, "temperature")}, scheduled by occupancy.</p><div class="peak-chart steps">${cooling}</div>
  <p class="caption">Each step is taken at the moment of the coil peak: ${esc(at(h))} and ${esc(at(cl))}. The sizing totals above come from each zone's own sizing peak, so the room loads here differ slightly. ERV values use hourly averages of the supply air entering each zone. Fan heat and other is the remainder; the heat-pump fans draw ${units.fmt(h.unit_fan_W, "load")} and ${units.fmt(cl.unit_fan_W, "load")} at these two moments. Room moisture is the coil moisture removal less the ERV moisture.</p></div>
  <div class="energy-panel"><h3>Zone by zone</h3><div class="peak-chart" role="img" aria-label="Room and coil heating and cooling peaks for each zone in ${kbtuh}; exact values follow.">${chart}</div><p class="caption">Each bar is that zone's own maximum. Zone peaks fall at different times and on different design days, so they do not add up to the building totals.</p>${zoneHeating}${zoneCooling}<p>Rated capacities are the provisional heat-pump allowances in the model, at rated conditions. Coil output at design conditions can exceed the rating. Coil peaks are the highest 5-minute values; times are the end of the timestep.${capacityNote}</p><p><a href="downloads/design-day-loads.csv" download>Design-day loads CSV ↓</a> · <a href="downloads/design-day-results.json" download>Design-day results and source references JSON ↓</a></p></div>
  <h3>What makes up the room loads</h3>${components}<p class="caption">EnergyPlus component load summary at the building room-load peak: ${esc(clock(comp.heating_time))} on the ${esc(label(comp.heating_condition))} day and ${esc(clock(comp.cooling_time))} on the ${esc(label(comp.cooling_condition))} day. EnergyPlus estimates the components separately, so the totals differ from the sizing totals by less than 0.5%. ${['People', 'Lights', 'Equipment'].every(n => comp.heating.find(c => c.component === n).sensible_W === 0) ? 'The winter design day carries no people, lighting or equipment gains. ' : ''}Infiltration is ${num(infiltration * 100, 0)}% of the room heating load. Negative cooling values reduce the load; the slab sits on a constant ${units.say(d.controls.slab_ground_C, "temperature")} ground on design days.</p>
  <h3>Assumptions to confirm before sizing</h3><ul>${d.sizing_notes.map(n => `<li>${esc(units.prose(n))}</li>`).join('')}</ul>
  <h3>Operating checks by design condition</h3><p>All zones hold 70°F heating in winter without backup heat. With a 75°F cooling target, Visitor Center reaches ${units.fmt(visitor.summer_max_air_C,"temperature",2)} on the wet-bulb day. Visitor/Core remain below 60% RH in these tests; Labs reaches ${num(labs.summer_max_RH_percent,2)}%.</p><label>Inspect a design condition<select id="design-condition">${d.conditions.map((c,i) => `<option value="${i}">${esc(c.label)}</option>`).join('')}</select></label><div id="condition-summary" aria-live="polite"></div>
  <details><summary>Equipment allowances and controls</summary><div class="details-body"><p>Generic model inputs tested with the recovered ERV air, transfer paths and dehumidifier heat included. These values are provisional equipment allowances. Airflow is recirculating unit air, separate from ERV outdoor air.</p>${equipment}<p>ERV terminal runs first, heat pump second and supplemental dehumidifier last. All 13 ERV flow channels pass. Windows remain closed on design days. Backup heaters are available but unused. The run uses twelve timesteps/hour and a three-step sizing average.</p></div></details>
  <details><summary>Design conditions, limitations and source references</summary><div class="details-body">${table(d.conditions.map(c => [c.label,units.number(c.dry_bulb_C,"temperature"),c.humidity_basis,units.number(c.humidity_value_C,"temperature")]),['Design condition',`Outdoor dry bulb ${F}`,'Moisture basis',`Moisture value ${F}`])}<p>Exactly four annual design conditions run with no annual weather period. Both measures succeed and EnergyPlus reports zero severe errors. Known part-load warnings remain.</p><ul>${d.limitations.map(l => `<li>${esc(units.prose(l))}</li>`).join('')}</ul><p>${src.hbjson_sha256 === src.annual_hbjson_sha256 ? "The Annual and Design-Day runs use the same HBJSON export; only the slab-ground boundary differs, as noted above." : "Separate annual and Design-Day exports have different generated identifiers. Their physical geometry, programs, material properties and internal mass were checked to match."}</p>${table([['HBJSON SHA-256',src.hbjson_sha256],['Annual HBJSON SHA-256',src.annual_hbjson_sha256],['Final IDF SHA-256',src.idf_sha256],['Final OSM SHA-256',src.osm_sha256],['Result SQL SHA-256',src.sql_sha256],['EnergyPlus / OpenStudio',src.energyplus+' / '+src.openstudio]],['Run reference','Value'])}<p>${esc(units.prose(d.basis))}</p></div></details></section>`;
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
  ["winter", "energy", "Winter outage · zone energy flows", "Hourly heat gains to each zone. Window, infiltration and window-ventilation flows are net (gain minus loss); negative values are losses."],
  ["winter", "air_changes", "Winter outage · air change rates", "Hourly air changes per hour (ACH) by zone, for envelope infiltration, window ventilation and the ERV."],
  ["winter", "envelope", "Winter outage · envelope surfaces", "One line per surface, colored by zone; select a line to see its name. Energy values are kBtu per hour, positive toward the zone. Kiva slabs report inside-face conduction and no heat storage."],
  ["summer", "energy", "Summer outage · zone energy flows", "Hourly heat gains to each zone. Window, infiltration and window-ventilation flows are net (gain minus loss); negative values are losses."],
  ["summer", "air_changes", "Summer outage · air change rates", "Hourly air changes per hour (ACH) by zone, for envelope infiltration, window ventilation and the ERV."],
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
  const checks = block => [["Run period", `${dayLabel(block.run_period[0])} to ${dayLabel(block.run_period[1])} · ${block.hours.length} hours`], ["EnergyPlus", `${block.checks.severe_errors} severe errors · ${block.checks.warnings} warnings · ${block.checks.timesteps_per_hour} timesteps/hour`],
    ["Heating and cooling delivered during outage", `${units.fmt(block.checks.outage_conditioning_kWh, "energy", 1)} (conditioned day: ${units.fmt(block.checks.conditioning_day1_kWh, "energy", 0)}, recovery day: ${units.fmt(block.checks.conditioning_day9_kWh, "energy", 0)})`],
    ["Backup electricity during outage", `${num(block.checks.outage_electricity_kWh_per_day, 1)} kWh/day`],
    ["ERV outdoor air during outage", `${units.fmt(block.checks.outage_mechanical_ventilation_m3 / block.checks.outage_ventilated_hours, "airflow_hourly")} for ${block.checks.outage_ventilated_hours} refuge hours`],
    ["Window ventilation during outage", units.fmt(block.checks.outage_window_ventilation_m3, "volume")]];
  const src = data.release.source;
  const refs = table([["Shared HBJSON SHA-256", src.hbjson_sha256], ["Weather file", src.weather_file], ["Weather SHA-256", src.weather_sha256],
    ["Winter IDF / SQL SHA-256", `${w.source.idf_sha256} / ${w.source.sql_sha256}`], ["Summer IDF / SQL SHA-256", `${s.source.idf_sha256} / ${s.source.sql_sha256}`], ["EnergyPlus / OpenStudio", `${src.energyplus} / ${src.openstudio}`]], ["Run reference", "Value"]);
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
  host.innerHTML = `<section class="result-section" id="resilience"><span class="status draft">First-pass outage results · ${esc(data.release.run_date)} · for design review</span>
  <div class="zone-metrics annual-metrics">${metric(`Summer peak heat index · ${esc(refuge.label)}`, tF(sz.heat_index_max_C), `${esc(peakBand.label)} band · ${sz.band_hours.danger + sz.band_hours.extreme_danger} h in Danger or above`)}${metric(`Winter SET below 54°F · ${esc(refuge.label)}`, num(wz.set_degree_hours_F_h, 0), `°F·h · REVIVE limit ${num(c.set_limit_F_h, 0)} °F·h`)}${metric("Coldest zone air", units.say(coldest.v.air_min_C, "temperature"), `${esc(coldest.z.label)} · ${coldest.v.hours_below_cold_limit} h below ${tF(c.cold_air_limit_C, 0)}`)}</div>
  <p class="caption">${w.checks.lead_in_hours ? "Each study ends with nine evaluated days, after a conditioned seasonal lead-in that brings the ground to its seasonal state:" : "Each study runs nine days:"} one conditioned day, seven days with no heating, cooling or water heating, and one recovery day. Results are evaluated over the seven outage days. ${esc(refuge.label)} is the occupied refuge (${esc(data.outage.refuge_hours.split(",")[0])}); the other zones are unoccupied.</p>
  <div class="energy-panel"><h3>Summer outage · heat index</h3><p>Hourly heat index in each zone, ${esc(dayLabel(s.run_period[0]))} to ${esc(dayLabel(s.run_period[1]))}. Shaded bands are the NOAA heat-index categories; Phius REVIVE allows zero hours in Danger or Extreme Danger.</p>${wrap(hiChart, hiSeries)}<p class="caption">Heat index combines air temperature and humidity (EnergyPlus zone heat index, hourly mean). Extreme Danger starts at ${tF(c.heat_index_bands_C[3].from_C, 0)}, above the chart. ${esc(refuge.label)} peaks at ${tF(sz.heat_index_max_C)}, in ${esc(bandLabel(peakBand.id))}.</p></div>
  <div class="energy-panel"><h3>Winter outage · standard effective temperature</h3><p>Hourly SET in each zone, ${esc(dayLabel(w.run_period[0]))} to ${esc(dayLabel(w.run_period[1]))}. Phius REVIVE allows at most ${num(c.set_limit_F_h, 0)} °F·h below 54°F SET over the outage.</p>${wrap(setChart, setSeries)}<p class="caption">SET at ${num(c.set_conditions.clo, 1)} clo, ${units.fmt(c.set_conditions.W_per_person, "power")} per person and ${units.fmt(c.set_conditions.air_speed_m_s, "speed")} air speed, calculated from zone air temperature, mean radiant temperature and humidity. Degree-hours sum the shortfall below 54°F for every outage hour.</p></div>
  <h3>Compared with the Phius REVIVE 2024 criteria</h3><p>${esc(outcome)} These are reference comparisons for design review, not a certification result.</p>${criteria}
  <details><summary>Summer daily conditions and deadly-day check · ${esc(refuge.label)}</summary><div class="details-body">${days}<p>A deadly day is one where the zone's mean daily air temperature exceeds Tdead, a humidity-dependent limit (Mora et al.) given in REVIVE 6.4.2. Other zones follow the same pattern; their values are in the downloads.</p><h3>Outage hours by heat-index band</h3>${bands}</div></details>
  <details><summary>Zone air temperature, both outages</summary><div class="details-body"><h3>Winter</h3>${wrap(airWinter, airW)}<h3>Summer</h3>${wrap(airSummer, airS)}<p class="caption">Zone mean air temperature with outdoor dry bulb (dashed). REVIVE 6.3.2 names no metric for the 36°F limit; zone mean air temperature is used here.</p></div></details>
  <h3>Supporting outage graphs</h3><p>Energy flows, air change rates and envelope surface detail behind the headline results, over the same nine days.</p>${DETAIL_GROUPS.map(([season, group, title, note], i) => `<details class="outage-detail" data-season="${season}" data-group="${group}"><summary>${esc(title)}</summary><div class="details-body"><p>${esc(note)}</p><div class="detail-figures" role="status">Loading graphs…</div></div></details>`).join("")}
  <details><summary>Outage assumptions and run checks</summary><div class="details-body"><h3>Winter run</h3>${table(checks(w), ["Check", "Result"])}<h3>Summer run</h3>${table(checks(s), ["Check", "Result"])}<ul>${data.limitations.map(l => `<li>${esc(units.prose(l))}</li>`).join("")}</ul></div></details>
  <details><summary>Run information, calculation and downloads</summary><div class="details-body"><p>${esc(c.basis)}</p><p>Both seasons use the same HBJSON export and the Phius REVIVE 2024 extreme-week weather file for White Plains / Westchester County Airport. The physical model matches the annual model per the resilience folder notes; programs and controls are outage-specific.</p>${refs}${download}</div></details></section>`;
  host.querySelectorAll(".outage-detail").forEach(panel => panel.addEventListener("toggle", () => panel.open && openDetail(panel)));
}
