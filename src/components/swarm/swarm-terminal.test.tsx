import { describe, expect, it } from 'vitest'
import { shouldConnectSwarmTerminal } from './swarm-terminal'

describe('SwarmTerminal', () => {
  it('keeps inactive runtime panels disconnected from server terminals', () => {
    expect(shouldConnectSwarmTerminal(false)).toBe(false)
    expect(shouldConnectSwarmTerminal(true)).toBe(true)
  })
})
