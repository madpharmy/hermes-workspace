import { afterEach, describe, expect, it, vi } from 'vitest'


afterEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})


describe('native Kanban board scope', () => {
  it('accepts only safe board slugs', async () => {
    const mod = await import('./kanban-backend')
    expect(mod.normalizeKanbanBoardSlug('orcaslicer')).toBe('orcaslicer')
    expect(mod.normalizeKanbanBoardSlug('default')).toBe('default')
    expect(() => mod.normalizeKanbanBoardSlug('../secrets')).toThrow(/invalid kanban board/i)
    expect(() => mod.normalizeKanbanBoardSlug('Orca Slicer')).toThrow(/invalid kanban board/i)
  })

  it('reads an explicitly selected project board instead of the default database', async () => {
    vi.stubEnv('HERMES_HOME', '/Users/aurora/.hermes')
    vi.stubEnv('CLAUDE_HOME', '/Users/aurora/.hermes')
    vi.stubEnv('CLAUDE_KANBAN_BACKEND', 'claude')

    vi.doMock('./swarm-kanban-store', () => ({
      SWARM_KANBAN_FILE: '/tmp/swarm2-kanban.json',
      createSwarmKanbanCard: vi.fn(),
      listSwarmKanbanCards: vi.fn(() => []),
      updateSwarmKanbanCard: vi.fn(),
    }))
    vi.doMock('node:fs', () => ({
      existsSync: vi.fn((target: string) =>
        target === '/Users/aurora/.hermes/kanban/boards/orcaslicer/kanban.db' ||
        target === '/Users/aurora/.hermes/kanban/boards/orcaslicer',
      ),
    }))
    const calls: Array<string[]> = []
    vi.doMock('node:child_process', () => ({
      execFileSync: vi.fn((command: string, args: string[] = []) => {
        if (command === 'which') throw new Error('not found')
        if (command === 'sqlite3') {
          calls.push(args)
          return JSON.stringify([{ id: 't_fab', title: 'S0 Intake', status: 'ready', created_at: 1 }])
        }
        throw new Error(`Unexpected ${command}`)
      }),
    }))

    const mod = await import('./kanban-backend')
    const cards = await mod.listKanbanCards('orcaslicer')

    expect(cards[0]).toMatchObject({ id: 't_fab', title: 'S0 Intake' })
    expect(calls[0]?.[0]).toBe('/Users/aurora/.hermes/kanban/boards/orcaslicer/kanban.db')
  })
})
