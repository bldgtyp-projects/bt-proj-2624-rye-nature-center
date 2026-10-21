// External sources cited in the report. The renderers and scripts/build.mjs link only through this registry.
// Checked 21 October 2026: the TMYx download matches the model's EPW, DDY and STAT byte for byte.
const REVIVE_PDF = "https://www.phius.org/sites/default/files/2026-10/Phius%20REVIVE%202024%20Pilot%20Standard%20v24.1.1.pdf";
export const REFS = {
  tmyx: { group: "Weather and climate", label: "White Plains / Westchester County AP TMYx weather (EPW, DDY and STAT)", source: "Climate.OneBuilding.org",
    href: "https://climate.onebuilding.org/WMO_Region_4_North_and_Central_America/USA_United_States_of_America/NY_New_York/USA_NY_White.Plains-Westchester.County.AP.725037_TMYx.zip",
    note: "Annual weather, and the source of the four design-day records and the outage base weather." },
  ashrae: { group: "Weather and climate", label: "ASHRAE climatic design conditions, Westchester County AP (WMO 725037)", source: "ashrae-meteo.info",
    href: "https://ashrae-meteo.info/v3.0/?lat=41.062&lng=-73.705&place=%27%27&wmo=725037",
    note: "Design days use the 2025 ASHRAE Handbook, Fundamentals values; choose 2025 on the page." },
  revive: { group: "Standards and methods", label: "Phius REVIVE 2024 Pilot Standard v24.1.1", source: "Phius",
    href: "https://www.phius.org/phius-revive-2024-pilot-standard-document",
    note: "Outage weather (6.1.2.1), winter criteria (6.3.2) and summer criteria (6.4.2)." },
  heat_index: { group: "Standards and methods", label: "Heat index categories", source: "NOAA National Weather Service",
    href: "https://www.weather.gov/ama/heatindex" },
  mora: { group: "Standards and methods", label: "Mora et al. (2017), Global risk of deadly heat, Nature Climate Change 7, 501–506", source: "doi:10.1038/nclimate3322",
    href: "https://doi.org/10.1038/nclimate3322", note: "Basis of the REVIVE deadly-day limit." },
  design_day: { group: "Standards and methods", label: "SizingPeriod:DesignDay, EnergyPlus Input Output Reference", source: "Big Ladder Software",
    href: "https://bigladdersoftware.com/epx/docs/25-1/input-output-reference/group-location-climate-weather-file-access.html#sizingperioddesignday",
    note: "How EnergyPlus builds a design day: daily temperature range and the ASHRAE clear-sky (tau) model." },
  energyplus: { group: "Software", label: "EnergyPlus 25.1.0", source: "GitHub release",
    href: "https://github.com/NatLabRockies/EnergyPlus/releases/tag/v25.1.0" },
  openstudio: { group: "Software", label: "OpenStudio 3.10.0", source: "GitHub release",
    href: "https://github.com/NatLabRockies/OpenStudio/releases/tag/v3.10.0" },
  kiva: { group: "Software", label: "Kiva ground heat transfer", source: "Big Ladder Software",
    href: "https://bigladdersoftware.com/projects/kiva/", note: "Slab-ground model in the annual and outage runs." },
  honeybee: { group: "Software", label: "Honeybee", source: "Ladybug Tools",
    href: "https://www.ladybug.tools/honeybee.html", note: "Builds the model and writes the simulation inputs." },
  hbjson: { group: "Software", label: "HBJSON model schema", source: "Ladybug Tools",
    href: "https://ladybug-tools.github.io/honeybee-schema/model.html" },
  honeybee_revive: { group: "Software", label: "honeybee-REVIVE", source: "PH-Tools",
    href: "https://github.com/PH-Tools/honeybee_REVIVE", note: "Builds the outage weather from the TMYx file and calculates SET." },
};
// PDF pages of the REVIVE sections the report cites.
const REVIVE_PAGES = { "6.1.2.1": 31, "6.3.2": 37, "6.3.3": 37, "6.4.2": 39 };

const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const anchor = (href, html) => `<a class="ext" href="${escape(href)}" target="_blank" rel="noopener">${html}</a>`;

// A link to a registered source; text defaults to its label.
export function link(id, text = REFS[id].label) {
  if (!REFS[id]) throw Error(`Unknown reference ${id}`);
  return anchor(REFS[id].href, escape(text));
}

// A link to a cited section of the REVIVE standard PDF.
export function section(number, text = number) {
  if (!REVIVE_PAGES[number]) throw Error(`Unmapped REVIVE section ${number}`);
  return anchor(`${REVIVE_PDF}#page=${REVIVE_PAGES[number]}`, escape(text));
}

// Links explicit citations in already-escaped prose: each mapped REVIVE section, then the first of each named source.
const CITED = [[/Phius REVIVE 2024 Standard v24\.1\.1/, "revive"], [/Mora et al\./, "mora"], [/\bKiva\b/, "kiva"]];
export function cite(html) {
  let out = html.replace(/\b6(?:\.\d)+\b/g, n => (REVIVE_PAGES[n] ? section(n) : n));
  for (const [pattern, id] of CITED) out = out.replace(pattern, m => link(id, m));
  return out;
}

// The grouped reference list for the Data & sources page.
export function referenceList() {
  const groups = [...new Set(Object.values(REFS).map(r => r.group))];
  return groups.map(g => `<h3>${escape(g)}</h3><ul class="reference-list">${Object.entries(REFS).filter(([, r]) => r.group === g)
    .map(([id, r]) => `<li>${link(id)} <span class="reference-source">${escape(r.source)}</span>${r.note ? `<br><span class="caption">${escape(r.note)}</span>` : ""}</li>`).join("")}</ul>`).join("");
}
