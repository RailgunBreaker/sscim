<#
  Restart the SSCIM vault API.

  WHY THIS EXISTS. The API is a long-running `node src/index.js`. It loads
  server/src/bundle.js once, at startup, and holds it for the life of the
  process -- so after the schema grows (a new table, a new bundle section) the
  running instance keeps serving the OLD shape. It does not error. It answers
  200 with valid JSON that is simply missing a section.

  That is exactly how the deployed map came to draw 0 of 275 plants: the
  facilities table shipped, the API had been running since before it existed,
  and the dashboard preferred the live API over its own bundled snapshot.
  Nothing anywhere said anything was wrong.

  So: restart after any change to bundle.js, to the database schema, or to
  anything under src/ that the running process would have cached.

  USAGE

    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\restart-api.ps1

  ELEVATION. If the instance you are replacing was started from an elevated
  shell, only an elevated shell can stop it -- Windows refuses across the
  privilege boundary, with "Access is denied". Run this from an Administrator
  PowerShell in that case. Starting the API unelevated in the first place
  avoids needing this at all.
#>
param(
  [int]$Port = 8787,
  [switch]$NoVerify
)

$ErrorActionPreference = 'Stop'
$serverDir = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = 'C:\Program Files\nodejs\node.exe' }
if (-not (Test-Path $node)) { throw "node not found -- install Node or edit `$node in this script." }

$logDir = Join-Path $serverDir 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$outLog = Join-Path $logDir 'api.out.log'
$errLog = Join-Path $logDir 'api.err.log'

# ---- 1. stop whatever currently holds the port -------------------------------
$holders = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
foreach ($h in $holders) {
  # NOTE: deliberately not $pid -- that is a read-only automatic variable.
  $holderPid = $h.OwningProcess
  Write-Host "Stopping process $holderPid on port $Port..."
  try {
    Stop-Process -Id $holderPid -Force -ErrorAction Stop
  } catch {
    Write-Host ""
    Write-Host "  Access denied stopping pid $holderPid." -ForegroundColor Yellow
    Write-Host "  That instance was started from an elevated shell, so only an" -ForegroundColor Yellow
    Write-Host "  elevated shell can stop it. Re-run this script from an" -ForegroundColor Yellow
    Write-Host "  Administrator PowerShell." -ForegroundColor Yellow
    exit 1
  }
}

# Windows can hold a listening socket briefly after the owner exits; starting
# a replacement into a still-bound port fails with EADDRINUSE and leaves you
# with no API at all, which is worse than the stale one you started with.
$deadline = (Get-Date).AddSeconds(10)
while ((Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 250
}
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
  throw "Port $Port is still held after 10s -- not starting a second instance."
}

# ---- 2. start a fresh one ----------------------------------------------------
Write-Host "Starting API from $serverDir ..."
$proc = Start-Process -FilePath $node -ArgumentList 'src/index.js' `
  -WorkingDirectory $serverDir -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $outLog -RedirectStandardError $errLog
Write-Host "  pid $($proc.Id) | logs: $outLog"

if ($NoVerify) { exit 0 }

# ---- 3. prove it is actually serving the current shape -----------------------
# A restart that comes back still serving the old bundle is the failure this
# script exists to catch, so check the payload rather than just the port.
$deadline = (Get-Date).AddSeconds(25)
$bundle = $null
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 500
  try {
    $bundle = Invoke-RestMethod -Uri "http://localhost:$Port/api/bundle" -TimeoutSec 5
    break
  } catch { }
}

if (-not $bundle) {
  Write-Host "API did not answer within 25s. Check $errLog" -ForegroundColor Red
  exit 1
}

$facilities = if ($bundle.PSObject.Properties.Name -contains 'facilities') { @($bundle.facilities).Count } else { -1 }
$countries  = @($bundle.countries).Count
$events     = @($bundle.events).Count

Write-Host ""
Write-Host "API is up on port $Port" -ForegroundColor Green
Write-Host ("  facilities : {0}" -f $(if ($facilities -lt 0) { 'MISSING -- still the old bundle shape' } else { $facilities }))
Write-Host ("  countries  : {0}" -f $countries)
Write-Host ("  events     : {0}" -f $events)
Write-Host ("  snapshot   : {0}" -f $bundle.meta.snapshotDate)

if ($facilities -le 0) {
  Write-Host ""
  Write-Host "The facilities section is still absent. The process restarted but is" -ForegroundColor Yellow
  Write-Host "loading code from somewhere other than $serverDir, or the vault has no" -ForegroundColor Yellow
  Write-Host "facilities rows. Run:  node scripts/sync-facilities.mjs" -ForegroundColor Yellow
  exit 1
}
