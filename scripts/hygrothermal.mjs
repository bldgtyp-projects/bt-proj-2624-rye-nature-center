// Wall moisture page: WUFI Pro / ASHRAE 160 study of Exterior Wall 1 with cedar and stone cladding.
// Static HTML from site/data/hygrothermal.json. Layer thicknesses are the specified IP dimensions.
import { link, pdfPage } from "../site/assets/references.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fixed = (x, d = 1) => Number(x).toFixed(d);

// ---------- Section drawings ----------
// Layers outside to inside: [key, thickness in inches, label]. Inboard of the ZIP-R the walls are identical.
const INBOARD = [
  ["zip_osb", 0.4375, "ZIP-R: 7/16 in OSB, water-resistive facer, seams taped"],
  ["foam", 2.0, "ZIP-R: 2 in polyiso foam (R-12)"],
  ["fiber", 5.5, "5-1/2 in dense-pack wood fiber between 2x6 studs"],
  ["plywood", 0.5, "1/2 in plywood, taped: air and vapor control"],
  ["wool", 2.5, "2-1/2 in mineral wool service cavity"],
  ["gwb", 0.5, "1/2 in gypsum board"],
];
const WALLS = {
  cedar: { outboard: [["cedar", 0.75, "3/4 in cedar siding, painted"], ["air", 0.75, "3/4 in ventilated air space, furring strips"]], water: "zip" },
  stone_drawn: { outboard: [["stone", 2.0, "2 in natural stone"], ["mortar", 1.0, "1 in mortar bed and scratch coat"]], water: "zip" },
  stone_mat: { outboard: [["stone", 2.0, "2 in natural stone"], ["mortar", 1.0, "1 in mortar bed and scratch coat"], ["mat", 0.41, "about 7/16 in drainage mat with lath (DELTA-DRY & LATH)"]], water: "mat" },
};
const PX = 24; // drawing pixels per inch, the same for every wall
const MAX_OUT = 3.5; // inches outboard of the ZIP-R, so the ZIP-R lines up across the drawings
const X0 = 14, ZIP_X = X0 + MAX_OUT * PX, TOP = 30, H = 220, LABEL_X = ZIP_X + 11.6 * PX + 22, W = 720;
const DROP = (x, y) => `<path d="M${x} ${y - 9}c-4 6-6 8-6 11a6 6 0 0 0 12 0c0-3-2-5-6-11z" class="drop"/>`;

const PATTERNS = `<defs>
<pattern id="p-cedar" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" class="hatch"/></pattern>
<pattern id="p-zip_osb" width="9" height="7" patternUnits="userSpaceOnUse"><path d="M1 2h3M5 5h3M2 6h2" class="hatch"/></pattern>
<pattern id="p-foam" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 0l8 8M8 0l-8 8" class="hatch"/></pattern>
<pattern id="p-fiber" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".8" class="dot"/><circle cx="5.5" cy="5" r=".8" class="dot"/></pattern>
<pattern id="p-plywood" width="4" height="10" patternUnits="userSpaceOnUse"><line x1="2" y1="0" x2="2" y2="10" class="hatch"/></pattern>
<pattern id="p-wool" width="20" height="14" patternUnits="userSpaceOnUse"><path d="M0 7q5-7 10 0t10 0" class="hatch light" fill="none"/></pattern>
<pattern id="p-gwb" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r=".5" class="dot"/></pattern>
<pattern id="p-stone" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><line x1="0" y1="0" x2="0" y2="14" class="hatch dark"/><line x1="7" y1="0" x2="7" y2="14" class="hatch"/></pattern>
<pattern id="p-mortar" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" class="dot"/><circle cx="4" cy="3.5" r=".5" class="dot"/><circle cx="2" cy="5" r=".6" class="dot"/></pattern>
</defs>`;

