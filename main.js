const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  screen,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const qa = process.argv.find((a) => a.startsWith("--qa-output="))?.slice(12);
if (qa) app.setPath("userData", path.join(qa, "qa-profile"));
let win,
  dock,
  tray,
  observer,
  geometry,
  config = {},
  last = null,
  busy = false,
  timer,
  observerRetry,
  watchdog,
  lastGeometryAt = 0,
  observerFailures = 0;
function log(event, details = {}) {
  try {
    const p = path.join(app.getPath("userData"), "stability.log");
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (fs.existsSync(p) && fs.statSync(p).size > 512000)
      fs.renameSync(p, p + ".previous");
    fs.appendFileSync(
      p,
      JSON.stringify({ time: new Date().toISOString(), event, ...details }) +
        "\n",
    );
  } catch {}
}
function diagnostics() {
  return {
    version: app.getVersion(),
    visible: dock?.isVisible(),
    topmost: dock?.isAlwaysOnTop(),
    bounds: dock?.getBounds(),
    helperPid: observer?.pid,
    geometry,
    lastGeometryAt,
    weatherUpdated: last?.updated,
  };
}
const { spawn } = require("node:child_process");
function publish(s) {
  win?.webContents.send("weather", s);
  dock?.webContents.send("weather", s);
}
const configPath = () => path.join(app.getPath("userData"), "settings.json");
function save() {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2));
}
async function json(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (r.status === 429)
    throw Error("Weather service is busy. Please wait before refreshing.");
  if (!r.ok)
    throw Error(`Weather service returned ${r.status}. Try again shortly.`);
  try {
    return await r.json();
  } catch {
    throw Error("Weather service sent an invalid response. Try again shortly.");
  }
}
function label(p) {
  return [p.name, p.admin1, p.country].filter(Boolean).join(", ");
}
async function refresh() {
  if (busy || !config.place) return;
  busy = true;
  publish({ loading: true });
  try {
    const p = new URLSearchParams({
      latitude: config.place.latitude,
      longitude: config.place.longitude,
      current:
        "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
      daily:
        "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max",
      timezone: "auto",
      forecast_days: "5",
      past_days: "1",
      temperature_unit: config.unit === "C" ? "celsius" : "fahrenheit",
      wind_speed_unit: config.unit === "C" ? "kmh" : "mph",
    });
    const data = await json("https://api.open-meteo.com/v1/forecast?" + p);
    if (
      !data.current ||
      !data.daily ||
      !Number.isFinite(data.current.temperature_2m) ||
      !Array.isArray(data.daily.time) ||
      ![
        "sunrise",
        "sunset",
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_probability_max",
      ].every(
        (k) =>
          Array.isArray(data.daily[k]) &&
          data.daily[k].length === data.daily.time.length,
      )
    )
      throw Error("Incomplete weather response. Please retry.");
    last = {
      data,
      place: config.place,
      unit: config.unit,
      updated: Date.now(),
    };
    tray.setToolTip(
      `${config.place.name}: ${Math.round(data.current.temperature_2m)}°${config.unit}`,
    );
    // Render tray temperature from a local, isolated canvas window.
    const icon = await win.webContents.executeJavaScript(
      `window.trayImage(${JSON.stringify(Math.round(data.current.temperature_2m))})`,
    );
    tray.setImage(nativeImage.createFromDataURL(icon));
    publish(last);
  } catch (e) {
    log("weather-error", { message: e.message });
    publish({ error: e.message, last });
    tray?.setToolTip("Clear Weather — update unavailable");
  } finally {
    busy = false;
  }
}
function show() {
  const d = screen.getPrimaryDisplay(),
    w = d.workArea;
  const height = Math.min(790, w.height - 24);
  win.setBounds({
    x: w.x + 12,
    y: w.y + w.height - height - 10,
    width: 430,
    height,
  });
  win.show();
  win.focus();
  win.webContents.send("tick");
}
function observeTaskbar() {
  if (app.quitting) return;
  clearTimeout(observerRetry);
  const child = spawn(
    path.join(process.resourcesPath, "Geometry.exe"),
    [
      String(process.pid),
      dock.getNativeWindowHandle().readBigUInt64LE().toString(),
    ],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  observer = child;
  lastGeometryAt = Date.now();
  let buffer = "",
    lastDecision;
  log("observer-start", { pid: child.pid });
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    if (buffer.length > 65536) {
      buffer = "";
      log("observer-buffer-reset");
      return;
    }
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      try {
        const g = JSON.parse(line),
          r = screen.screenToDipRect(null, g.bar),
          f = screen.screenToDipRect(null, g.front),
          display = screen.getDisplayMatching(r),
          b = display.bounds;
        lastGeometryAt = Date.now();
        observerFailures = 0;
        geometry = {
          taskbar: r,
          display: b,
          foreground: f,
          frontClass: g.frontClass,
          taskbarAbove: g.taskbarAbove,
          taskbarExposed: g.taskbarExposed,
        };
        const fullscreen =
          !["Progman", "WorkerW", "Shell_TrayWnd"].includes(g.frontClass) &&
          f.x <= b.x &&
          f.y <= b.y &&
          f.x + f.width >= b.x + b.width &&
          f.y + f.height >= b.y + b.height;
        const shownHeight =
          Math.min(r.y + r.height, b.y + b.height) - Math.max(r.y, b.y);
        const reason = !g.visible
          ? "taskbar-hidden"
          : fullscreen && !g.taskbarExposed
            ? "fullscreen"
            : r.width < 400 || shownHeight < 24
              ? "taskbar-offscreen"
              : "shown";
        if (reason !== lastDecision) {
          log("visibility", { reason, frontClass: g.frontClass });
          lastDecision = reason;
        }
        if (reason !== "shown") {
          if (dock.isVisible()) dock.hide();
          continue;
        }
        const bounds = {
            x: r.x + 8,
            y: Math.round(r.y + (r.height - 44) / 2),
            width: 204,
            height: 44,
          },
          old = dock.getBounds();
        if (Object.keys(bounds).some((k) => bounds[k] !== old[k]))
          dock.setBounds(bounds);
        if (!dock.isVisible()) dock.showInactive();
        if (g.taskbarAbove) {
          dock.moveTop();
          log("restored-above-taskbar");
        }
      } catch (e) {
        log("observer-sample-error", { message: e.message });
      }
    }
  });
  let finished = false;
  const recover = (reason) => {
    if (finished) return;
    finished = true;
    if (observer === child) observer = null;
    if (app.quitting) return;
    observerFailures++;
    log("observer-restart", { reason });
    observerRetry = setTimeout(
      observeTaskbar,
      Math.min(1000 * observerFailures, 10000),
    );
  };
  child.on("error", (e) => recover(e.message));
  child.stderr.on("data", (data) =>
    log("observer-stderr", { message: data.toString().slice(0, 200) }),
  );
  child.on("exit", (code) => recover("exit " + code));
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", (_, argv) => {
    const report = argv.find((a) => a.startsWith("--diagnostics="));
    if (report) {
      fs.writeFileSync(
        report.slice(14),
        JSON.stringify(diagnostics(), null, 2),
      );
      return;
    }
    if (argv.includes("--quit")) app.quit();
    else show();
  });
  app.whenReady().then(async () => {
    try {
      config = JSON.parse(fs.readFileSync(configPath(), "utf8"));
    } catch {}
    config.unit = config.unit === "C" ? "C" : "F";
    win = new BrowserWindow({
      width: 430,
      height: 790,
      minWidth: 390,
      minHeight: 500,
      frame: false,
      skipTaskbar: true,
      resizable: false,
      show: false,
      title: "Clear Weather",
      backgroundColor: "#172f54",
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.on("blur", () => {
      if (!qa) win.hide();
    });
    win.on("close", (e) => {
      if (!app.quitting) {
        e.preventDefault();
        win.hide();
      }
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (e) => e.preventDefault());
    win.setAlwaysOnTop(true, "pop-up-menu");
    await win.loadFile("index.html");
    dock = new BrowserWindow({
      width: 204,
      height: 44,
      frame: false,
      transparent: true,
      show: false,
      skipTaskbar: true,
      resizable: false,
      focusable: false,
      hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    dock.setAlwaysOnTop(true, "screen-saver");
    dock.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    dock.webContents.on("will-navigate", (e) => e.preventDefault());
    await dock.loadFile("dock.html");
    observeTaskbar();
    watchdog = setInterval(() => {
      if (observer && Date.now() - lastGeometryAt > 8000) {
        log("observer-stalled");
        observer.kill();
      }
    }, 2000);
    dock.webContents.on("render-process-gone", () => {
      log("dock-renderer-restart");
      setTimeout(() => {
        if (!app.quitting) dock.reload();
      }, 750);
    });
    dock.webContents.on("did-finish-load", () => {
      if (last) dock.webContents.send("weather", last);
    });
    win.webContents.on("render-process-gone", () => {
      log("panel-renderer-restart");
      setTimeout(() => {
        if (!app.quitting) win.reload();
      }, 750);
    });
    win.webContents.on("did-finish-load", () => {
      if (last) win.webContents.send("weather", last);
    });
    const image = await win.webContents.executeJavaScript(
      "window.trayImage(null)",
    );
    tray = new Tray(nativeImage.createFromDataURL(image));
    tray.setToolTip("Clear Weather");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Open weather", click: show },
        { label: "Refresh", click: refresh },
        { type: "separator" },
        { label: "Quit", click: () => app.quit() },
      ]),
    );
    tray.on("click", () => (win.isVisible() ? win.hide() : show()));
    if (qa) {
      try {
        const places = await json(
          "https://geocoding-api.open-meteo.com/v1/search?name=London&count=8&language=en&format=json",
        );
        const p =
          places.results?.find((p) => p.country_code === "GB") ||
          places.results?.[0];
        if (!p) throw Error("No live location results");
        config = {
          place: {
            name: p.name,
            label: label(p),
            latitude: p.latitude,
            longitude: p.longitude,
            timezone: p.timezone,
          },
          unit: "F",
        };
        show();
        await refresh();
        if (!last) throw Error("Live forecast failed");
        await new Promise((r) => setTimeout(r, 2300));
        const result = await win.webContents.executeJavaScript(
          `({temperature:document.getElementById('temperature').textContent,sunrise:document.getElementById('sunrise').textContent,sunset:document.getElementById('sunset').textContent,days:document.getElementById('days').children.length,visible:!document.getElementById('forecast').hidden,scrollHeight:document.body.scrollHeight,viewport:innerHeight})`,
        );
        if (!result.visible || result.days !== 5 || result.sunrise === "—")
          throw Error("Rendered forecast check failed");
        fs.mkdirSync(qa, { recursive: true });
        fs.writeFileSync(
          path.join(qa, "runtime-test.json"),
          JSON.stringify(
            { passed: true, place: config.place, result },
            null,
            2,
          ),
        );
        fs.writeFileSync(
          path.join(qa, "weather-preview.png"),
          (await win.webContents.capturePage()).toPNG(),
        );
        for (let i = 0; i < 20 && !geometry?.taskbar; i++)
          await new Promise((r) => setTimeout(r, 2300));
        if (!geometry?.taskbar)
          throw Error("Taskbar geometry was not observed");
        fs.writeFileSync(
          path.join(qa, "taskbar-test.json"),
          JSON.stringify({ geometry, widget: dock.getBounds() }, null, 2),
        );
        dock.show();
        await new Promise((r) => setTimeout(r, 1200));
        fs.writeFileSync(
          path.join(qa, "widget-preview.png"),
          (await dock.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG(),
        );
        fs.writeFileSync(
          path.join(qa, "visibility-test.json"),
          JSON.stringify(
            { visible: dock.isVisible(), bounds: dock.getBounds(), geometry },
            null,
            2,
          ),
        );
        const { desktopCapturer } = require("electron");
        const display = screen.getPrimaryDisplay();
        const sources = await desktopCapturer.getSources({
          types: ["screen"],
          thumbnailSize: {
            width: Math.round(display.size.width * display.scaleFactor),
            height: Math.round(display.size.height * display.scaleFactor),
          },
        });
        const source = sources.find((s) => s.display_id === String(display.id));
        if (source) {
          const size = source.thumbnail.getSize();
          fs.writeFileSync(
            path.join(qa, "taskbar-preview.png"),
            source.thumbnail
              .crop({
                x: 0,
                y: size.height - Math.round(64 * display.scaleFactor),
                width: Math.round(350 * display.scaleFactor),
                height: Math.round(64 * display.scaleFactor),
              })
              .toPNG(),
          );
        }
        for (const [name, code, day] of [
          ["night", 0, 0],
          ["rain", 63, 1],
          ["snow", 73, 1],
        ]) {
          await win.webContents.executeJavaScript(
            `render({...state,data:{...state.data,current:{...state.data.current,weather_code:${code},is_day:${day}}}})`,
          );
          await new Promise((r) => setTimeout(r, 600));
          fs.writeFileSync(
            path.join(qa, name + "-preview.png"),
            (await win.webContents.capturePage()).toPNG(),
          );
        }
        const moonChecks = [];
        for (const [name, phase] of [
          ["new", 0],
          ["waxing-crescent", 0.125],
          ["first-quarter", 0.25],
          ["waxing-gibbous", 0.375],
          ["full", 0.5],
          ["waning-gibbous", 0.625],
          ["last-quarter", 0.75],
          ["waning-crescent", 0.875],
        ]) {
          await win.webContents.executeJavaScript(
            `render({...state,data:{...state.data,current:{...state.data.current,weather_code:0,is_day:0}}},{phase:'night',moonPhase:${phase}})`,
          );
          await new Promise((r) => setTimeout(r, 200));
          const check = await win.webContents.executeJavaScript(
            `({name:document.getElementById('moon-name').textContent,detail:document.getElementById('moon-detail').textContent,height:document.body.scrollHeight,viewport:innerHeight})`,
          );
          if (check.name === "—" || check.height > check.viewport)
            throw Error("Lunar card missing or overflow");
          moonChecks.push({ phase, ...check });
          fs.writeFileSync(
            path.join(qa, "moon-" + name + ".png"),
            (await win.webContents.capturePage()).toPNG(),
          );
        }
        fs.writeFileSync(
          path.join(qa, "moon-tests.json"),
          JSON.stringify(moonChecks, null, 2),
        );
        const sceneChecks = [];
        for (const [name, code, phase] of [
          ["sunrise", 0, "sunrise"],
          ["sunset", 0, "sunset"],
          ["night-clear", 0, "night"],
          ["night-storm", 95, "night"],
          ["light-rain", 61, "day"],
          ["heavy-rain", 65, "day"],
          ["night-rain", 63, "night"],
          ["drizzle", 51, "day"],
          ["snow-heavy", 75, "night"],
          ["fog", 45, "day"],
          ["freezing-rain", 67, "night"],
          ["hail", 99, "night"],
          ["partly-cloudy", 2, "day"],
          ["overcast", 3, "day"],
        ]) {
          await win.webContents.executeJavaScript(
            `render({...state,data:{...state.data,current:{...state.data.current,weather_code:${code},is_day:${phase === "night" ? 0 : 1}}}},{phase:${JSON.stringify(phase)}})`,
          );
          await new Promise((r) => setTimeout(r, 200));
          const actual = await win.webContents.executeJavaScript(
            `({...document.body.dataset})`,
          );
          if (actual.phase !== phase) throw Error("Wrong phase for " + name);
          sceneChecks.push({ name, code, ...actual });
          fs.writeFileSync(
            path.join(qa, "scene-" + name + ".png"),
            (await win.webContents.capturePage()).toPNG(),
          );
        }
        fs.writeFileSync(
          path.join(qa, "scene-tests.json"),
          JSON.stringify(sceneChecks, null, 2),
        );
        const assert = require("node:assert/strict");
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        for (let i = 0; i < 5; i++) {
          show();
          await sleep(100);
          win.hide();
          await sleep(100);
          assert.equal(dock.isVisible(), true);
        }
        dock.webContents.forcefullyCrashRenderer();
        await sleep(2000);
        assert.equal(dock.webContents.isCrashed(), false);
        assert.match(
          await dock.webContents.executeJavaScript(
            "document.getElementById('temp').textContent",
          ),
          /°/,
        );
        const mock = new BrowserWindow({
          show: false,
          frame: false,
          skipTaskbar: true,
          backgroundColor: "#172f54",
          webPreferences: { sandbox: true },
        });
        try {
          mock.setBounds(screen.getPrimaryDisplay().bounds);
          mock.setAlwaysOnTop(true, "screen-saver");
          mock.show();
          mock.focus();
          await sleep(1800);
          assert.equal(
            dock.isVisible(),
            false,
            "Hide for fullscreen foreground",
          );
        } finally {
          mock.destroy();
        }
        show();
        await sleep(1800);
        assert.equal(dock.isVisible(), true, "Recover after fullscreen");
        fs.writeFileSync(
          path.join(qa, "interaction-tests.json"),
          JSON.stringify(
            {
              passed: true,
              openCloseCycles: 5,
              rendererRecovery: true,
              fullscreenHideAndReturn: true,
            },
            null,
            2,
          ),
        );
        app.quit();
      } catch (e) {
        fs.mkdirSync(qa, { recursive: true });
        fs.writeFileSync(
          path.join(qa, "runtime-test.json"),
          JSON.stringify({ passed: false, error: e.stack }),
        );
        app.exit(1);
      }
    } else {
      if (!config.place) show();
      await refresh();
      timer = setInterval(refresh, 15 * 60 * 1000);
    }
  });
  app.on("before-quit", () => {
    app.quitting = true;
    clearInterval(timer);
    clearInterval(watchdog);
    clearTimeout(observerRetry);
    observer?.kill();
  });
}
ipcMain.handle("settings", () => config);
ipcMain.handle("search", async (_, q) => {
  if (typeof q !== "string" || q.trim().length < 2 || q.length > 120)
    throw Error("Enter at least two characters.");
  const r = await json(
    "https://geocoding-api.open-meteo.com/v1/search?" +
      new URLSearchParams({
        name: q.trim(),
        count: "8",
        language: "en",
        format: "json",
      }),
  );
  return (r.results || []).map((p) => ({
    name: p.name,
    label: label(p),
    latitude: p.latitude,
    longitude: p.longitude,
    timezone: p.timezone,
  }));
});
ipcMain.handle("select", async (_, p, unit) => {
  if (busy) throw Error("Please wait for the current update.");
  if (
    !p ||
    typeof p.name !== "string" ||
    !Number.isFinite(p.latitude) ||
    Math.abs(p.latitude) > 90 ||
    !Number.isFinite(p.longitude) ||
    Math.abs(p.longitude) > 180
  )
    throw Error("Choose a location from search results.");
  config = {
    place: {
      name: p.name.slice(0, 120),
      label: String(p.label).slice(0, 240),
      latitude: p.latitude,
      longitude: p.longitude,
      timezone: String(p.timezone),
    },
    unit: unit === "C" ? "C" : "F",
  };
  save();
  last = null;
  await refresh();
  return config;
});
ipcMain.handle("refresh", refresh);

ipcMain.handle("toggle", () => (win.isVisible() ? win.hide() : show()));
ipcMain.handle("hide", () => win.hide());
ipcMain.handle("menu", () =>
  Menu.buildFromTemplate([
    { label: "Open weather", click: show },
    { label: "Refresh", click: refresh },
    { label: "Quit Clear Weather", click: () => app.quit() },
  ]).popup(),
);
