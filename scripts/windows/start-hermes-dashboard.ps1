[CmdletBinding()]
param(
  [string]$HermesHome = (Join-Path $env:LOCALAPPDATA 'hermes'),
  [string]$AgentRoot = (Join-Path $HermesHome 'hermes-agent'),
  [string]$HostName = '127.0.0.1',
  [int]$Port = 9119,
  [string]$LogPath = (Join-Path $env:LOCALAPPDATA 'Hermes Workspace\dashboard.log')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-ServiceLog {
  param([Parameter(Mandatory = $true)][string]$Message)

  $timestamp = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffK'
  Add-Content -LiteralPath $LogPath -Value "[$timestamp] [dashboard] $Message" -Encoding UTF8
}

$logDirectory = Split-Path -Parent $LogPath
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

try {
  $pythonCandidates = @(
    (Join-Path $AgentRoot '.venv\Scripts\python.exe'),
    (Join-Path $AgentRoot 'venv\Scripts\python.exe')
  )
  $pythonPath = $pythonCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
  if (-not $pythonPath) {
    throw "Hermes Agent Python not found under $AgentRoot. Expected .venv\Scripts\python.exe."
  }
  if (-not (Test-Path -LiteralPath (Join-Path $AgentRoot 'hermes_cli\main.py') -PathType Leaf)) {
    throw "Hermes Agent checkout not found at $AgentRoot."
  }

  $env:HERMES_HOME = $HermesHome
  $env:PYTHONIOENCODING = 'utf-8'
  $existingPythonPath = [Environment]::GetEnvironmentVariable('PYTHONPATH', 'Process')
  if ([string]::IsNullOrWhiteSpace($existingPythonPath)) {
    $env:PYTHONPATH = $AgentRoot
  }
  else {
    $env:PYTHONPATH = "$AgentRoot;$existingPythonPath"
  }

  $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
  $nodeDir = if ($nodeCommand) {
    Split-Path -Parent $nodeCommand.Source
  } else {
    'C:\Users\madph\Documents\Projects\openclaw\.local\toolchain\node-v24.15.0-win-x64'
  }
  if (Test-Path -LiteralPath (Join-Path $nodeDir 'node.exe') -PathType Leaf) {
    $env:PATH = "$nodeDir;$env:PATH"
  }

  $webDist = Join-Path $AgentRoot 'hermes_cli\web_dist\index.html'
  $argumentList = @(
    '-m', 'hermes_cli.main',
    'dashboard',
    '--port', "$Port",
    '--host', $HostName,
    '--no-open'
  )
  if (Test-Path -LiteralPath $webDist -PathType Leaf) {
    $argumentList += '--skip-build'
  }

  Write-ServiceLog "starting pid=$PID python=$pythonPath agent=$AgentRoot port=$Port skip_build=$(Test-Path -LiteralPath $webDist -PathType Leaf)"
  Push-Location -LiteralPath $HermesHome
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $pythonPath @argumentList *>> $LogPath
    $nativeExitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorAction
    Pop-Location
  }
  if ($null -eq $nativeExitCode) {
    $nativeExitCode = 0
  }
  Write-ServiceLog "stopped exit_code=$nativeExitCode"
  exit $nativeExitCode
}
catch {
  Write-ServiceLog "startup_failed type=$($_.Exception.GetType().FullName) message=$($_.Exception.Message)"
  exit 1
}
