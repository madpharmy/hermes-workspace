[CmdletBinding()]
param(
  [string]$StartScriptPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($StartScriptPath)) {
  $StartScriptPath = Join-Path $PSScriptRoot 'start-workspace-service.ps1'
}

$text = Get-Content -LiteralPath $StartScriptPath -Raw
if ($text -notmatch "ErrorActionPreference = 'Continue'") {
  throw 'start-workspace-service.ps1 must set ErrorActionPreference Continue around the Node process so stderr warnings do not kill Workspace.'
}
if ($text -notmatch '&\s+\$resolvedNode \$serverEntry \*>> \$LogPath') {
  throw 'start-workspace-service.ps1 must keep Node stdout/stderr in the service log.'
}

[pscustomobject]@{
  result = 'PASS'
  stderr_warnings_are_nonterminating = $true
} | ConvertTo-Json
