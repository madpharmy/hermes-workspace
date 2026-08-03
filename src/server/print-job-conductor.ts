import { execFile } from 'node:child_process'
import { existsSync, readdirSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { z } from 'zod'

const JOB_ID_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/i
const HASH_PATTERN = /^[a-f0-9]{64}$/i
const DEFAULT_TIMEOUT_MS = 30_000
const MAX_PAGE_SIZE = 100

const ProjectionStageSchema = z
  .object({
    stage: z.string().regex(/^S(?:1[01]|[0-9])$/),
    name: z.string().nullish(),
    applicable: z.boolean().nullish(),
    verdict: z.string().nullish(),
    finding_count: z.number().int().nonnegative(),
    evidence_count: z.number().int().nonnegative(),
    independent: z.boolean().nullish(),
  })
  .passthrough()

const ProjectionStagesSchema = z
  .array(ProjectionStageSchema)
  .length(12)
  .superRefine((stages, context) => {
    stages.forEach((stage, index) => {
      if (stage.stage !== `S${index}`) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'stage'],
          message: `Expected canonical stage S${index}.`,
        })
      }
    })
  })

export const PrintJobProjectionSchema = z
  .object({
    schema: z.literal('print-anything-job-projection.v1'),
    generated_at: z.string(),
    job_id: z.string().regex(JOB_ID_PATTERN),
    title: z.string().nullish(),
    board: z.unknown().optional(),
    current_stage: z.string().nullish(),
    completion_state: z.string().nullish(),
    highest_evidence_tier: z.string().nullish(),
    release: z.record(z.string(), z.unknown()).nullish(),
    cycle_budget: z.record(z.string(), z.unknown()).nullish(),
    approvals: z.record(z.string(), z.unknown()),
    stages: ProjectionStagesSchema,
    provider_runs: z.array(z.unknown()),
    ledger_valid: z.boolean(),
    pipeline_passed: z.boolean(),
    pipeline_registry_sha256: z.string().regex(HASH_PATTERN),
    provider_bindings: z.record(z.string(), z.unknown()),
    pre_model_gate: z.record(z.string(), z.unknown()),
    source: z.object({
      manifest: z.string(),
      manifest_sha256: z.string().regex(HASH_PATTERN),
      stage_ledger: z.string(),
      stage_ledger_sha256: z.string().regex(HASH_PATTERN),
    }),
    read_only: z.literal(true),
  })
  .passthrough()
  .superRefine((projection, context) => {
    const modelStartAuthorized =
      projection.pre_model_gate.model_start_authorized === true
    const providerBindingsValid =
      projection.provider_bindings.valid === true
    const releaseStatus =
      typeof projection.release?.status === 'string'
        ? projection.release.status.trim().toUpperCase()
        : null
    if (
      modelStartAuthorized &&
      (!projection.ledger_valid || !providerBindingsValid)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pre_model_gate', 'model_start_authorized'],
        message:
          'Model start cannot be authorized with an invalid ledger or provider binding.',
      })
    }
    if (
      releaseStatus === 'RELEASED' &&
      (!projection.ledger_valid ||
        !projection.pipeline_passed ||
        !providerBindingsValid)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['release', 'status'],
        message:
          'A released projection must have a valid ledger, passing pipeline, and valid provider bindings.',
      })
    }
  })

export const PrintPipelineDoctorSchema = z
  .object({
    schema: z.literal('print-anything-pipeline-doctor.v1'),
    passed: z.boolean(),
    consolidation_complete: z.boolean(),
    registry_sha256: z.string().regex(HASH_PATTERN),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
  })
  .passthrough()

export type PrintJobProjection = z.infer<typeof PrintJobProjectionSchema>
export type PrintPipelineDoctor = z.infer<typeof PrintPipelineDoctorSchema>

export type PrintAnythingEnvironment = {
  repoRoot: string
  jobsRoot: string
  conductorPath: string
  pythonBin: string
  repoExists: boolean
  jobsRootExists: boolean
  conductorExists: boolean
}

export type ConductorExecutionInput = {
  pythonBin: string
  conductorPath: string
  args: Array<string>
  cwd: string
  timeoutMs: number
}

export type ConductorExecutionResult = {
  stdout: string
  stderr: string
}

export type ConductorExecutor = (
  input: ConductorExecutionInput,
) => Promise<ConductorExecutionResult>

