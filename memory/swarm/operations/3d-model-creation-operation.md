# Printable-object workflow authority

This path is a non-operational tombstone. The former Workspace-owned 3D DAG was
archived to:

`memory\archive\3d-model-creation-operation.superseded.md`

All new and resumed printable-object work is controlled exclusively by
OrcaSlicer's `print_job_conductor.py`, its manifest and stage ledger, and
`print-anything-job-projection.v1` under
`orcaslicer\mcp-workdir\print-jobs`.

Hermes Workspace may:

- read and display the canonical projection;
- route hash-bound advisory or execution workers selected by the conductor
  plan;
- store worker reports and checkpoints.

Hermes Workspace must not:

- create or advance a competing stage ledger;
- grant Phase A, Phase B, release, or physical-print approval;
- mutate canonical Orca job state through board cards or worker reports;
- model before `pre_model_gate.model_start_authorized` is true;
- start a physical print.

The Orca repository's
`.agents\skills\build-printable-decor-models\references\3d-pipeline-component-registry.v1.json`
is the component, ownership, legacy, and removal-gate source of truth.
