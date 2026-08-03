'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import {
  buildFabricationJobSummaries,
  type WorkspacePrintJobRecord,
} from './fabrication-board-model'

type PrintJobsResponse = {
  ok: boolean
  schema?: string
  data?: Array<WorkspacePrintJobRecord>
  errors?: Array<{ jobId: string; code: string; message: string }>
  doctor?: {
    passed: boolean
    consolidation_complete: boolean
    warnings: Array<string>
    errors: Array<string>
  }
  environment?: {
    repoConfigured: boolean
    conductorAvailable: boolean
    jobsRootAvailable: boolean
  }
  error?: { code?: string; message?: string }
}

type SwarmResponse = {
  ok: boolean
  mode?: 'native-swarm' | 'dashboard'
  missionId?: string
  error?: { code?: string; message?: string } | string
}

function responseErrorMessage(
  error: SwarmResponse['error'],
): string | undefined {
  return typeof error === 'string' ? error : error?.message
}

async function fetchPrintJobs(): Promise<PrintJobsResponse> {
  const response = await fetch('/api/print-jobs?pageSize=20', {
    credentials: 'same-origin',
  })
  const data = (await response.json().catch(() => ({}))) as PrintJobsResponse
  if (!response.ok || data.ok === false) {
    throw new Error(
      data.error?.message || `Print-job projection failed: ${response.status}`,
    )
  }
  return data
}

async function routePrintJobSwarm(jobId: string): Promise<SwarmResponse> {
  const response = await fetch('/api/conductor-spawn', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      printJobId: jobId,
      maxParallel: 2,
    }),
  })
  const data = (await response.json().catch(() => ({}))) as SwarmResponse
  if (!response.ok || data.ok === false) {
    throw new Error(
      responseErrorMessage(data.error) ||
        `Print-job swarm dispatch failed: ${response.status}`,
    )
  }
  return data
}

export function PrintAnythingJobsPanel({
  className,
}: {
  className?: string
}) {
  const [routedJobId, setRoutedJobId] = useState<string | null>(null)
  const query = useQuery({
    queryKey: ['swarm2', 'print-jobs'],
    queryFn: fetchPrintJobs,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
  const routeMutation = useMutation({
    mutationFn: routePrintJobSwarm,
    onSuccess: (_result, jobId) => setRoutedJobId(jobId),
  })
  const jobs = useMemo(
    () => buildFabricationJobSummaries(query.data?.data ?? []),
    [query.data?.data],
  )
  const doctor = query.data?.doctor
  const environment = query.data?.environment
  const isHealthy =
    doctor?.passed === true &&
    environment?.repoConfigured === true &&
    environment?.conductorAvailable === true

  return (
    <section
      className={cn(
        'rounded-2xl border border-amber-400/35 bg-amber-500/5 p-3',
        className,
      )}
      aria-label="Canonical print jobs"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
            Orca conductor • read-only
          </div>
          <div className="mt-0.5 text-xs text-[var(--theme-muted-2)]">
            Stage, approval, evidence, and release state comes directly from
            print-anything-job-projection.v1. Board cards cannot advance it.
          </div>
        </div>
        <span
          className={cn(
            'rounded-full border px-2 py-1 text-[10px] font-semibold',
            isHealthy
              ? 'border-green-400/40 bg-green-500/10 text-green-700'
              : query.isLoading
                ? 'border-slate-400/40 bg-slate-500/10 text-slate-700'
                : 'border-red-400/40 bg-red-500/10 text-red-700',
          )}
        >
          {query.isLoading
            ? 'Checking'
            : isHealthy
              ? `${jobs.length} canonical ${jobs.length === 1 ? 'job' : 'jobs'}`
              : 'Unavailable'}
        </span>
      </div>

      {query.isError ? (
        <div className="mt-3 rounded-xl border border-red-400/35 bg-red-500/10 p-2 text-xs text-red-700">
          {query.error instanceof Error
            ? query.error.message
            : 'Unable to read the Orca conductor.'}
        </div>
      ) : null}

      {doctor?.passed && doctor.consolidation_complete === false ? (
        <div className="mt-2 text-[10px] text-amber-700">
          Contract healthy; broader pipeline migration is still incomplete.
        </div>
      ) : null}

      {!query.isLoading && isHealthy && jobs.length === 0 ? (
        <div className="mt-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 text-xs text-[var(--theme-muted-2)]">
          {environment?.jobsRootAvailable
            ? 'The canonical job root is ready and currently empty.'
            : 'No canonical job root exists yet. It will appear when the Orca conductor initializes the first product job.'}
        </div>
      ) : null}

      {jobs.length > 0 ? (
        <div className="mt-3 grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
          {jobs.map((job) => (
            <article
              key={job.jobId}
              className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--theme-text)]">
                    {job.title}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--theme-muted)]">
                    {job.jobId} • {job.manifestSha256.slice(0, 10)}
                  </div>
                </div>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[9px] font-semibold',
                    job.completionState === 'BLOCKED' ||
                    !job.ledgerValid ||
                    !job.providerBindingsValid ||
                    (job.releaseStatus === 'RELEASED' && !job.pipelinePassed)
                      ? 'border-red-400/40 bg-red-500/10 text-red-700'
                      : job.releaseStatus === 'RELEASED'
                        ? 'border-green-400/40 bg-green-500/10 text-green-700'
                        : 'border-amber-400/40 bg-amber-500/10 text-amber-700',
                  )}
                >
                  {job.releaseStatus.replaceAll('_', ' ')}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                <div>
                  <div className="text-[var(--theme-muted)]">Evidence</div>
                  <div className="mt-0.5 font-semibold text-[var(--theme-text)]">
                    {job.highestEvidenceTier}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--theme-muted)]">Next gate</div>
                  <div className="mt-0.5 font-semibold text-[var(--theme-text)]">
                    {job.firstBlockingStage ?? 'None'}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--theme-muted)]">Stages</div>
                  <div className="mt-0.5 font-semibold text-[var(--theme-text)]">
                    {job.passedStages}/{job.totalApplicableStages}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1 text-[9px]">
                <span className="rounded-full border border-[var(--theme-border)] px-2 py-0.5 text-[var(--theme-muted-2)]">
                  ledger {job.ledgerValid ? 'valid' : 'invalid'}
                </span>
                <span className="rounded-full border border-[var(--theme-border)] px-2 py-0.5 text-[var(--theme-muted-2)]">
                  model {job.modelStartAuthorized ? 'authorized' : 'gated'}
                </span>
                <span className="rounded-full border border-[var(--theme-border)] px-2 py-0.5 text-[var(--theme-muted-2)]">
                  {job.providerRunCount} provider runs
                </span>
              </div>
              <button
                type="button"
                disabled={routeMutation.isPending}
                onClick={() => routeMutation.mutate(job.jobId)}
                className="mt-3 rounded-lg border border-amber-400/40 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {routeMutation.isPending &&
                routeMutation.variables === job.jobId
                  ? 'Routing…'
                  : routedJobId === job.jobId
                    ? 'Swarm routed'
                    : 'Route bounded swarm'}
              </button>
            </article>
          ))}
        </div>
      ) : null}

      {routeMutation.isError ? (
        <div className="mt-2 text-xs text-red-700">
          {routeMutation.error instanceof Error
            ? routeMutation.error.message
            : 'Unable to route the print-job swarm.'}
        </div>
      ) : null}

      {(query.data?.errors?.length ?? 0) > 0 ? (
        <div className="mt-2 text-[10px] text-red-700">
          {query.data?.errors?.length} job projection(s) were rejected and
          isolated.
        </div>
      ) : null}
    </section>
  )
}