export type PrintJobProjectionRecord = {
  jobId: string
  jobDir: string
  projection: PrintJobProjection
}

export type PrintJobListError = {
  jobId: string
  code: string
  message: string
}

export type PrintJobListResult = {
  data: Array<PrintJobProjectionRecord>
  errors: Array<PrintJobListError>
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export type PrintAnythingSwarmAssignment = {
  workerId: string
  task: string
  rationale: string
  criticality: 'hard' | 'advisory'
  reviewRequired?: boolean
  dependsOn?: Array<string>
}

export type PrintAnythingSwarmPlan = {
  schema: 'print-anything-workspace-swarm-plan.v1'
  jobId: string
  title: string
  missionTitle: string
  jobDir: string
  currentStage: string | null
  firstBlockingStage: string | null
  modelStartAuthorized: boolean
  projectionIdentity: {
    schema: 'print-anything-job-projection.v1'
    manifestSha256: string
    stageLedgerSha256: string
    pipelineRegistrySha256: string
  }
  authority: {
    owner: 'orcaslicer-print-job-conductor'
    workspaceRole: 'projection-and-routing-only'
    projectionReadOnly: true
    mayAdvanceStage: false
    mayApprove: false
    mayRelease: false
    mayStartPhysicalPrint: false
  }
  assignments: Array<PrintAnythingSwarmAssignment>
  limitations: Array<string>
}

export class PrintJobConductorError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status = 500) {
    super(message)
    this.name = 'PrintJobConductorError'
    this.code = code
    this.status = status
  }
}

function candidateOrcaRoots(explicit?: string): Array<string> {
  if (explicit?.trim()) return [resolve(explicit.trim())]
  const profileRoot = process.env.USERPROFILE?.trim() || homedir()
  return [
    resolve(process.cwd(), '..', 'orcaslicer'),
    resolve(profileRoot, 'Documents', 'Projects', 'orcaslicer'),
  ]
}

export function resolvePrintAnythingEnvironment(overrides?: {
  repoRoot?: string
  jobsRoot?: string
  pythonBin?: string
}): PrintAnythingEnvironment {
  const explicitRepo =
    overrides?.repoRoot ?? process.env.ORCASLICER_REPO_ROOT ?? undefined
  const roots = candidateOrcaRoots(explicitRepo)
  const repoRoot =
    roots.find((candidate) =>
      existsSync(
        join(
          candidate,
          '.agents',
          'skills',
          'build-printable-decor-models',
          'scripts',
          'print_job_conductor.py',
        ),
      ),
    ) ?? roots[0]
  const conductorPath = join(
    repoRoot,
    '.agents',
    'skills',
    'build-printable-decor-models',
    'scripts',
    'print_job_conductor.py',
  )
  const configuredJobsRoot =
    overrides?.jobsRoot ?? process.env.ORCASLICER_PRINT_JOBS_ROOT
  const jobsRoot = configuredJobsRoot?.trim()
    ? isAbsolute(configuredJobsRoot.trim())
      ? resolve(configuredJobsRoot.trim())
      : resolve(repoRoot, configuredJobsRoot.trim())
    : join(repoRoot, 'mcp-workdir', 'print-jobs')
  const jobsRootContainment = relative(repoRoot, jobsRoot)
  if (
    jobsRootContainment.startsWith('..') ||
    isAbsolute(jobsRootContainment)
  ) {
    throw new PrintJobConductorError(
      'INVALID_JOBS_ROOT',
      'The print-job root must remain inside the configured OrcaSlicer repository.',
      500,
    )
  }

  return {
    repoRoot,
    jobsRoot,
    conductorPath,
    pythonBin:
      overrides?.pythonBin?.trim() ||
      process.env.ORCASLICER_PYTHON?.trim() ||
      'python',
    repoExists: existsSync(repoRoot),
    jobsRootExists: existsSync(jobsRoot),
    conductorExists: existsSync(conductorPath),
  }
}

export const defaultConductorExecutor: ConductorExecutor = (input) =>
  new Promise((resolveExecution, rejectExecution) => {
    execFile(
      input.pythonBin,
      [input.conductorPath, ...input.args],
      {
        cwd: input.cwd,
        env: { ...process.env, PYTHONUTF8: '1' },
        timeout: input.timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          const detail = String(stderr || '').trim() || error.message
          rejectExecution(
            new PrintJobConductorError(
              'CONDUCTOR_EXECUTION_FAILED',
              detail,
              502,
            ),
          )
          return
        }
        resolveExecution({
          stdout: String(stdout || ''),
          stderr: String(stderr || ''),
        })
      },
    )
  })

