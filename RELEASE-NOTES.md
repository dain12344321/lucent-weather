# Lucent Weather v0.9.1

- Fix taskbar tile hide/show feedback by using the same native obstruction check while visible and hidden.
- Ignore click-through overlays and invisible resize borders when checking taskbar coverage.
- Require consecutive exposed samples on both monitors to suppress transient flashes, while retaining fullscreen hiding and recovery.
- Remove misleading repeated taskbar recovery log entries.
- Fix a sunrise/night-card spacing overflow that clipped the bottom navigation.
- Preserve existing location, units, placement and startup settings.

Validation: 36 automated tests pass. Native Windows QA passes live weather/radar, layout, lunar/scenes/hourly checks, placement, five open/close cycles, renderer/helper recovery, and HTML video plus borderless fullscreen hide/return on both monitors. Click-through overlay stability: 24 samples per monitor, zero tile hides. Installed executable, app.asar and native helper hashes match the release payload. Settings are unchanged.

Download **LucentWeather-v0.9.1-Windows-x64.zip** and extract the complete runtime.

---

# Lucent Weather v0.9.0

ClearWeather is now **Lucent Weather**. Existing location, unit and taskbar preferences are preserved.

- Extract the Windows x64 release ZIP and run `LucentWeather.exe` directly. Optional installer/shortcuts are included.
- Refined split sun/cloud icon, embedded in the executable at nine Windows sizes.
- Fullscreen visibility now checks beneath the tile, recovers from helper failures and avoids repeated window positioning. Earlier native runs passed HTML video and borderless-player checks on both monitors; the final retest was inconclusive with another window foreground.
- Weather, hourly and air-quality requests run concurrently; optional feed failures do not discard a valid forecast.
- Missing measurements stay unavailable; zero values remain valid. Search races, location-change retries and radar metadata timeouts are handled.
- Reduced-motion navigation, accessible controls and preserved hourly selections.
- Removed unused Chromium locales, build files and Leaflet sources/maps from the Windows runtime.

Validation: 35 automated tests pass; npm audit reports no known vulnerabilities. Native Windows checks pass for live weather/radar, layout, scenes, moon phases, hourly selection and placement. Earlier runs also passed renderer/helper recovery and fullscreen restoration on both monitors; the final fullscreen retest failed while another application was foreground, so final-build fullscreen behavior remains incompletely verified.

Download **LucentWeather-v0.9.0-Windows-x64.zip**, not GitHub's source-code ZIP. The app is unsigned; other GPUs, exclusive fullscreen games and shell customizations have not all been tested.
