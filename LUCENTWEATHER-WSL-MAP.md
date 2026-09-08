# Lucent Weather WSL and Windows map

The source tree and build dependencies stay on the Linux filesystem. Windows
receives only the generated portable runtime and the small Windows-side
wrappers.

```text
/home/dain0/projects/lucent-weather/       WSL source checkout
├── package.json / package-lock.json      pinned Node metadata
├── node_modules/                         WSL-only npm dependencies
├── build-icon.cjs                        WSL/Node icon build
├── build-helper.cjs + build-helper.ps1   Windows C# compiler bridge
├── scripts/package.cjs                   Electron portable package step
├── scripts/stage-release.cjs             flat release folder and ZIP
└── dist/
    ├── LucentWeather-win32-x64/          flat portable root
    │   ├── LucentWeather.exe
    │   ├── resources/app.asar
    │   ├── resources/Geometry.exe
    │   └── locales/{en-US,en-GB}.pak
    └── release/
        └── LucentWeather-v0.9.3-Windows-x64/  ZIP staging root

C:\Programs\Lucent Weather\               optional Windows install target
├── LucentWeather.exe
├── resources\
└── locales\
```

From WSL, `npm run build:helper` converts the script path with `wslpath -w`
and invokes Windows PowerShell so `csc.exe` writes `Geometry.exe` back into
the Linux checkout. `npm run build:release` then runs the icon build, helper
build, Electron Packager, locale pruning, and ZIP staging in that order.

The portable app has no dependency on the WSL checkout after extraction.
Runtime settings remain in `%APPDATA%\clear-weather`; moving the Windows
payload does not move or erase them. The optional installer stages a validated
copy and preserves an existing target in a timestamped `.previous-*` folder.
