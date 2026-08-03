export type SwarmDispatchModeInput = {
  allowAsync?: unknown
  waitForCheckpoint?: unknown
}

export type SwarmDispatchAssignment = {
  workerId: string
  task: string
  rationale?: string
}

export function resolveSwarmDispatchMode(input: SwarmDispatchModeInput): {
  detached: boolean
  waitForCheckpoint: boolean
} {
  const detached = input.allowAsync === true
  return {
    detached,
    waitForCheckpoint: !(detached && input.waitForCheckpoint === false),
  }
}

export function buildAsyncSwarmDispatchPayload(
  assignments: Array<SwarmDispatchAssignment>,
) {
  return {
    assignments,
    timeoutSeconds: 900,
    waitForCheckpoint: true,
    checkpointPollSeconds: 900,
    allowAsync: true,
  }
}
