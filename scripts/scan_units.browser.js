// Release check: rendered pages must show no SI units (except the Data & sources page, which
// describes the SI downloads). Run in the browser console or Browser tool on the local preview
// (node scripts/serve.mjs, http://127.0.0.1:4624/). Opens every page, every disclosure and
// supporting-graph panel, every Program zone/schedule/scenario and every design condition.
// Expected result: every page lists [] and 0 errors; downloads.html may list "°C".
(async () => {
  const pages = ["index.html", "program.html", "model.html", "annual-energy.html", "peak-loads.html", "resilience.html", "downloads.html"];
  const SI = /\d\s?(?:°C|m²|m³|m\/s|L\/s|L\/day|L\/h|W\/m²|kW\b|K·h)|°C|\bm²|\bm³|W\/m²|\bkW\b|L\/s/g;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  for (const page of pages) {
    const frame = document.createElement("iframe");
    frame.style.cssText = "width:1280px;height:900px;position:fixed;left:-3000px";
    frame.src = "/" + page;
    document.body.append(frame);
    await new Promise((r) => (frame.onload = r));
    await wait(1500);
    const d = frame.contentDocument;
    const scan = (key) => { const m = d.body.innerText.match(SI); if (m) out[key] = [...new Set(m)].slice(0, 5); };
    d.querySelectorAll("details").forEach((x) => (x.open = true));
    await wait(1500);
    if (page === "program.html")
      for (const zone of d.querySelectorAll("[data-zone]")) {
        zone.click();
        await wait(200);
        const schedule = d.querySelector("#schedule");
        for (const option of schedule.options) {
          schedule.value = option.value;
          schedule.dispatchEvent(new Event("change"));
          for (const scenario of ["annual", "winter_design", "summer_design"]) {
            const s = d.querySelector("#scenario");
            s.value = scenario;
            s.dispatchEvent(new Event("change"));
            scan(`${page}: ${zone.textContent} / ${option.textContent} / ${scenario}`);
          }
        }
      }
    if (page === "peak-loads.html") {
      const c = d.querySelector("#design-condition");
      for (const option of c.options) { c.value = option.value; c.dispatchEvent(new Event("change")); scan(`${page}: ${option.textContent}`); }
    }
    const text = d.body.innerText + [...d.querySelectorAll("svg title, svg text")].map((e) => e.textContent).join(" ");
    out[page] = [...new Set(text.match(SI) || [])];
    out[`${page} errors`] = d.querySelectorAll(".error").length;
    frame.remove();
  }
  console.table(out);
  return out;
})();
