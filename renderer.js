const $ = (id) => document.getElementById(id);
let active = null,
  state = null,
  searchId = 0,
  lastError = null,
  selecting = false;
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
  $(id).textContent = value;
}
function clock(s) {
  const m = Solar.minutes(s);
  if (m === null) return "—";
  return `${m % 720 < 60 ? 12 : Math.floor(m / 60) % 12}:${String(m % 60).padStart(2, "0")} ${m >= 720 ? "PM" : "AM"}`;
}
function value(n) {
  return Number.isFinite(n) ? Math.round(n) : "—";
}
function render(s, preview) {
  state = s;
  active = s.place;
  $("setup").hidden = true;
  $("forecast").hidden = false;
  $("cancel").hidden = false;
  const { data: d, unit: u } = s,
    c = d.current,
    a = d.daily;
  document.body.dataset.weather = Solar.theme(c.weather_code, c.is_day);
  text("place", s.place.name);
  text("region", s.place.label);
  text(
    "date",
    new Intl.DateTimeFormat("en", {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: d.timezone,
    })
      .format(new Date())
      .toUpperCase(),
  );
  text("temperature", value(c.temperature_2m) + "°");
  text("condition", Solar.condition(c.weather_code));
  text("feels", `Feels like ${value(c.apparent_temperature)}°${u}`);
  text("wind", `Wind ${value(c.wind_speed_10m)} ${u === "C" ? "km/h" : "mph"}`);
  text("humidity", `Humidity ${value(c.relative_humidity_2m)}%`);
  const daylight = Daylight.describe(
    a,
    d.timezone,
    preview?.now ? new Date(preview.now) : new Date(),
  );
  const idx = daylight.index,
    rise = idx < 0 ? null : Solar.minutes(a.sunrise[idx]),
    set = idx < 0 ? null : Solar.minutes(a.sunset[idx]);
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: d.timezone,
  }).formatToParts(preview?.now ? new Date(preview.now) : new Date());
  const now =
      Number(parts.find((p) => p.type === "hour").value) * 60 +
      Number(parts.find((p) => p.type === "minute").value),
    t = daylight.progress;
  text(
    "sunrise",
    clock(a.sunrise[daylight.daytime ? idx : daylight.nextIndex]),
  );
  text("sunset", clock(a.sunset[idx]));
  const visual = Solar.scene(c.weather_code, c.is_day, rise, set, now);
  if (preview?.phase) visual.phase = preview.phase;
  Object.assign(document.body.dataset, {
    scene: visual.kind,
    phase: visual.phase,
    intensity: visual.intensity,
    frozen: String(visual.frozen),
    hail: String(visual.hail),
  });
  Lunar.update(s, preview);
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
      : "",
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
  a.time.forEach((day, i) => {
    if (day < daylight.day) return;
    const row = document.createElement("div");
    row.className = "day";
    const vals = [
      day === daylight.day
        ? "Today"
        : new Intl.DateTimeFormat("en", {
            weekday: "short",
            timeZone: "UTC",
          }).format(new Date(day + "T12:00:00Z")),
      Solar.condition(a.weather_code[i]),
      `${value(a.precipitation_probability_max[i])}%`,
      `${value(a.temperature_2m_max[i])}° / ${value(a.temperature_2m_min[i])}°`,
    ];
    vals.forEach((v, j) => {
      const span = document.createElement("span");
      span.textContent = v;
      span.title = v;
      span.className = j === 2 ? "rain" : j === 3 ? "temps" : "";
      row.append(span);
      if (j === 1) {
        const glyph = weatherIcon(a.weather_code[i]);
        row.append(glyph);
      }
    });
    $("days").append(row);
  });
  text(
    "status",
    `Updated ${new Date(s.updated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · °${u}`,
  );
}
window.weather.onUpdate((s) => {
  const editing = !$("setup").hidden && !!state && !selecting;
  if (s.loading) {
    text("status", "Updating weather…");
    return;
  }
  if (s.error) {
    lastError = s.error;
    if (s.last) render(s.last);
    text("status", (s.last ? "Showing last update. " : "") + s.error);
  } else {
    ((lastError = null), (selecting = false));
    render(s);
  }
  if (editing) {
    $("setup").hidden = false;
    $("forecast").hidden = true;
  }
});
$("search-form").onsubmit = async (e) => {
  e.preventDefault();
  const id = ++searchId;
  $("search-button").disabled = true;
  text("status", "Finding places…");
  $("results").replaceChildren();
  try {
    const results = await window.weather.search($("query").value);
    if (id !== searchId) return;
    text(
      "status",
      results.length
        ? "Choose your location below."
        : "No places found. Try a nearby town or a city name.",
    );
    results.forEach((p) => {
      const b = document.createElement("button");
      b.className = "result";
      b.textContent = p.label;
      b.onclick = async () => {
        selecting = true;
        b.disabled = true;
        text("status", "Loading local weather…");
        try {
          await window.weather.select(p, $("unit").value);
        } catch (e) {
          text("status", e.message);
        } finally {
          selecting = false;
          b.disabled = false;
        }
      };
      $("results").append(b);
    });
  } catch (e) {
    text("status", e.message);
  } finally {
    $("search-button").disabled = false;
  }
};
$("settings").onclick = () => {
  $("setup").hidden = false;
  $("forecast").hidden = true;
};
$("cancel").onclick = () => {
  if (state) render(state);
};
$("refresh").onclick = () => window.weather.refresh();
$("unit").onchange = async () => {
  if (active) {
    try {
      await window.weather.select(active, $("unit").value);
    } catch (e) {
      text("status", e.message);
    }
  }
};
window.weather.settings().then((s) => {
  $("unit").value = s.unit || "F";
  if (s.place) {
    active = s.place;
    $("query").value = s.place.name;
    text("status", "Loading local weather…");
  }
});

document.getElementById("close").onclick = () => window.weather.hide();
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.weather.hide();
});

setInterval(() => {
  if (
    state &&
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
function weatherIcon(code) {
  const kind = Solar.scene(code, 1).kind,
    id = {
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
