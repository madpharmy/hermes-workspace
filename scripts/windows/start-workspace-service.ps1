[CmdletBinding()]
param(
  [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$NodePath = 'node.exe',
  [string]$LogPath = (Join-Path $env:LOCALAPPDATA 'Hermes Workspace\workspace.log')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-ServiceLog {
  param([Parameter(Mandatory = $true)][string]$Message)

  $timestamp = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffK'
  Add-Content -LiteralPath $LogPath -Value "[$timestamp] [service] $Message" -Encoding UTF8
}

function Import-DotEnv {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Workspace environment file not found: $Path"
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -notmatch '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
      continue
    }

    $name = $matches[1]
    $value = $matches[2].Trim()
    if ($value.Length -ge 2) {
      $first = $value[0]
      $last = $value[$value.Length - 1]
      if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
        $value = $value.Substring(1, $value.Length - 2)
      }
    }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

$logDirectory = Split-Path -Parent $LogPath
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

try {
  if (-not (Test-Path -LiteralPath $RepositoryRoot -PathType Container)) {
    throw "Workspace repository not found: $RepositoryRoot"
  }

  $serverEntry = Join-Path $RepositoryRoot 'server-entry.js'
  $serverBuild = Join-Path $RepositoryRoot 'dist\server\server.js'
  foreach ($requiredPath in $serverEntry, $serverBuild) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
      throw "Required production artifact not found: $requiredPath. Run pnpm build before starting the service."
    }
  }
  $clientBuild = Join-Path $RepositoryRoot 'dist\client'
  if (-not (Test-Path -LiteralPath $clientBuild -PathType Container)) {
    throw "Required production artifact directory not found: $clientBuild. Run pnpm build before starting the service."
  }

  $resolvedNode = (Get-Command -Name $NodePath -ErrorAction Stop).Source
  Import-DotEnv -Path (Join-Path $RepositoryRoot '.env')
  [Environment]::SetEnvironmentVariable('NODE_ENV', 'production', 'Process')
  if ([string]::IsNullOrWhiteSpace($env:PORT)) {
    [Environment]::SetEnvironmentVariable('PORT', '3000', 'Process')
  }
  if ([string]::IsNullOrWhiteSpace($env:HOST)) {
    [Environment]::SetEnvironmentVariable('HOST', '127.0.0.1', 'Process')
  }

  Write-ServiceLog "starting pid=$PID repository=$RepositoryRoot node=$resolvedNode"
  Push-Location -LiteralPath $RepositoryRoot
  try {
    & $resolvedNode $serverEntry *>> $LogPath
    $nativeExitCode = $LASTEXITCODE
  }
  finally {
    Pop-Location
  }
  Write-ServiceLog "stopped exit_code=$nativeExitCode"
  exit $nativeExitCode
}
catch {
  Write-ServiceLog "startup_failed type=$($_.Exception.GetType().FullName) message=$($_.Exception.Message)"
  exit 1
}
