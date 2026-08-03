# End-to-End 3D Model Creation Swarm Operation

> **Archived advisory design (superseded).** This document is retained for
> provenance and useful role/evidence ideas. It is not an executable stage
> ledger. New printable-object work is owned by OrcaSlicer's
> `print_job_conductor.py`, the job manifest, and
> `print-anything-job-projection.v1` under
> `orcaslicer\mcp-workdir\print-jobs`. Hermes may route hash-bound worker lanes
> and store advisory reports only; it must not advance, approve, release, or
> start a physical print.

Status: archived / superseded by the Orca print-anything conductor
Mission: `mission-mrzvlozt-riiv9o`
Recovered predecessor session: `20260724_233531_865d61`
Control principle: no stage advances on claims alone; every handoff carries artifacts, machine-readable evidence, and an explicit gate decision.

## 1. Scope and release levels

This operation accepts a natural-language request, references, measurements, scans, or an existing model and can release one or more of these independently:

- `concept`: approved design direction only;
- `editable_model`: source scene/CAD/procedural graph plus dependency manifest;
- `consumer_asset`: validated GLB/GLTF, FBX, OBJ, USD, or target-engine artifact;
- `fabrication_mesh`: dimensioned STL/3MF plus geometry report, not yet sliced;
- `sliced`: exact printer/material/nozzle/plate/profile slice and G-code metadata;
- `physical`: separately authorized and measured print evidence.

A request is not implicitly a print request. A beauty render is not geometry proof; a manifold mesh is not slice proof; a slice is not physical qualification.

## 2. Current capability inventory

### Verified as installed skill surfaces

| Skill | Ownership in this operation | Current state |
|---|---|---|
| `manage-3d-print-recipes` | Intake normalization, route selection, evidence ladder, material/interface/coupon ledgers, release control | `available_unverified` for a future object until its planner is run on a real request |
| `hermhub-local-ai` | Truthful routing for ComfyUI, TRELLIS2, Blender Model Forge, vision, and local fleet capability | `available_unverified`; requires live service/stage probes |
| `comfyui` | Repeatable concept/reference generation, masks, depth/normal hypotheses, controlled variants | `available_unverified`; server/workflow/model/output smoke is required |
| `manage-hermhub-gpu-workloads` | GPU admission, leases, fencing, and stuck-work recovery for selected generative stages | `available_unverified`; live fleet telemetry is required |

### Required execution capabilities, resolved per run

| Capability | Preferred owner/tool | Proof before use | Honest fallback |
|---|---|---|---|
| reference research and provenance | `km-agent` with web/source tools | source ledger with URLs/files, rights status, dimensions/fidelity claim map | user-supplied references with unresolved claims marked |
| vision/reference critique | quality vision lane or human review | attributable review of submitted proof sheet | explicit human gate |
| artistic concepts | ComfyUI/FLUX or image generation | fresh outputs, prompt/workflow/seed/model identity | authored sketch/vector references |
| organic image-to-3D donor | TRELLIS2 | fresh hashed donor mesh and clay/normal review | authored Blender sculpt/SDF or relief route |
| editable organic/procedural model | Blender/Geometry Nodes/Model Forge | target-version scene opens and deterministic rebuild succeeds | manual Blender handoff or CAD/vector route |
| exact interfaces and solids | CAD/vector kernel or measured Blender route | valid solids, units/datums, nominal/adverse/failing variants | unresolved manual CAD handoff |
| materials and render | Blender/material pipeline | texture license and packed/dependency-complete render smoke | neutral clay proof plus material TODO |
| geometry QA | mesh/CAD diagnostics | units, bounds, manifoldness, normals, degenerates, thickness, self-intersection and part checks | manual inspection with unresolved machine checks listed |
| slicing | OrcaSlicer/project skill | exact binary/profile tuple and fresh slice metadata | geometry-only release marked unsliced |
| metrology and physical observation | `fabrication` plus authorized operator | attributable instrument/method/measurements or photos | remain at sliced/fabrication-mesh tier |

Recovered runtime evidence from the predecessor session: `blender`, `FreeCADCmd`, `openscad`, `OrcaSlicer`, `prusa-slicer`, `meshlabserver`, and `assimp` were not on the orchestrator worker PATH. This does not prove they are absent from `builder`, `fabrication`, fleet nodes, desktop installs, or configured services. Probe the selected execution worker rather than centralizing modeling on orchestrator.

