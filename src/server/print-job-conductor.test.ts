import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PrintJobConductorError,
  PrintJobProjectionSchema,
  buildPrintAnythingSwarmPlan,
  firstBlockingPrintStage,
  listPrintJobProjections,
  readPrintJobProjection,
  readPrintPipelineDoctor,
  resolvePrintAnythingEnvironment,
  type ConductorExecutor,
  type PrintJobProjection,
} from './print-job-conductor'

const roots: Array<string> = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true })
  }
})

function fixtureEnvironment() {
  const repoRoot = mkdtempSync(join(tmpdir(), 'print-job-adapter-'))
  roots.push(repoRoot)
  const conductorPath = join(
    repoRoot,
    '.agents',
    'skills',
    'build-printable-decor-models',
    'scripts',
    'print_job_conductor.py',
  )
  mkdirSync(join(conductorPath, '..'), { recursive: true })
  writeFileSync(conductorPath, '# fixture conductor\n', 'utf8')
  const jobsRoot = join(repoRoot, 'mcp-workdir', 'print-jobs')
  return resolvePrintAnythingEnvironment({
    repoRoot,
    jobsRoot,
    pythonBin: 'python-fixture',
  })
}

function createJob(
  environment: ReturnType<typeof fixtureEnvironment>,
  jobId: string,
) {
  const jobDir = join(environment.jobsRoot, jobId)
  mkdirSync(jobDir, { recursive: true })
  writeFileSync(
    join(jobDir, 'manifest.json'),
    JSON.stringify({ job_id: jobId }),
    'utf8',
  )
  return jobDir
}

function projectionFixture(
  jobId = 'fixture-job',
  overrides: Partial<PrintJobProjection> = {},
): PrintJobProjection {
  const stages = Array.from({ length: 12 }, (_, index) => ({
    stage: `S${index}`,
    name: `Stage ${index}`,
    applicable: true,
    verdict: index === 0 ? 'PASS' : 'NOT_RUN',
    finding_count: 0,
    evidence_count: index === 0 ? 1 : 0,
    independent: index >= 8,
  }))
  return PrintJobProjectionSchema.parse({
    schema: 'print-anything-job-projection.v1',
    generated_at: '2026-07-25T00:00:00Z',
    job_id: jobId,
    title: 'Fixture print job',
    board: 'fabrication',
    current_stage: 'S0',
    completion_state: 'ACTIVE',
    highest_evidence_tier: 'INTENT_LOCKED',
    release: { status: 'NOT_RELEASED' },
    cycle_budget: { limit: 5, used: 0 },
    approvals: {},
    stages,
    provider_runs: [],
    ledger_valid: true,
    pipeline_passed: false,
    pipeline_registry_sha256: 'a'.repeat(64),
    provider_bindings: { valid: true, errors: [] },
    pre_model_gate: {
      ready: false,
      model_start_authorized: false,
      errors: ['S1-S5 not closed'],
    },
    source: {
      manifest: 'manifest.json',
      manifest_sha256: 'b'.repeat(64),
      stage_ledger: 'stage-gates.json',
      stage_ledger_sha256: 'c'.repeat(64),
    },
    read_only: true,
    ...overrides,
  })
}

function executorFor(
  response: (args: Array<string>) => unknown,
): ConductorExecutor {
  return vi.fn(async ({ args }) => ({
    stdout: JSON.stringify(response(args)),
    stderr: '',
  }))
}

