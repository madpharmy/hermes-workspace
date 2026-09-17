# Hermes Workspace Windows service tasks

Hermes Workspace uses two repository-owned Scheduled Tasks on Windows:

- `Hermes_Workspace` owns the production Node process on `127.0.0.1:3000`.
- `Hermes_Workspace_Watchdog` checks `/api/healthcheck` every minute. After two
  failed probes it starts the Workspace task, or restarts it if it is running
  but unhealthy. It also repairs an orphaned canonical Node process when Task
  Scheduler has stopped the launcher but left `server-entry.js` alive.

The existing `Hermes_Gateway` task remains the owner of port `8642`.
`HermHub-Dashboard` owns port `9119` as the Hermes Agent dashboard **backend**
for Workspace. It must use the same live Hermes install as the gateway
(`%LOCALAPPDATA%\hermes\hermes-agent`), not the older HermHub 0.18 checkout.
The obsolete duplicate `Hermes_Dashboard` task is disabled only when that
dashboard health check passes.

Do not treat HermHub's `/hermhub` page as the chat UI. Open Workspace on
`http://127.0.0.1:3000`.

## Install or repair

Build the production server and register the tasks from PowerShell:

```powershell
pnpm build
.\scripts\windows\install-workspace-service.ps1
```

The installer backs up replaced task definitions under
`%LOCALAPPDATA%\Hermes Workspace\task-backups\<timestamp>`. It does not print
or copy `.env` values. The launcher loads the repository `.env` directly into
the child process and writes lifecycle output to
`%LOCALAPPDATA%\Hermes Workspace\workspace.log`.

Both tasks retain the signed-in user's interactive security context for local
and network access, but their PowerShell processes are launched through the
repository's `run-hidden-powershell.vbs` helper. This prevents the Windows 11
default-terminal delegation path from opening a visible Windows Terminal
window during startup or the watchdog's one-minute health probe.

For exact interruption evidence, enable the Task Scheduler Operational channel
once from an elevated PowerShell window:

```powershell
wevtutil sl Microsoft-Windows-TaskScheduler/Operational /e:true
```

## Verify

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/api/healthcheck
Get-ScheduledTask Hermes_Workspace,Hermes_Workspace_Watchdog,Hermes_Gateway,HermHub-Dashboard
.\scripts\windows\test-hidden-powershell-runner.ps1
```

To exercise the recovery path, stop only the canonical Workspace task and run
the watchdog once:

```powershell
Stop-ScheduledTask Hermes_Workspace
Start-ScheduledTask Hermes_Workspace_Watchdog
```

Do not launch a separate `pnpm dev` process as an uptime recovery mechanism.
Development mode remains appropriate for active UI work, but it is not the
canonical background owner. Disable `Hermes_Workspace_Watchdog` explicitly
before intentionally replacing the production owner during development.
