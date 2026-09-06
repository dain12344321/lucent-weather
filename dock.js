document.getElementById("widget").onclick = () => window.weather.toggle();
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  window.weather.menu();
});
window.weather.onUpdate((s) => {
  if (s.loading) return;
  if (s.error) {
    document.getElementById("detail").textContent = "Update unavailable";
    return;
  }
  const c = s.data.current;
  const theme = Solar.theme(c.weather_code, c.is_day);
  document.body.dataset.weather = theme;
  document
    .getElementById("weather-glyph")
    .setAttribute(
      "href",
      "#" +
        {
          clear: "sunny",
          night: "moon",
          cloudy: "cloudy",
          "night-cloudy": "cloudy",
          rain: "rainy",
          snow: "snowy",
          storm: "stormy",
          fog: "foggy",
        }[theme],
    );
  document.getElementById("temp").textContent =
    `${Math.round(c.temperature_2m)}°${s.unit}`;
  document.getElementById("detail").textContent = Solar.condition(
    c.weather_code,
  );
  document.getElementById("widget").title =
    s.place.label + " · Click for forecast";
});
