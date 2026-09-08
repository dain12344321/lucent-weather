# Lucent Weather 0.9.3

A weather and daylight companion for Windows 11. A small taskbar tile opens a weather-responsive forecast, hourly outlook, sun/moon card, and radar.

Patch 0.9.3 keeps the taskbar tile visible during ordinary window overlap, maximized desktop use and window switching. A full-monitor app covering the taskbar suppresses it even when a dialog takes focus.

## Download and run

Download **LucentWeather-v0.9.3-Windows-x64.zip** from [GitHub Releases](https://github.com/dain12344321/lucent-weather/releases). Extract the complete ZIP to a permanent folder and double-click **LucentWeather.exe**. No installer, account, API key, Node.js, or WSL is needed to run it. Keep the runtime files, `locales`, and `resources` beside the executable.

The optional `Install-LucentWeather.cmd` copies the app to a location you choose and can create shortcuts. See [distribution instructions](LUCENTWEATHER-DISTRIBUTION.md). GitHub **Code → Download ZIP** contains source code; use the release asset for Windows.

## Features

- Current temperature, feels-like, wind, humidity, location search and Fahrenheit/Celsius.
- Interactive 24-hour forecast with temperature, conditions, rain chance and selected-hour details.
- Seven-day highs/lows and precipitation probabilities.
- Sunrise/sunset countdown, solar noon, day/night progress arc, and moon phase/illumination/horizon status.
- Hourly modeled UV and US air quality index, with missing values clearly unavailable.
- A second forecast page with a Leaflet/OpenStreetMap basemap and observed NOAA radar playback.
- Day, night, sunrise and sunset scenes with rain, snow, fog, freezing precipitation and storm treatments; reduced-motion support.
- One tile on the primary taskbar, or a tile on each Windows taskbar. Choose **Screens** and **Position** from the tile/notification-icon context menu.
- Automatic recovery after Explorer/taskbar changes, geometry-helper failures and renderer crashes.
- A refined split sun/cloud icon, generated at nine Windows icon sizes from one SVG source.

## Use

Click a tile to open the forecast on that display. Click outside, press Escape, or use the close button to dismiss it. Right-click a tile or the notification icon to refresh, choose placement/screens, or quit. The tray temperature is a fallback entry point.

The tile uses 204 × 44 device-independent pixels. It overlays available space beside the system tray or at the left corner; it does not reserve space from other taskbar buttons. It follows the visible taskbar and stays present when ordinary windows overlap it. It hides while a full-monitor app covers that taskbar, including when another dialog takes focus, and returns when the taskbar is exposed. A secondary display needs Windows' taskbar-on-all-displays option. Horizontal Windows 11 taskbars are the supported layout; shell replacements and unusual taskbar customizations need their own verification.

Weather refreshes every 15 minutes and after resuming from sleep if stale. The core forecast, hourly forecast and air-quality requests run concurrently. Missing optional feeds leave current/daily conditions usable. A failed refresh preserves the last in-session forecast with an error label. A failed location change never relabels the previous location's forecast.

## Settings and privacy

Settings remain in `%APPDATA%\clear-weather\settings.json`; updates preserve your location, units and layout. They are written atomically. Weather is held in memory, and diagnostic logs are bounded in that same profile. No Windows service, scheduled task, telemetry, Windows Widgets or Microsoft weather integration is installed.

Auto-start is optional: place a shortcut to the permanent executable in your Windows user Startup folder, or opt in through the mini installer. Remove the shortcut to disable it. Moving the portable folder requires updating your shortcuts.

Weather, geocoding, and CAMS air-quality data use [Open-Meteo](https://open-meteo.com/), with CC BY 4.0 attribution. Searches and selected coordinates are sent over HTTPS. The hosted public endpoints are for **non-commercial use**; commercial distribution needs a suitable provider plan/backend under the [provider terms](https://open-meteo.com/en/terms).

The basemap uses [OpenStreetMap](https://www.openstreetmap.org/copyright); its [tile policy](https://operations.osmfoundation.org/policies/tiles/) applies. Map requests identify the app and disclose the viewed region. There is no offline tile download or prefetch. Radar uses NOAA/NWS CONUS reflectivity under [NOAA data terms](https://www.weather.gov/disclaimer). The providers do not endorse this app.

## Forecast and astronomy conventions

- Open-Meteo forecasts use WMO condition codes. Daily precipitation percentages are daily maximum probabilities. Missing measurements remain unavailable, including zero-safe temperature, wind and UV handling.
- Hourly timestamps are UTC epoch seconds and display in the selected location's timezone, including DST. Sunrise/sunset countdowns use that timezone and continue across midnight.
- The arc shows elapsed day or night, not the measured position of the Sun or Moon. It updates on the minute and respects reduced motion.
- Sunrise colors span 35 minutes either side of sunrise; sunset colors span 45 minutes before through 30 minutes after sunset. These are artistic windows.
- SunCalc 2.0.2 supplies moon phase, illumination, altitude and solar noon. Phase names use eight conventional categories, and moon diagrams use a north-up view. No lunar rise/set times are claimed. Polar locations can lack a sunrise or sunset; no event is fabricated.
- Air quality uses the US AQI scale worldwide and is modeled, not a nearby sensor reading. UV and AQI are hourly modeled estimates.
- NOAA radar covers the contiguous US. Elsewhere, the map and forecast remain usable with a coverage message. Radar shows observed precipitation, not a future forecast; non-rain echoes are possible. Frames older than 20 minutes are labeled delayed. Metadata refreshes every five minutes while visible; playback stops when hidden, and stalled images time out.

## Build and verify

On this PC the source and all `node_modules` live on the Linux disk in WSL Ubuntu-24.04. See [the Windows/WSL map](LUCENTWEATHER-WSL-MAP.md).

Requires Node.js 22.12 or newer and Windows .NET Framework's C# compiler. A WSL build invokes the Windows compiler through the included bridge; native Windows builds are also supported on CI. Versions are pinned in `package-lock.json`.

```sh
npm ci
npm test
npm run build:release
```

The build renders the SVG icon, compiles `Geometry.cs`, creates the Windows x64 package, stages the flat portable release, and produces its ZIP. Development/build files and unused Leaflet sources/maps are excluded from the app archive. English Chromium language packs are included; runtime DLLs and notices remain intact.

Native Windows runtime verification:

```text
LucentWeather.exe --qa-output=ABSOLUTE_DIRECTORY
```

The QA runner uses a separate profile and a public London weather fixture. It verifies layout, hourly/daily/astronomy/scenes, tile placement, renderer recovery, and real HTML video fullscreen plus borderless-player restoration on displays with a taskbar. It produces JSON results and screenshots, and opens short-lived test windows. Internet is required for the weather/radar portion. Add `--qa-taskbar-only` to run offline window-overlap, maximized-window, focus-switching and foreground/background fullscreen checks on every taskbar.

A running normal instance can write a diagnostic snapshot with:

```text
LucentWeather.exe --diagnostics=ABSOLUTE_JSON_PATH
```

Tests cover representative layouts and failures; exclusive fullscreen games, every GPU driver, Windows update and shell customization still need user testing. Builds are unsigned.

## License

Original app code/artwork: MIT, [LICENSE](LICENSE). Vendored SunCalc: BSD-2-Clause, [SUNCALC-LICENSE](SUNCALC-LICENSE); astronomical algorithms are unchanged. Leaflet 1.9.4 is BSD-2-Clause, with its license in the package. Electron/Chromium notices are retained in every Windows release.
