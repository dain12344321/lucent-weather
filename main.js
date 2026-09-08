const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  screen,
} = require("electron");
// Small transparent flyouts should not compete with fullscreen game swapchains.
app.disableHardwareAcceleration();
app.userAgentFallback = `LucentWeather/${app.getVersion()} (+https://github.com/dain12344321/lucent-weather)`;
const fs = require("node:fs");
const {tileBounds} = require("./placement");
const {geometryDecision, boundsEqual} = require("./geometry");
const {createVisibilityGate} = require("./visibility");
const primaryVisibility = createVisibilityGate();
const { json, fetchWeather, validPlace, normalizeConfig } = require("./weather-service.cjs");
const path = require("node:path");
const qa = process.argv.find((a) => a.startsWith("--qa-output="))?.slice(12);
// Keep the original profile across the Lucent Weather rebrand.
app.setPath("userData", qa ? path.join(qa, "qa-profile") : path.join(app.getPath("appData"), "clear-weather"));
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
  panelOpenedAt = 0,
  panelBlurTimer,
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
const secondary = require("./secondary")(()=>config,()=>last,()=>win,log);
let secondaryBars=[];
let selectedDock=null;
function diagnostics() {
  return {
    version: app.getVersion(),
    position: config.position ?? "tray",
    screens: config.screens ?? "primary",
    secondary:secondary.diagnostics(),
    visible: dock?.isVisible(),
    panelVisible: win?.isVisible(),
    panelFocused: win?.isFocused(),
    panelMinimized: win?.isMinimized(),
    topmost: dock?.isAlwaysOnTop(),
    bounds: dock?.getBounds(),
    helperPid: observer?.pid,
    geometry,
    lastGeometryAt,
    weatherUpdated: last?.updated,
    visibilityState: primaryVisibility.state,
    visibilityReason: primaryVisibility.lastReason,
  };
}
const { spawn } = require("node:child_process");
function publish(s) {
  if (win && !win.isDestroyed()) win.webContents.send("weather", s);
  if (dock && !dock.isDestroyed()) dock.webContents.send("weather", s);
  secondary.publish(s);
}
const configPath = () => path.join(app.getPath("userData"), "settings.json");
function save(value = config) {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  const temp = configPath() + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(value, null, 2));
  fs.renameSync(temp, configPath());
}
function label(p) {
  return [p.name, p.admin1, p.country].filter(Boolean).join(", ");
}
async function refresh() {
  if (busy || !config.place) return;
  busy = true;
  publish({ loading: true });
  try {
    const data = await fetchWeather(config);
    if (app.quitting) return;
    last = {
      data,
      place: config.place,
      unit: config.unit,
      updated: Date.now(),
    };
    tray.setToolTip(
      `${config.place.name}: ${Math.round(data.current.temperature_2m)}°${config.unit}`,
    );
    publish(last);
    // A renderer restart must not mark a successful forecast as failed.
    try {
      const icon = await win.webContents.executeJavaScript(
        `window.trayImage(${JSON.stringify(Math.round(data.current.temperature_2m))})`,
      );
      if (!app.quitting) tray.setImage(nativeImage.createFromDataURL(icon));
    } catch (e) { log("tray-render-error", {message:e.message}); }
  } catch (e) {
    if (app.quitting) return;
    log("weather-error", { message: e.message });
    publish({ error: e.message, last });
    tray?.setToolTip("Lucent Weather — update unavailable");
  } finally {
    busy = false;
  }
}
function show() {
  const anchor=selectedDock && !selectedDock.isDestroyed() ? selectedDock : dock;
  const d = anchor ? screen.getDisplayMatching(anchor.getBounds()) : screen.getPrimaryDisplay(),
    w = d.workArea;
  const height = Math.min(790, w.height - 24);
  win.setBounds({
    x: config.position !== "left" ? Math.max(w.x+12, Math.min(w.x+w.width-442, (anchor?.getBounds().x ?? w.x+w.width-442)+204-430)) : w.x + 12,
    y: w.y + w.height - height - 10,
    width: 430,
    height,
  });
  clearTimeout(panelBlurTimer);
  panelOpenedAt = Date.now();
  log("panel-open");
  if (win.isMinimized()) win.restore();
  win.showInactive();
  win.focus();
  win.webContents.send("tick");
}
function observeTaskbar() {
  if (app.quitting) return;
  clearTimeout(observerRetry);
  primaryVisibility.reset();
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
    if (observer !== child || app.quitting) return;
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
        secondaryBars=g.secondaryBars||[];
        secondary.sync(secondaryBars);
        lastGeometryAt = Date.now();
        observerFailures = 0;
        geometry = {
          taskbar: r,
          tray: g.tray ? screen.screenToDipRect(null,g.tray) : null,
          display: b,
          foreground: f,
          frontClass: g.frontClass,
          taskbarAbove: g.taskbarAbove,
          fullscreenBlocked: g.fullscreenBlocked,
        };
        const decision = geometryDecision({...g, bar:r}, b);
        const reason = decision.reason;
        if (g.visible && r.width >= 400 && r.height >= 24) {
          const bounds = tileBounds(r, geometry.tray, config.position);
          if (!boundsEqual(bounds, dock.getBounds())) dock.setBounds(bounds);
        }
        if (reason !== lastDecision) {
          log("visibility", { reason, frontClass: g.frontClass });
          lastDecision = reason;
        }
        const transition = primaryVisibility.observe(decision.shown, reason);
        if (transition.action) log("tile-transition", {action:transition.action, reason, foreground:f, frontClass:g.frontClass});
        if (transition.action === "hide" && dock.isVisible()) dock.hide();
        if (!decision.shown) continue;
        if (primaryVisibility.state === "shown" && !dock.isVisible()) dock.showInactive();
      } catch (e) {
        log("observer-sample-error", { message: e.message });
      }
    }
  });
  let finished = false;
  const recover = (reason) => {
    if (finished) return;
    finished = true;
    if (observer !== child) return;
    observer = null;
    primaryVisibility.reset();
    if (dock && !dock.isDestroyed()) dock.hide();
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
      fs.mkdirSync(path.dirname(report.slice(14)), {recursive:true});
      fs.writeFileSync(
        report.slice(14),
        JSON.stringify(diagnostics(), null, 2),
      );
      return;
    }
    if (argv.includes("--quit")) app.quit();
    else if (win && dock) show();
  });
  app.whenReady().then(async () => {
    app.setAppUserModelId("LucentWeather.Desktop");
    const { session, powerMonitor } = require("electron");
    session.defaultSession.setPermissionRequestHandler((_web, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    powerMonitor.on("resume", () => { if (!busy && (!last || Date.now() - last.updated > 5 * 60000)) refresh(); });
    try {
      config = JSON.parse(fs.readFileSync(configPath(), "utf8"));
    } catch {}
    config = normalizeConfig(config);
    win = new BrowserWindow({
      width: 430,
      height: 790,
      minWidth: 390,
      minHeight: 500,
      frame: false,
      skipTaskbar: true,
      resizable: false,
      show: false,
      title: "Lucent Weather",
      icon: path.join(__dirname, "LucentWeather.ico"),
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
      log("panel-blur");
      if (qa) return;
      clearTimeout(panelBlurTimer);
      panelBlurTimer = setTimeout(
        () => {
          if (!win.isDestroyed() && win.isVisible() && !win.isFocused()) {
            log("panel-dismiss-blur");
            win.hide();
          }
        },
        Math.max(350, 900 - (Date.now() - panelOpenedAt)),
      );
    });
    win.on("focus", () => {
      clearTimeout(panelBlurTimer);
      log("panel-focus");
    });
    win.on("hide", () => {
      clearTimeout(panelBlurTimer);
      log("panel-hide");
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
      // Allow an explicit click to transfer focus from Start to our flyout.
      // A non-activating tile lets the fullscreen game regain focus in between.
      focusable: true,
      hasShadow: false,
      icon: path.join(__dirname, "LucentWeather.ico"),
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
        primaryVisibility.reset();
        dock.hide();
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
    tray.setToolTip("Lucent Weather");
    updateTrayMenu();
    tray.on("click", () => (win.isVisible() ? win.hide() : show()));
    if (qa) {
      await require("./qa.cjs")({
        qa, win, dock, secondary, json, label, show, refresh, setPosition,
        setScreens, configPath, diagnostics,
        get config() { return config; }, get last() { return last; },
        get geometry() { return geometry; }, get secondaryBars() { return secondaryBars; },
        get selectedDock() { return selectedDock; },
        setConfig(value) { config = value; }, setSelectedDock(value) { selectedDock = value; },
      });
    } else {
      if (!config.place) show();
      await refresh();
      timer = setInterval(refresh, 15 * 60 * 1000);
    }
  }).catch(e => { log("startup-error", {message:e.stack}); app.exit(1); });
  app.on("before-quit", () => {
    app.quitting = true;
    clearInterval(timer);
    clearInterval(watchdog);
    clearTimeout(panelBlurTimer);
    clearTimeout(observerRetry);
    secondary.close();
    observer?.kill();
  });
}
function handle(channel, listener) {
  ipcMain.handle(channel, (event, ...args) => {
    const frame = event.senderFrame;
    const allowed = ["index.html", "dock.html"].map(file => require("node:url").pathToFileURL(path.join(__dirname, file)).href);
    if (!frame || frame !== event.sender.mainFrame || !allowed.includes(frame.url)) throw Error("Unsupported request source.");
    return listener(event, ...args);
  });
}
handle("settings", () => config);
handle("search", async (_, q) => {
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
handle("select", async (_, p, unit) => {
  if (busy) throw Error("Please wait for the current update.");
  if (!validPlace(p)) throw Error("Choose a location from search results.");
  const next = normalizeConfig({...config, place: p, unit});
  save(next);
  config = next;
  last = null;
  await refresh();
  return config;
});
handle("refresh", refresh);

handle("toggle", (event) => {
  const target=BrowserWindow.fromWebContents(event.sender);
  const same=selectedDock===target;
  selectedDock=target;
  if(win.isVisible()&&same)win.hide();else show();
});
handle("hide", () => win.hide());
function placementMenu() {
  return { label:"Position", submenu:[
    {label:"Left corner",type:"radio",checked:config.position==="left",click:()=>setPosition("left")},
    {label:"Beside system tray",type:"radio",checked:config.position!=="left",click:()=>setPosition("tray")},
  ]};
}
function contextMenu() {
  return Menu.buildFromTemplate([
    {label:"Open weather",click:show},
    {label:"Refresh",click:refresh},
    placementMenu(),
    {label:"Screens",submenu:[
      {label:"Primary screen only",type:"radio",checked:config.screens!=="all",click:()=>setScreens("primary")},
      {label:"All screens",type:"radio",checked:config.screens==="all",click:()=>setScreens("all")}
    ]},
    {type:"separator"},
    {label:"Quit Lucent Weather",click:()=>app.quit()},
  ]);
}
function updateTrayMenu() { tray?.setContextMenu(contextMenu()); }
function setPosition(position) {
  config.position=position==="tray"?"tray":"left";
  save();
  if(geometry?.taskbar) dock.setBounds(tileBounds(geometry.taskbar,geometry.tray,config.position));
  if(win.isVisible()) show();
  updateTrayMenu();
}
function setScreens(mode) {
  config.screens=mode;
  save(); secondary.sync(secondaryBars); updateTrayMenu();
}
handle("menu", (event) => {
  selectedDock=BrowserWindow.fromWebContents(event.sender);
  const target=selectedDock;
  return new Promise(resolve => {
    const menu=contextMenu();
    if(qa)setTimeout(()=>menu.closePopup(target),400);
    menu.popup({window:target,callback:resolve});
  });
});
