# Fabrication handoff — passive snap-track audit

Mission: `mission-mrzxxgp9-jfx467`  
Assignment: `assign-mrzxxgp9-8wapqk`  
Date: 2026-07-25  
State: awaiting orchestrator greenlight; no model edits made

## Located source of truth

- Procedural builder: `C:\Users\madph\Documents\Projects\orcaslicer\spikes\014-passive-snap-track\build_passive_track.py`
- Design contract: `C:\Users\madph\Documents\Projects\orcaslicer\spikes\014-passive-snap-track\print-anything-design-contract.v1.json`
- Rebuild/slice entry point: `C:\Users\madph\Documents\Projects\orcaslicer\spikes\014-passive-snap-track\Run-PassiveSnapTrackProof.ps1`
- Latest candidate: `C:\Users\madph\Documents\Projects\orcaslicer\spikes\014-passive-snap-track\proof-cycle5-refined`
- Editable/generated scene: `proof-cycle5-refined\passive-snap-track.blend`
- Frozen fabrication exports: `proof-cycle5-refined\*.stl`, `*.3mf`
- Existing evidence: `engineering-report.json`, `artifact-manifest.json`, `slices-hermetic\slice-report.json`, and four PNG proof renders

The script is the practical modeling source of truth. The `.blend` is a generated fabrication/presentation scene. The builder creates primitives, applies bevels/booleans, voxel-remeshes unions, applies decimation, makes independent mesh copies for links, builds a print plate, exports STL/3MF, renders, saves the scene, and emits a report plus hashes.

## Current evidence

- Contract: M1 adult, hand-manipulated demonstrator; 28 identical links at 10 mm pitch; 12-lobe passive guides; 3 mm tension adjustment; PLA hypothesis; no useful load or drive.
- Reported assembled envelope: 127.95 x 20.0 x 48.64 mm.
- Link: 2,291 vertices, 4,578 faces, one component, zero reported non-manifold edges, 877.55 mm3, 12.248 x 20.0 x 9.1 mm.
- BB guide: 7,069 vertices, 13,228 faces, one component, zero reported non-manifold edges.
- Bushing guide: 6,850 vertices, 13,295 faces, one component, zero reported non-manifold edges.
- Frame: 7,548 vertices, 14,230 faces, one component, zero reported non-manifold edges.
- Analytic motion: 450 samples across one revolution in both directions; maximum pitch error 0.11128 mm; maximum articulation 29.658 degrees against a 35 degree limit; no reported forbidden center-envelope collision.
- Solid wheel/link check: 42 phase samples; intended wheel contact detected; zero core-proxy overlap; positive-control oversized core overlaps.
- Generic hermetic Orca slice: MyKlipper 0.4 + Generic PLA, 213 layers, max Z 42.6 mm, 50.86 g, estimated 3h31m11s, 15,990,787-byte G-code.
- Visual review: assembly and plate renders are coherent and clearly expose the repeated-link, guide-wheel, frame, retainer, and tension-insert architecture.
- No physical print, dimensional measurement, force measurement, fatigue test, derailment test, wear test, or H2D production slice is proven.
- Independent background Blender inspection was attempted through the connected Blender CLI tool and timed out after 120 seconds; therefore scene-internal transform/material/collection findings are not claimed as independently verified.

## Findings and prioritized plan

### P0 — release blockers

1. Keep release below physical/production status. The only successful slice is a generic MyKlipper 0.4 hermetic toolpath, not the contracted H2D hardware/material/plate tuple.
2. Print and measure the snap and BB-race coupon ladders before selecting production clearances. The nominal 0.30 mm snap and 0.35 mm BB radial clearances remain hypotheses.
3. Verify actual 1.75 mm axle stock diameter/ovality and the exact BB lot diameter/roundness; then test cap retention and retainer service sequence.
4. Run full assembled motion and durability evidence: both directions, derailment/link release/whitening/fracture checks, and the planned 25/100/250/500-cycle inspections.

