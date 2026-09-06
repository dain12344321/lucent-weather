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
