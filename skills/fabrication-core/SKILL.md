---
name: fabrication-core
description: Inspect, challenge, execute, and verify bounded 3D-print fabrication stages through OrcaSlicer's canonical print-job conductor. Use for printable-object BOMs, interfaces, material allocation, orientation, supports, geometry and motion checks, Orca profile and slice readiness, provider-envelope handoffs, or physical-evidence review inside the Hermes fabrication worker.
---

# Fabrication Core

Treat OrcaSlicer's `print_job_conductor.py`, job manifest, and stage ledger as
the sole fabrication authority. Hermes Workspace is a projection and routing
surface only.

## Start

1. Read the job through `print_job_conductor.py project <job-dir>`.
2. Verify the projection schema is `print-anything-job-projection.v1`,
   `read_only=true`, and the supplied manifest, ledger, and registry hashes
   match the assignment.
3. Run `doctor` before resuming provider work. Report
   `consolidation_complete=false` as a limitation, not a transport failure.
4. Stop authoring when `pre_model_gate.model_start_authorized` is not exactly
   `true`.

Never edit `manifest.json` or `stage-gates.json`. Never record Adam's approval,
advance a stage, release a product, or authorize a physical action.

## Evaluate the complete fabrication system

For every assigned part and interface, check:

- printed, purchased, consumable, sacrificial, and print-in-place ownership;
- material product/color/state, orientation, supports, walls, closures, infill,
  local reinforcement, plate finish, seams, purge, and post-processing;
- under-material and over-material risks at each functional region;
- datums, clearances, retention, assembly/release path, service, wear, creep,
  fatigue, heat, and adverse conditions;
- editable source, fabrication twin, export, profile, slice, coupon, and
  physical evidence as separate claims.

Prefer standard or hybrid machine elements when measured load, alignment, wear,
runout, duty, heat, life, or safety rejects a printed substitute. Do not assume
metal hardware, print-in-place construction, or universal clearance.

## Use provider envelopes

Invoke Blender, TRELLIS, Orca, or local-model work only from a conductor-created
provider request. Write inside its declared output root, then return results
through `provider-result` and `provider-accept`. Do not insert approval, stage,
job-state, physical-authorization, or release fields into a provider result.

Use applicable local image generation, blind-first image analysis, and
structured inference as bounded champion/challenger lanes. Record model/runtime
provenance, task metrics, timeout, quorum, losing results, and limitations.
Continue after an advisory lane outage when minimum valid-result quorum remains;
block only on a missing hard requirement.

## Return evidence

Return a structured Workspace checkpoint with:

- exact job and artifact hashes;
- commands/tools/versions and outcome;
- part/interface coverage;
- defects with root cause, earliest prevention stage, immediate and systemic
  fixes, detector, known-bad positive control, and regression;
- highest verified evidence tier and explicit unverified claims;
- the exact next conductor operation or smallest blocker.

A successful slice does not prove physical fit, strength, motion, finish, color,
or safety. Keep physical evidence `UNVERIFIED` unless Adam separately authorized
the exact print and measured evidence exists.
