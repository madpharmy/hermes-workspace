import { describe, expect, it } from 'vitest'
import {
  buildFabricationJobSummaries,
  buildFabricationJobSummary,
  firstBlockingFabricationStage,
  type WorkspacePrintJobRecord,
} from './fabrication-board-model'

const record = (
  overrides: Partial<WorkspacePrintJobRecord['projection']> = {},
): WorkspacePrintJobRecord => ({
  jobId: 'mechanical-portfolio',
  jobDir: 'C:\\jobs\\mechanical-portfolio',
  projection: {
    schema: 'print-anything-job-projection.v1',
    job_id: 'mechanical-portfolio',
    title: 'Mechanical portfolio',
    current_stage: 'S2',
    completion_state: 'ACTIVE',
    highest_evidence_tier: 'INTENT_LOCKED',
    release: { status: 'NOT_RELEASED' },
    approvals: {},
    stages: [
      {
        stage: 'S0',
        applicable: true,
        verdict: 'PASS',
        finding_count: 0,
        evidence_count: 1,
      },
      {
        stage: 'S1',
        applicable: true,
        verdict: 'PASS',
        finding_count: 0,
        evidence_count: 1,
      },
      {
        stage: 'S2',
        applicable: true,
        verdict: 'BLOCKED',
        finding_count: 2,
        evidence_count: 0,
      },
    ],
    provider_runs: [],
    ledger_valid: true,
    pipeline_passed: false,
    provider_bindings: { valid: true },
    pre_model_gate: {
      ready: false,
      model_start_authorized: false,
    },
    source: {
      manifest_sha256: 'a'.repeat(64),
      stage_ledger_sha256: 'b'.repeat(64),
    },
    read_only: true,
    ...overrides,
  },
})

describe('canonical fabrication projection', () => {
  it('uses Orca stage verdicts instead of Kanban card status', () => {
    const summary = buildFabricationJobSummary(record())

    expect(summary.firstBlockingStage).toBe('S2')
    expect(summary.passedStages).toBe(2)
    expect(summary.totalApplicableStages).toBe(3)
    expect(summary.highestEvidenceTier).toBe('INTENT_LOCKED')
    expect(summary.releaseStatus).toBe('NOT_RELEASED')
  })

  it('skips non-applicable stages without promoting release', () => {
    const input = record({
      stages: [
        {
          stage: 'S0',
          applicable: true,
          verdict: 'PASS',
          finding_count: 0,
          evidence_count: 1,
        },
        {
          stage: 'S1',
          applicable: false,
          verdict: 'NOT_RUN',
          finding_count: 0,
          evidence_count: 0,
        },
        {
          stage: 'S2',
          applicable: true,
          verdict: 'NOT_RUN',
          finding_count: 0,
          evidence_count: 0,
        },
      ],
    })

    expect(firstBlockingFabricationStage(input.projection)).toBe('S2')
    expect(buildFabricationJobSummary(input).pipelinePassed).toBe(false)
  })

  it('preserves pre-model authorization as an independent gate', () => {
    const blocked = buildFabricationJobSummary(record())
    const ready = buildFabricationJobSummary(
      record({
        pre_model_gate: {
          ready: true,
          model_start_authorized: true,
        },
      }),
    )

    expect(blocked.modelStartAuthorized).toBe(false)
    expect(ready.modelStartAuthorized).toBe(true)
  })

  it('reports approval, provider, evidence, and finding counts from the projection', () => {
    const summary = buildFabricationJobSummary(
      record({
        approvals: {
          phase_a: { status: 'APPROVED' },
          phase_b: { status: 'BLOCKED' },
        },
        provider_runs: [{ id: 'one' }, { id: 'two' }],
      }),
    )

    expect(summary).toMatchObject({
      approvalCount: 1,
      providerRunCount: 2,
      evidenceCount: 2,
      findingCount: 2,
      providerBindingsValid: true,
      ledgerValid: true,
      readOnly: true,
    })
  })

  it('groups only explicit canonical records and sorts by title', () => {
    const beta = record({ job_id: 'beta', title: 'Beta' })
    beta.jobId = 'beta'
    const alpha = record({ job_id: 'alpha', title: 'Alpha' })
    alpha.jobId = 'alpha'

    expect(
      buildFabricationJobSummaries([beta, alpha]).map((item) => item.jobId),
    ).toEqual(['alpha', 'beta'])
  })
})
