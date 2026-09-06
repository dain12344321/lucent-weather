@echo off
setlocal
set "app=%~dp0LucentWeather.exe"
if not exist "%app%" set "app=%~dp0LucentWeather-win32-x64\LucentWeather.exe"
if not exist "%app%" set "app=%~dp0LucentWeather\LucentWeather.exe"
if not exist "%app%" (
  echo LucentWeather.exe was not found.
  echo Extract the complete release folder before running this launcher.
  pause
  exit /b 1
)
pushd "%~dp0"
start "Lucent Weather" "%app%"
popd
endlocal
