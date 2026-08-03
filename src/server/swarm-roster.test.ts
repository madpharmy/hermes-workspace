import { describe, expect, it } from 'vitest'
import {
  SwarmRosterSchema,
  SwarmRosterUpsertSchema,
  isSwarmWorkerId,
  readSwarmRoster,
} from './swarm-roster'

describe('swarm roster semantic workers', () => {
  it('accepts both legacy swarm ids and semantic profile ids for upsert', () => {
    const baseWorker = {
      name: 'Builder',
      role: 'Builder',
      specialty: '',
      model: 'Worker',
      mission: 'Ship focused changes.',
      skills: [],
      capabilities: [],
      preferredTaskTypes: [],
      maxConcurrentTasks: 1,
    }

    expect(SwarmRosterUpsertSchema.parse({ ...baseWorker, id: ' builder ' }).id).toBe('builder')
    expect(SwarmRosterUpsertSchema.safeParse({ ...baseWorker, id: 'swarm13' }).success).toBe(true)
    expect(SwarmRosterUpsertSchema.safeParse({ ...baseWorker, id: 'builder' }).success).toBe(true)
    expect(SwarmRosterUpsertSchema.safeParse({ ...baseWorker, id: 'km-agent' }).success).toBe(true)
    expect(SwarmRosterUpsertSchema.safeParse({ ...baseWorker, id: 'ops-watch' }).success).toBe(true)
    expect(isSwarmWorkerId('builder')).toBe(true)
    expect(isSwarmWorkerId('km-agent')).toBe(true)
    expect(isSwarmWorkerId('../bad')).toBe(false)
  })

  it('preserves semantic roster metadata through parse', () => {
    const parsed = SwarmRosterSchema.parse({
      version: 1,
      workers: [
        {
          id: 'km-agent',
          name: 'KM Agent',
          role: 'Knowledge steward',
          specialty: 'RAZSOC and GBrain stewardship',
          model: 'GPT-5.5',
          mission: 'Keep the operating brain coherent.',
          profile: 'km-agent',
          modes: ['health', 'curate'],
          tools: ['gbrain', 'terminal', 'file'],
          skills: ['km-agent-core'],
          plugins: ['disk-cleanup'],
          pluginToolsets: ['spotify'],
          mcpServers: ['gbrain'],
          wrapper: 'km:health',
          capabilities: ['gbrain', 'obsidian', 'drift-audit'],
          preferredTaskTypes: ['knowledge', 'curation'],
          greenlightRequiredFor: ['delete', 'purge', 'publish'],
          maxConcurrentTasks: 1,
        },
      ],
    })

    expect(parsed.workers[0]).toMatchObject({
      id: 'km-agent',
      profile: 'km-agent',
      modes: ['health', 'curate'],
      tools: ['gbrain', 'terminal', 'file'],
      skills: ['km-agent-core'],
      plugins: ['disk-cleanup'],
      pluginToolsets: ['spotify'],
      mcpServers: ['gbrain'],
      wrapper: 'km:health',
      greenlightRequiredFor: ['delete', 'purge', 'publish'],
    })
  })

  it('registers the fabrication worker with its deterministic profile surface', () => {
    const worker = readSwarmRoster(['fabrication']).workers.find(
      (candidate) => candidate.id === 'fabrication',
    )

    expect(worker).toMatchObject({
      id: 'fabrication',
      profile: 'fabrication',
      wrapper: 'fabrication.cmd',
      reviewRequired: true,
      maxConcurrentTasks: 1,
    })
    expect(worker.skills).toEqual(
      expect.arrayContaining(['fabrication-core', 'manage-3d-print-recipes']),
    )
    expect(worker.mcpServers).toEqual(
      expect.arrayContaining(['blender', 'blender-z13', 'orcaslicer']),
    )
    expect(worker.greenlightRequiredFor).toEqual(
      expect.arrayContaining([
        'model-authoring-before-phase-b',
        'physical-print',
        'release',
      ]),
    )
  })
})