describe('print-job conductor adapter', () => {
  it('returns an empty canonical list when the production job root is absent', async () => {
    const environment = fixtureEnvironment()
    const executor = vi.fn<ConductorExecutor>()

    const result = await listPrintJobProjections({
      environment,
      executor,
    })

    expect(result.data).toEqual([])
    expect(result.errors).toEqual([])
    expect(result.pagination.totalItems).toBe(0)
    expect(executor).not.toHaveBeenCalled()
  })

  it('projects one direct-child job with fixed argv and validates read-only identity', async () => {
    const environment = fixtureEnvironment()
    const jobDir = createJob(environment, 'fixture-job')
    const executor = executorFor(() => projectionFixture())

    const record = await readPrintJobProjection('fixture-job', {
      environment,
      executor,
    })

    expect(record.jobDir).toBe(jobDir)
    expect(record.projection.read_only).toBe(true)
    expect(executor).toHaveBeenCalledWith(
      expect.objectContaining({
        args: ['project', jobDir],
        cwd: environment.repoRoot,
        pythonBin: 'python-fixture',
      }),
    )
  })

  it('rejects traversal and projection identity drift', async () => {
    const environment = fixtureEnvironment()
    createJob(environment, 'fixture-job')
    await expect(
      readPrintJobProjection('../outside', { environment }),
    ).rejects.toMatchObject({
      code: 'INVALID_JOB_ID',
      status: 400,
    })

    await expect(
      readPrintJobProjection('fixture-job', {
        environment,
        executor: executorFor(() => projectionFixture('different-job')),
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_JOB_PROJECTION',
      status: 502,
    })
  })

  it('rejects a mutable or malformed conductor projection', async () => {
    const environment = fixtureEnvironment()
    createJob(environment, 'fixture-job')
    const invalid = { ...projectionFixture(), read_only: false }

    await expect(
      readPrintJobProjection('fixture-job', {
        environment,
        executor: executorFor(() => invalid),
      }),
    ).rejects.toBeInstanceOf(PrintJobConductorError)
  })

  it('rejects cross-field authority drift in projected model and release state', () => {
    const unauthorizedModelStart = {
      ...projectionFixture('unsafe-model'),
      ledger_valid: false,
      pre_model_gate: {
        ready: true,
        model_start_authorized: true,
        errors: [],
      },
    }
    const unsafeRelease = {
      ...projectionFixture('unsafe-release'),
      release: { status: 'RELEASED' },
      pipeline_passed: false,
    }

    expect(
      PrintJobProjectionSchema.safeParse(unauthorizedModelStart).success,
    ).toBe(false)
    expect(PrintJobProjectionSchema.safeParse(unsafeRelease).success).toBe(
      false,
    )
  })

  it('rejects a configured print-job root outside the canonical Orca repository', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'print-job-root-'))
    const outsideRoot = mkdtempSync(join(tmpdir(), 'print-job-outside-'))
    roots.push(repoRoot, outsideRoot)

    expect(() =>
      resolvePrintAnythingEnvironment({
        repoRoot,
        jobsRoot: outsideRoot,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: 'INVALID_JOBS_ROOT',
      }),
    )
  })

  it('isolates a corrupt job instead of hiding valid jobs', async () => {
    const environment = fixtureEnvironment()
    createJob(environment, 'alpha')
    createJob(environment, 'beta')
    const executor = executorFor((args) =>
      String(args[1]).endsWith('alpha')
        ? projectionFixture('alpha')
        : { schema: 'wrong' },
    )

    const result = await listPrintJobProjections({
      environment,
      executor,
      pageSize: 20,
    })

    expect(result.data.map((item) => item.jobId)).toEqual(['alpha'])
    expect(result.errors).toEqual([
      expect.objectContaining({
        jobId: 'beta',
        code: 'INVALID_JOB_PROJECTION',
      }),
    ])
  })

  it('bounds concurrent conductor projections while preserving job order', async () => {
    const environment = fixtureEnvironment()
    const jobIds = ['alpha', 'beta', 'delta', 'epsilon', 'gamma', 'zeta']
    jobIds.forEach((jobId) => createJob(environment, jobId))
    let active = 0
    let peak = 0
    const executor = vi.fn<ConductorExecutor>(async ({ args }) => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
      const jobId = String(args[1]).split(/[\\/]/).at(-1) ?? ''
      return {
        stdout: JSON.stringify(projectionFixture(jobId)),
        stderr: '',
      }
    })

    const result = await listPrintJobProjections({
      environment,
      executor,
      pageSize: 20,
      projectionConcurrency: 2,
    })

    expect(peak).toBe(2)
    expect(result.data.map((item) => item.jobId)).toEqual(jobIds)
    expect(result.errors).toEqual([])
  })

  it('parses the version-pinned doctor response', async () => {
    const environment = fixtureEnvironment()
    const doctor = await readPrintPipelineDoctor({
      environment,
      executor: executorFor(() => ({
        schema: 'print-anything-pipeline-doctor.v1',
        passed: true,
        consolidation_complete: false,
        registry_sha256: 'd'.repeat(64),
        errors: [],
        warnings: ['workspace-state-projection remains open'],
      })),
    })

    expect(doctor).toMatchObject({
      passed: true,
      consolidation_complete: false,
    })
  })

  it('routes planning lanes before approval and never routes builder authoring', () => {
    const projection = projectionFixture()
    const plan = buildPrintAnythingSwarmPlan({
      jobId: projection.job_id,
      jobDir: 'C:\\jobs\\fixture-job',
      projection,
    })
    const workers = plan.assignments.map((item) => item.workerId)

    expect(workers).toContain('fabrication')
    expect(workers).toContain('km-agent')
    expect(workers).not.toContain('researcher')
    expect(workers).not.toContain('reviewer')
    expect(workers).not.toContain('ops-watch')
    expect(workers).not.toContain('builder')
    expect(plan.authority).toMatchObject({
      projectionReadOnly: true,
      mayAdvanceStage: false,
      mayApprove: false,
      mayRelease: false,
      mayStartPhysicalPrint: false,
    })
  })

  it('routes builder plus independent QA only when the pre-model gate authorizes S6+', () => {
    const projection = projectionFixture('authorized-job', {
      current_stage: 'S6',
      stages: Array.from({ length: 12 }, (_, index) => ({
        stage: `S${index}`,
        name: `Stage ${index}`,
        applicable: true,
        verdict: index < 6 ? 'PASS' : 'NOT_RUN',
        finding_count: 0,
        evidence_count: index < 6 ? 1 : 0,
        independent: index >= 8,
      })),
      pre_model_gate: {
        ready: true,
        model_start_authorized: true,
        errors: [],
      },
    })
    const plan = buildPrintAnythingSwarmPlan({
      jobId: projection.job_id,
      jobDir: 'C:\\jobs\\authorized-job',
      projection,
    })

    expect(plan.assignments.map((item) => item.workerId)).toEqual(
      expect.arrayContaining(['builder', 'fabrication', 'qa', 'reviewer']),
    )
    expect(
      plan.assignments.find((item) => item.workerId === 'qa')?.dependsOn,
    ).toBeUndefined()
    expect(
      plan.assignments.every((item) => item.reviewRequired !== true),
    ).toBe(true)
    expect(
      plan.assignments.find((item) => item.workerId === 'researcher')
        ?.criticality,
    ).toBe('advisory')
  })

  it('uses the earliest applicable non-passing stage and skips not-applicable rows', () => {
    const stages = Array.from({ length: 12 }, (_, index) => ({
      stage: `S${index}`,
      name: `Stage ${index}`,
      applicable: index !== 1,
      verdict: index === 0 ? 'PASS' : index === 1 ? 'NOT_RUN' : index === 2 ? 'BLOCKED' : 'NOT_RUN',
      finding_count: index === 2 ? 1 : 0,
      evidence_count: index === 0 ? 1 : 0,
      independent: index >= 8,
    }))
    const projection = projectionFixture('stage-job', {
      stages,
    })

    expect(firstBlockingPrintStage(projection)).toBe('S2')
  })

  it('rejects reordered or incomplete stage projections', () => {
    const projection = projectionFixture()
    const reordered = {
      ...projection,
      stages: [...projection.stages].reverse(),
    }
    const incomplete = {
      ...projection,
      stages: projection.stages.slice(0, 11),
    }

    expect(PrintJobProjectionSchema.safeParse(reordered).success).toBe(false)
    expect(PrintJobProjectionSchema.safeParse(incomplete).success).toBe(false)
  })
})