## 3. Worker roles and authority boundaries

### `orchestrator` — control plane and greenlight gate

Owns intake, knowledge-gap ledger, route shortlist, DAG state, approval records, proof-contract validation, retries/reselection, release manifest, and final delivery. It does not fabricate readiness or perform specialist work merely because a skill exists.

### `km-agent` — recovered history, references, provenance, and claim map

Owns prior-session recovery, source discovery, rights/provenance, reference normalization, dimension/fidelity claim mapping, and research cutoff. It may recommend, but cannot approve, a design or declare geometry valid.

### `builder` — modeling, procedural automation, materials, rendering, export

Owns editable sources, deterministic build scripts/graphs, semantic part naming, topology/UV/material work, neutral proof renders, beauty renders, export presets, and consumer-format smoke tests. It cannot approve its own geometry/fabrication QA.

### `fabrication` — dimensional, mesh, process, slice, and physical-readiness authority

Owns printer/process constraints, material/profile tuple, orientation/support analysis, geometry diagnostics, interface/coupon planning, Orca preflight/slice, and separately authorized physical observations. It may reject builder output with reproducible findings; it does not silently repair the artistic master.

### Independent review lane

Use a `qa` or `reviewer` profile when available for blind-first visual and manifest review. If only the four mission workers are allowed, `fabrication` performs technical QA and the human performs visual/release approval; `builder` never self-certifies.

## 4. Artifact root and immutable run identity

Every execution creates:

`runs/3d/<run_id>/`

Minimum structure:

- `00_intake/`: `request.json`, `knowledge-gaps.json`, source payload checksums;
- `01_research/`: `history.md`, `sources.json`, reference board, rights ledger;
- `02_routes/`: recipe output, route comparison, capability probes, approvals;
- `03_design/`: concepts/references, selected direction, human decision record;
- `04_model/`: editable master, scripts/graphs, dependencies, build log;
- `05_materials/`: material definitions, texture provenance, packed assets;
- `06_validation/`: geometry/interface reports and proof renders;
- `07_exports/`: neutral/beauty renders and consumer/fabrication exports;
- `08_fabrication/`: material/profile tuple, orientation/support report, slice/coupon evidence;
- `09_qa/`: independent review, defects, retest evidence;
- `10_delivery/`: manifest, checksums, README, release decision.

`run_id`, units, coordinate convention, target release level, and source artifact hashes are immutable. Revisions append an attempt number; they do not overwrite accepted evidence.

## 5. Executable DAG

```text
S0 Recover history ─┐
                    ├─> S1 Intake/specification -> G1 Phase A intent approval
S0 Capability probe ┘

G1 -> S2 Reference research/provenance
G1 -> S3 Route and representation shortlist -> G2 Route lock

G2 -> S4 Part/interface architecture + procedural plan -> G3 Phase B engineering approval

G3 -> S5A Artistic references (only artistic/hybrid)
G3 -> S5B Source/metrology normalization (only source-faithful/replacement)
G3 -> S6 Editable modeling + procedural automation

S5A/S5B as applicable -> S6 -> S7 Materials/UV/color ownership
S6 + S7 -> S8 Geometry/interface/consumer validation
S8 pass -> S9 Rendering and export
S8 pass -> S10 Fabrication readiness and optional slicing
S9 + S10 -> S11 Independent QA -> G4 Release approval -> S12 Artifact delivery

Physical printing is a separate authorized child operation after G4; it is never implied by this DAG.
```

Parallelism rules:

- S2 and capability probes may run in parallel after the intake draft exists.
- Artistic reference generation and source/metrology normalization may run only when the selected mode needs them.
- Materials can begin on named semantic parts, but final packing/export waits for stable topology.
- Rendering and fabrication analysis can run in parallel only after the same immutable validation candidate hash passes S8.
- QA receives artifacts blind-first and may not use builder assertions as evidence.

## 6. Stage cards and proof contracts

### S0 — Recovery and live readiness

Owner: `km-agent` for history; `orchestrator` for aggregation; selected specialist for live probes.

Inputs: mission ID, known paths, previous session IDs, current worker/profile list.

Required outputs:

