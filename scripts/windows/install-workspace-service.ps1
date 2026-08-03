[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$WorkspaceTaskName = 'Hermes_Workspace',
  [string]$WatchdogTaskName = 'Hermes_Workspace_Watchdog',
  [string]$DuplicateDashboardTaskName = 'Hermes_Dashboard',
  [switch]$SkipStart
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$startScript = Join-Path $PSScriptRoot 'start-workspace-service.ps1'
$watchdogScript = Join-Path $PSScriptRoot 'watch-workspace-service.ps1'
$powershellPath = (Get-Command powershell.exe -ErrorAction Stop).Source
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$stateRoot = Join-Path $env:LOCALAPPDATA 'Hermes Workspace'
$backupRoot = Join-Path $stateRoot ('task-backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))

function Backup-ScheduledTaskDefinition {
  param([Parameter(Mandatory = $true)][string]$TaskName)

  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if (-not $task) {
    return
  }

  New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
  $xml = Export-ScheduledTask -TaskName $TaskName
  $backupPath = Join-Path $backupRoot ($TaskName + '.xml')
  Set-Content -LiteralPath $backupPath -Value $xml -Encoding Unicode
  Write-Host "Backed up $TaskName to $backupPath"
}

foreach ($requiredPath in $startScript, $watchdogScript) {
  if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
    throw "Required service script not found: $requiredPath"
  }
}

New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
if (-not $WhatIfPreference) {
  Backup-ScheduledTaskDefinition -TaskName $WorkspaceTaskName
  Backup-ScheduledTaskDefinition -TaskName $WatchdogTaskName
  Backup-ScheduledTaskDefinition -TaskName $DuplicateDashboardTaskName
}

$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$workspaceActionArguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -RepositoryRoot "{1}" -NodePath "{2}"' -f $startScript, $repositoryRoot, $nodePath
$workspaceAction = New-ScheduledTaskAction -Execute $powershellPath -Argument $workspaceActionArguments
$workspaceTrigger = New-ScheduledTaskTrigger -AtLogOn -User $identity
$workspaceSettings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -DontStopOnIdleEnd `
  -ExecutionTimeLimit ([timespan]::Zero) `
  -MultipleInstances IgnoreNew `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -StartWhenAvailable

if ($PSCmdlet.ShouldProcess($WorkspaceTaskName, 'Register canonical Workspace production task')) {
  Register-ScheduledTask `
    -TaskName $WorkspaceTaskName `
    -Action $workspaceAction `
    -Trigger $workspaceTrigger `
    -Settings $workspaceSettings `
    -Principal $principal `
    -Description 'Hermes Workspace production server on http://127.0.0.1:3000. Managed by the repository-owned watchdog.' `
    -Force | Out-Null
}

$watchdogActionArguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -TaskName "{1}" -RepositoryRoot "{2}"' -f $watchdogScript, $WorkspaceTaskName, $repositoryRoot
$watchdogAction = New-ScheduledTaskAction -Execute $powershellPath -Argument $watchdogActionArguments
$watchdogLogonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $identity
$watchdogRepeatingTrigger = New-ScheduledTaskTrigger `
  -Once `
  -At ((Get-Date).AddMinutes(1)) `
  -RepetitionInterval (New-TimeSpan -Minutes 1) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$watchdogSettings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -DontStopOnIdleEnd `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
  -MultipleInstances IgnoreNew `
  -StartWhenAvailable

if ($PSCmdlet.ShouldProcess($WatchdogTaskName, 'Register Workspace health watchdog')) {
  Register-ScheduledTask `
    -TaskName $WatchdogTaskName `
    -Action $watchdogAction `
    -Trigger @($watchdogLogonTrigger, $watchdogRepeatingTrigger) `
    -Settings $watchdogSettings `
    -Principal $principal `
    -Description 'Checks Hermes Workspace every minute and restarts its canonical task after two failed health probes.' `
    -Force | Out-Null
}

$duplicateDashboardTask = Get-ScheduledTask -TaskName $DuplicateDashboardTaskName -ErrorAction SilentlyContinue
if ($duplicateDashboardTask) {
  $dashboardHealthy = $false
  try {
    $dashboardResponse = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:9119/api/status' -TimeoutSec 5
    $dashboardHealthy = $dashboardResponse.StatusCode -eq 200
  }
  catch {
    $dashboardHealthy = $false
  }

  if ($dashboardHealthy) {
    if ($PSCmdlet.ShouldProcess($DuplicateDashboardTaskName, 'Disable duplicate Dashboard task; HermHub-Dashboard remains canonical')) {
      Disable-ScheduledTask -TaskName $DuplicateDashboardTaskName | Out-Null
    }
  }
  else {
    Write-Warning "Dashboard health check failed; leaving duplicate task '$DuplicateDashboardTaskName' unchanged."
  }
}

if (-not $SkipStart -and $PSCmdlet.ShouldProcess($WorkspaceTaskName, 'Start canonical Workspace task')) {
  Start-ScheduledTask -TaskName $WorkspaceTaskName
}

Write-Host "Workspace task: $WorkspaceTaskName"
Write-Host "Watchdog task: $WatchdogTaskName"
Write-Host "Repository: $repositoryRoot"
Write-Host "Node: $nodePath"
if (Test-Path -LiteralPath $backupRoot) {
  Write-Host "Task backups: $backupRoot"
}
