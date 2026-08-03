# Fabrication checkpoint — passive snap-track canonical gate

Mission: `mission-ms10qw8e-o5o3hk`  
Worker: Fabrication — 3D Fabrication / Manufacturing Evidence Gate  
Date: 2026-07-25  
Lane result: completed evidence-gate review; canonical pipeline blocked before provider execution

## Exact historical artifact inspected

- Candidate root: `C:\Users\madph\Documents\Projects\orcaslicer\spikes\014-passive-snap-track\proof-cycle5-refined`
- Procedural source: `C:\Users\madph\Documents\Projects\orcaslicer\spikes\014-passive-snap-track\build_passive_track.py`
- Blender scene: `passive-snap-track.blend`
- Blender scene SHA-256: `14da57d5c130ba7581b85e6012945c3f7171456222637956f478dfab09d4cf0e`
- Plate STL: `passive-snap-track-plate.stl`
- Plate STL SHA-256: `a0404772ee97159985ae707380b9c1b974f7738447bfce8719ab3b2aabdabfa7`
- Colored 3MF: `passive-snap-track-colored.3mf`
- Colored 3MF SHA-256: `facbbd19fc928182ee5070cd9b0af74fb5a66987c687d4472be3bb3185910902`
- Engineering report SHA-256: `152304d83a608004d4a8ca50225974e29d589366398584b908d0a4d83dfd40bf`
- All 13 files listed by `artifact-manifest.json` independently matched both recorded SHA-256 and byte count.

This is historical spike evidence, not a conductor-owned production artifact.

## Canonical pipeline result

Canonical job inspected:
`C:\Users\madph\Documents\Projects\orcaslicer\mcp-workdir\print-jobs\hermes-workspace-integration-20260725`

- `doctor`: `passed=true`; `consolidation_complete=false`.
- Projection schema: `print-anything-job-projection.v1`.
- Projection is read-only: `true`.
- Manifest SHA-256: `2e20925a38786f9eb9a114b69a44f12f6178876b780f7e5f2928cb1947b766b7`.
- Stage-ledger SHA-256: `8b29ef56252ff4d2b156bed77039a942fbb010b47604b83816c18571a575a7dc`.
- Pipeline-registry SHA-256: `e41f31c2ef431a4844cf5688be9d780c66ae38f967259debba314e4a7d9e7066`.
- Current stage: S0.
- S0-S11: all `BLOCKED`; zero evidence.
- Compiled semantic contract: missing.
- Pre-model baseline: missing.
- Phase A approval: missing.
- Phase B approval: missing.
- `model_start_authorized=false`.
- `model-start-check`: `ready=false`.

Therefore no Blender S7/S8 provider request, independent Blender scene load,
fresh geometry export, Orca S9 provider request, or fresh slice was executed.
Doing so would bypass the canonical conductor and the worker contract.

## Historical evidence reviewed

The historical report claims:

- 28 links at 10 mm pitch, M1 adult hand-manipulated demonstrator.
- Link mesh: 2,291 vertices, 4,578 faces, one component, zero reported
  non-manifold edges, 877.55 mm3.
- Forward/reverse analytic sweep: 450 samples per revolution; maximum pitch
  error 0.11128 mm; maximum articulation 29.658 degrees against 35 degrees.
- Solid wheel/link check: 42 phase samples; intended wheel contact detected;
  zero forbidden core-proxy overlap; oversized-core positive control detected.
- Nominal snap clearance: 0.30 mm diametral hypothesis.
- Nominal BB radial clearance: 0.35 mm hypothesis.
- Physical fit, retention, wear, force, fatigue, derailment and 500-cycle life:
  `UNVERIFIED`.

Historical generic slice:

- Orca binary: `C:\Users\madph\AppData\Local\Programs\OrcaSlicer\orca-slicer.exe`.
- Machine: `MyKlipper 0.4 nozzle`, nozzle 0.4 mm.
- Process: `0.20mm Standard @MyKlipper`.
- Filament: `Generic PLA @System`, 1.75 mm, max volumetric speed 12 mm3/s,
  plate temperatures recorded as 55 C.
- Effective process values independently read from the flattened profile:
  0.20 mm layer, 3 walls, 4 top layers, 3 bottom layers, 15% crosshatch,
  supports disabled.
- Existing G-code: 15,990,787 bytes; 213 layers; max Z 42.6 mm; 50.86 g;
  17,053.99 mm filament; estimated 3h31m11s.

## Defects and remediation

### F1 — no canonical tank-track job or approved baseline

- Root cause: the historical spike was never compiled into the sole conductor
  control plane; the only job is a Workspace integration proof with no contract.
