(function (root) {
  function minutes(s) {
    if (!s) return null;
    const m = /T(\d{2}):(\d{2})/.exec(s);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }
  function progress(rise, set, now) {
    if (rise === null || set === null || set <= rise) return null;
    return Math.max(0, Math.min(1, (now - rise) / (set - rise)));
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
  function condition(c) {
    return labels[c] || "Unavailable";
  }
  function scene(c, day, rise, set, now) {
    const known = Object.prototype.hasOwnProperty.call(labels, c);
    const kind = !known
      ? "unknown"
      : c >= 95
        ? "storm"
        : c >= 85
          ? "snow"
          : c >= 80
            ? "rain"
            : c >= 71
              ? "snow"
              : c >= 61
                ? "rain"
                : c >= 51
                  ? "drizzle"
                  : c >= 45
                    ? "fog"
                    : c === 3
                      ? "overcast"
                      : c === 2
                        ? "partly-cloudy"
                        : "clear";
    const intensity = [55, 57, 65, 67, 75, 82, 86, 99].includes(c)
      ? "heavy"
      : [51, 56, 61, 66, 71, 77, 80, 85].includes(c)
        ? "light"
        : "moderate";
    let phase = day ? "day" : "night";
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
      frozen: [48, 56, 57, 66, 67].includes(c),
      hail: [96, 99].includes(c),
    };
  }
  function theme(c, day) {
    if (c >= 95) return "storm";
    if ((c >= 71 && c <= 77) || (c >= 85 && c <= 86)) return "snow";
    if (c >= 51 && c <= 82) return "rain";
    if (c === 45 || c === 48) return "fog";
    if (c >= 2 && c <= 3) return day ? "cloudy" : "night-cloudy";
    return day ? "clear" : "night";
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
  const api = { minutes, progress, condition, theme, icon, scene, labels };
  if (typeof module !== "undefined") module.exports = api;
  else root.Solar = api;
})(globalThis);
