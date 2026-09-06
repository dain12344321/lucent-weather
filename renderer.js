const $ = (id) => document.getElementById(id);
let active = null,
  state = null,
  searchId = 0,
  lastError = null,
  selecting = false,
  selectionId = 0,
  refreshing = false;
window.trayImage = (temp) => {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const x = c.getContext("2d");
  x.fillStyle = "#17242b";
  x.beginPath();
  x.roundRect(0, 0, 32, 32, 7);
  x.fill();
  x.fillStyle = "#f5d799";
  if (temp === null) {
    x.beginPath();
    x.arc(16, 16, 8, 0, Math.PI * 2);
    x.fill();
  } else {
    x.font = `bold ${String(temp).length > 2 ? 17 : 22}px Arial`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(String(temp), 16, 17);
  }
  return c.toDataURL();
};
function text(id, value) {
  const node = $(id);
  if (node) node.textContent = value;
}
function clock(s) {
  const m = Solar.minutes(s);
  if (m === null) return "—";
  return `${m % 720 < 60 ? 12 : Math.floor(m / 60) % 12}:${String(m % 60).padStart(2, "0")} ${m >= 720 ? "PM" : "AM"}`;
}
function value(n) {
  const number = finite(n);
  return number === null ? "—" : Math.round(number);
}
function finite(n) {
  return Hourly.number(n) ?? null;
}
function dateValue(value, fallback = new Date()) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : fallback;
}
function timezone(value) {
  return Daylight.validTimeZone(value) || "UTC";
}
function dateLabel(day, zone) {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return "—";
  const ms = Daylight.instant(`${day}T12:00`, zone);
  try {
    return new Intl.DateTimeFormat("en", {
      weekday: "short",
      timeZone: zone,
    }).format(new Date(ms ?? `${day}T12:00:00Z`));
  } catch {
    return "—";
  }
}
function errorMessage(error, fallback = "Something went wrong. Try again.") {
  const message = error?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}
function setRefreshBusy(busy) {
  refreshing = busy;
  const button = $("refresh");
  if (!button) return;
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  button.title = busy ? "Updating weather…" : "Refresh weather";
}
function scrollBehavior() {
  return typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}
