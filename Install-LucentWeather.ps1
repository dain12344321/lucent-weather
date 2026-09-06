param(
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'Programs\LucentWeather'),
  [switch]$AutoStart,
  [switch]$NoAutoStart,
  [switch]$DesktopShortcut,
  [switch]$NoDesktopShortcut,
  [switch]$NoPrompt,
  [switch]$NoShortcuts
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Test-LucentWeatherPayload {
  param([string]$Path)

  $required = @(
    (Join-Path $Path 'LucentWeather.exe'),
    (Join-Path $Path 'resources\app.asar'),
    (Join-Path $Path 'resources\Geometry.exe'),
    (Join-Path $Path 'locales')
  )
  if (-not (Test-Path -LiteralPath $required[0] -PathType Leaf)) { return $false }
  if (-not (Test-Path -LiteralPath $required[1] -PathType Leaf)) { return $false }
  if (-not (Test-Path -LiteralPath $required[2] -PathType Leaf)) { return $false }
  if (-not (Test-Path -LiteralPath $required[3] -PathType Container)) { return $false }
  return ((Get-Item -LiteralPath $required[0]).Length -gt 100MB)
}

function Get-FullPath {
  param([string]$Path)
  return [IO.Path]::GetFullPath($Path).TrimEnd('\')
}

function Ask-YesNo {
  param([string]$Message)
  $answer = Read-Host "$Message [y/N]"
  return $answer -match '^(y|yes)$'
}

if ($AutoStart -and $NoAutoStart) {
  throw 'Choose either -AutoStart or -NoAutoStart, not both.'
}
if ($DesktopShortcut -and $NoDesktopShortcut) {
  throw 'Choose either -DesktopShortcut or -NoDesktopShortcut, not both.'
}

# A release ZIP has a flat portable root. The two nested candidates keep this
# installer compatible with older release bundles during the transition.
$candidates = @(
  $PSScriptRoot,
  (Join-Path $PSScriptRoot 'LucentWeather-win32-x64'),
  (Join-Path $PSScriptRoot 'LucentWeather'),
  (Join-Path $PSScriptRoot 'release\LucentWeather-win32-x64')
)
$payload = $null
foreach ($candidate in $candidates | Select-Object -Unique) {
  if ((Test-Path -LiteralPath $candidate -PathType Container) -and (Test-LucentWeatherPayload -Path $candidate)) {
    $payload = (Get-Item -LiteralPath $candidate).FullName
    break
  }
}
if (-not $payload) {
  throw 'Lucent Weather payload not found. Extract the complete release folder, including LucentWeather.exe, resources\app.asar, the locales folder, and resources\Geometry.exe.'
}

$payloadFull = Get-FullPath $payload
$installFull = Get-FullPath $InstallRoot
if ($payloadFull -eq $installFull -or
    $payloadFull.StartsWith("$installFull\", [StringComparison]::OrdinalIgnoreCase) -or
    $installFull.StartsWith("$payloadFull\", [StringComparison]::OrdinalIgnoreCase)) {
  throw 'InstallRoot must be a separate folder from the source payload.'
}

# Never rename an unrelated directory supplied as an install target.
if (-not [IO.Path]::IsPathRooted($installFull) -or $installFull.Length -lt 4) {
  throw 'Choose a dedicated app folder, not a drive root.'
}
if (Test-Path -LiteralPath $installFull) {
  $existing = Get-Item -LiteralPath $installFull -Force
  if (($existing.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
      -not (Test-LucentWeatherPayload -Path $installFull)) {
    throw 'The destination exists and is not a Lucent Weather installation. Choose a new empty app folder.'
  }
}

$iconSource = $null
foreach ($candidate in @(
  (Join-Path $PSScriptRoot 'lucent-weather-preview.ico'),
  (Join-Path $payload 'lucent-weather-preview.ico'),
  (Join-Path $payload 'LucentWeather.ico')
)) {
  if (Test-Path -LiteralPath $candidate -PathType Leaf) {
    $iconSource = (Get-Item -LiteralPath $candidate).FullName
    break
  }
}

$wantAutoStart = $AutoStart.IsPresent
$wantDesktop = $DesktopShortcut.IsPresent
if (-not $NoPrompt) {
  if (-not $AutoStart -and -not $NoAutoStart) {
    $wantAutoStart = Ask-YesNo 'Start Lucent Weather automatically when you sign in?'
  }
  if (-not $DesktopShortcut -and -not $NoDesktopShortcut) {
    $wantDesktop = Ask-YesNo 'Create a desktop shortcut?'
  }
}

$installParent = Split-Path -Parent $installFull
$installLeaf = Split-Path -Leaf $installFull
$stamp = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $PID
$staging = Join-Path $installParent ('.' + $installLeaf + '.staging-' + $PID)
$backup = Join-Path $installParent ('.' + $installLeaf + '.previous-' + $stamp)
foreach ($target in @($staging, $backup)) {
  $resolvedTarget = [IO.Path]::GetFullPath($target)
  if ([IO.Path]::GetDirectoryName($resolvedTarget) -ne $installParent) {
    throw 'The staging or backup path escaped the installation parent.'
  }
}
$backupCreated = $false
$installCommitted = $false

Write-Host "Source:      $payload"
Write-Host "Install to:  $installFull"
try {
  if (Test-Path -LiteralPath $staging) {
    throw "Temporary staging folder already exists: $staging"
  }
  New-Item -ItemType Directory -Path $staging -Force | Out-Null

  # Copy only the portable runtime. Release wrappers and docs stay beside the
  # extracted ZIP and are not mixed into the installed program folder.
  $skip = @('Install-LucentWeather.cmd', 'Install-LucentWeather.ps1', 'Run-LucentWeather.cmd', 'LUCENTWEATHER-DISTRIBUTION.md', 'lucent-weather-preview.ico')
  Get-ChildItem -LiteralPath $payload -Force | Where-Object { $skip -notcontains $_.Name } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $staging $_.Name) -Recurse -Force
  }
  if ($iconSource) {
    Copy-Item -LiteralPath $iconSource -Destination (Join-Path $staging 'lucent-weather-preview.ico') -Force
  }
  if (-not (Test-LucentWeatherPayload -Path $staging)) {
    throw 'The staged payload failed validation.'
  }

  if (Test-Path -LiteralPath $installFull) {
    Move-Item -LiteralPath $installFull -Destination $backup
    $backupCreated = $true
  }
  Move-Item -LiteralPath $staging -Destination $installFull
  $installCommitted = $true
  if (-not (Test-LucentWeatherPayload -Path $installFull)) {
    throw 'The installed payload failed validation after the atomic move.'
  }
}
catch {
  # Keep a failed new tree recoverable while restoring the previous one.
  if (Test-Path -LiteralPath $staging) {
    Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
  }
  if ($installCommitted -and (Test-Path -LiteralPath $installFull)) {
    $failed = $installFull + '.failed-' + $stamp
    Move-Item -LiteralPath $installFull -Destination $failed -ErrorAction SilentlyContinue
  }
  if ($backupCreated -and (Test-Path -LiteralPath $backup) -and -not (Test-Path -LiteralPath $installFull)) {
    Move-Item -LiteralPath $backup -Destination $installFull -ErrorAction SilentlyContinue
  }
  throw
}

$installedExe = Join-Path $installFull 'LucentWeather.exe'
$programs = [Environment]::GetFolderPath('Programs')
$desktop = [Environment]::GetFolderPath('Desktop')
$startup = [Environment]::GetFolderPath('Startup')
$startMenuDir = Join-Path $programs 'Lucent Weather'
$installedIcon = Join-Path $installFull 'lucent-weather-preview.ico'
$iconPath = if (Test-Path -LiteralPath $installedIcon -PathType Leaf) { $installedIcon } else { $installedExe }

if (-not $NoShortcuts) {
  New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null
  $shell = New-Object -ComObject WScript.Shell
  function New-LucentWeatherShortcut {
    param([string]$Path)
    $shortcut = $shell.CreateShortcut($Path)
    $shortcut.TargetPath = $installedExe
    $shortcut.WorkingDirectory = $installFull
    $shortcut.IconLocation = "$iconPath,0"
    $shortcut.Description = 'Open Lucent Weather weather and daylight companion'
    $shortcut.Save()
  }

  New-LucentWeatherShortcut -Path (Join-Path $startMenuDir 'Lucent Weather.lnk')
  if ($wantDesktop) {
    New-LucentWeatherShortcut -Path (Join-Path $desktop 'Lucent Weather.lnk')
  }
  if ($wantAutoStart) {
    New-Item -ItemType Directory -Path $startup -Force | Out-Null
    New-LucentWeatherShortcut -Path (Join-Path $startup 'Lucent Weather.lnk')
  }
}

Write-Host ''
Write-Host 'Lucent Weather installed.' -ForegroundColor Green
Write-Host "Run:       $installedExe"
if ($backupCreated) { Write-Host "Rollback:  $backup" }
if (-not $NoShortcuts) {
  Write-Host "Start Menu: $startMenuDir\Lucent Weather.lnk"
  if ($wantDesktop) { Write-Host "Desktop:    $desktop\Lucent Weather.lnk" }
  if ($wantAutoStart) { Write-Host "Auto-start: $startup\Lucent Weather.lnk" }
}
Write-Host 'No elevation requested. Your saved weather settings were preserved.'
