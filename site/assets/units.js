// Display units. All report data is SI; the site shows US (IP) units. Every conversion,
// unit label and display precision lives here, keyed by the kind of quantity, so a
// re-exported or rerun package displays in IP with no other change.

const FT = 0.3048; // m, exact
const FT2 = FT * FT;
const FT3 = FT2 * FT;
const BTU = 1055.05585262; // J, International Table
const KWH = 3.6e6; // J
const GAL = 3.785411784e-3; // m³, US gallon
const PINT = GAL / 8;
const CFM = FT3 / 60; // m³/s
const TON = 12000 * BTU / 3600; // W

const scale = (factor) => (x) => x * factor;

// si: unit of the data; ip: displayed unit; to: SI → IP; digits: default display precision.
export const KINDS = {
  // Temperatures: 0.1 °F in tables (digits), whole °F in prose and headline metrics (proseDigits).
  temperature: { si: "°C", ip: "°F", to: (c) => c * 1.8 + 32, digits: 1, proseDigits: 0, tight: true },
  temperature_delta: { si: "K", ip: "°F", to: scale(1.8), digits: 1, tight: true },
  degree_hours: { si: "K·h", ip: "°F·h", to: scale(1.8), digits: 0 },
  area: { si: "m²", ip: "ft²", to: scale(1 / FT2), digits: 0 },
  volume: { si: "m³", ip: "ft³", to: scale(1 / FT3), digits: 0 },
  length: { si: "m", ip: "ft", to: scale(1 / FT), digits: 1 },
  electricity: { si: "kWh", ip: "kWh", to: scale(1), digits: 0 },
  energy: { si: "kWh", ip: "kBtu", to: scale(KWH / BTU / 1000), digits: 2 },
  eui: { si: "kWh/m²·yr", ip: "kBtu/ft²·yr", to: scale((KWH / BTU / 1000) * FT2), digits: 1 },
  load: { si: "W", ip: "kBtu/h", to: scale(3600 / BTU / 1000), digits: 1 },
  power: { si: "W", ip: "Btu/h", to: scale(3600 / BTU), digits: 0 },
  cooling_tons: { si: "W", ip: "tons", to: scale(1 / TON), digits: 2 },
  power_density: { si: "W/m²", ip: "W/ft²", to: scale(FT2), digits: 2 },
  occupant_density: { si: "people/m²", ip: "people/1,000 ft²", to: scale(FT2 * 1000), digits: 1 },
  airflow: { si: "m³/s", ip: "cfm", to: scale(1 / CFM), digits: 0 },
  airflow_hourly: { si: "m³/h", ip: "cfm", to: scale(1 / 3600 / CFM), digits: 0 },
  airflow_per_person: { si: "m³/s·person", ip: "cfm/person", to: scale(1 / CFM), digits: 1 },
  airflow_per_area: { si: "m³/s·m²", ip: "cfm/ft²", to: scale(FT2 / CFM), digits: 3 },
  water_flow: { si: "m³/s", ip: "gpm", to: scale(60 / GAL), digits: 2 },
  hot_water_per_area: { si: "L/h·m²", ip: "gal/h per 1,000 ft²", to: scale((1e-3 / GAL) * FT2 * 1000), digits: 1 },
  liquid_per_day: { si: "L/day", ip: "pints/day", to: scale(1e-3 / PINT), digits: 0 },
  speed: { si: "m/s", ip: "fpm", to: scale(60 / FT), digits: 0 },
  wind_speed: { si: "m/s", ip: "mph", to: scale(3600 / (5280 * FT)), digits: 0 },
};

function kind(name) {
  const k = KINDS[name];
  if (!k) throw Error(`Unknown quantity kind: ${name}`);
  return k;
}

export const value = (x, name) => kind(name).to(Number(x));
export const label = (name) => kind(name).ip;
export const digitsOf = (name) => kind(name).digits;

export function number(x, name, digits = kind(name).digits) {
  return value(x, name).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmt(x, name, digits) {
  const k = kind(name);
  return `${number(x, name, digits)}${k.tight ? "" : " "}${k.ip}`;
}

// Exporter prose marks SI quantities as {kind:value} or {kind:value:digits}; render them in IP.
// Apply to text that is already HTML-escaped; tokens contain no markup characters.
export function prose(text) {
  return String(text).replace(/\{([a-z_]+):(-?[\d.]+)(?::(\d))?\}/g, (_, name, v, d) =>
    fmt(Number(v), name, d === undefined ? kind(name).proseDigits : Number(d)),
  );
}

// Whole-unit form for prose and headline metrics where the kind defines one.
export const say = (x, name) => fmt(x, name, kind(name).proseDigits);

// Schedule unit strings as exported by Honeybee, mapped to a quantity kind.
export const SCHEDULE_KINDS = { C: "temperature", W: "power" };