- Earliest prevention stage: S0 intake/authority.
- Immediate fix: initialize a dedicated tank-track job, plan the exact umbrella
  contract, validate whole-BOM and prevention plans, close S0-S5, and obtain
  Adam's exact hash-bound Phase A and Phase B approvals.
- Systemic fix: promote this mechanism method from the spike tree into a
  registered provider and golden conductor job.
- Detector: `project`, `status --through S0`, and `model-start-check`.
- Known-bad positive control: the current job, which correctly returns
  `model_start_authorized=false`.
- Regression: require every Blender/Orca provider request for this subject to
  bind the approved baseline hash.

### F2 — slice settings contradict the claimed per-part manufacturing plan

- Root cause: the historical plate was sliced as one STL with a generic process
  profile; the effective profile is 3 walls, 4/3 shells and 15% crosshatch,
  while the engineering plan requests 4-5 walls, 5/5 or 6/6 shells, 25-40%
  gyroid by part.
- Earliest prevention stage: S4 engineering architecture and S9 exact
  manufacturing preflight.
- Immediate fix: preserve semantic parts in a conductor-owned 3MF, apply
  explicit per-object settings/modifiers, then slice the exact H2D/nozzle/
  plate/filament/profile tuple and inspect critical extrusion paths.
- Systemic fix: add a report check that compares requested per-part settings
  with effective sliced object settings and fails on drift.
- Detector: flattened-profile comparison plus Orca object-setting/toolpath
  inspection.
- Known-bad positive control: the existing monolithic MyKlipper plate slice.
- Regression: assert critical regions meet declared extrusion counts and the
  report records effective rather than requested settings.

### F3 — Blender evidence is generated, not independent

- Root cause: the procedural builder produced the scene, meshes, motion checks
  and report in one lane; the prior independent Blender probe timed out.
- Earliest prevention stage: S8 digital validation.
- Immediate fix: after model-start authorization, create a separate Blender
  validation provider request and reopen the immutable scene to check units,
  transforms, origins, collections, modifiers, normals, degenerates,
  self-intersections, minimum wall/feature size and actual-mesh clearance.
- Systemic fix: use an independent validator and known-bad mesh fixtures.
- Detector: clean Blender reopen plus evaluated-mesh/BVH and thickness checks.
- Known-bad positive controls: forced collision, flipped normals, degenerate
  face, disconnected shell and below-minimum-wall fixtures.
- Regression: require independent validation JSON and scene hash match before S8.

### F4 — motion/contact proof is discretized and incomplete

- Root cause: adjacent-link clearance is a center-envelope approximation and
  wheel contact uses 42 discrete phase samples with a core proxy.
- Earliest prevention stage: S4 architecture and S8 digital validation.
- Immediate fix: run full actual-solid adjacent/non-neighbor/link-wheel sweeps
  in both directions with adaptive refinement, explicit minimum clearance,
  adverse XY/Z growth, containment, and assembly/service envelope checks.
- Systemic fix: add mesh-level wrong-pitch, fused-joint, missing-retention,
  exhausted-tensioner and impossible-service positive controls.
- Detector: evaluated-mesh BVH plus distance/containment checks.
- Regression: retain exact failing pose, clearance and body IDs.

### F5 — material and production tuple remain hypotheses

- Root cause: generic PLA/MyKlipper evidence is not the contracted H2D tuple,
  and BB/filament axle lots are unmeasured.
- Earliest prevention stage: S4 architecture, S6 coupons and S9 preflight.
- Immediate fix: bind exact H2D hardware, nozzle, plate, PLA product/color/lot/
  conditioning/calibration tuple; measure 1.75 mm axle stock and 5.95 mm BB lot;
  slice and inspect snap/race coupons first.
- Systemic fix: require the capability/calibration registry and lot-bound
  coupon evidence before production clearance selection.
- Detector: exact-tuple registry plus measured coupon report.
- Known-bad positive controls: interference and excessive-looseness ladder ends.
- Regression: nominal clearance cannot be promoted until measured coupon pass.

## Highest verified tier

`MESH` for immutable historical artifacts and self-reported digital checks.
The historical generic toolpath separately reaches `SLICED_GENERIC`, not exact
production slice readiness. Assembly geometry, production slice, coupon
calibration, physical function, durability and release remain unverified.

## Exact next conductor action

Orchestrator should initialize a dedicated job:

`python .\.agents\skills\build-printable-decor-models\scripts\print_job_conductor.py init .\mcp-workdir\print-jobs passive-snap-track-20260725 "Passive Snap-Track Toy Demonstrator"`

Then compile the existing umbrella contract into that job and stop for the
required interactive Phase A/Phase B closure and Adam's hash-bound approvals.
No approval, release, or printer action was performed.
