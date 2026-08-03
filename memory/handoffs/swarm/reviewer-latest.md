STATE: BLOCKED
FILES_CHANGED: C:\Users\madph\Documents\Projects\hermes-workspace\memory\handoffs\swarm\reviewer-latest.md; C:\Users\madph\AppData\Local\hermes\profiles\reviewer\memory\handoffs\mission-mrzxxgp9-jfx467-pre-mutation-gate.md; reviewer-only probes at C:\Users\madph\AppData\Local\Temp\reviewer_blend_scene_probe.py and C:\Users\madph\AppData\Local\Temp\reviewer_assembly_bounds_probe.py. Product source/artifacts changed: none.
COMMANDS_RUN: `"/c/Program Files/Blender Foundation/Blender 5.1/blender.exe" --background "C:/Users/madph/Documents/Projects/orcaslicer/spikes/014-passive-snap-track/proof-cycle5-refined/passive-snap-track.blend" --python-exit-code 1 --python "C:/Users/madph/AppData/Local/Temp/reviewer_blend_scene_probe.py"`; `"/c/Program Files/Blender Foundation/Blender 5.1/blender.exe" --background "C:/Users/madph/Documents/Projects/orcaslicer/spikes/014-passive-snap-track/proof-cycle5-refined/passive-snap-track.blend" --python-exit-code 1 --python "C:/Users/madph/AppData/Local/Temp/reviewer_assembly_bounds_probe.py"`; Python SHA-256 comparison of same-named top-level files in `proof-cycle5-refined` and `C:/Users/madph/AppData/Local/Temp/qa-passive-track-rebuild-20260725-010912`; Python/Pillow pixel-payload and `zipfile` 3MF-member comparisons over those two directories; `git status --short -- memory/handoffs/swarm/reviewer-latest.md`; `git diff --check -- memory/handoffs/swarm/reviewer-latest.md`.
RESULT: PRE-MUTATION MERGE GATE = BLOCK. The current candidate is reproducible at STL/report and canonical PNG/3MF-content level, but it does not satisfy its approved envelope, source-scene, motion-proof, production-slice, physical-validation, or release-evidence requirements. No mutation or release promotion is approved. A new isolated attempt may proceed only after the plan incorporates the required controls below.
BLOCKER: Current plan and candidate have critical logic/evidence gaps. Exact blockers follow.
NEXT_ACTION: Orchestrator must amend the build plan with the mandatory controls below, then dispatch the resulting immutable attempt back to reviewer for diff, artifact, two-build reproducibility, Blender-scene, motion/collision, slicer, and acceptance-matrix verification.

# Independent merge/quality gate — passive snap-track

Review target:
- C:\Users\madph\Documents\Projects\orcaslicer\spikes\014-passive-snap-track\proof-cycle5-refined
- Candidate Blend SHA-256: 14da57d5c130ba7581b85e6012945c3f7171456222637956f478dfab09d4cf0e
- Builder: build_passive_track.py
- Contract: print-anything-design-contract.v1.json

## Blocking findings

### CRITICAL — the envelope gate does not enforce the approved envelope

The report declares an approved target of [127, 20, 51] mm at engineering-report.json:6-11, but its own calculated envelope is [127.95, 20.0, 48.64] at lines 24-28. The implementation still passes because build_passive_track.py:776-779 silently relaxes length to 132 mm and checks only two analytic dimensions.

Independent bounds from the saved assembled objects are [125.8415, 34.0, 56.7470] Blender-coordinate units. With the builder's intended millimeter convention, the assembled geometry exceeds the declared 20 mm thickness by 14 mm and the 51 mm height by about 5.747 mm. The analytic gate omits the frame, axle, retainer, and/or link extents that determine the real union bounds. This is a contract failure, not an optimization opportunity.

Required fix: compute evaluated world-space union bounds from the exact assembled release object set; map axes explicitly; compare all three dimensions against the approved maxima with no hidden tolerance. Any tolerance must be contract-approved and recorded, not named `ish`.

### CRITICAL — the motion/contact gate is not a non-interference proof