- `history.md`: recovered decisions, artifacts, failures, unresolved questions, and confidence labels;
- capability matrix with `verified`, `available_unverified`, `unavailable`, or `not_needed` only;
- exact probe command/API, timestamp, worker/node, exit/status, and non-secret evidence path.

Pass rule: restart packet distinguishes recovered fact from inference and every hard dependency has either a fresh probe or a declared pre-stage probe owner.

### S1 — Intake and specification

Owner: `orchestrator`; human is decision authority.

Required fields:

- purpose, interaction, failure consequence, release level, target formats;
- dimensions, units, tolerances, quantity, coordinate/up-axis convention;
- art direction, fidelity, source rights, editability, variants;
- parts, interfaces, loads, motion, environment, service life;
- printer/nozzle/plate/material/support/finish constraints when fabrication applies;
- acceptance tests and forbidden failures.

Outputs: schema-valid `request.json` and `knowledge-gaps.json`, with every consequential unknown assigned to `before_route_lock`, `before_engineering_lock`, `before_release`, or `before_physical_release`.

Pass rule: no consequential unknown is hidden as a default.

### G1 — Phase A intent approval (human greenlight)

Human approves the outcome contract. Before G1, no concept generation, modeling, slicing, downloads, or paid-cloud execution is authorized. Rejection returns to S1 with a decision note.

### S2 — Reference research and provenance

Owner: `km-agent`.

Outputs: source ledger, rights/use status, normalized reference set, scale/fidelity claim map, contradictions, research cutoff, and hashes of local copies.

Pass rule: each design-driving claim cites its source; unknown rights or dimensions remain blocking where relevant.

### S3 — Route and representation shortlist

Owner: `orchestrator`, informed by `builder` and `fabrication`.

Compare one to three complete routes. Each route names representations, stage artifacts, hard dependencies, probe, retry budget, fallback, evidence cost, and release limits. Hard conflicts eliminate a route before preference scoring.

Examples:

- exact/technical: parametric CAD + optional Blender cosmetic shell;
- artistic organic: bounded references -> Blender authored master;
- image-to-3D: references -> TRELLIS2 donor -> Blender reconstruction, never raw donor release;
- planar/relief: vector partitions or bounded depth -> closed geometry;
- procedural family: Geometry Nodes/scripted master + frozen fabrication twin.

Output: route decision record and rejection ledger.

### G2 — Route lock (human greenlight)

Human approves route, cost/time envelope, local/cloud boundary, fallback policy, and release tier. Any unavailable hard dependency blocks the route or forces explicit reselection.

### S4 — Part/interface architecture and procedural plan

Owners: `builder` authors; `fabrication` challenges; `orchestrator` reconciles.

Outputs:

- part/BOM ledger with stable IDs and material/color ownership;
- interface ledger with datums, constrained DOF, fit type, nominal/adverse/failing variants;
- load/motion/failure/service assumptions where applicable;
- procedural parameter schema, ranges, seed/version policy, determinism plan;
- validation, coupon, rendering, export, and delivery plans.

Pass rule: every acceptance criterion maps to a planned machine or human proof.

### G3 — Phase B engineering approval (human greenlight)

Human approves architecture, materials/process hypothesis, interfaces, procedural controls, validation plan, and physical-action boundary. Modeling remains unauthorized before G3. A newly discovered consequential choice reopens G2 or G3.

### S5 — Optional reference-generation or metrology lanes

Owners: `builder` for artistic generation; `km-agent` for provenance; `fabrication` for metrology requirements.

Artistic proof: fresh images, prompt/workflow/model/seed identity, variant scorecard, and selected-direction record. Generated images establish art direction, not geometry.

Metrology proof: instrument/method, repeated measurements, units, uncertainty, datum definition, and damage/wear interpretation. A scan without scale or uncertainty is not dimensional proof.

### S6 — Editable modeling and procedural automation

Owner: `builder`.

Outputs:

- editable master and dependency manifest;
- deterministic build script/graph where applicable;
- target software/version, plugins, units, transforms, axis convention;
- semantic object/part names and frozen candidate exports;
- build log and immutable candidate hash.

Pass rule: clean-environment rebuild or reopen succeeds; the result matches required bounds/part count and no missing dependency is hidden. Generated donor meshes must be reconstructed or explicitly limited, not relabeled as production masters.

