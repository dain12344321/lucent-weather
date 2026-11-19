# Lucent Weather development handoff

## 2026-11-18 · Codex · Release v1.1.0

- Promoted the approved forecast and taskbar design to v1.1.0 and updated the Windows distribution notes.
- Verified all 40 automated tests, a fresh Windows x64 package, and native QA including live forecasts, NOAA radar, recovery, and fullscreen behavior on two displays.
- The v1.1.0 tag builds and publishes the Windows ZIP through the GitHub release workflow. The Windows workspace keeps the deployment receipt and v1.0.1 rollback materials.

## 2026-11-18 · Codex · Approved forecast design

- Integrated the approved forecast typography, spacing, weather panels, selected-hour readings, and seven-day rows. The taskbar and forecast share the approved weather glyphs, including the rain-mark correction. Sunrise, sunset, overnight progress, lunar phases, and unavailable or continuous daylight states use the same visual system.
- Verified all 40 automated tests and the Windows x64 package. Ran the packaged app with isolated settings and verified live forecast, NOAA radar, hour selection, close and reopen, renderer and helper recovery, and simulated fullscreen behavior on two displays.
- Compared six packaged captures at matched sizes with the design references. Verified the layout with 320 px and 360 px viewports, a 430 px short window, and a wider viewport.
- The recovery point is `abc478f970be8e5b0e470301fd0fd515b8068525`. The Windows candidate is ready for release review on this branch.
