import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import { resolveClaudeAgentDir } from './claude-agent'

const tempDirs: string[] = []

function createAgentDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  mkdirSync(join(dir, 'webapi'))
  tempDirs.push(dir)
  return dir
}

function createGatewayAgentDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  mkdirSync(join(dir, 'gateway'), { recursive: true })
  writeFileSync(join(dir, 'gateway', 'run.py'), '')
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('resolveClaudeAgentDir', () => {
  it('prefers HERMES_AGENT_PATH when it points to a valid hermes-agent checkout', () => {
    const hermesAgentDir = createAgentDir('hermes-agent-')
    const legacyAgentDir = createAgentDir('claude-agent-')

    expect(
      resolveClaudeAgentDir({
        HERMES_AGENT_PATH: hermesAgentDir,
        CLAUDE_AGENT_PATH: legacyAgentDir,
      }),
    ).toBe(hermesAgentDir)
  })

  it('falls back to legacy CLAUDE_AGENT_PATH for backward compatibility', () => {
    const legacyAgentDir = createAgentDir('claude-agent-')

    expect(
      resolveClaudeAgentDir({
        CLAUDE_AGENT_PATH: legacyAgentDir,
      }),
    ).toBe(legacyAgentDir)
  })

  it('recognizes a current Hermes checkout with gateway/run.py', () => {
    const hermesAgentDir = createGatewayAgentDir('hermes-gateway-')

    expect(
      resolveClaudeAgentDir({
        HERMES_AGENT_PATH: hermesAgentDir,
      }),
    ).toBe(hermesAgentDir)
  })
})
