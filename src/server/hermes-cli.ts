import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'

type HermesCliCandidateOptions = {
  home?: string
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
}

export function buildHermesCliCandidates(
  options: HermesCliCandidateOptions = {},
): Array<string> {
  const home = options.home ?? homedir()
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env
  const agentRoots = [
    env.HERMES_AGENT_PATH,
    env.HERMES_AGENT_REPO,
    platform === 'win32' && env.LOCALAPPDATA
      ? join(env.LOCALAPPDATA, 'hermes', 'hermes-agent')
      : null,
    join(home, '.hermes', 'hermes-agent'),
  ].filter((value): value is string => Boolean(value))
  const venvExecutable =
    platform === 'win32'
      ? ['venv', 'Scripts', 'hermes.exe']
      : ['venv', 'bin', 'hermes']
  const repoVenvExecutable =
    platform === 'win32'
      ? ['.venv', 'Scripts', 'hermes.exe']
      : ['.venv', 'bin', 'hermes']

  return [
    env.HERMES_CLI_PATH,
    env.HERMES_CLI_BIN,
    ...agentRoots.flatMap((root) => [
      join(root, ...venvExecutable),
      join(root, ...repoVenvExecutable),
    ]),
    join(home, '.local', 'bin', 'hermes'),
    'hermes',
  ].filter((value): value is string => Boolean(value))
}

export function selectHermesCliCandidate(
  candidates: Array<string>,
  fileExists: (candidate: string) => boolean = existsSync,
): string {
  for (const candidate of candidates) {
    const isExplicitPath =
      isAbsolute(candidate) ||
      candidate.includes('/') ||
      candidate.includes('\\')
    if (isExplicitPath) {
      if (fileExists(candidate)) return candidate
      continue
    }
    return candidate
  }
  return 'hermes'
}

export function resolveHermesCliBin(
  options: HermesCliCandidateOptions = {},
): string {
  return selectHermesCliCandidate(buildHermesCliCandidates(options))
}
