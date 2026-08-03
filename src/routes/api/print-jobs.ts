import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  PrintJobConductorError,
  listPrintJobProjections,
  readPrintJobProjection,
  readPrintPipelineDoctor,
  resolvePrintAnythingEnvironment,
} from '../../server/print-job-conductor'

function parsePositiveInteger(
  value: string | null,
  fallback: number,
): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function publicEnvironment() {
  const environment = resolvePrintAnythingEnvironment()
  return {
    repoConfigured: environment.repoExists,
    conductorAvailable: environment.conductorExists,
    jobsRootAvailable: environment.jobsRootExists,
  }
}

function errorResponse(error: unknown) {
  const adapterError =
    error instanceof PrintJobConductorError
      ? error
      : new PrintJobConductorError(
          'PRINT_JOB_ADAPTER_FAILED',
          error instanceof Error ? error.message : String(error),
          500,
        )
  return json(
    {
      ok: false,
      error: { code: adapterError.code, message: adapterError.message },
    },
    { status: adapterError.status },
  )
}

export const Route = createFileRoute('/api/print-jobs')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json(
            {
              ok: false,
              error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
            },
            { status: 401 },
          )
        }

        const url = new URL(request.url)
        const jobId = url.searchParams.get('jobId')?.trim()
        const includeDoctor =
          url.searchParams.get('includeDoctor') !== 'false'
        try {
          const doctor = includeDoctor
            ? await readPrintPipelineDoctor()
            : undefined
          if (jobId) {
            return json({
              ok: true,
              schema: 'print-anything-workspace-projection.v1',
              data: [await readPrintJobProjection(jobId)],
              errors: [],
              pagination: {
                page: 1,
                pageSize: 1,
                totalItems: 1,
                totalPages: 1,
              },
              doctor,
              environment: publicEnvironment(),
            })
          }
          const result = await listPrintJobProjections({
            page: parsePositiveInteger(url.searchParams.get('page'), 1),
            pageSize: parsePositiveInteger(
              url.searchParams.get('pageSize'),
              20,
            ),
          })
          return json({
            ok: true,
            schema: 'print-anything-workspace-projection.v1',
            ...result,
            doctor,
            environment: publicEnvironment(),
          })
        } catch (error) {
          return errorResponse(error)
        }
      },
    },
  },
})
