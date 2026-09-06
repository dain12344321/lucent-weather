(function () {
  function localDate(date, zone) {
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    return ["year", "month", "day"]
      .map((k) => p.find((x) => x.type === k).value)
      .join("-");
  }
  function instant(iso, zone) {
    if (!iso) return null;
    const parts = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!parts) return null;
    const wall = Date.UTC(
      ...[+parts[1], +parts[2] - 1, +parts[3], +parts[4], +parts[5]],
    );
    let guess = wall;
    const format = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    for (let i = 0; i < 3; i++) {
      const p = format.formatToParts(new Date(guess)),
        v = (k) => +p.find((x) => x.type === k).value;
      const observed = Date.UTC(
        v("year"),
        v("month") - 1,
        v("day"),
        v("hour"),
        v("minute"),
        v("second"),
      );
      guess += wall - observed;
    }
    return guess;
  }
  function describe(daily, zone, now = new Date()) {
    const day = localDate(now, zone),
      index = daily.time.indexOf(day),
      ms = now.getTime();
    const rise = index < 0 ? null : instant(daily.sunrise[index], zone),
      set = index < 0 ? null : instant(daily.sunset[index], zone);
    const daytime = rise !== null && set !== null && ms >= rise && ms < set;
    const next = daily.sunrise
      .map((s, i) => ({ time: instant(s, zone), index: i }))
      .find((x) => x.time !== null && x.time > ms);
    const previous = daily.sunset
      .map((s) => instant(s, zone))
      .filter((t) => t !== null && t <= ms)
      .pop();
    const arcProgress = daytime
      ? (ms - rise) / (set - rise)
      : previous != null && next?.time > previous
        ? (ms - previous) / (next.time - previous)
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
        target == null ? null : Math.max(0, Math.ceil((target - ms) / 60000)),
      progress: arcProgress,
      duration:
        rise !== null && set !== null ? Math.round((set - rise) / 60000) : null,
    };
  }
  const api = { localDate, instant, describe };
  if (typeof module !== "undefined") module.exports = api;
  else globalThis.Daylight = api;
})();
