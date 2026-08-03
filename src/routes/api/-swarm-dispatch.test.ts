import { describe, expect, it } from 'vitest'
import {
  buildHermesChatQueryArgs,
  buildHermesTmuxLaunchCommand,
  buildWorkerPrompt,
  boundWorkerPrompt,
  checkpointFromRuntimeSnapshot,
  describeWorkerProcessFailure,
  dispatchBlockReason,
  mapWithConcurrency,
  messagesAfterChatBaseline,
  resolveCheckpointPollSeconds,
  resolveDispatchLaunchStaggerMs,
  resolveHermesOneShotLaunch,
  runtimeCheckpointSignature,
  runtimePatchForDispatchResult,
  runtimeSnapshotIsFresh,
  selectHermesOneShotBin,
} from './swarm-dispatch'

describe('resolveDispatchLaunchStaggerMs', () => {
  it('stagger-starts parallel Windows workers without serializing their execution', () => {
    expect(resolveDispatchLaunchStaggerMs(0, 'win32')).toBe(0)
    expect(resolveDispatchLaunchStaggerMs(1, 'win32')).toBe(750)
    expect(resolveDispatchLaunchStaggerMs(2, 'win32')).toBe(1_500)
    expect(resolveDispatchLaunchStaggerMs(2, 'linux')).toBe(0)
  })
})

describe('resolveHermesOneShotLaunch', () => {
  it('streams a Windows query through the venv Python process instead of argv', () => {
    const hermesBin =
      String.raw`C:\Hermes\venv\Scripts\hermes.exe`
    const pythonBin =
      String.raw`C:\Hermes\venv\Scripts\python.exe`
    const prompt = `sensitive-${'x'.repeat(30_000)}`
    const launch = resolveHermesOneShotLaunch(hermesBin, prompt, {
      platform: 'win32',
      fileExists: (candidate) => candidate === pythonBin,
    })

    expect(launch.cmd).toBe(pythonBin)
    expect(launch.args.join(' ')).not.toContain(prompt)
    expect(launch.stdin).toBe(prompt)
  })

  it('keeps the normal Hermes argv contract when stdin launching is unavailable', () => {
    const launch = resolveHermesOneShotLaunch('hermes', 'probe', {
      platform: 'linux',
      fileExists: () => false,
    })

    expect(launch.cmd).toBe('hermes')
    expect(launch.args).toEqual(buildHermesChatQueryArgs('probe'))
    expect(launch.stdin).toBeNull()
  })
})

describe('selectHermesOneShotBin', () => {
  it('bypasses Windows command wrappers that execFile cannot launch directly', () => {
    expect(
      selectHermesOneShotBin(
        String.raw`C:\Users\Adam\.local\bin\fabrication.cmd`,
        String.raw`C:\Hermes\venv\Scripts\hermes.exe`,
        {
          platform: 'win32',
          fileExists: () => true,
        },
      ),
    ).toBe(String.raw`C:\Hermes\venv\Scripts\hermes.exe`)
  })

  it('retains an installed wrapper on Unix workers', () => {
    expect(
      selectHermesOneShotBin('/usr/local/bin/fabrication', '/usr/bin/hermes', {
        platform: 'linux',
        fileExists: (candidate) =>
          candidate === '/usr/local/bin/fabrication',
      }),
    ).toBe('/usr/local/bin/fabrication')
  })
})

describe('boundWorkerPrompt', () => {
  it('keeps the assigned task and checkpoint contract within the Windows argv budget', () => {
    const prompt = [
      '## Swarm Orchestrator Dispatch',
      'x'.repeat(30_000),
      '## Assigned Task',
      'Verify canonical projection hashes.',
      '## Required Checkpoint Format',
      'STATE: DONE | BLOCKED',
    ].join('\n')

    const bounded = boundWorkerPrompt(prompt, 20_000)

    expect(bounded.length).toBeLessThanOrEqual(20_000)
    expect(bounded).toContain('Verify canonical projection hashes.')
    expect(bounded).toContain('## Required Checkpoint Format')
    expect(bounded).toContain('Startup memory truncated')
  })
})