function requireConductor(environment: PrintAnythingEnvironment): void {
  if (!environment.repoExists || !environment.conductorExists) {
    throw new PrintJobConductorError(
      'CONDUCTOR_NOT_CONFIGURED',
      'The Orca print-job conductor is not available at the configured repository root.',
      503,
    )
  }
}

function parseConductorJson(
  stdout: string,
  command: string,
): unknown {
  const raw = stdout.trim()
  if (!raw) {
    throw new PrintJobConductorError(
      'EMPTY_CONDUCTOR_RESPONSE',
      `The Orca conductor returned no JSON for ${command}.`,
      502,
    )
  }
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new PrintJobConductorError(
      'INVALID_CONDUCTOR_RESPONSE',
      `The Orca conductor returned invalid JSON for ${command}.`,
      502,
    )
  }
}

async function executeConductorJson(
  environment: PrintAnythingEnvironment,
  args: Array<string>,
  executor: ConductorExecutor,
): Promise<unknown> {
  requireConductor(environment)
  const result = await executor({
    pythonBin: environment.pythonBin,
    conductorPath: environment.conductorPath,
    args,
    cwd: environment.repoRoot,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  })
  return parseConductorJson(result.stdout, args[0] ?? 'unknown command')
}

export async function readPrintPipelineDoctor(
  options?: {
    environment?: PrintAnythingEnvironment
    executor?: ConductorExecutor
  },
): Promise<PrintPipelineDoctor> {
  const environment =
    options?.environment ?? resolvePrintAnythingEnvironment()
  const raw = await executeConductorJson(
    environment,
    ['doctor'],
    options?.executor ?? defaultConductorExecutor,
  )
  const parsed = PrintPipelineDoctorSchema.safeParse(raw)
  if (!parsed.success) {
    throw new PrintJobConductorError(
      'INVALID_DOCTOR_PROJECTION',
      'The Orca conductor doctor response did not match print-anything-pipeline-doctor.v1.',
      502,
    )
  }
  return parsed.data
}

function assertJobId(jobId: string): string {
  const normalized = jobId.trim()
  if (!JOB_ID_PATTERN.test(normalized)) {
    throw new PrintJobConductorError(
      'INVALID_JOB_ID',
      'jobId must contain only letters, numbers, dots, underscores, or hyphens.',
      400,
    )
  }
  return normalized
}

function containedJobDir(jobsRoot: string, jobId: string): string {
  const jobDir = resolve(jobsRoot, assertJobId(jobId))
  const resolvedRoot = existsSync(jobsRoot)
    ? realpathSync(jobsRoot)
    : resolve(jobsRoot)
  const resolvedJob = existsSync(jobDir) ? realpathSync(jobDir) : jobDir
  const containment = relative(resolvedRoot, resolvedJob)
  if (
    containment.startsWith('..') ||
    isAbsolute(containment) ||
    containment === ''
  ) {
    throw new PrintJobConductorError(
      'INVALID_JOB_PATH',
      'The requested print job is outside the configured job root.',
      400,
    )
  }
  return jobDir
}

export async function readPrintJobProjection(
  jobId: string,
  options?: {
    environment?: PrintAnythingEnvironment
    executor?: ConductorExecutor
  },
): Promise<PrintJobProjectionRecord> {
  const environment =
    options?.environment ?? resolvePrintAnythingEnvironment()
  const normalizedJobId = assertJobId(jobId)
  const jobDir = containedJobDir(environment.jobsRoot, normalizedJobId)
  if (!existsSync(join(jobDir, 'manifest.json'))) {
    throw new PrintJobConductorError(
      'JOB_NOT_FOUND',
      `Print job ${normalizedJobId} was not found.`,
      404,
    )
  }
  const raw = await executeConductorJson(
    environment,
    ['project', jobDir],
    options?.executor ?? defaultConductorExecutor,
  )
  const parsed = PrintJobProjectionSchema.safeParse(raw)
  if (!parsed.success || parsed.data.job_id !== normalizedJobId) {
    throw new PrintJobConductorError(
      'INVALID_JOB_PROJECTION',
      `Print job ${normalizedJobId} did not return a valid read-only projection.`,
      502,
    )
  }
  return {
    jobId: normalizedJobId,
    jobDir,
    projection: parsed.data,
  }
}

