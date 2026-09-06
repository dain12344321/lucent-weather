const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = __dirname;
const script = path.join(root, "build-helper.ps1");

function windowsPath(file) {
  if (process.platform === "win32") return file;
  const result = spawnSync("wslpath", ["-w", file], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`wslpath failed for ${file}: ${result.stderr || "unknown error"}`);
  }
  return result.stdout.trim();
}

function run() {
  const powershell = process.platform === "win32" ? "powershell.exe" : "powershell.exe";
  const result = spawnSync(
    powershell,
    [
      "-NoLogo",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      windowsPath(script),
    ],
    // The script path is absolute. Avoid passing the Linux cwd to the Windows
    // process when this is launched from WSL interop.
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  }
}

if (require.main === module) run();

module.exports = { windowsPath };
