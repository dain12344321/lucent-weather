document.getElementById("widget").onclick = () => window.weather.toggle();
const widget = document.getElementById("widget");
const icon = document.getElementById("icon");
icon.append(WeatherIcons.graphic(WeatherIcons.solar("day")));
function clearHighlight() {
  widget.blur();
  // Native menus can swallow pointerleave, leaving Chromium's :hover latched.
  widget.classList.add("menu-dismissed");
}
function restoreHighlight() { widget.classList.remove("menu-dismissed"); }
widget.addEventListener("pointermove", restoreHighlight);
widget.addEventListener("pointerenter", restoreHighlight);
widget.addEventListener("keydown", restoreHighlight);
window.addEventListener("blur", clearHighlight);
document.addEventListener("contextmenu", async (e) => {
  e.preventDefault();
  try { await window.weather.menu(); }
  finally { clearHighlight(); }
});
window.weather.onUpdate((s) => {
  if (s.loading) {
    widget.setAttribute("aria-busy", "true");
    return;
  }
  widget.setAttribute("aria-busy", "false");
  if (s.error) {
    if (s.selectionFailed && s.last) return;
    if (!s.last) document.getElementById("temp").textContent = "Weather";
    document.getElementById("detail").textContent = s.last ? "Update unavailable" : "Open to retry";
    widget.title = s.error;
    return;
  }
  const c = s.data.current;
  const theme = Solar.theme(c.weather_code, c.is_day);
  document.body.dataset.weather = theme;
  const skyAt = Solar.localSky(s.data.daily, s.data.timezone || "UTC");
  const { phase } = skyAt(c.weather_code, c.is_day, Date.now());
  icon.replaceChildren(
    WeatherIcons.graphic(WeatherIcons.weather(c.weather_code, phase)),
  );
  document.getElementById("temp").textContent =
    `${Math.round(c.temperature_2m)}°${s.unit}`;
  document.getElementById("detail").textContent = Solar.condition(
    c.weather_code,
  );
  document.getElementById("widget").title =
    s.place.label + " · Click for forecast";
});