function scrollToPage(id, behavior = scrollBehavior()) {
  const host = document.querySelector("main"), page = $(id);
  if (!host || !page) return;
  host.scrollTo({top:host.scrollTop + page.getBoundingClientRect().top - host.getBoundingClientRect().top, behavior});
}
function forecastState(s) {
  return Boolean(s?.data?.current && s?.data?.daily && s?.place);
}
function clearForecast(message) {
  state = null;
  active = null;
  selecting = false;
  selectionId++;
  $("forecast").hidden = true;
  $("setup").hidden = false;
  $("cancel").hidden = true;
  $("unit").disabled = false;
  $("search-button").disabled = false;
  for (const result of $("results").children) result.disabled = false;
  setRefreshBusy(false);
  text("status", message);
}
function render(s, preview) {
  if (!forecastState(s)) return;
  const firstRender = !state;
  state = s;
  active = s.place;
  $("setup").hidden = true;
  $("forecast").hidden = false;
  $("cancel").hidden = false;
  const { data: d, unit: u } = s,
    c = d.current || {},
    a = d.daily || {},
    zone = timezone(d.timezone),
    at = dateValue(preview?.now);
  const daylight = Daylight.describe(a, zone, at),
    isDay = c.is_day === undefined || c.is_day === null ? daylight.daytime : c.is_day;
  document.body.dataset.weather = Solar.theme(c.weather_code, isDay);
  text("place", s.place.name);
  text("region", s.place.label);
  text(
    "date",
    new Intl.DateTimeFormat("en", {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: zone,
    })
      .format(at)
      .toUpperCase(),
  );
  text("temperature", value(c.temperature_2m) + "°");
  text("condition", Solar.condition(c.weather_code));
  text("feels", `Feels like ${value(c.apparent_temperature)}°${u}`);
  text("wind", `Wind ${value(c.wind_speed_10m)} ${u === "C" ? "km/h" : "mph"}`);
  text("humidity", `Humidity ${value(c.relative_humidity_2m)}%`);
  const sunrise = Array.isArray(a.sunrise) ? a.sunrise : [],
    sunset = Array.isArray(a.sunset) ? a.sunset : [],
    idx = daylight.index,
    rise = idx < 0 ? null : Solar.minutes(sunrise[idx]),
    set = idx < 0 ? null : Solar.minutes(sunset[idx]);
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: zone,
  }).formatToParts(at);
  const now =
      Number(parts.find((p) => p.type === "hour")?.value) * 60 +
      Number(parts.find((p) => p.type === "minute")?.value),
    t = daylight.progress;
  text(
    "sunrise",
    clock(sunrise[daylight.daytime ? idx : daylight.nextIndex]),
  );
  text("sunset", clock(sunset[idx]));
  const visual = Solar.scene(
    c.weather_code,
    daylight.daytime ? 1 : 0,
    rise,
    set,
    Number.isFinite(now) ? now : null,
  );
  if (preview?.phase) visual.phase = preview.phase;
  Object.assign(document.body.dataset, {
    scene: visual.kind,
    phase: visual.phase,
    intensity: visual.intensity,
    frozen: String(visual.frozen),
    hail: String(visual.hail),
  });
  Lunar.update(s, preview);
  document.body.dataset.daytime = String(daylight.daytime);
  $("night-details").hidden = daylight.daytime;
  $("solar-detail").hidden = !daylight.daytime;
  const noonInstant = daylight.day
    ? Daylight.instant(daylight.day + "T12:00", zone)
    : null;
  const noon = noonInstant === null
    ? null
    : SunCalc.getTimes(
        new Date(noonInstant),
        s.place.latitude,
        s.place.longitude,
      ).solarNoon;
  text(
    "solar-detail",
    noon && Number.isFinite(noon.getTime())
      ? "Solar noon · " +
          new Intl.DateTimeFormat("en", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: zone,
          }).format(noon)
      : "Solar noon unavailable",
  );
  const airTimes = Array.isArray(d.air?.time) ? d.air.time : [],
    atSeconds = at.getTime() / 1000,
    ai = airTimes.findIndex(
      (time) => Number(time) <= atSeconds && Number(time) + 3600 > atSeconds,
    ),
    uv = d.air?.uv_index?.[ai],
    aqi = d.air?.us_aqi?.[ai];
  $("uv").hidden = !daylight.daytime;
  text(
    "uv",
    finite(uv) === null ? "UV unavailable" : "UV " + finite(uv).toFixed(1),
  );
  text(
    "air-quality",
    finite(aqi) === null
      ? "Air quality unavailable"
      : "Air " + Math.round(finite(aqi)) + " · " + Solar.aqiLabel(aqi),
  );
  Radar.setPlace(s.place);

  renderHourly(s);
  const rising = !daylight.daytime;
  $("light-title").replaceChildren(solarIcon(rising));
  $("light-title").title = rising ? "Next sunrise" : "Next sunset";
  const duration = daylight.duration,
    remaining = daylight.remaining,
    countdown =
      remaining === null
        ? "Unavailable"
        : `${Math.floor(remaining / 60)}h ${remaining % 60}m`;
  text(
    "daylength",
    daylight.daytime && duration !== null
      ? `${Math.floor(duration / 60)}h ${duration % 60}m daylight`
      : "NIGHT · THE MOON",
  );
  $("sun").style.display = daylight.daytime ? "" : "none";
  $("arc-moon").style.display = daylight.daytime ? "none" : "";
  $("arc-marker").style.display = t === null ? "none" : "";
  if (t !== null)
    $("arc-marker").style.transform =
      `translate(${20 + 300 * t}px,${125 - 400 * t * (1 - t)}px)`;
  text("sun-caption", daylight.daytime ? "Daylight" : countdown);
  $("sun-caption").setAttribute("font-size", daylight.daytime ? "12" : "25");
  text(
    "next-event",
    remaining === null
      ? "Sun times unavailable for the forecast period."
      : `${daylight.daytime ? "Sunset" : "Sunrise"} in ${countdown}`,
  );
  $("days").replaceChildren();
  const days = Array.isArray(a.time) ? a.time : [];
  const codes = Array.isArray(a.weather_code) ? a.weather_code : [],
    precipitation = Array.isArray(a.precipitation_probability_max)
      ? a.precipitation_probability_max
      : [],
    highs = Array.isArray(a.temperature_2m_max) ? a.temperature_2m_max : [],
    lows = Array.isArray(a.temperature_2m_min) ? a.temperature_2m_min : [];
  days.forEach((day, i) => {
    if (day < daylight.day) return;
    const row = document.createElement("div");
    row.className = "day";
    const vals = [
      day === daylight.day
        ? "Today"
        : dateLabel(day, zone),
      Solar.condition(codes[i]),
      `${value(precipitation[i])}%`,
      `${value(highs[i])}° / ${value(lows[i])}°`,
    ];
    vals.forEach((v, j) => {
      const span = document.createElement("span");
      span.textContent = v;
      span.title = v;
      span.className = j === 2 ? "rain" : j === 3 ? "temps" : "";
      row.append(span);
      if (j === 1) {
        const glyph = weatherIcon(codes[i]);
        row.append(glyph);
      }
    });
    $("days").append(row);
  });
  if (!days.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Daily forecast unavailable.";
    $("days").append(empty);
  }
  if (firstRender && typeof requestAnimationFrame === "function")
    requestAnimationFrame(() =>
      scrollToPage("now-page", "instant"),
    );
  const updated = dateValue(s.updated, at);
  text(
    "status",
    `Updated ${updated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · °${u}`,
  );
}
window.weather.onUpdate((s) => {
  const editing = !$("setup").hidden && !!state && !selecting;
  if (s.loading) {
    setRefreshBusy(true);
    text("status", "Updating weather…");
    return;
  }
  setRefreshBusy(false);
  if (s.error) {
    lastError = s.error;
    if (forecastState(s.last)) {
      render(s.last);
      text("status", "Showing last update. " + s.error);
    } else {
      clearForecast(s.error);
    }
  } else {
    ((lastError = null), (selecting = false));
    if (forecastState(s)) render(s);
    else clearForecast("Weather data is unavailable. Choose a location to try again.");
  }
  if (editing) {
    $("setup").hidden = false;
    $("forecast").hidden = true;
  }
});
$("query").addEventListener("input", () => {
  searchId++;
  if (!selecting) $("search-button").disabled = false;
  $("results").replaceChildren();
});
$("search-form").onsubmit = async (e) => {
  e.preventDefault();
  const id = ++searchId;
  const query = $("query").value.trim();
  if (query.length < 2) {
    text("status", "Enter at least two characters.");
    return;
  }
  $("search-button").disabled = true;
  text("status", "Finding places…");
  $("results").replaceChildren();
  try {
    const results = await window.weather.search(query);
    if (id !== searchId || query !== $("query").value.trim()) return;
    const places = Array.isArray(results) ? results : [];
    text(
      "status",
      places.length
        ? "Choose your location below."
        : "No places found. Try a nearby town or a city name.",
    );
    places.forEach((p) => {
      const b = document.createElement("button");
      b.className = "result";
      b.type = "button";
      b.textContent = p.label;
      b.onclick = async () => {
        if (selecting) return;
        const token = ++selectionId;
        selecting = true;
        for (const result of $("results").children) result.disabled = true;
        $("search-button").disabled = true;
        $("unit").disabled = true;
        text("status", "Loading local weather…");
        try {
          await window.weather.select(p, $("unit").value);
        } catch (e) {
          if (token === selectionId) text("status", errorMessage(e));
        } finally {
          if (token === selectionId) {
            selecting = false;
            $("unit").disabled = false;
            if (!$("setup").hidden) $("search-button").disabled = false;
            for (const result of $("results").children) result.disabled = false;
          }
        }
      };
      $("results").append(b);
    });
  } catch (e) {
    if (id === searchId)
      text("status", errorMessage(e, "Search failed. Try again."));
  } finally {
    if (id === searchId && !selecting) $("search-button").disabled = false;
  }
};
$("settings").onclick = () => {
  searchId++;
  $("search-button").disabled = selecting;
  $("setup").hidden = false;
  $("forecast").hidden = true;
  $("query").focus();
};
$("cancel").onclick = () => {
  searchId++;
  $("search-button").disabled = selecting;
  if (state) render(state);
  else {
    $("setup").hidden = false;
    $("forecast").hidden = true;
  }
};
$("refresh").onclick = async () => {
  if (refreshing) return;
  setRefreshBusy(true);
  text("status", "Updating weather…");
  try {
    await window.weather.refresh();
  } catch (e) {
    setRefreshBusy(false);
    text("status", errorMessage(e, "Refresh failed. Try again."));
  }
};
$("unit").onchange = async () => {
  if (active && !selecting) {
    const token = ++selectionId;
    selecting = true;
    $("unit").disabled = true;
    text("status", "Updating temperature units…");
    try {
      await window.weather.select(active, $("unit").value);
    } catch (e) {
      if (token === selectionId) text("status", errorMessage(e));
    } finally {
      if (token === selectionId) {
        selecting = false;
        $("unit").disabled = false;
      }
    }
  }
};
window.weather
  .settings()
  .then((s) => {
    $("unit").value = s.unit || "F";
    if (s.place) {
      active = s.place;
      $("query").value = s.place.name;
      text("status", "Loading local weather…");
    }
  })
  .catch((e) => text("status", errorMessage(e, "Settings unavailable.")));