### S7 — Materials, UVs, and color ownership

Owner: `builder`; `km-agent` verifies texture provenance.

Outputs: material table by part/face, texture licenses and hashes, UV diagnostics, packed assets or resolver manifest, color-space/render settings, and neutral clay fallback.

Pass rule: no missing texture, ambiguous color body, or unlicensed external asset; fabrication colors remain separate from render-only materials.

### S8 — Validation

Owner: `fabrication` for dimensional/mesh checks; independent review for visual checks; `builder` fixes defects.

Machine evidence as applicable:

- units, bounds, origin/pivot, transforms, object/part count;
- manifoldness/watertightness, normals, zero-area/degenerate faces, duplicate geometry;
- self-intersections, non-manifold edges, holes, wall/minimum-feature thickness;
- interface clearances, collision/motion sweeps, nominal/adverse/failing controls;
- polygon/texture budgets, UV overlap/coverage, target-consumer import smoke;
- parameter boundary tests and reproducibility.

Visual proof sheet:

- neutral clay, orthographic front/back/left/right/top/bottom;
- wireframe, silhouette, section/cutaway where hidden geometry matters;
- scale reference and closeups of critical interfaces;
- beauty render only after neutral proof.

Output: `validation.json` with check name, tool/version, candidate hash, threshold/source, result, evidence path, and defect ID.

Pass rule: all hard checks pass; waivers name risk, owner, expiry, and human approval. Any geometry change invalidates downstream evidence tied to the old hash.

### S9 — Rendering and export

Owner: `builder`.

Outputs: neutral proof renders, approved beauty/turntable output, export files, export settings, and target-application import report.

Pass rule: exports reopen/import in the named consumer, preserve units/orientation/parts/material expectations, and contain no unresolved external path.

### S10 — Fabrication readiness and optional slicing

Owner: `fabrication`.

Outputs as applicable:

- fabrication mesh/3MF tied to S8 candidate hash;
- exact printer, nozzle/tool, plate, material product/color, and profile identities;
- orientation/support/seam/split/assembly rationale;
- critical layer previews, time/material/warning metadata, and G-code hash;
- smallest non-confounded coupon plan for fit, strength, finish, color, motion, optical, support, leak, or wear claims.

Pass rule for `fabrication_mesh`: geometry checks pass and unresolved slice/physical claims are explicit.

Pass rule for `sliced`: fresh Orca slice passes with exact tuple and metadata.

Pass rule for `physical`: only separately authorized measured coupon/print evidence can promote the artifact.

### S11 — Independent QA

Owner: `qa`/`reviewer` when available; otherwise `fabrication` technical review plus human visual review.

Inputs: released candidate artifacts and acceptance contract, not builder narrative.

Outputs: blind-first defects, severity, reproduction, evidence path, acceptance-criterion mapping, and retest result.

Pass rule: no open blocker/critical/high defect; medium waivers require human approval; manifest and hashes match actual files.

### G4 — Release approval and S12 delivery

Human selects the exact release level and accepts waivers. `orchestrator` then emits:

- requested artifacts;
- editable sources and scripts/graphs;
- renders/proof sheets;
- validation, import, fabrication, and QA reports;
- provenance/licenses, dependencies, versions, units, axes, and rebuild instructions;
- `manifest.json` with file sizes and SHA-256 hashes;
- explicit exclusions: unsliced, unprinted, unmeasured, or unsupported claims.

## 7. Failure recovery and stop rules

### Retry budget

Every stage gets at most two bounded corrections for the same causal hypothesis. The third failure triggers route reselection rather than another blind retry. Each attempt records input hash, change, command/tool version, output hash, result, and next hypothesis.

### Failure classes

- `spec_gap`: reopen G1/G2/G3 depending on the decision affected;
- `capability_unavailable`: run one fresh probe, then use the approved fallback or block;
- `non_deterministic_generation`: freeze seed/model/workflow and rerun; if still unstable, move to authored geometry;
- `topology_failure`: return to S6; invalidate S7-S10 artifacts bound to the old hash;
- `interface_failure`: return to S4/S6 with nominal/adverse/failing variants and coupon revision;
- `consumer_import_failure`: return to S9 export settings without changing the master unless evidence requires it;
- `slice_failure`: first change orientation/support/profile within the approved envelope; geometry changes return to S6/S8;
- `GPU lease/stuck work`: use coordinator fencing and reconcile procedure; never kill foreign/unidentified work;
- `lost worker`: preserve immutable inputs and attempt ledger, reassign the stage, and resume from the last passed gate;
- `physical failure`: quarantine production release, attach measurements/photos, update the hypothesis, and require new authorization for another print.

