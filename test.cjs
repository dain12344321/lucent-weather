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

test("hourly window uses absolute timestamps across midnight and DST", () => {
  const { next } = require("./hourly");
  const start = Date.parse("2026-11-01T05:30:00Z");
  const time = Array.from(
    { length: 30 },
    (_, i) => Math.floor(start / 3600000) * 3600 + (i - 2) * 3600,
  );
  const hours = next({ time, temperature_2m: time.map(() => 0) }, start);
  assert.equal(hours.length, 24);
  assert.equal(hours[0].time, Date.parse("2026-11-01T05:00:00Z") / 1000);
  assert.equal(hours[23].time - hours[0].time, 23 * 3600);
  assert.equal(hours[0].temp, 0);
  assert.deepEqual(next(null, start), []);
});

test("solar noon is available between local sunrise and sunset", () => {
  const sun = require("./suncalc");
  const t = sun.getTimes(new Date("2026-09-06T17:00:00Z"), 41.2, -86.6);
  assert.ok(Number.isFinite(t.solarNoon.getTime()));
  assert.ok(t.solarNoon > t.sunrise && t.solarNoon < t.sunset);
});

test("radar times out stalled images and ignores superseded callbacks", async () => {
  const vm = require("node:vm"), fs = require("node:fs");
  const elements = {}, scheduled = new Map(), images = [];
  let observe, timerId = 0;
  const map = {on(){},setView(){},invalidateSize(){},getSize:()=>({x:380,y:245}),getBounds:()=>({getSouthWest:()=>({x:0,y:0}),getNorthEast:()=>({x:1,y:1})})};
  const context = {
    document:{hidden:false,getElementById:id=>elements[id]??=( {setAttribute(){}} ),addEventListener(){}},
    IntersectionObserver:class {constructor(cb){observe=cb;}observe(){}},
    L:{map:()=>map,tileLayer:()=>({addTo(){}}),circleMarker:()=>({addTo(){return this;},setLatLng(){}}),
      CRS:{EPSG3857:{project:x=>x}},
      imageOverlay:()=>{const im={handlers:{},on(k,fn){this.handlers[k]=fn;return this;},addTo(){},remove(){this.removed=true;}};images.push(im);return im;}},
    fetch:async()=>({ok:true,text:async()=>""}),
    DOMParser:class {parseFromString(){return {getElementsByTagName:()=>[{getAttribute:()=>"time",textContent:"2026-09-06T12:00:00Z,2026-09-06T12:10:00Z"}]};}},
    AbortSignal, AbortController, URLSearchParams, Date,
    setTimeout:(fn,ms)=>{const id=++timerId;scheduled.set(id,{fn,ms});return id;},
    clearTimeout:id=>scheduled.delete(id),setInterval(){},
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve("./radar.js"),"utf8")+"\nthis.radar=Radar;",context);
  context.radar.setPlace({latitude:41,longitude:-86});
  observe([{isIntersecting:true}]);
  await new Promise(r=>setImmediate(r));
  assert.equal(images.length,1);
  const old=images[0];
  elements["radar-time"].oninput({target:{value:0}});
  assert.equal(old.removed,true);
  old.handlers.load();
  assert.match(elements["radar-status"].textContent,/Loading/);
  const timeout=[...scheduled.values()].find(t=>t.ms===15000);
  assert.ok(timeout);
  timeout.fn();
  assert.match(elements["radar-status"].textContent,/unavailable/);
  assert.equal(elements["radar-play"].textContent,"Play");
  elements["radar-time"].oninput({target:{value:1}});
  observe([{isIntersecting:false}]);
  assert.equal(images.at(-1).removed,true);
  assert.equal(scheduled.size,0);
});

test("taskbar placement uses tray geometry and clamps within the taskbar", () => {
  const {tileBounds} = require("./placement");
  const bar={x:-1920,y:1040,width:1920,height:40};
  assert.equal(tileBounds(bar,{x:-220,width:220},"tray").x,-432);
  assert.equal(tileBounds(bar,null,"left").x,-1912);
  assert.equal(tileBounds(bar,null,"tray").x,-524);
  assert.equal(tileBounds({x:0,y:0,width:450,height:48},{x:100,width:350},"tray").x,8);
  assert.equal(tileBounds(bar,{x:9999,width:10},"tray").x,-524);
});

test("dismissed context menus clear tile focus and hover until pointer returns", async () => {
  const vm=require("node:vm"),fs=require("node:fs"),listeners={},widgetListeners={},classes=new Set();
  let finish,blurred=false;
  const widget={blur:()=>{blurred=true;},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},addEventListener:(n,fn)=>widgetListeners[n]=fn};
  const context={document:{getElementById:()=>widget,addEventListener:(n,fn)=>listeners[n]=fn},
    window:{addEventListener(){},weather:{toggle(){},onUpdate(){},menu:()=>new Promise(r=>finish=r)}}};
  vm.runInNewContext(fs.readFileSync(require.resolve("./dock.js"),"utf8"),context);
  const pending=listeners.contextmenu({preventDefault(){}});
  assert.equal(classes.size,0);
  finish();await pending;
  assert.ok(blurred);assert.ok(classes.has("menu-dismissed"));
  widgetListeners.pointerenter();
  assert.equal(classes.size,0);
});


test("radar metadata timeouts leave a usable retry control", async () => {
  const vm=require("node:vm"),fs=require("node:fs"),elements={},timers=new Map();
  let observe,id=0;
  const map={on(){},setView(){},invalidateSize(){}};
  const ctx={
    document:{hidden:false,getElementById:name=>elements[name]??={setAttribute(){}},addEventListener(){}},
    IntersectionObserver:class{constructor(fn){observe=fn;}observe(){}},
    L:{map:()=>map,tileLayer:()=>({addTo(){}}),circleMarker:()=>({addTo(){return this;},setLatLng(){}})},
    fetch:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener("abort",()=>reject(Object.assign(Error("aborted"),{name:"AbortError"})))),
    AbortController,AbortSignal,URLSearchParams,Date,
    setTimeout:(fn,ms)=>{const key=++id;timers.set(key,{fn,ms});return key;},clearTimeout:key=>timers.delete(key),setInterval(){},
  };
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve("./radar.js"),"utf8")+"\nthis.radar=Radar;",ctx);
  ctx.radar.setPlace({latitude:41,longitude:-86});observe([{isIntersecting:true}]);
  assert.equal(elements["radar-refresh"].disabled,true);
  const timeout=[...timers.values()].find(timer=>timer.ms===15000);assert.ok(timeout);timeout.fn();
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(elements["radar-status"].textContent,/timed out/);
  assert.equal(elements["radar-refresh"].disabled,false);
});