describe('describeWorkerProcessFailure', () => {
  it('turns a killed process at its deadline into an actionable timeout', () => {
    const error = Object.assign(new Error('Command failed: very long prompt'), {
      killed: true,
      signal: 'SIGTERM',
    })

    expect(describeWorkerProcessFailure(error, '', 300_100, 300_000)).toBe(
      'Worker exceeded the 300s execution limit. Retry this assignment with a longer background timeout.',
    )
  })

  it('preserves stderr for non-timeout process failures', () => {
    expect(
      describeWorkerProcessFailure(new Error('spawn failed'), 'provider rejected request', 25, 300_000),
    ).toBe('provider rejected request')
  })
})

describe('resolveCheckpointPollSeconds', () => {
  it('allows background checkpoint monitoring to match the worker deadline', () => {
    expect(resolveCheckpointPollSeconds(900, 900)).toBe(900)
  })

  it('never outlives the worker execution deadline', () => {
    expect(resolveCheckpointPollSeconds(1_200, 600)).toBe(600)
  })
})

describe('checkpointFromRuntimeSnapshot', () => {
  it('maps runtime lifecycle fields into a structured checkpoint', () => {
    const checkpoint = checkpointFromRuntimeSnapshot({
      checkpointStatus: 'done',
      state: 'idle',
      lastSummary: 'Patched dispatch polling',
      lastResult: 'Structured checkpoint returned to RouterChat',
      nextAction: 'Verify in UI flow',
      blockedReason: null,
      lastCheckIn: '2026-04-28T20:00:00.000Z',
      lastOutputAt: 1_746_000_000_000,
      checkpointRaw: null,
    })

    expect(checkpoint).not.toBeNull()
    expect(checkpoint?.stateLabel).toBe('DONE')
    expect(checkpoint?.checkpointStatus).toBe('done')
    expect(checkpoint?.result).toBe('Structured checkpoint returned to RouterChat')
    expect(checkpoint?.nextAction).toBe('Verify in UI flow')
    expect(checkpoint?.raw).toContain('STATE: DONE')
  })

  it('returns null when runtime has no meaningful checkpoint fields yet', () => {
    const checkpoint = checkpointFromRuntimeSnapshot({
      checkpointStatus: 'in_progress',
      state: 'executing',
      lastSummary: null,
      lastResult: null,
      nextAction: null,
      blockedReason: null,
      lastCheckIn: '2026-04-28T20:00:00.000Z',
      lastOutputAt: 1_746_000_000_000,
      checkpointRaw: null,
    })

    expect(checkpoint).toBeNull()
  })
})

describe('dispatchBlockReason', () => {
  it('turns failed or timed-out dispatch results into mission blocker text', () => {
    expect(dispatchBlockReason({ ok: false, error: 'Command failed: worker exited', output: '', checkpointStatus: undefined })).toBe('Command failed: worker exited')
    expect(dispatchBlockReason({ ok: true, error: null, output: 'Delivered', checkpointStatus: 'timeout' })).toBe('No fresh checkpoint before poll timeout.')
    expect(dispatchBlockReason({ ok: true, error: null, output: 'Checkpoint DONE', checkpointStatus: 'checkpointed' })).toBeNull()
  })
})

describe('runtimePatchForDispatchResult', () => {
  it('does not overwrite terminal checkpoint state after a successful dispatch', () => {
    const patch = runtimePatchForDispatchResult({
      workerId: 'orchestrator',
      ok: true,
      output: 'STATE: DONE\nRESULT: SWARM_WINDOWS_OK',
      error: null,
      durationMs: 1_000,
      exitCode: 0,
      delivery: 'oneshot',
      checkpointStatus: 'checkpointed',
    })

    expect(patch).toMatchObject({
      lastDispatchMode: 'oneshot',
      lastDispatchResult: 'STATE: DONE\nRESULT: SWARM_WINDOWS_OK',
    })
    expect(patch).not.toHaveProperty('state')
    expect(patch).not.toHaveProperty('checkpointStatus')
    expect(patch).not.toHaveProperty('blockedReason')
  })
})

