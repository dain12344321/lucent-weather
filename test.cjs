const { test } = require("node:test");
const assert = require("node:assert/strict");
const { minutes, progress, condition } = require("./solar");
test("sunlight boundaries and midpoint", () => {
  assert.equal(minutes("2026-09-05T06:30"), 390);
  assert.equal(progress(360, 1080, 720), 0.5);
  assert.equal(progress(360, 1080, 100), 0);
  assert.equal(progress(360, 1080, 1200), 1);
  assert.equal(progress(null, null, 720), null);
});
test("WMO weather groups include freezing precipitation and storms", () => {
  assert.equal(condition(66), "Freezing rain");
  assert.equal(condition(99), "Thunderstorm · heavy hail");
  assert.equal(condition(999), "Unavailable");
});

test("weather backgrounds respect snow, rain, fog and night", () => {
  const { theme } = require("./solar");
  assert.equal(theme(0, 0), "night");
  assert.equal(theme(73, 1), "snow");
  assert.equal(theme(63, 1), "rain");
  assert.equal(theme(48, 1), "fog");
  assert.equal(theme(96, 1), "storm");
});

test("every documented WMO condition has a scene, including unknown fallback", () => {
  const { labels, scene } = require("./solar");
  for (const code of Object.keys(labels)) {
    for (const day of [0, 1])
      assert.notEqual(scene(Number(code), day).kind, "unknown");
  }
  assert.equal(scene(999, 1).kind, "unknown");
  assert.equal(scene(61, 0).phase, "night");
  assert.equal(scene(61, 0).intensity, "light");
  assert.equal(scene(65, 1).intensity, "heavy");
  assert.equal(scene(67, 0).frozen, true);
  assert.equal(scene(99, 0).hail, true);
});
test("sunrise/sunset use selected local time and missing sun times remain safe", () => {
  const { scene } = require("./solar");
  assert.equal(scene(0, 0, 360, 1080, 340).phase, "sunrise");
  assert.equal(scene(0, 1, 360, 1080, 1060).phase, "sunset");
  assert.equal(scene(95, 0, 360, 1080, 1380).phase, "night");
  assert.equal(scene(95, 0, 360, 1080, 1380).kind, "storm");
  assert.equal(scene(0, 0, null, null, 800).phase, "night");
});
test("lunar phase names wrap around and preserve waxing/waning", () => {
  const { phaseName } = require("./lunar");
  assert.equal(phaseName(0), "New moon");
  assert.equal(phaseName(0.25), "First quarter");
  assert.equal(phaseName(0.5), "Full moon");
  assert.equal(phaseName(0.75), "Last quarter");
  assert.equal(phaseName(0.999), "New moon");
});
test("astronomy matches known April 2024 new/full moon events", () => {
  const lunar = require("./suncalc");
  assert.ok(
    lunar.getMoonIllumination(new Date("2024-04-08T18:21:00Z")).fraction < 0.01,
  );
  assert.ok(
    lunar.getMoonIllumination(new Date("2024-04-23T23:49:00Z")).fraction > 0.99,
  );
  const p = lunar.getMoonPosition(
    new Date("2026-09-06T01:00:00Z"),
    51.5074,
    -0.1278,
  );
  assert.ok(p.altitude >= -90 && p.altitude <= 90);
});

test("sunrise countdown crosses midnight using correct local forecast date", () => {
  const { describe } = require("./daylight");
  const daily = {
    time: ["2026-09-05", "2026-09-06"],
    sunrise: ["2026-09-05T06:16", "2026-09-06T06:17"],
    sunset: ["2026-09-05T19:12", "2026-09-06T19:10"],
  };
  const zone = "America/Indiana/Knox";
  const evening = describe(daily, zone, new Date("2026-09-06T02:00Z"));
  assert.equal(evening.daytime, false);
  assert.equal(evening.remaining, 557);
  const midnight = describe(daily, zone, new Date("2026-09-06T06:00Z"));
  assert.equal(midnight.index, 1);
  assert.equal(midnight.remaining, 317);
  assert.equal(
    describe(daily, zone, new Date("2026-09-06T17:00Z")).daytime,
    true,
  );
});
test("sunrise countdown honors DST and missing events", () => {
  const { describe } = require("./daylight");
  const d = {
    time: ["2026-03-07", "2026-03-08"],
    sunrise: ["2026-03-07T06:10", "2026-03-08T07:08"],
    sunset: ["2026-03-07T17:45", "2026-03-08T18:46"],
  };
  assert.equal(
    describe(d, "America/Chicago", new Date("2026-03-08T04:00Z")).remaining,
    488,
  );
  assert.equal(
    describe(
      { time: ["2026-03-08"], sunrise: [null], sunset: [null] },
      "UTC",
      new Date("2026-03-08T12:00Z"),
    ).remaining,
    null,
  );
});

test("night arc progresses from prior sunset through midnight to sunrise", () => {
  const { describe } = require("./daylight");
  const d = {
    time: ["2026-09-05", "2026-09-06"],
    sunrise: ["2026-09-05T06:00", "2026-09-06T06:00"],
    sunset: ["2026-09-05T18:00", "2026-09-06T18:00"],
  };
  assert.equal(describe(d, "UTC", new Date("2026-09-05T18:00Z")).progress, 0);
  assert.equal(describe(d, "UTC", new Date("2026-09-06T00:00Z")).progress, 0.5);
  assert.ok(describe(d, "UTC", new Date("2026-09-06T05:59Z")).progress > 0.99);
  assert.equal(describe(d, "UTC", new Date("2026-09-06T06:00Z")).daytime, true);
});
