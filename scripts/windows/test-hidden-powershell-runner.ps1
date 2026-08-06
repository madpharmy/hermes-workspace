[CmdletBinding()]
param(
  [string]$RunnerPath = (Join-Path $PSScriptRoot 'run-hidden-powershell.vbs'),
  [string]$PowerShellPath = (Get-Command powershell.exe -ErrorAction Stop).Source
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not ([System.Management.Automation.PSTypeName]'Hermes.WindowProbe').Type) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace Hermes
{
    public static class WindowProbe
    {
        [DllImport("user32.dll")]
        public static extern bool IsWindowVisible(IntPtr windowHandle);
    }
}
'@
}

$wscriptPath = Join-Path $env:SystemRoot 'System32\wscript.exe'
foreach ($requiredPath in $RunnerPath, $PowerShellPath, $wscriptPath) {
  if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
    throw "Required quiet-launch test path not found: $requiredPath"
  }
}

$terminalProcessesBefore = @(
  Get-Process -Name WindowsTerminal -ErrorAction SilentlyContinue |
    ForEach-Object { $_.Id }
)
$encodedProbe = [Convert]::ToBase64String(
  [Text.Encoding]::Unicode.GetBytes('Start-Sleep -Seconds 2; exit 23')
)
$visibleTerminalProcesses = [System.Collections.Generic.HashSet[int]]::new()
$startInfo = [Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = $wscriptPath
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
foreach ($argument in @(
  '//B',
  '//NoLogo',
  $RunnerPath,
  $PowerShellPath,
  '-NoProfile',
  '-NonInteractive',
  '-EncodedCommand',
  $encodedProbe
)) {
  [void]$startInfo.ArgumentList.Add($argument)
}
$process = [Diagnostics.Process]::Start($startInfo)

$deadline = (Get-Date).AddSeconds(10)
do {
  foreach ($terminal in @(Get-Process -Name WindowsTerminal -ErrorAction SilentlyContinue)) {
    if ($terminal.Id -in $terminalProcessesBefore) {
      continue
    }
    $terminal.Refresh()
    if ($terminal.MainWindowHandle -ne [IntPtr]::Zero -and
        [Hermes.WindowProbe]::IsWindowVisible($terminal.MainWindowHandle)) {
      [void]$visibleTerminalProcesses.Add($terminal.Id)
    }
  }
  if ($process.HasExited) {
    break
  }
  Start-Sleep -Milliseconds 50
} while ((Get-Date) -lt $deadline)

if (-not $process.HasExited) {
  Stop-Process -Id $process.Id -Force
  throw 'The hidden PowerShell runner did not finish within 10 seconds.'
}
if ($process.ExitCode -ne 23) {
  throw "The hidden PowerShell runner returned exit code $($process.ExitCode), expected 23."
}
if ($visibleTerminalProcesses.Count -gt 0) {
  throw "The hidden PowerShell runner opened visible Windows Terminal PID(s): $($visibleTerminalProcesses -join ', ')."
}

[pscustomobject]@{
  result = 'PASS'
  child_exit_code_preserved = $true
  visible_windows_terminal_count = 0
} | ConvertTo-Json