describe('mapWithConcurrency', () => {
  it('bounds concurrent workers and preserves assignment order', async () => {
    let active = 0
    let peak = 0
    const results = await mapWithConcurrency([40, 10, 30, 20], 2, async (delay) => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, delay))
      active -= 1
      return delay
    })

    expect(peak).toBe(2)
    expect(results).toEqual([40, 10, 30, 20])
  })
})

describe('runtimeSnapshotIsFresh', () => {
  it('requires a changed snapshot with post-dispatch activity', () => {
    const baseline = {
      checkpointStatus: 'in_progress' as const,
      state: 'executing',
      lastSummary: 'Dispatched task',
      lastResult: null,
      nextAction: 'Wait for worker',
      blockedReason: null,
      lastCheckIn: '2026-04-28T19:59:00.000Z',
      lastOutputAt: 1_745_999_900_000,
      checkpointRaw: null,
    }
    const dispatchedAt = 1_746_000_000_000

    expect(runtimeSnapshotIsFresh(baseline, runtimeCheckpointSignature(baseline), dispatchedAt)).toBe(false)

    const updated = {
      ...baseline,
      checkpointStatus: 'done' as const,
      lastResult: 'Completed backend patch',
      nextAction: 'Hand off to UI',
      lastCheckIn: '2026-04-28T20:00:01.000Z',
      lastOutputAt: 1_746_000_001_000,
    }

    expect(runtimeSnapshotIsFresh(updated, runtimeCheckpointSignature(baseline), dispatchedAt)).toBe(true)
  })
})

describe('messagesAfterChatBaseline', () => {
  it('accepts only messages after the exact baseline in the same session', () => {
    const messages = messagesAfterChatBaseline(
      {
        ok: true,
        sessionId: 'session-1',
        sessionTitle: null,
        messages: [
          {
            id: 'old',
            role: 'assistant',
            content: 'STATE: DONE',
            timestamp: 1_746_000_000,
          },
          {
            id: 'new',
            role: 'assistant',
            content: 'STATE: BLOCKED',
            timestamp: 1_746_000_010,
          },
        ],
      },
      'session-1',
      'old',
      1_746_000_005_000,
    )

    expect(messages.map((message) => message.id)).toEqual(['new'])
  })

  it('rejects stale messages when the prior session baseline is unavailable', () => {
    const messages = messagesAfterChatBaseline(
      {
        ok: true,
        sessionId: 'session-2',
        sessionTitle: null,
        messages: [
          {
            id: 'stale',
            role: 'assistant',
            content: 'STATE: DONE',
            timestamp: 1_745_999_000,
          },
          {
            id: 'fresh',
            role: 'assistant',
            content: 'STATE: BLOCKED',
            timestamp: 1_746_000_010,
          },
        ],
      },
      null,
      null,
      1_746_000_005_000,
    )

    expect(messages.map((message) => message.id)).toEqual(['fresh'])
  })
})

describe('checkpoint filtering', () => {
  it('still parses IN_PROGRESS runtime snapshots but leaves terminal filtering to the poller', () => {
    const checkpoint = checkpointFromRuntimeSnapshot({
      checkpointStatus: 'in_progress',
      state: 'executing',
      lastSummary: 'Task is running',
      lastResult: null,
      nextAction: 'Wait for worker output',
      blockedReason: null,
      lastCheckIn: '2026-04-28T20:00:01.000Z',
      lastOutputAt: 1_746_000_001_000,
      checkpointRaw: null,
    })

    expect(checkpoint?.stateLabel).toBe('IN_PROGRESS')
  })
})

describe('buildHermesTmuxLaunchCommand', () => {
  it('keeps the tmux shell alive so startup failures leave readable output', () => {
    const command = buildHermesTmuxLaunchCommand({
      profilePath: '/tmp/hermes profiles/swarm1',
      hermesBin: '/opt/homebrew/bin/hermes',
      ghToken: 'ghp_te...3456',
    })

    expect(command).toContain("HERMES_HOME='/tmp/hermes profiles/swarm1'")
    expect(command).toContain("'/opt/homebrew/bin/hermes' chat --tui")
    expect(command).toContain('[Hermes worker exited with status %s]')
    expect(command).not.toContain('exec ')
  })
})

