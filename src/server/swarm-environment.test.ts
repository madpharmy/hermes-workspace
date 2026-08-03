import { describe, expect, it } from 'vitest'

import { resolveSwarmMemoryRoot } from './swarm-environment'

describe('resolveSwarmMemoryRoot', () => {
  it('defaults shared Swarm memory to the canonical repository', () => {
    expect(resolveSwarmMemoryRoot('C:\\repo\\hermes-workspace')).toBe(
      'C:\\repo\\hermes-workspace',
    )
  })

  it('honors an explicit memory-root override', () => {
    expect(resolveSwarmMemoryRoot('C:\\repo\\hermes-workspace', 'D:\\swarm-memory')).toBe(
      'D:\\swarm-memory',
    )
  })
})