document.getElementById("close").onclick = () => window.weather.hide();
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.weather.hide();
});

setInterval(() => {
  if (
    state &&
    !refreshing &&
    !document.hidden &&
    !document.getElementById("forecast").hidden
  ) {
    render(state);
    if (lastError) text("status", "Showing last update. " + lastError);
  }
}, 60000);

function solarIcon(rising) {
  const ns = "http://www.w3.org/2000/svg",
    svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 28 24");
  svg.setAttribute("class", "event-icon");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", rising ? "Sunrise" : "Sunset");
  const p = document.createElementNS(ns, "path");
  p.setAttribute(
    "d",
    "M3 19h22M7 16a7 7 0 0 1 14 0M14 1v4M3 8l3 2M25 8l-3 2" +
      (rising ? "M14 16V9m-3 3 3-3 3 3" : "M14 9v7m-3-3 3 3 3-3"),
  );
  p.setAttribute("fill", "none");
  p.setAttribute("stroke", "#f5d799");
  p.setAttribute("stroke-width", "1.7");
  p.setAttribute("stroke-linecap", "round");
  p.setAttribute("stroke-linejoin", "round");
  svg.append(p);
  return svg;
}
function weatherIcon(code, day = 1) {
  const kind = Solar.scene(code, 1).kind,
    id =
      (day === 0 || day === "0") && (code === 0 || code === "0")
        ? "moon"
        : {
            clear: "sunny",
            "partly-cloudy": "cloudy",
            overcast: "cloudy",
            drizzle: "rainy",
            rain: "rainy",
            snow: "snowy",
            storm: "stormy",
            fog: "foggy",
            unknown: "cloudy",
          }[kind];
  const ns = "http://www.w3.org/2000/svg",
    svg = document.createElementNS(ns, "svg"),
    use = document.createElementNS(ns, "use");
  svg.setAttribute("viewBox", "0 0 28 28");
  svg.setAttribute("class", "forecast-icon");
  svg.setAttribute("aria-hidden", "true");
  use.setAttribute("href", "#" + id);
  svg.append(use);
  return svg;
}
window.weather.onTick(() => {
  if (state && document.getElementById("setup").hidden) {
    render(state);
    if (lastError) text("status", "Showing last update. " + lastError);
  }
});