### Stop conditions

Stop and report the smallest unblock action when:

- a human greenlight is missing;
- source rights, critical dimensions, safety consequence, or target format cannot be resolved;
- a selected hard dependency is unavailable and fallback was not approved;
- validation cannot observe a required property;
- the retry budget is exhausted;
- physical action is required but not separately authorized.

No worker may silently lower quality, change representation, use paid cloud compute, download unapproved dependencies, or print an object to escape a blocker.

## 8. Likely reasons the prior attempt stalled

Evidence recovered from session `20260724_233531_865d61`:

- it read profile and skill surfaces;
- it performed a broad skill scan that reached the `execute_code` 50-tool-call ceiling;
- it proved common 3D CLIs absent from orchestrator PATH;
- it loaded ComfyUI and GPU-routing guidance;
- its last durable state was a todo list with inventory complete, design in progress, and no operation artifact written.

Likely causes, ranked by confidence:

1. High confidence: exploration consumed the run without an early artifact checkpoint. The final observed message was a plan update, not a handoff.
2. High confidence: execution capability was checked on the control-plane worker, creating a dead end instead of routing modeling/fabrication probes to specialist workers.
3. High confidence: the assignment was treated as one large analysis task rather than a staged DAG with owners and proof contracts.
4. Medium confidence: no concrete object request existed, so capability states could not be promoted beyond surface discovery and the planner could not generate an object-specific recipe.
5. Medium confidence: skill availability, runtime readiness, and verified task output were not yet separated into a durable capability matrix.
6. Medium confidence: no approval-gate or retry/stop policy bounded the search, so additional inventory work could continue indefinitely.
7. Low confidence: no exact crash/timeout is present in recovered messages; infrastructure failure should not be claimed without more logs.

## 9. Restart recommendation

### Immediate restart packet

1. Preserve this operation document as the control contract.
2. Ask `km-agent` to recover any additional session/log/artifact history into S0 without rewriting accepted evidence.
3. Create a new `run_id` and normalize one concrete object request with `manage-3d-print-recipes`; keep Phase A and Phase B approvals false.
4. Probe only the capabilities required by the top route, on the worker/node that will execute them.
5. Stop at G1 for human intent approval; do not model first.
6. After G1, run reference research and route comparison in parallel.
7. After G2/G3, dispatch artifact-producing S6/S7 tasks to `builder` and validation/fabrication tasks to `fabrication` with candidate hashes in every handoff.
8. Require an independent QA packet and exact release-level approval before delivery.

### Restart card template

Each dispatched card must contain:

- `run_id`, stage ID, owner, parent stage/gate, and immutable input hashes;
- objective and non-goals;
- exact required output paths and formats;
- proof commands/checks and acceptance thresholds;
- retry budget, fallback, stop condition, and escalation target;
- statement of actions requiring human approval;
- completion handoff: summary, artifact paths, hashes, commands/results, open risks, next eligible stage.

### Minimal first dispatches

- `km-agent / S0`: recover prior history and source/provenance evidence only.
- `orchestrator / S1`: produce request and knowledge-gap ledger; stop at G1.
- After G1, `km-agent / S2` and `builder+fabrication / S3 consultation` may run concurrently.
- No builder modeling card is eligible until G3 is recorded.

## 10. Completion criteria

The operation design is executable when:

- each expected stage has one accountable owner, inputs, outputs, proof, pass rule, and failure route;
- dependencies and parallelism are explicit;
- human approvals bound intent, route, engineering, and release;
- availability states are evidence-based and tied to the executing worker/node;
- retries are bounded and three failed causal hypotheses force route reselection;
- delivery distinguishes concept, editable, consumer, fabrication, sliced, and physical evidence tiers;
- a restart can resume from passed gates using immutable hashes and attempt logs;
- no physical action, paid-cloud fallback, unsafe service exposure, or dependency installation is implicit.
