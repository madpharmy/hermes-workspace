# Windows Setup Guide — Hermes Workspace

Last updated: 2026-09-16

## Architecture

Use **Hermes Workspace** as the UI. One live Hermes Agent serves the gateway
and the dashboard backend. The HermHub git checkout is plugin/voice source,
not a second running agent.

| Service | Port | Config file |
|---|---|---|
| Hermes Agent Gateway | 8642 | `C:\Users\<you>\AppData\Local\hermes\.env` |
| Hermes Agent dashboard backend | 9119 | same live Hermes home |
| Hermes CLI tools | — | `C:\Users\<you>\.hermes\.env` |
| Workspace UI | 3000 | `C:\Users\<you>\Documents\Projects\hermes-workspace\.env` |

## Required .env contents

### `AppData\Local\hermes\.env` (gateway)
```
OPENROUTER_API_KEY=<your-key>
OPENROUTER_API_KEY_1=<your-key-2>
OPENROUTER_API_KEY_2=<your-key-3>
API_SERVER_ENABLED=true
API_SERVER_HOST=0.0.0.0
API_SERVER_KEY=<generate-a-random-hex-string>
```

### `~/.hermes\.env` (CLI tools)
Same as above — same keys, same API_SERVER_KEY.

### `hermes-workspace\.env` (dashboard)
```
OPENROUTER_API_KEY=<your-key>
HERMES_API_URL=http://127.0.0.1:8642
HERMES_DASHBOARD_URL=http://127.0.0.1:9119
HERMES_API_TOKEN=<must-match-API_SERVER_KEY-above>
PORT=3000
HOST=127.0.0.1
```

**Critical:** `HERMES_API_TOKEN` must equal `API_SERVER_KEY` exactly.

## Prerequisites (Windows)

```powershell
# 1. sqlite3 CLI (for kanban/tasks)
winget install SQLite.SQLite --accept-package-agreements --accept-source-agreements
# Then copy sqlite3.exe to a Git Bash PATH dir:
# Source: C:\Users\<you>\AppData\Local\Microsoft\WinGet\Packages\SQLite.SQLite_...\sqlite3.exe
# Dest:   C:\Users\<you>\bin\sqlite3.exe

# 2. Claude CLI (for Claude Tasks / Conductor)
npm install -g @anthropic-ai/claude-code

# 3. pnpm (if not installed)
npm install -g pnpm
```

## Start sequence

```powershell
# Terminal 1 — Gateway (already owned by Hermes_Gateway)
hermes gateway run

# Terminal 2 — Dashboard backend (same live Hermes as the gateway)
hermes dashboard --port 9119 --host 127.0.0.1 --no-open --skip-build

# Terminal 3 — Workspace UI, or use the Hermes_Workspace scheduled task
cd C:\Users\<you>\Documents\Projects\hermes-workspace
pnpm dev
```

Open http://127.0.0.1:3000. Do not use http://127.0.0.1:9119 as the chat UI.

## Port conflict resolution

```powershell
# Find what's holding a port
netstat -ano | findstr :8642
netstat -ano | findstr :3000

# Kill it
Stop-Process -Id <PID> -Force
```

## PWA Install

1. Open `http://127.0.0.1:3000` in Chrome or Edge
2. Click install icon (⊕) in address bar
3. Gets own window + taskbar icon

**Note:** PWA only works while `pnpm dev` is running.

## Common errors

| Error | Fix |
|---|---|
| `API_SERVER_KEY is required` | Add `API_SERVER_KEY=<value>` to `AppData\Local\hermes\.env` |
| `spawnSync sqlite3 ENOENT` | Install sqlite3 via winget, copy exe to PATH |
| `which: no claude in` | `npm install -g @anthropic-ai/claude-code` |
| `Port 3000 already in use` | Kill stale process via `netstat -ano` + `Stop-Process` |
| `Slack invalid_auth` | Expected if Slack not configured — ignore |
| Dashboard shows "not available on this backend" | Gateway API server not running or HERMES_API_TOKEN mismatch |

## File locations reference

| What | Path |
|---|---|
| Gateway env | `C:\Users\<you>\AppData\Local\hermes\.env` |
| CLI env | `C:\Users\<you>\.hermes\.env` |
| Workspace env | `C:\Users\<you>\hermes-workspace\.env` |
| Kanban DB | `C:\Users\<you>\AppData\Local\hermes\kanban.db` |
| Gateway code | `C:\Users\<you>\AppData\Local\hermes\hermes-agent\` |
| Workspace code | `C:\Users\<you>\hermes-workspace\` |
| Custom skills | `C:\Users\<you>\AppData\Local\hermes\skills\` |
| Hermes config | `C:\Users\<you>\.hermes\config.yaml` |
