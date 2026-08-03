import { describe, expect, it } from 'vitest'
import {
  buildAsyncSwarmDispatchPayload,
  resolveSwarmDispatchMode,
} from './swarm-dispatch-contract'

describe('Swarm dispatch contract', () => {
  it('builds a genuinely detached Router mission request', () => {
    const assignments = [
      {
        workerId: 'orchestrator',
        task: 'Plan the mission',
        rationale: 'Own routing.',
      },
    ]

    const payload = buildAsyncSwarmDispatchPayload(assignments)

    expect(payload).toEqual({
      assignments,
      timeoutSeconds: 900,
      waitForCheckpoint: true,
      checkpointPollSeconds: 900,
      allowAsync: true,
    })
    expect(resolveSwarmDispatchMode(payload)).toEqual({
      detached: true,
      waitForCheckpoint: true,
    })
  })

  it('does not silently disable checkpoint waiting without explicit async consent', () => {
    expect(resolveSwarmDispatchMode({ waitForCheckpoint: false })).toEqual({
      detached: false,
      waitForCheckpoint: true,
    })
  })

  it('allows an explicitly detached caller to skip checkpoint monitoring', () => {
    expect(
      resolveSwarmDispatchMode({
        allowAsync: true,
        waitForCheckpoint: false,
      }),
    ).toEqual({
      detached: true,
      waitForCheckpoint: false,
    })
  })
})