### P1 — digital geometry and workflow repairs

1. Split the workflow into an editable/kinematic master and a frozen fabrication twin. Preserve primitive/boolean/modifier intent in the master; apply voxel remesh/decimation only in exported fabrication copies.
2. Replace global constants with a versioned parameter input and record the complete parameter payload in the manifest. At present only `--out` is configurable.
3. Add independent geometry checks beyond manifold edge count: flipped normals, zero-area/degenerate faces, duplicate vertices/faces, self-intersections, minimum wall/feature thickness, and disconnected internal shells.
4. Strengthen collision validation. The current link/link test is a center-envelope approximation, and wheel contact uses 42 discrete phase samples plus a core proxy. Add actual-mesh adjacent-joint and non-neighbor sweeps, explicit clearance minima, and detector positive controls at the mesh level.
5. Verify transforms, origins, units, collection hierarchy, modifier state, and material assignment in a clean Blender reopen. The generated scene should separate `MASTER`, `KINEMATIC`, `FABRICATION`, `PLATE`, `COUPONS`, `PURCHASED_REFERENCE`, `CAMERAS`, and `LIGHTS`.
6. Reuse linked mesh data or collection instances for repeated presentation links. Current `duplicate_link` makes 28 independent mesh copies, increasing scene memory and allowing accidental drift.
7. Add clean-environment rebuild comparison: source hash + Blender version + parameter hash -> deterministic artifact hashes, bounds, part counts, and mesh statistics.

### P2 — manufacturing and presentation optimization

1. Inspect slicer layer previews for journal undersides, jaw bridges, frame bosses, seams, thin features, and local overhangs; the present report records requested shell/infill values but not independently confirmed per-part toolpath behavior.
2. Separate production plate alternatives and compare transition/time/material attribution. The colored 3MF is useful semantic ownership evidence, not yet a production multicolor plan.
3. Add neutral orthographic six-view, wireframe, section views through snap jaws and BB race, and dimensioned interface closeups. Existing beauty/clay renders do not prove hidden clearances.
4. After coupon selection, freeze one released link, wheel, insert, retainer, and axle-cap variant; remove unselected alternatives from the production plate while retaining them in calibration artifacts.
5. Consider simplifying frozen mesh density only after thickness and deviation checks; voxel remesh plus 8–12% collapse ratios are coarse global controls and should be bounded by surface-deviation evidence around functional interfaces.

## Proposed greenlight scope

Authorize a non-destructive digital refinement pass only:

1. copy the current script/candidate into a new immutable attempt directory;
2. add a parameter manifest and master/fabrication scene separation;
3. add independent mesh/scene validation and actual-mesh motion checks;
4. produce before/after renders, mesh statistics, validation JSON, deterministic build log, and fresh STL/3MF exports;
5. stop before slicing against a production profile or any physical print unless separately authorized.

## Required checkpoint

STATE: HANDOFF  
FILES_CHANGED: `C:\Users\madph\Documents\Projects\hermes-workspace\memory\handoffs\swarm\fabrication-latest.md`  
COMMANDS_RUN: profile/context reads; repository-wide `rg --files` asset discovery; OrcaSlicer AGENTS/README/contract/report/manifest/slice inspection; script symbol and numbered-source inspection; PNG visual inspection; read-only Blender CLI inspection attempt  
RESULT: Located and reconstructed the procedural tank-track workflow; audited existing geometry, motion, slicing, evidence boundaries, and scene-generation approach; supplied prioritized P0/P1/P2 plan and bounded implementation scope. No model/source/export was changed.  
BLOCKER: Orchestrator greenlight is required before model implementation. Independent Blender CLI scene audit also timed out after 120 seconds and must be retried with a narrower probe or direct local Blender invocation.  
NEXT_ACTION: Orchestrator reviews the proposed greenlight scope and either authorizes the bounded digital refinement pass or narrows/reorders the repair list.