describe('buildHermesChatQueryArgs', () => {
  it('passes the prompt immediately after -q so flags are not parsed as the query', () => {
    const prompt = 'STATE: DONE\nRESULT: ok'
    const args = buildHermesChatQueryArgs(prompt)

    expect(args.slice(0, 3)).toEqual(['chat', '-q', prompt])
    expect(args).not.toContain('--ignore-rules')
    expect(args).toEqual(
      expect.arrayContaining(['-Q', '--source', 'swarm-dispatch']),
    )
    expect(args).toContain('-Q')
    expect(args).toContain('--source')
    expect(args[1]).toBe('-q')
    expect(args[2]).toBe(prompt)
    expect(args[3]).toBe('-Q')
  })
})

describe('buildWorkerPrompt', () => {
  const roster = {
    id: 'swarm5',
    name: 'Builder',
    role: 'Primary Builder',
    specialty: 'full-stack implementation across Hermes Workspace and Swarm2',
    model: 'GPT-5.5',
    mission: 'Ship focused product slices with tests and clean diffs.',
    modes: [],
    tools: [],
    skills: ['swarm-ui-worker', 'swarm-worker-core'],
    plugins: [],
    pluginToolsets: [],
    mcpServers: [],
    capabilities: ['code-editing', 'ui-implementation', 'build-verification'],
    preferredTaskTypes: ['implementation'],
    greenlightRequiredFor: [],
    maxConcurrentTasks: 1,
    acceptsBroadcast: true,
    reviewRequired: false,
  }

  it('uses Name — Role as the human-facing label while preserving swarmN as machine ID', () => {
    const prompt = buildWorkerPrompt({
      workerId: 'swarm5',
      task: 'Patch the conductor card copy.',
      rationale: 'Builder executes implementation work.',
      roster,
    })

    expect(prompt).toContain('Worker: Builder — Primary Builder')
    expect(prompt).toContain('Machine ID: swarm5')
    expect(prompt).toContain('Mission: Ship focused product slices with tests and clean diffs.')
    expect(prompt).toContain('Capabilities: code-editing, ui-implementation, build-verification')
    expect(prompt).toContain('Skills: swarm-ui-worker, swarm-worker-core')
  })

  it('still injects role context for direct one-shot dispatch unless raw mode is explicit', () => {
    const prompt = buildWorkerPrompt({
      workerId: 'swarm5',
      task: 'Reply with exactly: BUILDER_OK',
      roster,
      direct: true,
    })

    expect(prompt).toContain('Worker: Builder — Primary Builder')
    expect(prompt).toContain('## Assigned Task')
    expect(prompt).toContain('Reply with exactly: BUILDER_OK')
    expect(prompt).toContain('STATE describes whether your assigned lane executed')
    expect(prompt).toContain('Never omit a label')
  })

  it('points worker memory instructions at the active Hermes profile tree', () => {
    const originalHermesHome = process.env.HERMES_HOME
    process.env.HERMES_HOME = 'C:\\Users\\test\\AppData\\Local\\hermes'
    try {
      const prompt = buildWorkerPrompt({
        workerId: 'swarm5',
        task: 'Inspect your durable memory.',
        roster,
      })

      expect(prompt).toContain(
        'C:\\Users\\test\\AppData\\Local\\hermes\\profiles\\swarm5\\MEMORY.md',
      )
      expect(prompt).not.toContain('~/.hermes/profiles/swarm5')
    } finally {
      if (originalHermesHome === undefined) delete process.env.HERMES_HOME
      else process.env.HERMES_HOME = originalHermesHome
    }
  })

  it('keeps explicit raw/smoke dispatch unwrapped for minimal probes', () => {
    const prompt = buildWorkerPrompt({
      workerId: 'swarm5',
      task: 'RAW_PING_ONLY',
      roster,
      direct: true,
      raw: true,
    })

    expect(prompt).toBe('RAW_PING_ONLY')
  })
})
