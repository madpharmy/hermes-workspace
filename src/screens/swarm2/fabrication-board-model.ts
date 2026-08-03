export type FabricationStage =
  | 'S0'
  | 'S1'
  | 'S2'
  | 'S3'
  | 'S4'
  | 'S5'
  | 'S6'
  | 'S7'
  | 'S8'
  | 'S9'
  | 'S10'
  | 'S11'

export type WorkspacePrintJobProjection = {
  schema: 'print-anything-job-projection.v1'
  job_id: string
  title?: string | null
  current_stage?: string | null
  completion_state?: string | null
  highest_evidence_tier?: string | null
  release?: Record<string, unknown> | null
  approvals: Record<string, unknown>
  stages: Array<{
    stage: string
    applicable?: boolean | null
    verdict?: string | null
    finding_count: number
    evidence_count: number
  }>
  provider_runs: Array<unknown>
  ledger_valid: boolean
  pipeline_passed: boolean
  provider_bindings: Record<string, unknown>
  pre_model_gate: Record<string, unknown>
  source: {
    manifest_sha256: string
    stage_ledger_sha256: string
  }
  read_only: true
}

export type WorkspacePrintJobRecord = {
  jobId: string
  jobDir: string
  projection: WorkspacePrintJobProjection
}

export type FabricationJobSummary = {
  jobId: string
  title: string
  currentStage: string | null
  firstBlockingStage: FabricationStage | null
  highestEvidenceTier: string
  releaseStatus: string
  completionState: string
  passedStages: number
  totalApplicableStages: number
  findingCount: number
  evidenceCount: number
  approvalCount: number
  providerRunCount: number
  ledgerValid: boolean
  providerBindingsValid: boolean
  pipelinePassed: boolean
  preModelReady: boolean
  modelStartAuthorized: boolean
  readOnly: boolean
  manifestSha256: string
  stageLedgerSha256: string
}

const STAGE_PATTERN = /^S(?:1[01]|[0-9])$/

function normalizedVerdict(value: string | null | undefined): string {
  return value?.trim().toUpperCase() || 'UNAVAILABLE'
}

function isPassingVerdict(value: string | null | undefined): boolean {
  const verdict = normalizedVerdict(value)
  return verdict === 'PASS' || verdict === 'NOT_APPLICABLE'
}

function booleanField(
  value: Record<string, unknown>,
  key: string,
): boolean {
  return value[key] === true
}

function stringField(
  value: Record<string, unknown> | null | undefined,
  key: string,
  fallback: string,
): string {
  const candidate = value?.[key]
  return typeof candidate === 'string' && candidate.trim()
    ? candidate.trim()
    : fallback
}

export function firstBlockingFabricationStage(
  projection: WorkspacePrintJobProjection,
): FabricationStage | null {
  for (const stage of projection.stages) {
    if (stage.applicable === false) continue
    if (!STAGE_PATTERN.test(stage.stage)) continue
    if (!isPassingVerdict(stage.verdict)) {
      return stage.stage as FabricationStage
    }
  }
  return null
}

export function buildFabricationJobSummary(
  record: WorkspacePrintJobRecord,
): FabricationJobSummary {
  const projection = record.projection
  const applicableStages = projection.stages.filter(
    (stage) => stage.applicable !== false && STAGE_PATTERN.test(stage.stage),
  )
  return {
    jobId: projection.job_id,
    title: projection.title?.trim() || projection.job_id,
    currentStage: projection.current_stage?.trim() || null,
    firstBlockingStage: firstBlockingFabricationStage(projection),
    highestEvidenceTier:
      projection.highest_evidence_tier?.trim() || 'UNAVAILABLE',
    releaseStatus: stringField(
      projection.release,
      'status',
      'UNAVAILABLE',
    ),
    completionState:
      projection.completion_state?.trim() || 'UNAVAILABLE',
    passedStages: applicableStages.filter((stage) =>
      isPassingVerdict(stage.verdict),
    ).length,
    totalApplicableStages: applicableStages.length,
    findingCount: applicableStages.reduce(
      (total, stage) => total + stage.finding_count,
      0,
    ),
    evidenceCount: applicableStages.reduce(
      (total, stage) => total + stage.evidence_count,
      0,
    ),
    approvalCount: Object.values(projection.approvals).filter(
      (approval) =>
        typeof approval === 'object' &&
        approval !== null &&
        (approval as Record<string, unknown>).status === 'APPROVED',
    ).length,
    providerRunCount: projection.provider_runs.length,
    ledgerValid: projection.ledger_valid,
    providerBindingsValid: booleanField(
      projection.provider_bindings,
      'valid',
    ),
    pipelinePassed: projection.pipeline_passed,
    preModelReady: booleanField(projection.pre_model_gate, 'ready'),
    modelStartAuthorized: booleanField(
      projection.pre_model_gate,
      'model_start_authorized',
    ),
    readOnly: projection.read_only === true,
    manifestSha256: projection.source.manifest_sha256,
    stageLedgerSha256: projection.source.stage_ledger_sha256,
  }
}

export function buildFabricationJobSummaries(
  records: Array<WorkspacePrintJobRecord>,
): Array<FabricationJobSummary> {
  return records
    .map(buildFabricationJobSummary)
    .sort((left, right) => left.title.localeCompare(right.title))
}