engineering-report.json:30-44 labels the motion check an analytic center-envelope sweep and reports a 1.25 mm sample step. build_passive_track.py:743 accepts `actual_solid_wheel_link_contact_phase_sweep`, while the report's `actual_solid_contact` treats 1,349-2,560 triangle overlap pairs per sampled phase as success. The implementation proves neither clearance nor penetration depth and classifies only a proxy core as forbidden. `non_neighbor_center_envelopes_clear` checks center envelopes rather than the evaluated link/frame/wheel/retainer meshes.

Required fix: use joint-constrained poses of the exact evaluated fabrication meshes; distinguish allowed contact surfaces from forbidden penetrations; report signed/minimum clearances or penetration depth with explicit thresholds; check link-link, link-wheel, link-frame/retainer, wheel-frame/retainer, axle/cap/service-path classes; bound between-sample motion; include positive controls that introduce known collisions and must fail. BVH overlap cardinality by itself cannot be called successful physical contact.

### CRITICAL — release manufacturing evidence is absent

The exact H2D slice in proof-cycle5-pass/slices-h2d/slice-report.json failed with exit code 3221225477 (0xC0000005), produced no G-code, and has `passed: false`. proof-cycle5-refined contains only a generic MyKlipper/Generic PLA hermetic slice. The engineering report itself says physical cycling is required for release and explicitly states no physical print was observed.

Required fix: do not promote to production/release. Obtain a successful attributable H2D/nozzle/plate/process/material slice plus critical-layer preview evidence. Physical fit, snap force/retention, BB retention/serviceability, derailment, wear, and 500-cycle qualification remain separate hard release gates and must stay NOT_RUN until actually executed.

### HIGH — editable source uses meter units for millimeter-valued geometry

Fresh Blender 5.1 inspection reports `system=METRIC`, `scale_length=1.0`, and `length_unit=METERS`; the builder creates geometry using values intended as millimeters. Export payloads are numerically usable because STL is emitted without scene-unit scaling and 3MF is labelled millimeter, but the `.blend` source itself is dimensionally ambiguous/wrong for downstream editing.

Required fix: set and assert `METRIC`, `scale_length=0.001`, `length_unit=MILLIMETERS`; round-trip-check key dimensions from the saved file and from every export.

### HIGH — the contract and generated calibration ladder disagree

print-anything-design-contract.v1.json:75 approves snap-clearance candidates 0.00, 0.15, 0.30, 0.45, and 0.75 mm. build_passive_track.py:670 uses 0.00, 0.15, 0.30, 0.45, and 0.60 mm; the 3MF and engineering report contain 0.60, not 0.75. The current `coupon_ladders_bracket_tight_and_loose` gate checks only list lengths, so it cannot detect this contract regression.

Required fix: make parameters single-source-of-truth from a validated config/contract and compare exact approved arrays, not cardinality.

### HIGH — source/evaluated/export ownership and editability are absent

Fresh scene inspection found 116 mesh objects, one generic collection, no active camera, no modifiers, no ownership tags, 28 unique mesh datablocks for 28 assembled links, and 28 more unique meshes for 28 plate links. On reopen, only the 44 plate meshes are render-visible. There is no MASTER/KINEMATIC/FABRICATION/PLATE/COUPONS/PURCHASED_REFERENCE/CAMERAS/LIGHTS separation and no editable construction stack.

Required fix: preserve an editable master separately from applied fabrication meshes; use task-owned semantic collections; instance repeated immutable geometry where appropriate; save explicit diagnostic cameras and a deliberate default visibility state; validate all named objects/collections after reopen.

### HIGH — current build/output behavior is not safe enough for iterative mutation

build_passive_track.py:94-98 globally deletes all scene objects, and main() reuses an existing output directory via `mkdir(..., exist_ok=True)` at lines 620-623. Unknown stale files survive and are then included by the manifest. Run-PassiveSnapTrackProof.ps1 recursively deletes its default proof directory before rebuilding.

Required fix: run only with `--factory-startup`; create a unique immutable attempt directory and fail if it exists; never load or delete the accepted candidate; scope cleanup to task-owned collections; stage outputs in a new temporary directory and atomically seal them only after every gate passes.

### HIGH — byte-for-byte reproducibility is not currently demonstrated

