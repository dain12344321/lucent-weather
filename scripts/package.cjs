const fs = require("node:fs");
const path = require("node:path");
const { packager } = require("@electron/packager");

const root = path.resolve(__dirname, "..");
const packageJson = require(path.join(root, "package.json"));
const dist = path.join(root, "dist");
const portableName = "LucentWeather-win32-x64";
const portableRoot = path.join(dist, portableName);
const ELECTRON_LANGUAGES = Object.freeze(["en-US", "en-GB"]);

// Keep the asar limited to files used by the running application. Electron's
// production prune removes dev modules; this allowlist also prevents future
// build, test, or documentation files from silently leaking into releases.
const RUNTIME_FILES = Object.freeze([
  "main.js",
  "preload.js",
  "secondary.js",
  "placement.js",
  "geometry.js",
  "visibility.js",
  "weather-service.cjs",
  "qa.cjs",
  "taskbar-qa.cjs",
  "index.html",
  "dock.html",
  "renderer.js",
  "dock.js",
  "solar.js",
  "suncalc.js",
  "lunar.js",
  "daylight.js",
  "hourly.js",
  "radar.js",
  "atmosphere.css",
  "scenes.css",
  "typography.css",
  "hourly.css",
  "refinement.css",
  "dock.css",
  "LucentWeather.ico",
  "LICENSE",
  "SUNCALC-LICENSE",
  "package.json",
  "node_modules/leaflet/LICENSE",
  "node_modules/leaflet/package.json",
  "node_modules/leaflet/dist/leaflet.css",
  "node_modules/leaflet/dist/leaflet.js",
]);
const RUNTIME_DIRECTORIES = Object.freeze(["node_modules/leaflet/dist/images"]);

const RUNTIME_FILE_SET = new Set(RUNTIME_FILES);

function shouldIgnore(relativePath) {
  const normalized = String(relativePath)
    .replaceAll(path.sep, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  if (normalized === "") return false;
  if (RUNTIME_FILE_SET.has(normalized)) return false;
  if (RUNTIME_DIRECTORIES.some((directory) => normalized === directory || normalized.startsWith(`${directory}/`))) return false;
  if (RUNTIME_DIRECTORIES.some((directory) => directory.startsWith(`${normalized}/`))) return false;
  if (RUNTIME_FILES.some((file) => file.startsWith(`${normalized}/`))) return false;
  return true;
}

function pruneLocales(directory, languages = ["en-US", "en-GB"]) {
  const localeDirectory = path.join(directory, "locales");
  const keep = new Set(languages.map((language) => `${language}.pak`));
  for (const entry of fs.readdirSync(localeDirectory)) {
    if (!keep.has(entry)) fs.rmSync(path.join(localeDirectory, entry), { force: true });
  }
}

function isPortableRoot(directory) {
  const required = [
    path.join(directory, "LucentWeather.exe"),
    path.join(directory, "resources", "app.asar"),
    path.join(directory, "resources", "Geometry.exe"),
    path.join(directory, "locales"),
  ];
  return (
    required.slice(0, 3).every((entry) => fs.existsSync(entry)) &&
    fs.existsSync(required[3]) &&
    fs.statSync(required[3]).isDirectory()
  );
}

async function packageWindows(options = {}) {
  const source = options.source ?? root;
  const output = options.output ?? dist;
  const icon = options.icon ?? path.join(source, "LucentWeather.ico");
  const helper = options.helper ?? path.join(source, "Geometry.exe");
  if (!fs.existsSync(icon)) throw new Error(`Icon not found: ${icon}`);
  if (!fs.existsSync(helper)) {
    throw new Error(`Geometry helper not found: ${helper}; run npm run build:helper first`);
  }
  fs.mkdirSync(output, { recursive: true });
  const [result] = await packager({
    dir: source,
    name: "LucentWeather",
    executableName: "LucentWeather",
    appVersion: packageJson.version,
    electronVersion: require("electron/package.json").version,
    platform: "win32",
    arch: "x64",
    out: output,
    overwrite: true,
    asar: true,
    prune: true,
    electronLanguages: ELECTRON_LANGUAGES,
    icon,
    extraResource: [helper],
    ignore: shouldIgnore,
    win32metadata: {
      CompanyName: "Lucent Weather contributors",
      ProductName: "Lucent Weather",
      FileDescription: "Lucent Weather desktop companion",
    },
  });
  if (path.resolve(result) !== path.resolve(path.join(output, portableName))) {
    throw new Error(`Unexpected package output: ${result}`);
  }
  pruneLocales(result);
  if (!isPortableRoot(result)) {
    throw new Error(`Portable package is incomplete: ${result}`);
  }
  const size = summarizeSize(result);
  console.log(`Portable package: ${result}`);
  console.log(`Portable size: ${size}`);
  return result;
}

function summarizeSize(directory) {
  let total = 0;
  const visit = (entry) => {
    const stat = fs.statSync(entry);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(entry)) visit(path.join(entry, child));
    } else {
      total += stat.size;
    }
  };
  visit(directory);
  return `${(total / 1024 / 1024).toFixed(1)} MiB`;
}

if (require.main === module) {
  packageWindows().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

module.exports = {
  ELECTRON_LANGUAGES,
  RUNTIME_FILES,
  RUNTIME_DIRECTORIES,
  dist,
  isPortableRoot,
  packageWindows,
  portableName,
  portableRoot,
  pruneLocales,
  shouldIgnore,
};
