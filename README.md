# Clear Weather

An independent weather and daylight companion for Windows 11. A small, native-looking weather tile sits over the empty left side of the taskbar; click it for a weather-responsive forecast panel.

## Features

- Current temperature, feels-like temperature, wind and humidity; selectable locations and Fahrenheit/Celsius.
- Five-day forecast with weather icons and precipitation probabilities.
- Sunrise/sunset countdown and a time-driven sun/moon progress arc.
- Moon phase, illumination and above/below-horizon status, calculated locally.
- Day, night, sunrise and sunset scenes, with rain, drizzle, snow, fog, freezing precipitation and storm treatments.
- Automatic recovery when Explorer covers the widget, its geometry helper exits, or a renderer crashes.
- No Windows Widgets, Microsoft weather service, account, API key, telemetry, or automatic startup registration.

## Run

Extract a Windows release ZIP into a permanent folder, then open `ClearWeather.exe`. Keep its supporting files beside it. Search for a city/postal code and select the correct region. Click the taskbar tile to open the panel; click outside, press Escape, or close it to dismiss. Right-click the tile to refresh or quit. The notification-area icon is a fallback control.

The tile is a **204 × 44 DIP overlay**, not an Explorer plugin. It assumes an empty bottom-left space on a horizontal primary taskbar, does not reserve space or rearrange buttons, and hides while a fullscreen app covers the taskbar or the taskbar is hidden. Opening Start with the Windows key exposes the taskbar and brings the tile back. It supports the tested Windows 11 desktop layout; other shell replacements and layouts may behave differently.

## Build

Requires Node.js 22.12 or newer, npm, and Windows for the native geometry helper. Dependencies are pinned by `package-lock.json`.

On Windows:

```powershell
npm ci
npm run build:helper
npm test
npm run package
```

The helper build uses the .NET Framework C# compiler included with supported Windows installations. It produces `Geometry.exe` from the included `Geometry.cs`. The Electron package includes that helper automatically.

For development in WSL, keep the repository and `node_modules` on the Linux filesystem. Compile `Geometry.cs` with the Windows compiler using `build-helper.ps1`, put the resulting `Geometry.exe` in the Linux project root, then run `npm ci`, `npm test`, and `npm run package` in WSL. The result is `dist/ClearWeather-win32-x64`. To launch directly with `npm start`, the helper must be copied to Electron's development resources directory; packaged builds are the supported test path.

## Data and privacy

Weather and geocoding use [Open-Meteo](https://open-meteo.com/) with CC BY 4.0 attribution. Search text and selected coordinates are sent over HTTPS. The public endpoint is for **non-commercial use**; commercial distribution requires a suitable provider plan/backend under its [terms](https://open-meteo.com/en/terms).

Settings are stored in `%APPDATA%\clear-weather\settings.json`. Weather is held in memory and refreshes every 15 minutes. Failed updates preserve the last in-session forecast with an error label. Diagnostic logs contain geometry/visibility events and error descriptions, not authentication tokens. Quit the app to stop its helper; no service or scheduled task is installed.

## Calculation conventions

- Forecasts come from Open-Meteo; condition labels follow its WMO code table. Precipitation percentages are daily maximum probabilities.
- Sunrise/sunset timestamps are interpreted in the selected location's timezone, including daylight-saving changes. The next-sunrise countdown works across midnight.
- The moving arc indicates elapsed **day or night**, not the Sun/Moon's measured position in the sky. It updates on the minute, with a brief smooth transition; reduced-motion settings are honored.
- Sunrise colors span 35 minutes either side of sunrise; sunset colors span 45 minutes before through 30 minutes after sunset. These are artistic windows, not calculated golden-hour intervals.
- Moon phase, illumination and altitude use [SunCalc 2.0.2](https://github.com/mourner/suncalc). Phase names are rounded to eight categories. Moon diagrams are conventional north-up views, not observer-relative rotation. No lunar rise/set times are claimed.

## Verification

`npm test` covers solar/daylight boundaries, timezone/DST handling, all documented condition codes and moon reference cases. A packaged executable accepts:

```text
ClearWeather.exe --qa-output=ABSOLUTE_DIRECTORY
```

This uses a separate profile, fetches a public London weather fixture, renders scene/phase screenshots, checks layout, and briefly exercises renderer recovery and fullscreen handling. It does not overwrite the normal location. Run it when short-lived test windows are acceptable. Internet is required for that smoke test.

For diagnostics from a running instance:

```text
ClearWeather.exe --diagnostics=ABSOLUTE_JSON_PATH
```

Logs are bounded under the user-data folder. All tests are a useful baseline, not exhaustive coverage of every monitor, taskbar customization, network or Windows update.

## License

Original application code and artwork: MIT, see `LICENSE`. SunCalc: BSD-2-Clause, see `SUNCALC-LICENSE`. Electron/Chromium notices remain in Windows packages. `suncalc.js` is vendored from npm `suncalc@2.0.2`, with a browser/CommonJS wrapper added locally; its astronomical algorithms are unchanged.
