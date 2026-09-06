(function () {
  function validTimeZone(zone) {
    if (typeof zone !== "string" || !zone) return null;
    try {
      new Intl.DateTimeFormat("en", { timeZone: zone }).format();
      return zone;
    } catch {
      return null;
    }
  }
  function validDateMs(date) {
    const ms = date instanceof Date ? date.getTime() : new Date(date).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  function localDate(date, zone) {
    const ms = validDateMs(date),
      tz = validTimeZone(zone);
    if (ms === null || !tz) return null;
    try {
      const p = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date(ms));
      const value = (kind) => p.find((x) => x.type === kind)?.value;
      const parts = ["year", "month", "day"].map(value);
      return parts.every(Boolean) ? parts.join("-") : null;
    } catch {
      return null;
    }
  }
  function instant(iso, zone) {
    if (typeof iso !== "string") return null;
    const tz = validTimeZone(zone);
    const parts = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!tz || !parts) return null;
    const year = +parts[1],
      month = +parts[2],
      day = +parts[3],
      hour = +parts[4],
      minute = +parts[5];
    if (
      !Number.isInteger(year) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      hour > 23 ||
      minute > 59
    )
      return null;
    const wall = Date.UTC(year, month - 1, day, hour, minute),
      calendar = new Date(wall);
    if (
      !Number.isFinite(wall) ||
      calendar.getUTCFullYear() !== year ||
      calendar.getUTCMonth() !== month - 1 ||
      calendar.getUTCDate() !== day
    )
      return null;
    let guess = wall;
    let format;
    try {
      format = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      });
    } catch {
      return null;
    }
    for (let i = 0; i < 4; i++) {
      const p = format.formatToParts(new Date(guess)),
        v = (kind) => Number(p.find((x) => x.type === kind)?.value);
      const observed = Date.UTC(
        v("year"),
        v("month") - 1,
        v("day"),
        v("hour"),
        v("minute"),
        v("second"),
      );
      if (!Number.isFinite(observed)) return null;
      guess += wall - observed;
    }
    return Number.isFinite(guess) ? guess : null;
  }
  function describe(daily, zone, now = new Date()) {
    const days = Array.isArray(daily?.time) ? daily.time : [],
      sunrises = Array.isArray(daily?.sunrise) ? daily.sunrise : [],
      sunsets = Array.isArray(daily?.sunset) ? daily.sunset : [],
      day = localDate(now, zone),
      index = day === null ? -1 : days.indexOf(day),
      ms = validDateMs(now);
    const rise = index < 0 ? null : instant(sunrises[index], zone),
      set = index < 0 ? null : instant(sunsets[index], zone);
    const daytime =
      ms !== null &&
      rise !== null &&
      set !== null &&
      set > rise &&
      ms >= rise &&
      ms < set;
    const next = sunrises
      .map((value, i) => ({ time: instant(value, zone), index: i }))
      .filter((event) => event.time !== null && ms !== null && event.time > ms)
      .sort((a, b) => a.time - b.time)[0];
    const previous = sunsets
      .map((value) => instant(value, zone))
      .filter((time) => time !== null && ms !== null && time <= ms)
      .sort((a, b) => a - b)
      .at(-1);
    const span = daytime
      ? set - rise
      : previous !== undefined && next?.time > previous
        ? next.time - previous
        : null;
    const rawProgress =
      span !== null && ms !== null
        ? (ms - (daytime ? rise : previous)) / span
        : null;
    const target = daytime ? set : next?.time;
    return {
      day,
      index,
      rise,
      set,
      daytime,
      nextIndex: next?.index ?? -1,
      remaining:
        target == null || ms === null
          ? null
          : Math.max(0, Math.ceil((target - ms) / 60000)),
      progress:
        rawProgress === null ? null : Math.max(0, Math.min(1, rawProgress)),
      duration:
        rise !== null && set !== null && set > rise
          ? Math.round((set - rise) / 60000)
          : null,
    };
  }
  const api = { localDate, instant, describe, validTimeZone };
  if (typeof module !== "undefined") module.exports = api;
  else globalThis.Daylight = api;
})();
