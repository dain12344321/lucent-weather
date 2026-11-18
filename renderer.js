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
function element(tag, content, className = "") {
  const node = document.createElement(tag);
  node.textContent = content;
  node.className = className;
  return node;
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
  const daylight = Daylight.describe(a, zone, at);
  const noonInstant = daylight.day ? Daylight.instant(daylight.day + "T12:00", zone) : null;
  const sunTimes = noonInstant === null ? null : SunCalc.getTimes(new Date(noonInstant), s.place.latitude, s.place.longitude);
  const noSunEvents = daylight.rise === null && daylight.set === null;
  const polar = noSunEvents && (sunTimes?.alwaysUp ? "continuousDay" : sunTimes?.alwaysDown ? "continuousNight" : null);
  const daylightNow = daylight.duration !== null ? daylight.daytime
    : polar ? polar === "continuousDay" : Boolean(Number(c.is_day));
  const skyAt = Solar.localSky(a, zone);
  document.body.dataset.weather = Solar.theme(c.weather_code, daylightNow);
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
  const t = daylight.progress;
  text("sunrise", clock(a.sunrise?.[daylightNow ? daylight.index : daylight.nextIndex]));
  text("sunset", clock(a.sunset?.[daylight.index]));
  const visual = skyAt(c.weather_code, daylightNow, at);
  if (preview?.phase) visual.phase = preview.phase;
  Object.assign(document.body.dataset, {
    scene: visual.kind,
    phase: visual.phase,
    intensity: visual.intensity,
    frozen: String(visual.frozen),
    hail: String(visual.hail),
    arcPhase: daylightNow ? "day" : "night",
  });
  Lunar.update(s, preview);
  document.body.dataset.daytime = String(daylightNow);
  $("night-details").hidden = daylightNow;
  $("solar-detail").hidden = !daylightNow || noSunEvents;
  const noon = sunTimes?.solarNoon;
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
  $("uv").hidden = !daylightNow;
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

  renderHourly(s, at, skyAt);
  const event = polar || (noSunEvents ? "unavailable" : daylightNow ? "sunset" : "sunrise");
  const eventLabel = {
    sunrise: "Next sunrise", sunset: "Next sunset", continuousDay: "Continuous daylight",
    continuousNight: "Continuous darkness", unavailable: "Sun times unavailable",
  }[event];
  const eventIcon = WeatherIcons.graphic(WeatherIcons.solar(event), "event-icon");
  eventIcon.removeAttribute("aria-hidden");
  eventIcon.setAttribute("role", "img");
  eventIcon.setAttribute("aria-label", eventLabel);
  $("light-title").replaceChildren(eventIcon);
  $("light-title").title = eventLabel;
  const duration = daylight.duration,
    remaining = daylightNow && !daylight.daytime ? null : daylight.remaining,
    countdown =
      remaining === null
        ? "Unavailable"
        : `${Math.floor(remaining / 60)}h ${remaining % 60}m`;
  text(
    "daylength",
    noSunEvents ? eventLabel : daylightNow && duration !== null
      ? `${Math.floor(duration / 60)}h ${duration % 60}m daylight`
      : daylightNow ? "Daylight" : "NIGHT · THE MOON",
  );
  $("sun").style.display = daylightNow ? "" : "none";
  $("night-progress").style.display = daylightNow ? "none" : "";
  $("daylight-arc").toggleAttribute("hidden", noSunEvents);
  $("daylight-arc").setAttribute("aria-label", daylightNow ? "Time from sunrise to sunset" : "Time from sunset to sunrise");
  $("sun-times").hidden = noSunEvents;
  $("arc-marker").style.display = t === null ? "none" : "";
  if (t !== null)
    $("arc-marker").style.transform =
      `translate(${20 + 300 * t}px,${125 - 400 * t * (1 - t)}px)`;
  text(
    "next-event",
    polar === "continuousDay" ? "Sun above the horizon all day"
      : polar === "continuousNight" ? "Sun below the horizon all day"
      : noSunEvents || remaining === null
      ? "Sun times unavailable for the forecast period."
      : `${daylightNow ? "Sunset" : "Sunrise"} in ${countdown}`,
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
    const condition = element("span", Solar.condition(codes[i]), "day-condition");
    condition.title = condition.textContent;
    const high = `${value(highs[i])}°`, low = `${value(lows[i])}°`;
    const temperatures = element("span", "", "temps");
    temperatures.title = `High ${high}, low ${low}`;
    temperatures.append(element("span", high), element("span", " / ", "day-separator"), element("span", low, "day-low"));
    row.append(
      element("span", day === daylight.day ? "Today" : dateLabel(day, zone), "day-name"),
      weatherIcon(codes[i]), condition, element("span", `${value(precipitation[i])}%`, "rain"), temperatures,
    );
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
    if (s.selectionFailed && forecastState(s.last)) {
      active = s.last.place;
      $("unit").value = s.last.unit;
      text("status", s.error);
      return;
    }
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
      if (token === selectionId) {
        if (state) $("unit").value = state.unit;
        text("status", errorMessage(e));
      }
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

function weatherIcon(code, phase = "day") {
  return WeatherIcons.graphic(WeatherIcons.weather(code, phase), "forecast-icon");
}
window.weather.onTick(() => {
  if (state && document.getElementById("setup").hidden) {
    render(state);
    if (lastError) text("status", "Showing last update. " + lastError);
  }
});

let renderedHourlyState, renderedHourBucket;
let selectedHour = null,
  hourlyPlace = "";
function renderHourly(s, at, skyAt) {
  const hourBucket = Math.floor(at.getTime() / 3600000);
  if (s === renderedHourlyState && hourBucket === renderedHourBucket) return;
  renderedHourlyState = s;
  renderedHourBucket = hourBucket;
  const list = Hourly.next(s.data?.hourly, at);
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
  if (rain) {
    const peak = element("strong", `${Math.round(rain.rain)}% at ${label(rain.time)}`);
    $("hourly-summary").replaceChildren("Rain chance reaches ", peak);
  } else {
    text("hourly-summary", "Your day, hour by hour. Tap an hour for details.");
  }
  for (const h of list) {
    const b = document.createElement("button");
    b.className = "hour";
    b.type = "button";
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
    const { phase } = skyAt(h.code, h.day, h.time * 1000);
    b.append(time, weatherIcon(h.code, phase), temp, chance);
    b.onclick = () => {
      selectedHour = h.time;
      for (const button of scroller.children) {
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
    const grid = document.createElement("dl");
    grid.className = "hour-detail-grid";
    for (const [label, reading, className] of [
      ["Feels like", `${value(h.feels)}°${s.unit}`],
      ["Rain chance", `${value(h.rain)}%`, "precipitation-value"],
      ["Wind", `${value(h.wind)} ${s.unit === "C" ? "km/h" : "mph"}`],
      ["Humidity", `${value(h.humidity)}%`],
    ]) {
      const pair = document.createElement("div");
      pair.append(element("dt", label), element("dd", reading, className));
      grid.append(pair);
    }
    host.append(title, grid);
  }
}

$("to-outlook").onclick = () =>
  scrollToPage("outlook-page");
$("to-now").onclick = () =>
  scrollToPage("now-page");
