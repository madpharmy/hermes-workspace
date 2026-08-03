import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type SwarmChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number | null
}

export type SwarmChatReadResult = {
  sessionId: string | null
  sessionTitle: string | null
  messages: Array<SwarmChatMessage>
  ok: boolean
  error?: string
}

const PYTHON_SCRIPT = `import json, sqlite3, sys

db_path = sys.argv[1]
limit = int(sys.argv[2])

conn = sqlite3.connect("file:" + db_path + "?mode=ro", uri=True)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

table_names = {row[0] for row in cur.execute(
    "SELECT name FROM sqlite_master WHERE type='table'"
).fetchall()}

session_id = None
session_title = None
messages = []

def render_content(value):
    if value is None:
        return ""
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.startswith("[") or stripped.startswith("{"):
            try:
                return render_content(json.loads(value))
            except Exception:
                return value
        return value
    if isinstance(value, list):
        parts = []
        for block in value:
            if not isinstance(block, dict):
                parts.append(str(block))
                continue
            btype = block.get("type")
            if btype in (None, "text"):
                parts.append(render_content(block.get("text", block.get("content", ""))))
            elif btype == "tool_use":
                parts.append("[tool:" + str(block.get("name", "?")) + "]")
            elif btype == "tool_result":
                parts.append(render_content(block.get("content", ""))[:400])
        return "\\n".join(part for part in parts if part)
    if isinstance(value, dict):
        if value.get("type") == "tool_use":
            return "[tool:" + str(value.get("name", "?")) + "]"
        nested = value.get("text")
        if nested is None:
            nested = value.get("content")
        return render_content(nested) if nested is not None else str(value)
    return str(value)

if "sessions" in table_names:
    session_cols = {row[1] for row in cur.execute("PRAGMA table_info(sessions)").fetchall()}
    title_col = "title" if "title" in session_cols else None
    started_col = (
        "started_at" if "started_at" in session_cols
        else ("created_at" if "created_at" in session_cols else None)
    )
    order_clause = "ORDER BY " + started_col + " DESC" if started_col else ""
    select_cols = ["id"]
    if title_col:
        select_cols.append(title_col)
    if started_col:
        select_cols.append(started_col)
    row = cur.execute(
        "SELECT " + ", ".join(select_cols) + " FROM sessions " + order_clause + " LIMIT 1"
    ).fetchone()
    if row is not None:
        session_id = row["id"]
        if title_col:
            session_title = row[title_col]

if session_id and "messages" in table_names:
    msg_cols = {row[1] for row in cur.execute("PRAGMA table_info(messages)").fetchall()}
    role_col = "role" if "role" in msg_cols else None
    content_col = (
        "content" if "content" in msg_cols
        else ("text" if "text" in msg_cols else None)
    )
    ts_col = (
        "created_at" if "created_at" in msg_cols
        else ("timestamp" if "timestamp" in msg_cols
              else ("started_at" if "started_at" in msg_cols else None))
    )
    if role_col and content_col:
        order_by = ts_col if ts_col else "id"
        ts_select = ", " + ts_col + " as ts" if ts_col else ""
        rows = cur.execute(
            "SELECT id, " + role_col + " as role, " + content_col + " as content"
            + ts_select
            + " FROM messages WHERE session_id = ? ORDER BY " + order_by + " DESC LIMIT ?",
            (session_id, limit),
        ).fetchall()
        for r in reversed(rows):
            content = r["content"]
            text = render_content(content)
            ts = None
            if ts_col:
                raw_ts = r["ts"]
                if isinstance(raw_ts, (int, float)):
                    ts = int(raw_ts)
                elif isinstance(raw_ts, str):
                    try:
                        ts = int(raw_ts)
                    except ValueError:
                        ts = None
            messages.append({
                "id": str(r["id"]),
                "role": r["role"] or "assistant",
                "content": text.strip(),
                "timestamp": ts,
            })

conn.close()
print(json.dumps({
    "sessionId": session_id,
    "sessionTitle": session_title,
    "messages": messages,
}))
`

export function readWorkerMessages(profilePath: string, limit: number): SwarmChatReadResult {
  const dbPath = join(profilePath, 'state.db')
  if (!existsSync(dbPath)) {
    return {
      sessionId: null,
      sessionTitle: null,
      messages: [],
      ok: false,
    }
  }
  try {
    const raw = execFileSync(
      'python3',
      ['-c', PYTHON_SCRIPT, dbPath, String(limit)],
      { encoding: 'utf-8', timeout: 5_000 },
    )
    const parsed = JSON.parse(raw) as {
      sessionId: string | null
      sessionTitle: string | null
      messages: Array<SwarmChatMessage>
    }
    return { ...parsed, ok: true }
  } catch (err) {
    return {
      sessionId: null,
      sessionTitle: null,
      messages: [],
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