function section(id) {
  const wall = WALLS[id];
  const layers = [...wall.outboard, ...INBOARD];
  const outTotal = wall.outboard.reduce((s, l) => s + l[1], 0);
  let x = ZIP_X - outTotal * PX;
  const placed = layers.map(([key, t, label]) => {
    const l = { key, label, x, w: t * PX };
    x += t * PX;
    return l;
  });
  const at = (key) => placed.find((l) => l.key === key);
  const shapes = placed.map((l) => {
    if (l.key === "air") return `<rect x="${l.x}" y="${TOP}" width="${l.w}" height="${H}" class="layer air"/>`;
    if (l.key === "mat") {
      // Dimpled HDPE sheet: a zigzag across the depth of the mat, with the drained gap behind it.
      let d = `M${l.x + 2} ${TOP}`;
      for (let y = TOP; y < TOP + H; y += 10) d += `L${l.x + l.w - 1.5} ${y + 5}L${l.x + 2} ${y + 10}`;
      return `<rect x="${l.x}" y="${TOP}" width="${l.w}" height="${H}" class="layer air"/><path d="${d}" class="wrb-sheet"/><line x1="${l.x + 1.5}" y1="${TOP}" x2="${l.x + 1.5}" y2="${TOP + H}" class="lath"/>`;
    }
    return `<rect x="${l.x}" y="${TOP}" width="${l.w}" height="${H}" class="layer fill-${l.key}"/><rect x="${l.x}" y="${TOP}" width="${l.w}" height="${H}" class="pattern" fill="url(#${id}-${l.key})"/>`;
  }).join("");
  const zip = at("zip_osb");
  const facer = `<line x1="${zip.x + 1}" y1="${TOP}" x2="${zip.x + 1}" y2="${TOP + H}" class="wrb-line"/>`;
  // Leaders: one row per layer, outside first, running right to the label column.
  const leaders = placed.map((l, i) => {
    const y = TOP + 14 + i * (H - 24) / (placed.length - 1);
    const cx = l.x + l.w / 2;
    return `<line x1="${cx}" y1="${y}" x2="${LABEL_X - 6}" y2="${y}" class="leader-halo"/><line x1="${cx}" y1="${y}" x2="${LABEL_X - 6}" y2="${y}" class="leader"/><circle cx="${cx}" cy="${y}" r="2.2" class="leader-dot"/><text x="${LABEL_X}" y="${y + 4}">${esc(l.label)}</text>`;
  }).join("");
  // Check points A (ZIP-R sheathing) and B (wood fiber face) below the wall; the drop above it marks where rain leakage was placed.
  const fiber = at("fiber");
  const waterX = wall.water === "mat" ? at("mat").x : zip.x;
  const by = TOP + H + 16;
  const marker = (cx, letter) => `<circle cx="${cx}" cy="${by}" r="8" class="check-dot"/><text x="${cx}" y="${by + 4}" class="check-letter">${letter}</text>`;
  const drop = DROP(waterX, TOP - 12);
  const scale = [0, 1, 2, 3, 4].map((n) => `<line x1="${LABEL_X + n * PX}" y1="${by - 4}" x2="${LABEL_X + n * PX}" y2="${by + 2}" class="scale"/><text x="${LABEL_X + n * PX}" y="${by + 15}" class="scale-text">${n}</text>`).join("");
  return `<svg class="wall-section" viewBox="0 0 ${W} ${by + 22}" role="img" aria-label="Section of the wall, outside on the left: ${esc(placed.map((l) => l.label).join("; "))}">${PATTERNS.replaceAll('id="p-', `id="${id}-`)}
<text x="${X0}" y="${TOP - 10}" class="side">OUTSIDE</text><text x="${placed.at(-1).x + placed.at(-1).w}" y="${TOP - 10}" class="side" text-anchor="end">INSIDE</text>
${shapes}${facer}${leaders}${drop}${marker(zip.x + zip.w / 2, "A")}${marker(fiber.x + 4, "B")}
<line x1="${LABEL_X}" y1="${by - 1}" x2="${LABEL_X + 4 * PX}" y2="${by - 1}" class="scale"/>${scale}<text x="${LABEL_X + 4 * PX + 8}" y="${by + 3}" class="scale-unit">inches</text></svg>`;
}

// ---------- Results ----------
// Each row: [id, label, what the case means]. The worst run sets each bar, except rain behind the mat,
// where the least severe of its runs shows that it still fails.
const ROWS = [
  ["base_nyc", "As designed, NYC weather", "The walls as drawn, in NYC's cold and hot moisture design years, with 1% of the wind-driven rain leaking past the cladding. The bar is the worst of the orientations we ran."],
  ["base_prv", "As designed, colder climate (Providence)", "The walls as drawn, in Providence's cold design year. It is colder than NYC, so it checks the walls against a harsher winter."],
  ["m309", "More indoor moisture", "Indoor moisture raised from 2.43 to 3.09 lb/h, about 27% more."],
  ["init90", "Built wet", "Every layer starts at 90% relative humidity, as if the framing and sheathing got rained on before close-in. The wall then has to dry out."],
  ["lk01", "Small leak into the ZIP-R (0.1% of rain)", "On top of the normal 1% rain leakage, 0.1% of the wind-driven rain goes straight into the ZIP-R OSB, as a small failed seam tape or flashing would let it."],
  ["lk1", "Larger leak into the ZIP-R (1% of rain)", "On top of the normal 1% rain leakage, another 1% of the wind-driven rain goes straight into the ZIP-R OSB, as a badly failed seam tape or flashing would let it."],
  ["zipwet", "Rain gets behind the mat, even with the gap vented", "The 1% rain leakage lands on the face of the ZIP-R behind the mat, as through a failed lap or flashing. We ran the gap at 1, 5, 10 and 20 air changes an hour in both weather years; the bar shows the least severe of these eight runs, which still fails."],
];
const ORDER = ["cedar", "stone_drawn", "stone_mat"];
const SHORT = { cedar: "Cedar siding", stone_drawn: "Stone as drawn (FE3)", stone_mat: "Stone on a drainage mat" };
const pct = (x) => `${(Math.min(x, 6) / 6) * 100}%`;
const MEANING = [[1, "no growth to first microscopic traces"], [2, "microscopic growth only"], [3, "several microscopic colonies, not yet visible to the eye"], [4, "visible mold on under 10% of the surface"], [5, "visible mold on 10 to 50% of the surface"], [6.01, "mold on more than half the surface"]];
const meaning = (m) => MEANING.find(([top]) => m < top)[1];
const close = (id) => `<button class="pop-close" popovertarget="${id}" popovertargetaction="hide" aria-label="Close">×</button>`;
const info = (id, label) => `<button class="info" popovertarget="${id}" aria-label="${esc(label)}">i</button>`;

function rowRuns(runs, wall, row) {
  const own = runs.filter((r) => r.wall === wall);
  if (row === "base_nyc") return own.filter((r) => r.scenario === "base" && r.weather.startsWith("nyc"));
  if (row === "base_prv") return own.filter((r) => r.scenario === "base" && r.weather === "prv_cold_n");
  if (row === "zipwet") return own.filter((r) => r.scenario.startsWith("zipwet"));
  return own.filter((r) => r.scenario === row);
}

// One bar: a button that opens the runs behind it.
function cell(data, wall, row, label, pops) {
  const runs = rowRuns(data.runs, wall, row);
  if (!runs.length) return `<div class="mi-cell empty">no mat</div>`;
  const pick = runs.reduce((a, b) => ((row === "zipwet" ? b.peak < a.peak : b.peak > a.peak) ? b : a));
  const id = `pop-${wall}-${row}`;
  const verdict = pick.passes ? `Passes: ${fixed(pick.peak, 2)} is below the limit of 3.` : `Fails: ${fixed(pick.peak, 2)} is above the limit of 3.`;
  const y5 = fixed(pick.zip_year5);
  const drying = pick.zip_year5 > data.limit
    ? `By year 5 the ZIP-R mold index is still ${y5}.`
    : pick.zip_year5 < pick.zip - 0.1
      ? `The peak comes early; by year 5 the ZIP-R mold index is down to ${y5}.`
      : `The ZIP-R mold index peaks at about the same level every year, ${y5} in year 5.`;
  const runRows = runs.map((r) => `<tr${r === pick ? ' class="picked"' : ""}><td>${esc(r.scenario.startsWith("zipwet") ? `${data.scenarios[r.scenario].replace(/^.*\(gap /, "Gap ").replace(")", "")}, ${data.weather[r.weather].replace(/ wall$/, "")}` : data.weather[r.weather])}</td><td>${fixed(r.zip, 2)}</td><td>${fixed(r.fiber_face, 2)}</td><td>${r.passes ? "Pass" : "Fail"}</td></tr>`).join("");
  pops.push(`<div id="${id}" popover class="info-pop">${close(id)}<p class="status ${pick.passes ? "pass" : "fail"}">${SHORT[wall]}</p><h3>${esc(label)}</h3><p><strong>${verdict}</strong> At ${fixed(pick.peak, 2)} the index means ${meaning(pick.peak)}.</p><p>${drying} In this run the OSB reaches ${fixed(pick.zip_mc_pct)}% moisture content at most${pick.zip_mc_pct > 20 ? ", above the 20% usually treated as the decay threshold for wood" : ""}.</p><div class="table-wrap"><table class="compact"><thead><tr><th>${row === "zipwet" ? "Gap airflow" : "Weather and wall"}</th><th>ZIP-R (A)</th><th>Wood fiber (B)</th><th></th></tr></thead><tbody>${runRows}</tbody></table></div><p class="caption">Peak mold index over five years at check points A and B. The highlighted run sets the bar.</p></div>`);
  return `<button class="mi-cell${pick.passes ? "" : " fails"}" popovertarget="${id}" aria-label="${esc(`${SHORT[wall]}, ${label}: ${fixed(pick.peak)}, ${pick.passes ? "passes" : "fails"}. Show the runs.`)}"><span class="mi-track"><span class="mi-bar" style="width:${pct(pick.peak)}"></span><span class="mi-limit" style="left:${pct(data.limit)}"></span></span><span class="mi-value">${fixed(pick.peak)}${pick.passes ? "" : " <small>fails</small>"}</span></button>`;
}

const SCALE = [["0", "No growth"], ["1", "First traces, visible only under a microscope"], ["2", "Several small colonies, visible only under a microscope"], ["3", "Mold visible to the eye on under 10% of the surface"], ["4", "Visible mold on 10 to 50% of the surface"], ["5", "Mold on more than half the surface"], ["6", "Surface fully covered"]];

function chart(data) {
  const pops = [];
  const axis = `<span class="mi-axis"><span class="mi-track"><span class="tick" style="left:0">0</span><span class="tick limit" style="left:${pct(data.limit)}">3 limit</span><span class="tick" style="left:100%">6</span></span><span></span></span>`;
  const head = `<div class="mi-row mi-head"><span>Case ${info("pop-cases", "About the cases")}</span>${ORDER.map((w) => `<span>${SHORT[w]}</span>`).join("")}</div>
<div class="mi-row mi-scale"><span>Mold index, 0 to 6 ${info("pop-index", "What is the mold index?")}</span>${ORDER.map(() => axis).join("")}</div>`;
  const body = ROWS.map(([id, label, about]) => {
    pops.push(`<div id="pop-row-${id}" popover class="info-pop">${close(`pop-row-${id}`)}<h3>${esc(label)}</h3><p>${esc(about)}</p></div>`);
    return `<div class="mi-row"><button class="mi-label" popovertarget="pop-row-${id}">${label}</button>${ORDER.map((w) => cell(data, w, id, label, pops)).join("")}</div>`;
  }).join("");
  pops.push(`<div id="pop-index" popover class="info-pop">${close("pop-index")}<h3>The mold index</h3><p>A rating from 0 to 6 of how much mold grows on a surface. It has no unit. We calculate it hour by hour from the temperature and humidity at each check point in the wall: it climbs while the surface is warm and damp, and falls back slowly once it dries.</p><div class="table-wrap"><table class="compact"><tbody>${SCALE.map(([i, t]) => `<tr${i === "3" ? ' class="picked"' : ""}><td>${i}</td><td>${t}</td></tr>`).join("")}</tbody></table></div><p class="caption">Levels from the VTT mold model, which ASHRAE 160 adopts.</p></div>`);
  pops.push(`<div id="pop-limit" popover class="info-pop">${close("pop-limit")}<h3>Why the limit is 3</h3><p>${link("ashrae160", "ASHRAE Standard 160")} requires the mold index to stay at or below 3.00. We check it at the ZIP-R sheathing and the face of the wood fiber. At 3, mold first becomes visible to the eye; below it, any growth is microscopic.</p><p>The standard rates materials by how readily they grow mold. We used its "sensitive" class, which it recommends for wood-based boards, for the ZIP-R OSB and the wood fiber.</p></div>`);
  pops.push(`<div id="pop-cases" popover class="info-pop">${close("pop-cases")}<h3>The cases</h3><p>The first two rows are each wall in normal use: cedar and stone as drawn, and stone on the proposed drainage mat. The rest are stress tests: more indoor moisture, a wall built wet, and rain getting past the water-resistive layer. Click a case for what it means, or a bar for the runs behind it.</p></div>`);
  return `<p class="mi-intro">Each bar is the highest <button class="term" popovertarget="pop-index">mold index</button> at the wall's check points over five years, on a scale of 0 to 6. Above the <button class="term" popovertarget="pop-limit">limit of 3</button> the wall fails. Click a case or a bar for more.</p>
<div class="mi-wrap"><div class="mi-grid" aria-label="Highest mold index in the wall over five years, by case and wall">${head}${body}</div></div>
<p class="caption">Each bar is the worst of the weather years and orientations run for that case. Rain behind the mat shows the least severe of its eight runs: four gap airflows in two weather years.</p>${pops.join("")}`;
}

function runTable(data, wall) {
  const rows = data.runs.filter((r) => r.wall === wall).map((r) => `<tr><td>${esc(data.scenarios[r.scenario])}</td><td>${esc(data.weather[r.weather])}</td><td>${fixed(r.zip, 2)}</td><td>${fixed(r.fiber_face, 2)}</td><td>${fixed(r.zip_year5, 2)}</td><td>${fixed(r.zip_mc_pct)}%</td><td>${r.passes ? "Pass" : "<strong>Fail</strong>"}</td></tr>`).join("");
  return `<div class="table-wrap"><table><thead><tr><th>Case</th><th>Weather and wall</th><th>ZIP-R sheathing (A)</th><th>Wood fiber face (B)</th><th>ZIP-R, year 5</th><th>ZIP-R max. moisture content</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function headline(data, wall) {
  const base = data.runs.filter((r) => r.wall === wall && r.scenario === "base");
  return Math.max(...base.map((r) => r.peak));
}

export function hygrothermalPage(data) {
  const s = data.summary;
  const card = (wall, pass, title, text) => `<div class="wall-card${pass ? "" : " fails"}"><span class="status ${pass ? "pass" : "fail"}">${pass ? "Passes" : "Fails"}</span><h3>${title}</h3><p class="wall-metric"><strong>${fixed(headline(data, wall))}</strong> highest mold index as designed; the limit is 3</p><p>${text}</p></div>`;
  const figure = (wall, pass, title, text) => `<figure class="wall-figure"><figcaption><span class="status ${pass ? "pass" : "fail"}">${pass ? "Passes" : "Fails"}</span><h3>${title}</h3><p>${text}</p></figcaption><div class="wall-scroll">${section(wall)}</div></figure>`;
  return `<div class="page-heading"><span class="status draft">First pass</span><h1>Wall moisture</h1><p class="lead">Will Exterior Wall 1 stay dry enough to prevent mold?</p><p>We simulated five years of heat and moisture moving through Exterior Wall 1 (SD-500), hour by hour, in ${link("wufi_pro", "WUFI Pro")}. We ran it with the cedar siding and with the stone cladding at SD-501 detail FE3, and judged each run against the mold limit in ${link("ashrae160", "ASHRAE Standard 160")}. These are first-pass results, pending our internal review.</p></div>
<section><div class="wall-cards">
${card("cedar", true, "Cedar siding", `Stays well below the limit in every weather year, orientation and indoor moisture level we tested. It fails only if rain keeps leaking through the ZIP-R seams or flashing. ${s.cedar.pass} of ${s.cedar.runs} runs pass.`)}
${card("stone_drawn", false, "Stone as drawn (FE3)", `Fails in all ${s.stone_drawn.runs} runs, even with no rain leakage. The wet mortar bed sits directly on the ZIP-R and holds the sheathing at about 99% relative humidity all year.`)}
${card("stone_mat", true, "Stone on a drainage mat", "Passes in every weather year and with every stone type and color we tested. It tolerates less water at the sheathing than the cedar wall, so laps and flashing matter more.")}
</div></section>
<section><div class="section-title"><h2>Recommendations</h2></div><ol class="recommendations">
<li><strong>Put a second water-resistive barrier and a drained space behind the stone.</strong> ZIP-R counts only as the first barrier. Huber requires at least one more, mechanically fastened, before the lath and stone (${pdfPage("huber_r_manual", 8, "Huber manual, p. 8")}); its adhered stone detail calls for one meeting ASTM E2556 (${pdfPage("huber_r_manual", 39, "p. 39")}). Huber prohibits a self-adhered or fluid-applied membrane over the whole ZIP-R wall (${pdfPage("huber_r_manual", 7, "Huber manual, p. 7")}). Huber reads the 2021 IBC as also requiring a drainage space of at least 3/16 in in moist climates such as Rye's (${pdfPage("huber_stone", 1, "Huber tech tip HUB 9213")}); confirm the requirement under the 2025 NYS Building Code with the code official. Two ways to get both:<ul>
<li>${link("dorken_lath", "DELTA-DRY & LATH")}, which we modeled, over a mechanically fastened barrier on the ZIP-R. It is a dimpled plastic sheet with a drained gap and built-in lath for the scratch coat. Dörken installs it outboard of a water-resistive barrier, so it doesn't replace the second barrier.</li>
<li>Huber's ZIP System Rainscreen: a 1/4 in drainage mat whose vapor-permeable fabric face, with its vertical seams taped, serves as the second barrier (${pdfPage("zip_rainscreen", 4, "Rainscreen manual, pp. 4 and 5")}). The stone still needs lath (${pdfPage("zip_rainscreen", 6, "p. 6")}). Its fabric passes far more vapor than the DELTA-DRY sheet, so ask us to rerun the stone wall before choosing it.</li></ul></li>
<li><strong>Detail every place water could get past the ZIP-R.</strong> Seam tape, window and door flashing and penetrations are where the cedar wall can fail. Behind the stone, also detail the mat laps, its top edge and the weep screed at the base. In our runs, rain that reached the ZIP-R behind the mat pushed the mold index past the limit even with the gap vented. Where flashing seals to the ZIP-R, use Huber's own tape or liquid flash; Huber warrants the adhesion of only those on its panels (${pdfPage("huber_r_manual", 6, "Huber manual, p. 6")}).</li>
<li><strong>Keep the sheathing and framing dry during construction.</strong> Install the wood fiber dry and close in the ZIP-R before it gets wet. In our runs the stone wall built wet failed even on the mat, so don't install the mat and stone until the ZIP-R is dry. Cover the ZIP-R with cladding within 180 days; after that, Huber requires a mechanically fastened barrier over it (${pdfPage("huber_r_manual", 7, "Huber manual, p. 7")}).</li>
<li><strong>Vent the mat at the top if the detail allows.</strong> We modeled a gap vented top and bottom at 5 air changes an hour, against 1 in the base case. That roughly halved the peak mold index at the ZIP-R, from about 1.5 to 0.7. The wall passes without it.</li>
</ol>
<h3 class="limits-title">ZIP-R limits to design around</h3><p>From Huber's ${link("huber_r_manual", "ZIP-R installation manual")} and the product's evaluation report, ${link("esr3373", "ICC-ES ESR-3373")}.</p><ul class="limits">
<li><strong>Walls only, no roofs.</strong> Huber doesn't warrant or recommend ZIP-R on roofs (${pdfPage("huber_r_manual", 7, "Huber manual, p. 7")}), and ESR-3373 evaluates it only for walls (${pdfPage("esr3373", 2, "section 2.0")}). The roof needs a different sheathing and insulation build-up.</li>
<li><strong>A gap at stone and masonry.</strong> Keep at least 1/2 in between the edge of the ZIP-R OSB and any stone or masonry it meets, such as at the foundation in FE3 (${pdfPage("huber_r_manual", 7, "Huber manual, p. 7")}).</li>
<li><strong>Cladding fasteners and the 2 in foam.</strong> The cladding manufacturer decides whether fasteners for the cedar furring and the stone lath must reach the studs through the foam or may fasten into the ZIP-R OSB alone (${pdfPage("huber_r_manual", 23, "Huber manual, p. 23")}; ESR-3373, ${pdfPage("esr3373", 4, "condition 5.5")}).</li>
<li><strong>Structure and construction type.</strong> Huber says ZIP-R isn't meant to replace structural panels where the sheathing must resist combined wind uplift and shear (${pdfPage("huber_r_manual", 7, "Huber manual, p. 7")}); ESR-3373 requires the code official to approve that use (${pdfPage("esr3373", 4, "condition 5.11")}). ESR-3373 covers light wood-frame walls of Type V construction (${pdfPage("esr3373", 2, "section 2.0")}). For the structural engineer and the code review.</li>
</ul></section>
<section><div class="section-title"><h2>The walls we tested</h2></div><p>All three drawings are at the same scale, outside on the left, cut through a stud bay. The ZIP-R lines up across them; everything from the ZIP-R inward is the same wall.</p>
${figure("cedar", true, "Cedar siding on a rainscreen", "Exterior Wall 1 on SD-500. The ventilated air space behind the siding lets the ZIP-R dry outward.")}
${figure("stone_drawn", false, "Stone as drawn (FE3)", "SD-501 detail FE3: stone on about 1 in of mortar, set directly on the ZIP-R with no drainage space and no second water-resistive barrier. AKA's note on FE3 asks whether a drainage mat is needed.")}
${figure("stone_mat", true, "Stone on a drainage mat", "The same stone and mortar on DELTA-DRY &amp; LATH. The plastic sheet keeps the wet mortar off the ZIP-R and its gap drains water away.")}
<ul class="wall-key"><li><span class="key-dot">A</span> ZIP-R sheathing, the main check point</li><li><span class="key-dot">B</span> Face of the wood fiber, against the foam</li><li><svg viewBox="-7 -10 14 18" width="12" height="16" aria-hidden="true"><path d="M0 -9c-4 6-6 8-6 11a6 6 0 0 0 12 0c0-3-2-5-6-11z" class="drop"/></svg> Where rain leakage lands</li><li><span class="key-line"></span> Water-resistive layer</li></ul></section>
<section><div class="section-title"><h2>How we tested</h2></div>
<p>Each run covers five years, hour by hour, starting in October. NYC's cold and hot moisture design years are the main weather. Providence's cold year is a colder check. We ran north, northeast, east and southeast walls; the north and northeast walls set the results.</p>
<p>Indoor moisture is 2.43 lb/h, the building's busiest regular heating-season day from its occupancy schedules, held all year. Following the ASHRAE 160 default, 1% of the wind-driven rain on the wall leaks past the cladding and lands on the ZIP-R behind the cedar and behind the stone as drawn, and on the face of the mat behind the stone on the mat.</p>
<p>The stress tests go further. "Built wet" starts every layer at 90% relative humidity. The leak cases add 0.1% or 1% of the rain directly into the ZIP-R sheathing, as a failed seam tape or flashing would. Each run is scored by its <button class="term" popovertarget="pop-index">mold index</button> against the <button class="term" popovertarget="pop-limit">ASHRAE 160 limit</button>.</p>

<details><summary>Inputs</summary><div class="details-body"><div class="table-wrap"><table><tbody>
<tr><th>Weather</th><td>NYC cold and hot moisture design years (ASHRAE research project 1325); Providence cold year</td></tr>
<tr><th>Orientation</th><td>North and northeast; east and southeast as checks</td></tr>
<tr><th>Indoor moisture</th><td>2.43 lb/h with 0.18 ACH, 70°F heating and 75°F cooling. Also run at 1.25 and 3.09 lb/h, and, for the cedar wall, with cooling that dehumidifies to 60% RH.</td></tr>
<tr><th>Rain</th><td>1% of wind-driven rain on the ZIP-R, or on the face of the mat</td></tr>
<tr><th>Cedar siding</th><td>Dark paint; the air space behind it changes 10 times an hour</td></tr>
<tr><th>Stone</th><td>2 in sandstone, medium gray. Also run as granite, as a second sandstone and as dark stone.</td></tr>
<tr><th>Drainage mat</th><td>0.14 perm plastic sheet with a drained gap</td></tr>
<tr><th>ZIP-R foam</th><td>2 in polyiso with facers, 0.76 perm. Also run at 0.3 perm on the cedar wall.</td></tr>
<tr><th>Wood fiber</th><td>Dense-pack at 3.5 pcf. Also run at 3.0 pcf and more vapor-open on the cedar wall.</td></tr>
<tr><th>Interior sheathing</th><td>1/2 in plywood, taped. Also run as OSB on the cedar wall.</td></tr>
<tr><th>Pass criterion</th><td>Mold index of 3 or less at every check point (ASHRAE 160)</td></tr>
</tbody></table></div></div></details></section>
<section><div class="section-title"><h2>Results</h2></div><p>The cedar wall stays under 2 in normal use and fails only with the larger leak. Stone as drawn fails every case. On the drainage mat the stone wall passes in normal use, but fails if it is built wet, if rain reaches the ZIP-R behind the mat, or if a leak reaches the sheathing. The small leak fails only on the northeast wall.</p>
${chart(data)}
<details><summary>All ${data.runs.length} runs</summary><div class="details-body"><p>Peak mold index over five years at each check point; year 5 shows whether the ZIP-R index is still high at the end or has fallen back. Moisture content is the highest in the ZIP-R OSB, by weight.</p>${ORDER.map((w) => `<h3 class="detail-title">${esc(data.walls[w])}</h3>${runTable(data, w)}`).join("")}<p><a href="downloads/wall-moisture-results.csv" download>Download all runs (CSV)</a></p></div></details>
<details><summary>Limits of the model</summary><div class="details-body"><p>The model holds liquid water in the mat's gap instead of letting it drain. That makes some stone-on-mat failures pessimistic: the larger leak, every run with rain behind the mat and the cold-year built-wet run. The passing runs had no water in the gap.</p><p>The stone-on-mat runs place the mat directly on the ZIP-R, without the second barrier Huber requires, and put the rain leakage on the face of the mat. With that barrier in place the leakage belongs on it instead. Those cases need a rerun once the build-up is chosen.</p></div></details></section>`;
}
