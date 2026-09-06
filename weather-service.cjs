const DAILY = ["weather_code", "temperature_2m_max", "temperature_2m_min", "sunrise", "sunset", "precipitation_probability_max"];
async function json(url) {
  let response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(15000) }); }
  catch (error) { throw Error(error.name === "TimeoutError" ? "Weather request timed out. Please retry." : "Cannot reach the weather service. Check your connection."); }
  if (response.status === 429) throw Error("Weather service is busy. Please wait before refreshing.");
  if (!response.ok) throw Error(`Weather service returned ${response.status}. Try again shortly.`);
  try { return await response.json(); }
  catch { throw Error("Weather service sent an invalid response. Try again shortly."); }
}
function validPlace(p) {
  return p && typeof p.name === "string" && p.name.trim().length > 0 &&
    Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 &&
    Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;
}
function normalizeConfig(value) {
  const c = value && typeof value === "object" ? value : {};
  let place;
  if (validPlace(c.place)) {
    const p = c.place;
    place = { name: p.name.slice(0, 120), label: String(p.label || p.name).slice(0, 240), latitude: p.latitude, longitude: p.longitude };
    try { new Intl.DateTimeFormat("en", {timeZone:p.timezone}).format(); place.timezone = p.timezone || "UTC"; }
    catch { place.timezone = "UTC"; }
  }
  return { place, unit: c.unit === "C" ? "C" : "F", position: c.position === "left" ? "left" : "tray", screens: c.screens === "all" ? "all" : "primary" };
}
async function fetchWeather(config, request = json) {
  const coordinates = {latitude: config.place.latitude, longitude: config.place.longitude};
  const units = {temperature_unit: config.unit === "C" ? "celsius" : "fahrenheit", wind_speed_unit: config.unit === "C" ? "kmh" : "mph"};
  const forecast = new URLSearchParams({...coordinates, ...units, current:"temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day", daily:DAILY.join(","), timezone:"auto", forecast_days:"7", past_days:"1"});
  const hourly = new URLSearchParams({...coordinates, ...units, hourly:"temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation_probability,is_day", timeformat:"unixtime", timezone:"GMT", forecast_days:"3"});
  const air = new URLSearchParams({...coordinates, hourly:"us_aqi,uv_index", timeformat:"unixtime", timezone:"GMT", forecast_days:"2"});
  // Independent calls share one deadline window; optional providers cannot discard the core forecast.
  const [currentResult, hourlyResult, airResult] = await Promise.allSettled([
    request("https://api.open-meteo.com/v1/forecast?" + forecast),
    request("https://api.open-meteo.com/v1/forecast?" + hourly),
    request("https://air-quality-api.open-meteo.com/v1/air-quality?" + air),
  ]);
  if (currentResult.status === "rejected") throw currentResult.reason;
  const data = currentResult.value;
  if (!data?.current || !Number.isFinite(data.current.temperature_2m) || !Array.isArray(data.daily?.time) || data.daily.time.length < 7 || !DAILY.every(k => Array.isArray(data.daily[k]) && data.daily[k].length === data.daily.time.length)) throw Error("Incomplete weather response. Please retry.");
  try { new Intl.DateTimeFormat("en", {timeZone:data.timezone}).format(); }
  catch { throw Error("Weather service sent an invalid timezone. Please retry."); }
  data.timezone = data.timezone || config.place.timezone || "UTC";
  data.hourly = hourlyResult.status === "fulfilled" && Array.isArray(hourlyResult.value?.hourly?.time) ? hourlyResult.value.hourly : null;
  if (!data.hourly) data.hourlyError = "Hourly forecast temporarily unavailable";
  data.air = airResult.status === "fulfilled" && Array.isArray(airResult.value?.hourly?.time) ? airResult.value.hourly : null;
  return data;
}
module.exports = { json, fetchWeather, validPlace, normalizeConfig };