An independent fresh Blender rebuild reproduced exact SHA-256 for all STL files and engineering-report.json. However, all four PNGs, both 3MF archives, the Blend file, and manifest had different byte hashes. PNG pixel hashes were identical, and 3MF member payloads were identical; the 3MF ZIP timestamps differed. This demonstrates canonical content reproducibility for those artifacts, not exact artifact-hash reproducibility.

Required fix: either normalize ZIP/PNG metadata and path-dependent Blend state to make byte hashes deterministic, or define and implement canonical hashes (pixel payload, sorted 3MF member payloads, scene semantic digest) and state the claim precisely. Do not claim exact artifact hashes when only semantic content is stable.

### MEDIUM — evidence state and manifest are stale/incomplete

engineering-report.json:3 says a fresh Orca slice is pending despite a colocated passing hermetic slice report. The top-level artifact manifest is generated before slicing and does not attest the slice outputs or exact profile hashes. The report and manifest therefore do not describe one sealed candidate state.

Required fix: generate the final report and manifest last; include source/config/profile hashes, Blender/Orca versions, command line, candidate path/run id, every release artifact, every slice report/G-code, gate status, and known limitations. Verify the manifest from a fresh process.

### MEDIUM — known-unknown ledger is not truthful enough

The approved contract records an empty `knowledge_gaps` array while the report lists unverified material lot, BB lot/dimensions, filament axle ovality, snap insertion/retention/fatigue, race wear/friction, and physical cycling.

Required fix: carry these as explicit unresolved items with owners, evidence required, and release impact. Do not infer a resolved G1/G2 gate from an empty array.

## Evidence that did pass independently

- Manifest-listed baseline artifacts match their recorded byte counts and SHA-256 hashes.
- `replacement-link.stl` is one watertight shell with 4,578 triangles, no degenerate triangles, no boundary edges, and no >2-edge non-manifold incidence.
- `passive-snap-track-plate.stl` has 44 watertight shells, 198,270 triangles, no degenerate triangles, and no boundary/non-manifold edge failures.
- Production 3MF parses as 44 objects/build items with millimeter units and three base materials; coupon 3MF parses as 15 objects/build items.
- Generic hermetic slicing passed with 213 layers and 15,990,787-byte G-code. This proves parser/toolpath viability for that generic profile only.
- Fresh Blender 5.1 rebuild exited 0 in about 37 seconds and reproduced the STL/report content exactly.

## Mandatory plan amendments before any new attempt

1. Record the exact approved contract revision/hash and an acceptance matrix with objective thresholds for every hard gate.
2. Create a new unique immutable attempt directory; fail if it exists; do not mutate/delete proof-cycle5-refined or current source.
3. Copy/refactor into a new task-owned builder; require `--factory-startup`; validate output path ownership; no global deletion in a loaded user scene.
4. Make parameters/config the single source of truth and validate exact contract values, including the 0.75 mm snap coupon.
5. Set explicit millimeter scene units and verify round-trip dimensions from Blend/STL/3MF.
6. Separate editable master, kinematic assembly, evaluated fabrication meshes, plate, coupons, purchased references, cameras, and lights.
7. Replace analytic/proxy motion gates with evaluated-mesh joint-constrained sweeps, explicit collision classes and thresholds, between-sample bounds, and positive controls.
8. Measure exact assembled union bounds and exact plate bounds/spacing; fail on any contract or printer-volume violation.
9. Define reproducibility as either byte-identical normalized artifacts or explicit canonical digests; run two clean builds and compare accordingly.
10. Generate the final manifest/report after slicing; include all tools, commands, profiles, source/config hashes, artifacts, and limitations.
11. Treat exact H2D slicing and physical qualification as hard release gates; generic slicing cannot substitute.
12. Quantify every optimization claim against the sealed baseline (file/scene size, mesh/data-block counts, build time, geometry digest, topology, slice metrics); no subjective `cleaner`, `optimized`, or `production-ready` claims.

## Post-change reviewer gate

Return the immutable attempt with source/config/diff, two clean-build logs, canonical/byte hash comparison, reopened Blender scene audit, evaluated-mesh motion/collision report with positive controls, STL/3MF round trips, exact H2D slice/preview evidence, manifest verification, and an acceptance matrix. Reviewer will then issue APPROVE or BLOCK. Physical release will remain blocked unless actual hardware qualification evidence exists.
