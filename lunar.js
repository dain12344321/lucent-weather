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
    if (phase === null || phase === undefined || phase === "" || typeof phase === "boolean") return null;
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
  // Orthographic illuminated sphere. Canonical north-up phase diagram, not sky orientation.
  function draw(canvas, phase) {
    const normalized = normalizePhase(phase);
    if (!canvas || normalized === null) return;
    const ctx = canvas.getContext("2d"),
      size = canvas.width,
      r = size * 0.46,
      mid = size / 2;
    if (!ctx || !Number.isInteger(size) || size < 1) return;
    ctx.clearRect(0, 0, size, size);
    const pixels = ctx.createImageData(size, size);
    const angle = normalized * Math.PI * 2,
      sx = Math.sin(angle),
      sz = -Math.cos(angle);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const nx = (x + 0.5 - mid) / r,
          ny = (y + 0.5 - mid) / r,
          d = nx * nx + ny * ny;
        if (d > 1) continue;
        const z = Math.sqrt(1 - d),
          lit = nx * sx + z * sz;
        const texture =
          1 - 0.055 * Math.sin(nx * 16 + ny * 9) * Math.sin(ny * 13 - nx * 5);
        const brightness =
          (lit > 0 ? 190 + 48 * Math.sqrt(Math.max(0, lit)) : 32) * texture;
        const i = (y * size + x) * 4;
        pixels.data[i] = brightness * 0.95;
        pixels.data[i + 1] = brightness * 0.98;
        pixels.data[i + 2] = Math.min(255, brightness * 1.04);
        pixels.data[i + 3] = Math.min(255, (1 - d) * r * 255);
      }
    ctx.putImageData(pixels, 0, 0);
  }
  function update(s, preview) {
    const now = preview?.now ? new Date(preview.now) : new Date(),
      illum = SunCalc.getMoonIllumination(now),
      pos = SunCalc.getMoonPosition(now, s.place.latitude, s.place.longitude);
    const override = normalizePhase(preview?.moonPhase),
      phase = override ?? normalizePhase(illum.phase) ?? 0;
    const fraction =
      override === null
        ? Math.max(0, Math.min(1, Number(illum.fraction)))
        : (1 - Math.cos(phase * 2 * Math.PI)) / 2;
    const name = phaseName(phase);
    document.getElementById("moon-name").textContent = name;
    document.getElementById("moon-detail").textContent =
      `${Math.round(fraction * 100)}% illuminated · ${phase < 0.5 ? "Waxing" : "Waning"}`;
    document.getElementById("moon-horizon").textContent =
      Number(pos.altitude) > 0 ? "Above\nhorizon" : "Below\nhorizon";
    document.getElementById("moon-horizon").title =
      "Calculated for your selected location; clouds may obscure the Moon.";
    document
      .getElementById("moon-disc")
      .setAttribute(
        "aria-label",
        `${name}, ${Math.round(fraction * 100)} percent illuminated`,
      );
    draw(document.getElementById("moon-disc"), phase);
    draw(document.getElementById("sky-moon"), phase);
    document.body.dataset.moonUp = String(
      override !== null || Number(pos.altitude) > 0,
    );
  }
  const api = { normalizePhase, phaseName, draw, update };
  if (typeof module !== "undefined") module.exports = api;
  else globalThis.Lunar = api;
})();