export async function listPrintJobProjections(options?: {
  environment?: PrintAnythingEnvironment
  executor?: ConductorExecutor
  page?: number
  pageSize?: number
  projectionConcurrency?: number
}): Promise<PrintJobListResult> {
  const environment =
    options?.environment ?? resolvePrintAnythingEnvironment()
  requireConductor(environment)
  const page = Math.max(1, Math.floor(options?.page ?? 1))
  const pageSize = Math.max(
    1,
    Math.min(MAX_PAGE_SIZE, Math.floor(options?.pageSize ?? 20)),
  )
  if (!existsSync(environment.jobsRoot)) {
    return {
      data: [],
      errors: [],
      pagination: { page, pageSize, totalItems: 0, totalPages: 0 },
    }
  }

  const jobIds = readdirSync(environment.jobsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && JOB_ID_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
  const totalItems = jobIds.length
  const start = (page - 1) * pageSize
  const selected = jobIds.slice(start, start + pageSize)
  const requestedConcurrency = Math.floor(options?.projectionConcurrency ?? 4)
  const projectionConcurrency = Number.isFinite(requestedConcurrency)
    ? Math.max(1, Math.min(8, requestedConcurrency))
    : 4
  const settled: Array<
    | { record: PrintJobProjectionRecord }
    | { error: { jobId: string; code: string; message: string } }
  > = new Array(selected.length)
  let cursor = 0
  const workers = Array.from(
    { length: Math.min(projectionConcurrency, selected.length) },
    async () => {
      while (cursor < selected.length) {
        const index = cursor
        cursor += 1
        const jobId = selected[index]
        if (!jobId) continue
      try {
        settled[index] = {
          record: await readPrintJobProjection(jobId, {
            environment,
            executor: options?.executor,
          }),
        }
      } catch (error) {
        const adapterError =
          error instanceof PrintJobConductorError
            ? error
            : new PrintJobConductorError(
                'JOB_PROJECTION_FAILED',
                error instanceof Error ? error.message : String(error),
                502,
              )
        settled[index] = {
          error: {
            jobId,
            code: adapterError.code,
            message: adapterError.message,
          },
        }
      }
      }
    },
  )
  await Promise.all(workers)

  return {
    data: settled.flatMap((result) =>
      'record' in result && result.record ? [result.record] : [],
    ),
    errors: settled.flatMap((result) =>
      'error' in result && result.error ? [result.error] : [],
    ),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
    },
  }
}

function isPassingVerdict(verdict: string | null | undefined): boolean {
  const normalized = verdict?.trim().toUpperCase()
  return normalized === 'PASS' || normalized === 'NOT_APPLICABLE'
}

export function firstBlockingPrintStage(
  projection: PrintJobProjection,
): string | null {
  for (const stage of projection.stages) {
    if (stage.applicable === false) continue
    if (!isPassingVerdict(stage.verdict)) return stage.stage
  }
  return null
}

function gateContext(
  projection: PrintJobProjection,
  jobDir: string,
): string {
  return [
    `Canonical print job: ${projection.job_id} (${projection.title || 'Untitled'})`,
    `Canonical job directory: ${jobDir}`,
    `Read-only projection schema: ${projection.schema}`,
    `Manifest SHA-256: ${projection.source.manifest_sha256}`,
    `Stage-ledger SHA-256: ${projection.source.stage_ledger_sha256}`,
    `Pipeline-registry SHA-256: ${projection.pipeline_registry_sha256}`,
    `Current stage: ${projection.current_stage ?? 'UNAVAILABLE'}`,
    `First non-passing stage: ${firstBlockingPrintStage(projection) ?? 'none'}`,
    '',
    'Authority boundary:',
    '- Read the job only through print_job_conductor.py project/status/doctor.',
    '- Do not edit manifest.json or stage-gates.json and do not create a parallel stage ledger.',
    '- Do not record a human approval, advance a stage, claim release, or start a physical print.',
    '- Provider work must use the Orca conductor provider request/result/accept envelope.',
    '- Return a Workspace checkpoint/report with evidence; it is advisory until the Orca conductor accepts the corresponding artifact.',
    '- Workspace checkpoint STATE describes lane execution, not the Orca job verdict. A completed review that proves the job is gated returns DONE and reports the canonical gate in RESULT/NEXT_ACTION; BLOCKED means the worker lane itself could not complete.',
  ].join('\n')
}

