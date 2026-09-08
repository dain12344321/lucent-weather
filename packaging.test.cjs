const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert/strict");

const root = __dirname;
const packageJson = require(path.join(root, "package.json"));
const packaging = require("./scripts/package.cjs");
const staging = require("./scripts/stage-release.cjs");

test("release metadata is pinned to the Lucent Weather portable contract", () => {
  assert.equal(packageJson.name, "lucent-weather");
  assert.equal(packageJson.version, "0.9.3");
  assert.equal(packageJson.devDependencies["@electron/packager"], "20.3.0");
  assert.equal(packageJson.devDependencies["@resvg/resvg-js"], "2.6.2");
  assert.match(packageJson.scripts.test, /test\.cjs/);
  assert.match(packageJson.scripts["build:release"], /stage-release/);
  assert.equal(packaging.portableName, "LucentWeather-win32-x64");
  assert.deepEqual(packaging.ELECTRON_LANGUAGES, ["en-US", "en-GB"]);
  assert.equal(staging.releaseName, "LucentWeather-v0.9.3-Windows-x64");
  assert.deepEqual(staging.WINDOWS_FILES, [
    "Install-LucentWeather.cmd",
    "Install-LucentWeather.ps1",
    "Run-LucentWeather.cmd",
    "LUCENTWEATHER-DISTRIBUTION.md",
  ]);
});

test("asar allowlist retains every application runtime module and omits maintenance files", () => {
  for (const file of [
    "qa.cjs",
    "weather-service.cjs",
    "geometry.js",
    "visibility.js",
    "main.js",
    "preload.js",
    "secondary.js",
    "index.html",
    "dock.html",
    "node_modules/leaflet/dist/leaflet.js",
    "node_modules/leaflet/dist/leaflet.css",
    "node_modules/leaflet/package.json",
  ]) {
    assert.ok(packaging.RUNTIME_FILES.includes(file), `missing runtime file: ${file}`);
    assert.equal(packaging.shouldIgnore(`/${file}`), false, `ignored runtime file: ${file}`);
  }
  for (const file of ["node_modules/leaflet/dist/images/layers.png", "node_modules/leaflet/dist/images/marker-icon.png"]) {
    assert.equal(packaging.shouldIgnore(`/${file}`), false, `ignored runtime image: ${file}`);
  }
  for (const file of [
    "style.css",
    "taskbar.ps1",
    "test.cjs",
    "geometry.test.cjs",
    "README.md",
    "scripts/package.cjs",
    "node_modules/leaflet/src/Leaflet.js",
    "node_modules/leaflet/dist/leaflet.js.map",
    "node_modules/leaflet/src/images/logo.svg",
  ]) {
    assert.equal(packaging.shouldIgnore(`/${file}`), true, `leaked maintenance file: ${file}`);
  }
});

test("portable-root validation requires the executable and runtime siblings", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "lucent-weather-package-"));
  try {
    fs.mkdirSync(path.join(temporary, "resources"));
    fs.mkdirSync(path.join(temporary, "locales"));
    fs.writeFileSync(path.join(temporary, "LucentWeather.exe"), "exe");
    fs.writeFileSync(path.join(temporary, "resources", "app.asar"), "asar");
    fs.writeFileSync(path.join(temporary, "resources", "Geometry.exe"), "helper");
    assert.equal(packaging.isPortableRoot(temporary), true);
    fs.rmSync(path.join(temporary, "resources", "Geometry.exe"));
    assert.equal(packaging.isPortableRoot(temporary), false);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test("Windows wrappers use the flat executable root and preserve rollback language", () => {
  const launcher = fs.readFileSync(path.join(root, "Run-LucentWeather.cmd"), "utf8");
  const installer = fs.readFileSync(path.join(root, "Install-LucentWeather.ps1"), "utf8");
  const distribution = fs.readFileSync(path.join(root, "LUCENTWEATHER-DISTRIBUTION.md"), "utf8");
  assert.match(launcher, /%~dp0LucentWeather\.exe/);
  assert.match(installer, /\.previous-/);
  assert.match(installer, /Test-LucentWeatherPayload/);
  assert.match(installer, /LucentWeather\.exe/);
  assert.match(distribution, /flat/);
  assert.match(distribution, /Run-LucentWeather\.cmd/);
});

test("packager keeps its traversal root while rejecting unrelated files", () => { assert.equal(packaging.shouldIgnore(""), false); assert.equal(packaging.shouldIgnore("/"), false); assert.equal(packaging.shouldIgnore("/passwords.json"), true); });
