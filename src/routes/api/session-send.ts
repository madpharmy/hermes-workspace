/**
 * ControlSuite-compatible session-send adapter.
 *
 * Operations sends { sessionKey, message } and expects { ok: true } quickly.
 * We forward to the local /api/send-stream endpoint and keep the SSE body
 * draining in the background so the agent run is not aborted when this
 * handler returns. The Operations chat panel polls /api/history for the reply.
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'
import { readProfile } from '../../server/profiles-browser'
import { requireJsonContentType } from '../../server/rate-limit'

const OPS_SESSION_PREFIX = 'agent:main:ops-'

function opsProfileFromSession(sessionKey: string): string | null {
  if (!sessionKey.startsWith(OPS_SESSION_PREFIX)) return null
  const name = sessionKey.slice(OPS_SESSION_PREFIX.length).trim()
  return name || null
}

function profileChatTarget(profileName: string): {
  model?: string
  baseUrl?: string
} {
  try {
    const detail = readProfile(profileName)
    const model = detail.config.model
    if (typeof model === 'string' && model.trim()) {
      return { model: model.trim() }
    }
    if (model && typeof model === 'object' && !Array.isArray(model)) {
      const rec = model as Record<string, unknown>
      const id = typeof rec.default === 'string' ? rec.default.trim() : ''
      const baseUrl = typeof rec.base_url === 'string' ? rec.base_url.trim() : ''
      return {
        ...(id ? { model: id } : {}),
        ...(baseUrl ? { baseUrl } : {}),
      }
    }
  } catch {
    // Missing/invalid profile — send-stream still has the user message.
  }
  return {}
}

export const Route = createFileRoute('/api/session-send')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck
        try {
          const body = (await request.json()) as {
            sessionKey?: string
            message?: string
          }
          const sessionKey = (body.sessionKey || '').trim()
          const message = (body.message || '').trim()
          if (!sessionKey) {
            return json(
              { ok: false, error: 'sessionKey is required' },
              { status: 400 },
            )
          }
          if (!message) {
            return json(
              { ok: false, error: 'message is required' },
              { status: 400 },
            )
          }
          // Use loopback rather than `request.url` so the internal hop never
          // leaves the host. Going back through a public hostname + reverse
          // proxy can drop the session cookie (SameSite / forbidden-header
          // handling differs across Node fetch implementations), which causes
          // the downstream /api/send-stream call to 401 silently and the user
          // never sees their assistant reply.
          const internalPort = process.env.PORT || '3000'
          const url = new URL(
            '/api/send-stream',
            `http://127.0.0.1:${internalPort}`,
          )
          const cookie = request.headers.get('cookie') || ''
          const payload: Record<string, string> = { sessionKey, message }
          const profileName = opsProfileFromSession(sessionKey)
          if (profileName) {
            const target = profileChatTarget(profileName)
            if (target.model) payload.model = target.model
            if (target.baseUrl) payload.baseUrl = target.baseUrl
          }

          // Await headers so send-stream actually starts, then drain the SSE
          // body in the background. Dropping the fetch without reading used
          // to abort the agent after ~100ms with an empty "complete" reply.
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...(cookie ? { cookie } : {}),
            },
            body: JSON.stringify(payload),
          })
          if (!response.ok) {
            const errBody = await response.text().catch(() => '')
            return json(
              {
                ok: false,
                error:
                  errBody.trim() || `send-stream failed (${response.status})`,
              },
              { status: 502 },
            )
          }
          if (response.body) {
            void response.body.pipeTo(new WritableStream()).catch(() => {})
          }
          return json({ ok: true, sessionKey, queued: true })
        } catch (error) {
          return json(
            {
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to queue message',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
