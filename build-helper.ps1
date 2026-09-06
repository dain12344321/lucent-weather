$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'The Windows .NET Framework C# compiler is required.' }
& $compiler /nologo /target:winexe ("/out:" + (Join-Path $PSScriptRoot 'Geometry.exe')) (Join-Path $PSScriptRoot 'Geometry.cs')
if ($LASTEXITCODE -ne 0) { throw 'Native helper build failed.' }
