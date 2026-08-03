# Print-anything Conductor integration: five-cycle audit

Date: 2026-07-25

Scope: integrate Hermes Workspace Conductor/Swarm with the canonical Orca
print-anything conductor as a read-only evidence and routing surface. Orca
remains the only authority for stage gates, accepted evidence, approvals,
release, and physical print actions.

Canonical proof job:

- Job: `hermes-workspace-integration-20260725`
- Job directory:
  `C:\Users\madph\Documents\Projects\orcaslicer\mcp-workdir\print-jobs\hermes-workspace-integration-20260725`
- Manifest SHA-256:
  `2e20925a38786f9eb9a114b69a44f12f6178876b780f7e5f2928cb1947b766b7`
- Stage-ledger SHA-256:
  `8b29ef56252ff4d2b156bed77039a942fbb010b47604b83816c18571a575a7dc`
- Pipeline-registry SHA-256:
  `e41f31c2ef431a4844cf5688be9d780c66ae38f967259debba314e4a7d9e7066`
- Current gate: S0
- Model start: unauthorized
- Release: not released
- Physical action: none

## Cycle 1: architecture and authority boundary

- Mapped Workspace Conductor, native Swarm, roster/profile, checkpoint, and
  Kanban paths against the Orca conductor.
- Rejected Workspace-owned print stage state and retained the Orca projection
  as the only job truth.
- Established separate hard and advisory lanes.
- Baseline focused result: 33 tests passed.

## Cycle 2: consolidation and schema hardening

- Consolidated on `src/server/print-job-conductor.ts`.
- Added strict projection identity, path containment, S0-S11 order/completeness,
  read-only, cross-field authority, and corrupt-job isolation checks.
- Removed redundant print adapter/routes.
- Focused result after fixture repair: 35 tests passed.

## Cycle 3: UI and production build

- Added the read-only print-job panel to Swarm and bounded routing through
  `/api/conductor-spawn`.
- Confirmed no card state can approve, release, advance, or authorize model
  generation.
- Client and SSR production build passed.

## Cycle 4: adversarial mission semantics

- Prevented advisory local/readiness failures from blocking a completed hard
  quorum.
- Removed fake review/dependency gates and made S0 routing stage-aware.
- Required exact six-label worker checkpoints and separated lane execution
  state from product gate verdict.
- Added post-dispatch checkpoint freshness controls.
- Adversarial result: 53 tests passed; the emitted duplicate concurrency
  option was removed.

## Cycle 5: live Conductor/Swarm execution and repair

Observed and corrected:

1. A Workspace restart could strand dispatched assignments.
   - Added post-dispatch runtime/chat recovery and a 600-second recovery
     timeout.
2. Wrapperless Windows workers attempted an extensionless Hermes command.
   - Resolved the installed venv `hermes.exe`.
3. Long one-shot prompts raised Windows `spawn EINVAL`.
   - Bounded startup memory and stream the query through the venv Python
     process instead of argv.
4. Back-to-back Windows process starts reproduced `spawn EINVAL` in the second
   lane.
   - Added a 750 ms launch stagger while retaining concurrency two after
     startup.
5. A product gate failure was incorrectly reported as a blocked worker lane.
   - Worker instructions now require `DONE` when the lane successfully proves
     that the product remains gated.

Positive transport proof:

- Mission: `fabrication-stdin-proof-1785017830`
- State: complete
- Fabrication checkpoint: DONE
- Verified the deployed `fabrication-core` skill from both the source and
  runtime profile paths.

Final clean mission:

- Mission:
  `print-hermes-workspace-integration-20260725-2e20925a3878-8b29ef56252f-e41f31c2ef43-retry-1785017988019`
- State: complete
- Orchestrator: DONE
- Fabrication: DONE
- KM Agent: DONE
- Concurrency: two, with staggered Windows launches
- Product state retained: S0 blocked, zero accepted evidence, model start
  unauthorized, approvals blocked, no provider runs, no release, no physical
  action.

## Evidence boundary

- Final focused verification: 14 files, 100 tests passed.
- Final client and SSR production build passed. Existing Vite sourcemap,
  dynamic-import, and chunk-size warnings remain non-fatal.
- Live Workspace, gateway, and dashboard listeners were present; authenticated
  `/api/print-jobs` returned the canonical job with zero adapter errors.
- Orca `doctor` passed with `consolidation_complete=false` and
  `physical_action_performed=false`.
- Live API and durable mission-store behavior were exercised.
- No Blender/model generation, slicing, approval, release, or physical printer
  action was authorized or performed.
- In-app browser discovery returned no connected browser, so browser-rendered
  visual proof is unavailable.
- Dashboard Conductor capability was unavailable; the documented Workspace
  native-Swarm fallback was used.
- Orca reports `consolidation_complete=false`; this integration does not claim
  to close that separate canonical program-level status.
