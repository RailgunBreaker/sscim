param([switch]$Remove)
$ErrorActionPreference = 'Stop'
$sscimRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$sscimTaskName = 'SSCIM evidence operations sscim-1'
if ($Remove) {
  Unregister-ScheduledTask -TaskName $sscimTaskName -Confirm:$false
  return
}
$sscimNode = (Get-Command node -ErrorAction Stop).Source
$sscimScript = Join-Path $sscimRoot 'server/scripts/run-operations.mjs'
$sscimExisting = Get-ScheduledTask -TaskName $sscimTaskName -ErrorAction SilentlyContinue
if ($sscimExisting -and $sscimExisting.Actions.Arguments -ne ('"' + $sscimScript + '"')) {
  throw 'Task name is occupied by a different command; no task changed.'
}
$sscimAction = New-ScheduledTaskAction -Execute $sscimNode -Argument ('"' + $sscimScript + '"') -WorkingDirectory $sscimRoot
$sscimTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddHours(1) -RepetitionInterval (New-TimeSpan -Hours 1)
$sscimSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 40) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$sscimPrincipal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $sscimTaskName -Action $sscimAction -Trigger $sscimTrigger -Settings $sscimSettings -Principal $sscimPrincipal -Description 'Collect public evidence, preserve prospective forecasts, score available outcomes and refresh the local structured catalog. No publish or automatic event approval.' -Force | Select-Object TaskName,State
