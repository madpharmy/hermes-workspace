# Fabrication checkpoint — Hermes Workspace print-pipeline integration proof

- Worker: Fabrication — 3D Fabrication / Manufacturing Evidence Gate
- Mission: `print-hermes-workspace-integration-20260725-1785016135073`
- Canonical job: `hermes-workspace-integration-20260725`
- Canonical job directory: `C:\Users\madph\Documents\Projects\orcaslicer\mcp-workdir\print-jobs\hermes-workspace-integration-20260725`
- Checkpoint time: 2026-07-25
- Authority: advisory Workspace projection only

## Canonical conductor evidence

The job was read only through the canonical Orca conductor `project`, `status`,
and `doctor` operations.

| Check | Observed |
|---|---|
| Projection schema | `print-anything-job-projection.v1` |
| Read-only projection | `true` |
| Manifest SHA-256 | `2e20925a38786f9eb9a114b69a44f12f6178876b780f7e5f2928cb1947b766b7` |
| Stage-ledger SHA-256 | `8b29ef56252ff4d2b156bed77039a942fbb010b47604b83816c18571a575a7dc` |
| Pipeline-registry SHA-256 | `e41f31c2ef431a4844cf5688be9d780c66ae38f967259debba314e4a7d9e7066` |
| Ledger valid | `true` |
| Provider bindings valid | `true` (0 checked) |
| Current / first blocking stage | `S0` / `S0` |
| S0 evidence count | `0` |
| Pipeline passed | `false` |
| Advance allowed | `false` |
| Model start authorized | `false` |
| Release | `NOT_RELEASED` |
| Physical action performed | `false` |
| Doctor | `passed=true`, `consolidation_complete=false` |

All three assignment hashes match the canonical projection.

## Fabrication coverage

No part, BOM, interface, material allocation, orientation, support plan,
editable source, fabrication twin, profile tuple, slice, coupon, or physical
artifact is present or authorized at S0. Therefore:

- whole-BOM and ownership reconciliation: `UNVERIFIED`;
- mechanical interfaces, datums, clearances, retention, and motion: `UNVERIFIED`;
- material product/color/state and under-/over-material checks: `UNVERIFIED`;
- orientation, supports, walls, closures, infill, seams, purge, and finish:
  `UNVERIFIED`;
- Blender geometry/topology/motion evidence: `UNVERIFIED`;
- Orca exact-tuple slice readiness and G-code metadata: `UNVERIFIED`;
- coupon and measured physical fit/strength/motion/finish/color evidence:
  `UNVERIFIED`.

No Blender or Orca provider was invoked because there is no conductor-created
provider request and the pre-model gate is closed.

## Blocking finding

**F-S0-001 — Intake and authority evidence is absent**

- Root cause: the canonical job has no compiled semantic contract, no
  pre-model baseline, no Phase A approval, no Phase B approval, and S0 has zero
  evidence.
- Earliest prevention stage: S0, Intake and authority.
- Immediate fix: complete the canonical S0 intake/authority artifacts and bind
  them through a conductor-owned operation; do not model or slice.
- Systemic fix: finish the conductor state-machine migration so evidence
  attachment and stage transitions are conductor-owned rather than requiring
  manually writable state.
- Detector: `project` reports `pre_model_gate.model_start_authorized=false`;
  `status` reports `first_blocking_stage=S0` and `advance_allowed=false`.
- Known-bad positive control: a job with no semantic contract, baseline, or
  approvals must remain blocked at S0 and must reject model start.
- Regression: rerun `project`, `status`, and `doctor`; require hash-bound S0
  evidence and closure without weakening the pre-model gate.

`consolidation_complete=false` is a documented migration limitation, not a
transport or doctor failure.

## Required checkpoint

STATE: BLOCKED

FILES_CHANGED: `C:\Users\madph\Documents\Projects\hermes-workspace\memory\swarm\missions\print-hermes-workspace-integration-20260725-1785016135073\fabrication-checkpoint-20260725.md`

COMMANDS_RUN:

1. `python C:\Users\madph\Documents\Projects\orcaslicer\.agents\skills\build-printable-decor-models\scripts\print_job_conductor.py project C:\Users\madph\Documents\Projects\orcaslicer\mcp-workdir\print-jobs\hermes-workspace-integration-20260725`
2. `python C:\Users\madph\Documents\Projects\orcaslicer\.agents\skills\build-printable-decor-models\scripts\print_job_conductor.py status C:\Users\madph\Documents\Projects\orcaslicer\mcp-workdir\print-jobs\hermes-workspace-integration-20260725`
3. `python C:\Users\madph\Documents\Projects\orcaslicer\.agents\skills\build-printable-decor-models\scripts\print_job_conductor.py doctor C:\Users\madph\Documents\Projects\orcaslicer\mcp-workdir\print-jobs\hermes-workspace-integration-20260725` (rejected: `doctor` accepts no job argument)
4. `python C:\Users\madph\Documents\Projects\orcaslicer\.agents\skills\build-printable-decor-models\scripts\print_job_conductor.py doctor`

RESULT: Canonical projection integrity is verified and all supplied hashes
match. The doctor passes, the ledger and provider bindings are valid, and no
physical action occurred. The manufacturing evidence gate remains blocked at
S0 with all part/interface/material/slice/physical claims unverified.

BLOCKER: S0 has zero evidence and there is no compiled semantic contract,
pre-model baseline, Phase A approval, or Phase B approval. The current
conductor surface exposes no worker-safe evidence-attachment/stage-transition
operation for Fabrication to resolve this without exceeding authority.

NEXT_ACTION: Orchestrator should route completion of the S0 intake/authority
artifact through the canonical Orca conductor. After S0 is canonically updated,
rerun `project`, `status`, and `doctor`; do not request Fabrication provider work
until a conductor-created provider request exists, and do not model until
`pre_model_gate.model_start_authorized` is exactly `true`.
