# Artifact-Gated Mission Conductor

Use this pattern when a mission spans regulated, safety-sensitive, hardware-facing, or evidence-heavy stages such as fabrication, deployment, data migration, or external publication.

## Why ordinary task chaining is insufficient

A shell command can prove that a file exists or code compiles, but it cannot by itself prove that:

- the artifact belongs to the current run;
- the evidence is fresh and attributable;
- an independent reviewer examined unchanged bytes;
- a human approved the exact artifact and side effect;
- a digital result justifies a physical or production claim.

For these missions, dispatch is a state machine over immutable artifacts, not merely a list of worker prompts.

## Conductor model

1. Create one job manifest containing the mission, scope, safety boundary, exact working directory, stage graph, approval requirements, and artifact registry.
2. Give each worker explicit input artifact IDs, an output schema, a write boundary, and machine-checkable exit criteria.
3. Require each output to record stable paths or IDs, hashes where possible, timestamps, tool/runtime identity, expected versus observed results, limitations, and worker identity.
4. Validate output structure and freshness before dispatching dependents. The worker that creates an artifact must not be the sole authority that advances it.
5. Bind reviews and approvals to unchanged artifact hashes. Any relevant change reopens the earliest affected stage.
6. Keep side-effecting or hardware-facing work on a separate, explicitly authorized card with least-privilege capabilities.
7. Distinguish lifecycle states such as `research_complete`, `candidate_ready`, `digitally_verified`, `side_effect_authorized`, `physically_verified`, and `released`.

## Safe parallelism

Parallelize only work that does not depend on another lane's unvalidated result:

- independent research questions;
- alternative candidate implementations;
- isolated analysis of the same immutable artifact;
- independent adversarial reviews.

Serialize:

- requirement and architecture approval;
- stage advancement;
- production or publication release;
- hardware actions;
- final reconciliation.

A general swarm is inappropriate when workers share mutable outputs, can self-promote, or can inherit high-risk capabilities.

## Audit before dispatch

When adopting an existing workflow:

1. Separate documented stages from executable implementations and retained run artifacts.
2. Trace one representative run end to end.
3. Find validators and then find their callers; an unwired validator is advisory.
4. Compare top-level completion with all child verdicts and actual released deliverables.
5. Treat cached test-result files as historical, not fresh.
6. Check whether artifacts are run-local and content-addressed rather than split across shared mutable directories.
7. Identify unavailable, adapter-only, and externally hosted capability boundaries without hardening transient setup failures into permanent constraints.

## Exit criteria for evidence-heavy tasks

Prefer criteria such as:

- schema validation succeeds;
- every declared artifact exists under the allowed root;
- current hashes match the manifest;
- dependent reviews cite the accepted hash;
- no earlier applicable stage is failed or blocked;
- side-effect approval names the exact action and target;
- the reported evidence tier does not exceed observed evidence.

Avoid accepting a bare `PASS`, file existence alone, an unversioned screenshot, or a worker's unsupported claim.
