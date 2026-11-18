(function () {
  const names = [
    "New moon",
    "Waxing crescent",
    "First quarter",
    "Waxing gibbous",
    "Full moon",
    "Waning gibbous",
    "Last quarter",
    "Waning crescent",
  ];
  function normalizePhase(phase) {
    if (phase == null || typeof phase === "boolean" || (typeof phase === "string" && !phase.trim())) return null;
    const n = Number(phase);
    if (!Number.isFinite(n)) return null;
    return ((n % 1) + 1) % 1;
  }
  function phaseName(phase) {
    const normalized = normalizePhase(phase);
    return normalized === null
      ? "Moon phase unavailable"
      : names[Math.round(normalized * 8) % 8];
  }
  // A north-up phase diagram, independent of the Moon's apparent tilt in the sky.
  function draw(disc, phase) {
    const graphic = WeatherIcons.graphic(WeatherIcons.moon(phase));
    graphic.setAttribute("viewBox", "3 3 22 22");
    disc.replaceChildren(graphic);
  }
  function update(s, preview) {
    const now = preview?.now ? new Date(preview.now) : new Date(),
      illum = SunCalc.getMoonIllumination(now),
      pos = SunCalc.getMoonPosition(now, s.place.latitude, s.place.longitude);
    const override = normalizePhase(preview?.moonPhase),
      phase = override ?? normalizePhase(illum.phase);
    const fraction = override === null ? illum.fraction : (1 - Math.cos(phase * 2 * Math.PI)) / 2;
    const available = phase !== null && Number.isFinite(fraction);
    const name = phaseName(available ? phase : null);
    const percent = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
    const altitude = pos.altitude;
    const above = Number.isFinite(altitude) && altitude > 0;
    const disc = document.getElementById("moon-disc");
    const sky = document.getElementById("sky-moon");
    document.getElementById("moon-name").textContent = name;
    document.getElementById("moon-detail").textContent = available
      ? `${percent}% illuminated · ${phase < 0.5 ? "Waxing" : "Waning"}` : "";
    document.getElementById("moon-horizon").textContent = available && Number.isFinite(altitude)
      ? (above ? "Above\nhorizon" : "Below\nhorizon") : "";
    document.getElementById("moon-horizon").title =
      "Calculated for your selected location; clouds may obscure the Moon.";
    disc.setAttribute("aria-label", available ? `${name}, ${percent} percent illuminated` : name);
    draw(disc, available ? phase : null);
    const visible = available && (above || override !== null) && percent > 0;
    if (visible) draw(sky, phase);
    else sky.replaceChildren();
    document.body.dataset.moonUp = String(visible);
  }
  const api = { normalizePhase, phaseName, draw, update };
  if (typeof module !== "undefined") module.exports = api;
  else globalThis.Lunar = api;
})();