let selectedHour = null,
  hourlyPlace = "";
function renderHourly(s) {
  const list = Hourly.next(s.data?.hourly);
  const key = `${s.place.latitude},${s.place.longitude}`;
  if (hourlyPlace !== key) {
    selectedHour = null;
    hourlyPlace = key;
  }
  const scroller = $("hours"),
    oldScroll = scroller.scrollLeft;
  scroller.replaceChildren();
  if (!list.length) {
    text(
      "hourly-summary",
      s.data.hourlyError || "Hourly forecast unavailable.",
    );
    text("hourly-range", "");
    $("hour-detail").replaceChildren();
    return;
  }
  if (!list.some((h) => h.time === selectedHour)) selectedHour = list[0].time;
  const zone = timezone(s.data?.timezone),
    formatter = new Intl.DateTimeFormat("en", {
      hour: "numeric",
      timeZone: zone,
    }),
    detailFormatter = new Intl.DateTimeFormat("en", {
      weekday: "short",
      hour: "numeric",
      timeZone: zone,
    }),
    label = (time) => formatter.format(new Date(time * 1000));
  const temps = list.map((h) => finite(h.temp)).filter((n) => n !== null);
  text(
    "hourly-range",
    temps.length
      ? `${Math.round(Math.min(...temps))}° – ${Math.round(Math.max(...temps))}°`
      : "",
  );
  const rain = list.find((h) => finite(h.rain) !== null && finite(h.rain) >= 40);
  text(
    "hourly-summary",
    rain
      ? `Rain chance reaches ${Math.round(rain.rain)}% at ${label(rain.time)}. Tap an hour for details.`
      : "Your day, hour by hour. Tap an hour for details.",
  );
  for (const h of list) {
    const b = document.createElement("button");
    b.className = "hour";
    b.type = "button";
    b.setAttribute("role", "option");
    b.setAttribute("aria-selected", String(h.time === selectedHour));
    b.setAttribute("aria-pressed", String(h.time === selectedHour));
    b.setAttribute(
      "aria-label",
      `${label(h.time)}, ${value(h.temp)} degrees, ${Solar.condition(h.code)}, ${value(h.rain)} percent rain chance`,
    );
    const time = document.createElement("span");
    time.textContent = label(h.time);
    const temp = document.createElement("strong");
    temp.textContent = `${value(h.temp)}°`;
    const chance = document.createElement("span");
    chance.className = "chance";
    chance.textContent = `${value(h.rain)}%`;
    b.append(time, weatherIcon(h.code, h.day), temp, chance);
    b.onclick = () => {
      selectedHour = h.time;
      for (const button of scroller.children) {
        button.setAttribute("aria-selected", String(button === b));
        button.setAttribute("aria-pressed", String(button === b));
      }
      detail(h);
    };
    scroller.append(b);
  }
  scroller.scrollLeft = oldScroll;
  detail(list.find((h) => h.time === selectedHour));
  function detail(h) {
    const host = $("hour-detail");
    host.replaceChildren();
    if (!h) return;
    const title = document.createElement("strong");
    title.textContent =
      detailFormatter.format(new Date(h.time * 1000)) +
      " · " +
      Solar.condition(h.code);
    const grid = document.createElement("div");
    grid.className = "hour-detail-grid";
    for (const content of [
      `Feels like ${value(h.feels)}°${s.unit}`,
      `Rain chance ${value(h.rain)}%`,
      `Wind ${value(h.wind)} ${s.unit === "C" ? "km/h" : "mph"}`,
      `Humidity ${value(h.humidity)}%`,
    ]) {
      const span = document.createElement("span");
      span.textContent = content;
      grid.append(span);
    }
    host.append(title, grid);
  }
}

const pageHost = document.querySelector("main");
$("to-outlook").onclick = () =>
  scrollToPage("outlook-page");
$("to-now").onclick = () =>
  scrollToPage("now-page");
let wheelUntil = 0;
pageHost?.addEventListener(
  "wheel",
  (e) => {
    if (
      $("forecast").hidden ||
      Math.abs(e.deltaY) < Math.abs(e.deltaX) ||
      e.ctrlKey
    )
      return;
    e.preventDefault();
    if (Date.now() < wheelUntil || Math.abs(e.deltaY) < 8) return;
    wheelUntil = Date.now() + 650;
    scrollToPage(e.deltaY > 0 ? "outlook-page" : "now-page");
  },
  { passive: false },
);
