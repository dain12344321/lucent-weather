const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { isPortableRoot, portableRoot } = require("./package.cjs");

const root = path.resolve(__dirname, "..");
const packageJson = require(path.join(root, "package.json"));
const releaseName = `LucentWeather-v${packageJson.version}-Windows-x64`;
const releaseRoot = path.join(root, "dist", "release");
const stage = path.join(releaseRoot, releaseName);
const zip = path.join(root, "dist", `${releaseName}.zip`);

const WINDOWS_FILES = [
  "Install-LucentWeather.cmd",
  "Install-LucentWeather.ps1",
  "Run-LucentWeather.cmd",
  "LUCENTWEATHER-DISTRIBUTION.md",
];

function copyPayload() {
  if (!isPortableRoot(portableRoot)) {
    throw new Error(`Portable package is missing or incomplete: ${portableRoot}`);
  }
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage, { recursive: true });
  for (const entry of fs.readdirSync(portableRoot)) {
    fs.cpSync(
      path.join(portableRoot, entry),
      path.join(stage, entry),
      { recursive: true, force: true },
    );
  }
  for (const file of WINDOWS_FILES) {
    fs.copyFileSync(path.join(root, file), path.join(stage, file));
  }
  fs.copyFileSync(
    path.join(root, "LucentWeather.ico"),
    path.join(stage, "lucent-weather-preview.ico"),
  );
}

function quotePowerShell(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function createZip() {
  fs.rmSync(zip, { force: true });
  if (process.platform !== "win32") {
    const result = spawnSync("zip", ["-q", "-r", "-X", zip, "."], {
      cwd: stage,
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`zip failed with exit code ${result.status}`);
    return;
  }
  const command = [
    "$ErrorActionPreference = 'Stop'",
    `Compress-Archive -Path (Join-Path ${quotePowerShell(stage)} '*') -DestinationPath ${quotePowerShell(zip)} -CompressionLevel Optimal -Force`,
  ].join("; ");
  const result = spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-Command", command], {
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Compress-Archive failed with exit code ${result.status}`);
}

function main() {
  copyPayload();
  createZip();
  console.log(`Release folder: ${stage}`);
  console.log(`Release ZIP: ${zip}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  }
}

module.exports = {
  WINDOWS_FILES,
  createZip,
  main,
  releaseName,
  releaseRoot,
  stage,
  zip,
};
