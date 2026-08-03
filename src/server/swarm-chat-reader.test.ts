import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readWorkerMessages } from './swarm-chat-reader'

describe('readWorkerMessages', () => {
  it('treats a missing state.db as an unavailable session, not a UI error', () => {
    const profilePath = mkdtempSync(join(tmpdir(), 'swarm-chat-reader-'))

    try {
      const result = readWorkerMessages(profilePath, 30)

      expect(result).toEqual({
        sessionId: null,
        sessionTitle: null,
        messages: [],
        ok: false,
      })
      expect(result.error).toBeUndefined()
    } finally {
      rmSync(profilePath, { recursive: true, force: true })
    }
  })

  it('normalizes object-wrapped list content instead of crashing the chat poller', () => {
    const profilePath = mkdtempSync(join(tmpdir(), 'swarm-chat-reader-'))
    const dbPath = join(profilePath, 'state.db')

    try {
      execFileSync('python3', [
        '-c',
        [
          'import json, sqlite3, sys',
          'conn = sqlite3.connect(sys.argv[1])',
          'conn.execute("CREATE TABLE sessions (id TEXT, title TEXT, started_at INTEGER)")',
          'conn.execute("CREATE TABLE messages (id TEXT, session_id TEXT, role TEXT, content TEXT, created_at INTEGER)")',
          'conn.execute("INSERT INTO sessions VALUES (?, ?, ?)", ("session-1", "Fabrication", 1))',
          'content = json.dumps({"content": [{"type": "text", "text": "Checkpoint ready"}]})',
          'conn.execute("INSERT INTO messages VALUES (?, ?, ?, ?, ?)", ("message-1", "session-1", "assistant", content, 2))',
          'conn.commit()',
          'conn.close()',
        ].join('; '),
        dbPath,
      ])

      const result = readWorkerMessages(profilePath, 30)

      expect(result.ok).toBe(true)
      expect(result.messages).toEqual([
        expect.objectContaining({ content: 'Checkpoint ready' }),
      ])
    } finally {
      rmSync(profilePath, { recursive: true, force: true })
    }
  })
})
