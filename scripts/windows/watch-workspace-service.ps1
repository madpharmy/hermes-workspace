[CmdletBinding()]
param(
  [string]$TaskName = 'Hermes_Workspace',
  [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [uri]$HealthUri = 'http://127.0.0.1:3000/api/healthcheck',
  [int]$ProbeTimeoutSeconds = 3,
  [int]$ProbeDelaySeconds = 5,
  [int]$StartupGraceSeconds = 45,
  [int]$RecoveryTimeoutSeconds = 45,
  [string]$LogPath = (Join-Path $env:LOCALAPPDATA 'Hermes Workspace\watchdog.log')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Write-WatchdogLog {
  param([Parameter(Mandatory = $true)][string]$Message)

  $timestamp = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffK'
  Add-Content -LiteralPath $LogPath -Value "[$timestamp] [watchdog] $Message" -Encoding UTF8
}

function Test-WorkspaceHealth {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $HealthUri -TimeoutSec $ProbeTimeoutSeconds
    return $response.StatusCode -eq 200
  }
  catch {
    return $false
  }
}

function Stop-VerifiedOrphan {
  $connection = Get-NetTCPConnection -State Listen -LocalPort $HealthUri.Port -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if (-not $connection) {
    return
  }

  $listener = Get-CimInstance Win32_Process -Filter "ProcessId=$($connection.OwningProcess)" -ErrorAction Stop
  $canonicalEntry = Join-Path $RepositoryRoot 'server-entry.js'
  if ($listener.Name -ne 'node.exe' -or $listener.CommandLine -notlike "*$canonicalEntry*") {
    throw "Port $($HealthUri.Port) is healthy but task '$TaskName' is not running, and listener PID $($listener.ProcessId) is not the canonical Workspace server."
  }

  Write-WatchdogLog "stopping_orphan task=$TaskName pid=$($listener.ProcessId)"
  Stop-Process -Id $listener.ProcessId -Force

  $deadline = (Get-Date).AddSeconds(10)
  do {
    Start-Sleep -Milliseconds 500
    if (-not (Test-WorkspaceHealth)) {
      return
    }
  } while ((Get-Date) -lt $deadline)

  throw "Verified orphan PID $($listener.ProcessId) stopped, but port $($HealthUri.Port) remained healthy."
}

$logDirectory = Split-Path -Parent $LogPath
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

try {
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
  if ($task.State -eq 'Disabled') {
    throw "Task '$TaskName' is disabled."
  }

  $healthy = Test-WorkspaceHealth
  if (-not $healthy) {
    Start-Sleep -Seconds $ProbeDelaySeconds
    $healthy = Test-WorkspaceHealth
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
  }

  if ($healthy -and $task.State -eq 'Running') {
    exit 0
  }

  if ($healthy) {
    Write-WatchdogLog "ownership_mismatch task=$TaskName state=$($task.State)"
    Stop-VerifiedOrphan
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
  }

  $taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction Stop
  $taskAgeSeconds = ((Get-Date) - $taskInfo.LastRunTime).TotalSeconds
  if ($task.State -eq 'Running' -and $taskAgeSeconds -ge 0 -and $taskAgeSeconds -lt $StartupGraceSeconds) {
    Write-WatchdogLog "unhealthy_but_starting task=$TaskName age_seconds=$([math]::Round($taskAgeSeconds))"
    exit 0
  }

  if ($task.State -eq 'Running') {
    Write-WatchdogLog "unhealthy_stopping task=$TaskName age_seconds=$([math]::Round($taskAgeSeconds))"
    Stop-ScheduledTask -TaskName $TaskName
    $stopDeadline = (Get-Date).AddSeconds(15)
    do {
      Start-Sleep -Milliseconds 500
      $task = Get-ScheduledTask -TaskName $TaskName
    } while ($task.State -eq 'Running' -and (Get-Date) -lt $stopDeadline)
    if ($task.State -eq 'Running') {
      throw "Task '$TaskName' did not stop within 15 seconds."
    }
  }

  Write-WatchdogLog "starting task=$TaskName"
  Start-ScheduledTask -TaskName $TaskName

  $deadline = (Get-Date).AddSeconds($RecoveryTimeoutSeconds)
  do {
    Start-Sleep -Seconds 1
    if (Test-WorkspaceHealth) {
      $newInfo = Get-ScheduledTaskInfo -TaskName $TaskName
      Write-WatchdogLog "recovered task=$TaskName last_run=$($newInfo.LastRunTime.ToString('o'))"
      exit 0
    }
  } while ((Get-Date) -lt $deadline)

  throw "Workspace did not become healthy within $RecoveryTimeoutSeconds seconds."
}
catch {
  Write-WatchdogLog "recovery_failed type=$($_.Exception.GetType().FullName) message=$($_.Exception.Message)"
  exit 1
}