function assignment(
  workerId: string,
  rationale: string,
  context: string,
  instructions: Array<string>,
  options?: {
    reviewRequired?: boolean
    dependsOn?: Array<string>
    criticality?: 'hard' | 'advisory'
  },
): PrintAnythingSwarmAssignment {
  return {
    workerId,
    rationale,
    criticality: options?.criticality === 'advisory' ? 'advisory' : 'hard',
    task: [context, '', 'Assigned lane:', ...instructions.map((line) => `- ${line}`)].join(
      '\n',
    ),
    ...(options?.reviewRequired
      ? { reviewRequired: options.reviewRequired }
      : {}),
    ...(options?.dependsOn ? { dependsOn: options.dependsOn } : {}),
  }
}

export function buildPrintAnythingSwarmPlan(
  record: PrintJobProjectionRecord,
): PrintAnythingSwarmPlan {
  const { projection, jobDir } = record
  const firstBlockingStage = firstBlockingPrintStage(projection)
  const currentStage = projection.current_stage ?? firstBlockingStage
  const stageNumber = Number.parseInt(
    String(currentStage ?? 'S0').replace(/^S/i, ''),
    10,
  )
  const normalizedStageNumber = Number.isFinite(stageNumber) ? stageNumber : 0
  const modelStartAuthorized =
    projection.pre_model_gate.model_start_authorized === true
  const context = gateContext(projection, jobDir)
  const assignments: Array<PrintAnythingSwarmAssignment> = [
    assignment(
      'orchestrator',
      'Coordinate the Workspace mission while leaving every fabrication verdict in the Orca conductor.',
      context,
      [
        'Reconcile worker checkpoints against the canonical projection hashes and the first non-passing stage.',
        'Route fixes to the earliest prevention stage; do not approve on Adam’s behalf.',
        'Stop downstream authoring when model_start_authorized is false.',
      ],
    ),
    assignment(
      'fabrication',
      'Own independent manufacturing, BOM, interface, material-allocation, and slice-readiness analysis.',
      context,
      [
        'Inspect every applicable part/interface/material/orientation/support and under/over-material check for the current gate.',
        'Keep geometric, slice, coupon, and physical claims separate; label missing physical evidence UNVERIFIED.',
        'Use Orca/Blender tools only within their provider boundary and never start a printer.',
      ],
    ),
  ]

  if (normalizedStageNumber >= 5) {
    assignments.push(assignment(
      'reviewer',
      'Provide fresh-context independent review and detector positive controls.',
      context,
      [
        'Review the projection and new lane evidence without relying on generator assertions.',
        'Require a known-bad positive control for every detector used to close a deficiency.',
        'Report supported, partly-supported, unsupported, or unavailable for each material claim.',
      ],
    ))
  }

  if (
    normalizedStageNumber >= 3 ||
    projection.provider_runs.length > 0
  ) {
    assignments.push(assignment(
      'ops-watch',
      'Verify provider and resource readiness without treating installed configuration as live capability.',
      context,
      [
        'Probe only providers required by the current route and report exact version, worker, timestamp, and result.',
        'Report storage/GPU/model/service limitations as advisory unless the contract marks the capability hard-required.',
        'Do not restart services or change credentials/configuration without separate authorization.',
      ],
      { criticality: 'advisory' },
    ))
  }

  if (normalizedStageNumber <= 2) {
    assignments.push(
      assignment(
        'km-agent',
        'Recover requirements, provenance, prior deficiencies, and learning evidence before model authoring.',
        context,
        [
          'Reconcile request, whole-BOM, prevention/local-model plan, and prior accepted evidence by hash.',
          'Expose missing needs and contradictions; do not turn inference into an approval or measured fact.',
        ],
        { criticality: 'advisory' },
      ),
    )
  }

  if (normalizedStageNumber >= 1 && normalizedStageNumber <= 5) {
    assignments.push(
      assignment(
        'researcher',
        'Run bounded champion/challenger concept, vision, and structured-inference comparisons for planning.',
        context,
        [
          'Use applicable local image-generation, blind-first image-analysis, and engineering-inference lanes in parallel.',
          'Normalize task-specific results, preserve losing outputs, and continue after advisory failure when minimum quorum remains.',
          'Return promotion candidates for review only; never auto-edit skills or canonical job state.',
        ],
        { criticality: 'advisory' },
      ),
    )
  }

  if (
    normalizedStageNumber >= 6 &&
    modelStartAuthorized &&
    normalizedStageNumber <= 8
  ) {
    assignments.push(
      assignment(
        'builder',
        'Author or refine editable source and fabrication twins only after the canonical pre-model gate authorizes it.',
        context,
        [
          'Work from the approved hash-bound baseline and provider request envelope.',
          'Preserve editable source separately from fabrication geometry and return exact artifact hashes.',
          'Do not self-certify geometry, motion, art, slicing, or release.',
        ],
      ),
      assignment(
        'qa',
        'Run blind-first visual, workflow, import, and known-bad regression checks.',
        context,
        [
          'Inspect the latest immutable candidate already present in the canonical job; report UNAVAILABLE if no candidate exists yet.',
          'Inspect neutral and diagnostic views before reading author claims.',
          'Keep visible observations separate from measured geometry and slice evidence.',
          'Return reproducible defects and retest evidence tied to the candidate hash.',
        ],
      ),
      assignment(
        'researcher',
        'Compare applicable local generation, vision, and inference lanes without blocking useful authoring on advisory outages.',
        context,
        [
          'Fan out champion/challenger lanes with declared timeout and quorum.',
          'Record model/runtime provenance and task-specific scores; preserve all valid results.',
          'Escalate only missing hard requirements; otherwise record limitations and continue.',
        ],
        { criticality: 'advisory' },
      ),
    )
  } else if (normalizedStageNumber >= 6) {
    assignments.push(
      assignment(
        'qa',
        'Verify manufacturing/release evidence independently while respecting the physical-action boundary.',
        context,
        [
          'Check exact artifact/profile hashes, toolpath evidence, limitations, and release exclusions.',
          'Do not infer fit, strength, finish, motion, or color from a successful slice.',
          'No physical print or printer-control action is authorized by this mission.',
        ],
      ),
    )
  }

  const limitations = [
    'Workspace consumes the canonical read-only projection and cannot advance, approve, release, or physically print the job.',
    'Workspace fans out evidence lanes in parallel; Orca stage gates, not Workspace assignment ordering or review state, control downstream eligibility.',
    'Advisory local-model and readiness lanes may end blocked with a recorded limitation; hard fabrication and independent-review lanes still govern mission success.',
  ]
  if (!modelStartAuthorized && normalizedStageNumber >= 6) {
    limitations.push(
      'The projection is at or beyond S6 but model_start_authorized is false; builder authoring is intentionally not routed.',
    )
  }
  if (normalizedStageNumber === 0) {
    limitations.push(
      'S0 routes only authority/intake, fabrication classification, and prior-context recovery; independent QA, provider readiness, and local-model comparison are withheld until their inputs exist.',
    )
  }
  if (!('attempts' in projection)) {
    limitations.push(
      'The current Orca projection does not expose attempt/event records; Workspace reports them unavailable instead of inventing state.',
    )
  }

  return {
    schema: 'print-anything-workspace-swarm-plan.v1',
    jobId: projection.job_id,
    title: projection.title || projection.job_id,
    missionTitle: `Print job ${projection.job_id} — ${projection.title || 'Untitled'} [${currentStage ?? 'UNAVAILABLE'}]`,
    jobDir,
    currentStage,
    firstBlockingStage,
    modelStartAuthorized,
    projectionIdentity: {
      schema: projection.schema,
      manifestSha256: projection.source.manifest_sha256,
      stageLedgerSha256: projection.source.stage_ledger_sha256,
      pipelineRegistrySha256: projection.pipeline_registry_sha256,
    },
    authority: {
      owner: 'orcaslicer-print-job-conductor',
      workspaceRole: 'projection-and-routing-only',
      projectionReadOnly: true,
      mayAdvanceStage: false,
      mayApprove: false,
      mayRelease: false,
      mayStartPhysicalPrint: false,
    },
    assignments,
    limitations,
  }
}
