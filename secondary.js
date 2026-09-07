const {BrowserWindow, screen, app} = require("electron");
const {spawn} = require("node:child_process");
const path = require("node:path");
const {tileBounds} = require("./placement");
const {geometryDecision, boundsEqual} = require("./geometry");
const {createVisibilityGate} = require("./visibility");

const HELPER_STALE_MS = 8000;
const HELPER_RETRY_MS = 1500;

module.exports = function secondaryWidgets(getConfig, getLast, getPanel, log) {
  const entries = new Map();

  function hide(entry) {
    if (!entry.window.isDestroyed() && entry.window.isVisible())
      entry.window.hide();
  }

  function dispose(entry) {
    entry.closed = true;
    clearTimeout(entry.retry);
    clearInterval(entry.watch);
    entry.retry = null;
    const child = entry.child;
    entry.child = null;
    if (child) {
      try { child.kill(); } catch {}
    }
    if (!entry.window.isDestroyed()) entry.window.destroy();
  }

  function sync(ids) {
    const wanted = new Set(getConfig().screens === "all" ? ids || [] : []);
    for (const [id, entry] of entries) {
      if (!wanted.has(id)) {
        dispose(entry);
        entries.delete(id);
      }
    }
    for (const id of wanted) if (!entries.has(id)) create(id);
  }

  function create(id) {
    const window = new BrowserWindow({
      width: 204,
      height: 44,
      frame: false,
      transparent: true,
      show: false,
      skipTaskbar: true,
      resizable: false,
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
    const entry = {
      window,
      closed: false,
      child: null,
      retry: null,
      lastAt: Date.now(),
      taskbarExposed: false,
      visibilityReason: "unobserved",
      gate: createVisibilityGate(),
    };
    entries.set(id, entry);

    window.setAlwaysOnTop(true, "screen-saver");
    window.webContents.setWindowOpenHandler(() => ({action: "deny"}));
    window.webContents.on("will-navigate", (event) => event.preventDefault());
    window.webContents.on("did-finish-load", () => {
      if (getLast() && !entry.closed)
        window.webContents.send("weather", getLast());
    });
    window.webContents.on("render-process-gone", () => {
      if (!entry.closed) window.reload();
    });
    window.loadFile("dock.html")
      .then(() => { if (!entry.closed) start(); })
      .catch((error) => log("secondary-load-error", {message: error.message}));

    entry.watch = setInterval(() => {
      const child = entry.child;
      if (!child || Date.now() - entry.lastAt <= HELPER_STALE_MS) return;
      log("secondary-helper-stalled", {id, pid: child.pid});
      recover(child, "helper-stalled");
    }, 2000);

    function recover(child, reason) {
      if (entry.closed || (child && entry.child !== child)) return;
      if (entry.retry) return;
      entry.child = null;
      entry.lastAt = 0;
      entry.taskbarExposed = false;
      entry.visibilityReason = reason;
      // A helper that cannot produce fresh geometry must never leave a stale
      // tile over a fullscreen window or a recreated Explorer taskbar.
      entry.gate.reset();
      hide(entry);
      if (child) {
        try { child.kill(); } catch {}
      }
      if (app.quitting) return;
      entry.retry = setTimeout(() => {
        entry.retry = null;
        start();
      }, HELPER_RETRY_MS);
      log("secondary-helper-restart", {id, reason});
    }

    function start() {
      if (entry.closed || app.quitting || entry.child) return;
      entry.gate.reset();
      let child;
      try {
        child = spawn(
          path.join(process.resourcesPath, "Geometry.exe"),
          [
            String(process.pid),
            window.getNativeWindowHandle().readBigUInt64LE().toString(),
            id,
          ],
          {windowsHide: true, stdio: ["ignore", "pipe", "pipe"]},
        );
      } catch (error) {
        recover(null, "spawn-error");
        log("secondary-helper-error", {id, message: error.message});
        return;
      }
      entry.child = child;
      entry.lastAt = Date.now();
      let buffer = "";

      child.stdout.on("data", (chunk) => {
        if (entry.closed || entry.child !== child) return;
        buffer += chunk.toString();
        if (buffer.length > 65536) {
          buffer = "";
          log("secondary-helper-buffer-reset", {id});
          return;
        }
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const g = JSON.parse(line);
            const bar = screen.screenToDipRect(null, g.bar);
            const display = screen.getDisplayMatching(bar);
            const decision = geometryDecision({...g, bar}, display.bounds);
            entry.lastAt = Date.now();
            entry.taskbarExposed = Boolean(g.widgetExposed ?? g.taskbarExposed);
            entry.visibilityReason = decision.reason;
            if (g.visible && bar.width >= 400 && bar.height >= 24) {
              const bounds = tileBounds(bar, g.tray ? screen.screenToDipRect(null, g.tray) : null, getConfig().position);
              if (!boundsEqual(bounds, window.getBounds())) window.setBounds(bounds);
            }
            const transition = entry.gate.observe(decision.shown, decision.reason);
            if (transition.action === "hide") hide(entry);
            if (!decision.shown || entry.closed || window.isDestroyed()) continue;
            if (entry.gate.state === "shown" && !window.isVisible())
              window.showInactive();
          } catch (error) {
            log("secondary-geometry-error", {id, message: error.message});
          }
        }
      });
      child.stderr.on("data", (data) => {
        log("secondary-helper-stderr", {id, message: data.toString().slice(0, 200)});
      });
      child.on("error", (error) => {
        log("secondary-helper-error", {id, message: error.message});
        recover(child, "error");
      });
      child.on("exit", (code, signal) => {
        recover(child, `exit ${code ?? "null"}${signal ? ` ${signal}` : ""}`);
      });
    }
  }

  return {
    sync,
    publish: (state) => {
      for (const entry of entries.values()) {
        if (!entry.window.isDestroyed()) entry.window.webContents.send("weather", state);
      }
    },
    diagnostics: () => [...entries.values()].map((entry) => ({
      bounds: entry.window.isDestroyed() ? null : entry.window.getBounds(),
      visible: !entry.window.isDestroyed() && entry.window.isVisible(),
      taskbarExposed: entry.taskbarExposed,
      visibilityReason: entry.visibilityReason,
      visibilityState: entry.gate.state,
      helperPid: entry.child?.pid,
      lastGeometryAt: entry.lastAt,
    })),
    close: () => {
      for (const entry of entries.values()) dispose(entry);
      entries.clear();
    },
  };
};
