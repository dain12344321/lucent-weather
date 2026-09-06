# Lucent Weather Windows distribution

Lucent Weather 0.9.3 is a portable Windows app. The release ZIP has one flat
runtime root: `LucentWeather.exe` sits beside `resources\`, Chromium DLLs,
`locales\`, and the two optional launcher/installer scripts. Keep that root
together after extraction.

## Portable use

Extract `LucentWeather-v0.9.3-Windows-x64.zip` into a permanent folder and
open `LucentWeather.exe`. `Run-LucentWeather.cmd` is a convenience launcher
for the same folder. No installation, administrator rights, registry entries,
or automatic startup are required. The app stores its settings in
`%APPDATA%\clear-weather`, outside the portable folder.

Do not copy out only the executable, and do not use GitHub **Code → Download
ZIP** as the Windows app. That archive is source code and has no packaged
Electron runtime. The release ZIP must retain `resources\app.asar`,
`resources\Geometry.exe`, the Chromium files, and `locales\` beside the EXE.

## Optional installer

Run `Install-LucentWeather.cmd` when Start Menu or desktop shortcuts are
useful. Its default target is `%LOCALAPPDATA%\Programs\LucentWeather`; pass
`-InstallRoot` to choose another folder, such as a user-owned
`C:\Programs\Lucent Weather` directory. The installer validates the EXE, asar, helper, and locale
folder before moving anything. An existing target is moved to a timestamped
`.previous-*` folder, the new tree is staged and validated, and a failed move
restores the previous folder. Settings remain in `%APPDATA%\clear-weather`.

Examples:

```powershell
.\Install-LucentWeather.cmd -NoPrompt -NoShortcuts
.\Install-LucentWeather.cmd -InstallRoot 'C:\Programs\Lucent Weather' -NoPrompt
```

The installer does not delete an existing backup. Close a running Lucent
Weather copy before replacing its folder so Windows can move the executable.

## Windows-side contents

| Item | Purpose |
| --- | --- |
| `LucentWeather.exe` | Electron runtime and app entry point |
| `resources\app.asar` | Pruned application source and production Leaflet assets |
| `resources\Geometry.exe` | Native taskbar geometry helper |
| `locales\en-US.pak`, `locales\en-GB.pak` | English Chromium locale resources |
| `lucent-weather-preview.ico` | Shortcut icon copied by the optional installer |
| `Run-LucentWeather.cmd` | Portable convenience launcher |
| `Install-LucentWeather.cmd` / `.ps1` | Optional validated installer |

The build keeps Git metadata, Node modules used only for development, tests,
build scripts, source maps, Leaflet source, and maintenance documentation out
of the asar. The release root contains only what Windows needs to run and
repair the app.
