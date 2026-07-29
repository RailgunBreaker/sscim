<#
  Scheduled-task wrapper for the SSCIM data pipeline.

  Task Scheduler runs with a bare environment and no console, so this wrapper
  pins the working directory, resolves node by absolute path, and tees output
  to a dated log. It deliberately does NOT swallow the exit code: a failed
  verification gate must surface as a failed task, not a silent no-op.

  Register it to run daily at 06:30 (adjust as you like):

    $ps = (Get-Command powershell).Source
    $script = "$PWD\scripts\run-pipeline.ps1"
    $action  = New-ScheduledTaskAction -Execute $ps `
                 -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
    $trigger = New-ScheduledTaskTrigger -Daily -At 6:30am
    # StartWhenAvailable catches up a run missed while the PC was asleep/off.
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
                  -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
                  -ExecutionTimeLimit (New-TimeSpan -Hours 1)
    Register-ScheduledTask -TaskName "SSCIM data pipeline" `
      -Action $action -Trigger $trigger -Settings $settings -Description "Fetch events, recompute indices, publish to GitHub Pages"

  Run it once by hand first — the first run proves credentials and the git
  push work, which a scheduled run cannot tell you interactively:

    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-pipeline.ps1 -DryRun
#>
param(
  [switch]$DryRun,
  [switch]$NoAi
)

$ErrorActionPreference = 'Stop'
$serverDir = Split-Path -Parent $PSScriptRoot
Set-Location $serverDir

$logDir = Join-Path $serverDir 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = Join-Path $logDir ("pipeline-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = 'C:\Program Files\nodejs\node.exe' }
if (-not (Test-Path $node)) { throw "node not found - set an absolute path in run-pipeline.ps1" }

$argList = @('scripts/pipeline.mjs')
if ($DryRun) { $argList += '--dry-run' }
if ($NoAi)   { $argList += '--no-ai' }

"=== $(Get-Date -Format o) starting: $($argList -join ' ') ===" | Tee-Object -FilePath $logFile -Append
& $node @argList 2>&1 | Tee-Object -FilePath $logFile -Append
$code = $LASTEXITCODE
"=== $(Get-Date -Format o) exit $code ===" | Tee-Object -FilePath $logFile -Append

# Prune logs older than 30 days so an unattended task doesn't grow unbounded.
Get-ChildItem $logDir -Filter 'pipeline-*.log' |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
  Remove-Item -Force -ErrorAction SilentlyContinue

exit $code
