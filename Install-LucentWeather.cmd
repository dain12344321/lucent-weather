@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-LucentWeather.ps1" %*
set "exitCode=%ERRORLEVEL%"
if not "%exitCode%"=="0" (
  echo.
  echo Lucent Weather installation failed with exit code %exitCode%.
  pause
)
endlocal & exit /b %exitCode%
