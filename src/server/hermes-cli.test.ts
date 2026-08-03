import { describe, expect, it } from 'vitest'

import {
  buildHermesCliCandidates,
  selectHermesCliCandidate,
} from './hermes-cli'

describe('selectHermesCliCandidate', () => {
  it('does not mistake a missing Windows path for a PATH command', () => {
    expect(
      selectHermesCliCandidate(
        [
          String.raw`C:\Users\adam\.hermes\hermes-agent\venv\bin\hermes`,
          'hermes',
        ],
        () => false,
      ),
    ).toBe('hermes')
  })

  it('selects the first existing explicit executable', () => {
    const installed = String.raw`C:\Users\adam\bin\hermes.exe`
    expect(
      selectHermesCliCandidate(
        [String.raw`C:\missing\hermes.exe`, installed, 'hermes'],
        (candidate) => candidate === installed,
      ),
    ).toBe(installed)
  })
})

describe('buildHermesCliCandidates', () => {
  it('includes the Windows virtualenv location before PATH fallback', () => {
    const candidates = buildHermesCliCandidates({
      home: String.raw`C:\Users\adam`,
      platform: 'win32',
      env: { LOCALAPPDATA: String.raw`C:\Users\adam\AppData\Local` },
    })

    expect(candidates).toContain(
      String.raw`C:\Users\adam\AppData\Local\hermes\hermes-agent\venv\Scripts\hermes.exe`,
    )
    expect(candidates).toContain(
      String.raw`C:\Users\adam\.hermes\hermes-agent\venv\Scripts\hermes.exe`,
    )
    expect(candidates.at(-1)).toBe('hermes')
  })

  it('honors the Workspace HERMES_CLI_PATH override first', () => {
    const cliPath = String.raw`C:\Hermes\hermes.exe`
    expect(
      buildHermesCliCandidates({
        home: String.raw`C:\Users\adam`,
        platform: 'win32',
        env: { HERMES_CLI_PATH: cliPath },
      }).at(0),
    ).toBe(cliPath)
  })
})
