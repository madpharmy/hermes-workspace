import { describe, expect, it } from 'vitest'

import { buildReportViewModel, type Swarm2ReportRow } from './swarm2-reports-view'

function row(
  id: string,
  missionId: string,
  state: Swarm2ReportRow['state'],
): Swarm2ReportRow {
  return {
    id,
    kind: 'checkpoint',
    title: id,
    missionId,
    missionTitle: missionId,
    assignmentId: id,
    workerId: id,
    workerName: id,
    state,
    stateLabel: state,
    updatedAt: 1,
    summary: id,
    checkpointStatus: state,
    blocker: null,
    nextAction: null,
    reviewRequired: false,
    reviewedAt: null,
    reviewedBy: null,
    details: [],
    artifacts: [],
    previews: [],
  }
}

describe('buildReportViewModel', () => {
  const missions = [
    { id: 'current', title: 'Current 3D mission', state: 'blocked', updatedAt: 300 },
    { id: 'smoke-ready', title: 'Old ready smoke', state: 'complete', updatedAt: 200 },
    { id: 'smoke-blocked', title: 'Old blocked smoke', state: 'cancelled', updatedAt: 100 },
  ]
  const rows = [
    row('current-blocked', 'current', 'blocked'),
    row('current-ready', 'current', 'ready'),
    row('old-ready', 'smoke-ready', 'ready'),
    row('old-blocked', 'smoke-blocked', 'blocked'),
  ]

  it('defaults to the newest non-archived mission and excludes smoke history from counts', () => {
    const view = buildReportViewModel({
      missions,
      rows,
      missionFilter: 'current',
      workerFilter: 'all',
      stateFilter: 'all',
    })

    expect(view.resolvedMissionId).toBe('current')
    expect(view.filteredRows.map((item) => item.id)).toEqual([
      'current-blocked',
      'current-ready',
    ])
    expect(view.counts).toMatchObject({ blocked: 1, ready: 1 })
  })

  it('keeps all-mission history available when explicitly selected', () => {
    const view = buildReportViewModel({
      missions,
      rows,
      missionFilter: 'all',
      workerFilter: 'all',
      stateFilter: 'all',
    })

    expect(view.filteredRows).toHaveLength(4)
    expect(view.counts).toMatchObject({ blocked: 2, ready: 2 })
  })
})
