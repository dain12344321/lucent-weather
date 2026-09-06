(function (root) {
  function minutes(s) {
    if (typeof s !== "string") return null;
    const m = /T(\d{2}):(\d{2})/.exec(s);
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }
  function progress(rise, set, now) {
    if ([rise,set,now].some(value => value === null || value === undefined || value === "" || typeof value === "boolean")) return null;
    const start = Number(rise),
      end = Number(set),
      current = Number(now);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      !Number.isFinite(current) ||
      end <= start
    )
      return null;
    return Math.max(0, Math.min(1, (current - start) / (end - start)));
  }
  const labels = {
    0: "Clear sky",
    1: "Mostly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Freezing fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    56: "Freezing drizzle",
    57: "Heavy freezing drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Heavy freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Light showers",
    81: "Rain showers",
    82: "Heavy showers",
    85: "Snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm · hail",
    99: "Thunderstorm · heavy hail",
  };
  function code(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isInteger(n) ? n : null;
  }
  function dayValue(value) {
    return value === true || value === 1 || value === "1";
  }
  function condition(c) {
    return labels[code(c)] || "Unavailable";
  }
  function scene(c, day, rise, set, now) {
    const weatherCode = code(c),
      known = Object.prototype.hasOwnProperty.call(labels, weatherCode);
    const kind = !known
      ? "unknown"
      : weatherCode >= 95
        ? "storm"
        : weatherCode >= 85
          ? "snow"
          : weatherCode >= 80
            ? "rain"
            : weatherCode >= 71
              ? "snow"
              : weatherCode >= 61
                ? "rain"
                : weatherCode >= 51
                  ? "drizzle"
                  : weatherCode >= 45
                    ? "fog"
                    : weatherCode === 3
                      ? "overcast"
                      : weatherCode === 2
                        ? "partly-cloudy"
                        : "clear";
    const intensity = [55, 57, 65, 67, 75, 82, 86, 99].includes(weatherCode)
      ? "heavy"
      : [51, 56, 61, 66, 71, 77, 80, 85].includes(weatherCode)
        ? "light"
        : "moderate";
    let phase = dayValue(day) ? "day" : "night";
    if (
      Number.isFinite(rise) &&
      Number.isFinite(set) &&
      set > rise &&
      Number.isFinite(now)
    ) {
      phase = now >= rise && now < set ? "day" : "night";
      if (now >= rise - 35 && now <= rise + 35) phase = "sunrise";
      else if (now >= set - 45 && now <= set + 30) phase = "sunset";
    }
    return {
      kind,
      intensity,
      phase,
      frozen: [48, 56, 57, 66, 67].includes(weatherCode),
      hail: [96, 99].includes(weatherCode),
    };
  }
  function theme(c, day) {
    const weatherCode = code(c);
    if (weatherCode >= 95) return "storm";
    if ((weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86)) return "snow";
    if (weatherCode >= 51 && weatherCode <= 82) return "rain";
    if (weatherCode === 45 || weatherCode === 48) return "fog";
    if (weatherCode >= 2 && weatherCode <= 3) return dayValue(day) ? "cloudy" : "night-cloudy";
    return dayValue(day) ? "clear" : "night";
  }
  function aqiLabel(value) {
    if (value === null || value === undefined || value === "") return "Unavailable";
    const n = Number(value);
    if (!Number.isFinite(n)) return "Unavailable";
    return n <= 50
      ? "Good"
      : n <= 100
        ? "Moderate"
        : n <= 150
          ? "Sensitive groups"
          : n <= 200
            ? "Unhealthy"
            : n <= 300
              ? "Very unhealthy"
              : "Hazardous";
  }
  function icon(t) {
    return (
      {
        clear: "☀",
        night: "☾",
        cloudy: "☁",
        "night-cloudy": "☁",
        rain: "☂",
        snow: "❄",
        storm: "ϟ",
        fog: "≋",
      }[t] || "☀"
    );
  }
  const api = { minutes, progress, condition, theme, icon, scene, labels, aqiLabel };
  if (typeof module !== "undefined") module.exports = api;
  else root.Solar = api;
})(globalThis);
