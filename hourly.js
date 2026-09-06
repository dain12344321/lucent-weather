(function () {
  function number(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
    if (typeof value !== "string" || value.trim() === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  function next(hourly, now = Date.now()) {
    if (!Array.isArray(hourly?.time)) return [];
    const nowMs = number(now instanceof Date ? now.getTime() : now);
    if (nowMs === undefined) return [];
    const start = Math.floor(nowMs / 3600000) * 3600,
      end = start + 86400,
      seen = new Set(),
      result = [];
    hourly.time.forEach((rawTime, i) => {
      const time = number(rawTime);
      if (time === undefined || time < start || time >= end || seen.has(time))
        return;
      seen.add(time);
      result.push({
        time,
        temp: number(hourly.temperature_2m?.[i]),
        feels: number(hourly.apparent_temperature?.[i]),
        humidity: number(hourly.relative_humidity_2m?.[i]),
        code: number(hourly.weather_code?.[i]),
        wind: number(hourly.wind_speed_10m?.[i]),
        rain: number(hourly.precipitation_probability?.[i]),
        day: number(hourly.is_day?.[i]),
      });
    });
    return result.sort((a, b) => a.time - b.time).slice(0, 24);
  }
  const api = { next, number };
  if (typeof module !== "undefined") module.exports = api;
  else globalThis.Hourly = api;
})();
