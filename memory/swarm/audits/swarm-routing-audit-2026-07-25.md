# Swarm Orchestrator / Greenlight Gate Audit

Date: 2026-07-25
Scope: read-only audit of `swarm.yaml`, installed Hermes profiles, routing/decomposition/dispatch code, mission state, proof checkpoints, wrappers, skills, MCP declarations, and human gates.
Decision: **DO NOT GREENLIGHT runtime/configuration repair yet.** The current control plane can launch work, but it does not reliably constrain dispatch to the roster, honor dependency or greenlight policy, or close review-required missions.

## Executive verdict

- Canonical roster: 10 workers, unique IDs, schema-valid, profile aliases equal their IDs.
- Installed profiles: 7/10 (`orchestrator`, `km-agent`, `builder`, `reviewer`, `qa`, `researcher`, `ops-watch`). Missing: `maintainer`, `strategist`, `inbox-triage`.
- Installed profile configs: all 7 checked profiles returned `hermes --profile <id> config check` exit 0.
- One-shot launch: structurally available because dispatch bootstraps missing profiles and calls Hermes directly.
- Persistent/live launch: unavailable for all 10 declared workers on this host because all declared wrapper paths are absent; tmux-start hard-requires the wrapper.
- Worker specialization: materially degraded. Of 67 declared worker-skill assignments, 50 are absent from the corresponding profile/project skill manifests. `gbrain` is declared for all 10 workers and configured for none.
- Policy enforcement: **fail**. `greenlightRequiredFor`, roster `reviewRequired`, `maxConcurrentTasks`, and `acceptsBroadcast` are metadata, not dispatch gates.
- Dependency enforcement: **fail**. `dependsOn` is stored but initial dispatch launches every submitted assignment immediately.
- Review completion: **fail**. Review-required checkpoints enter `reviewing`, but the production orchestrator loop imports the review-closing helper without calling it; no API caller of the single-assignment review helper was found.
- Proof enforcement: syntax-only. Six checkpoint labels and a valid state are required, but paths, commands, outputs, hashes, reviewer identity, and approval evidence are not verified.
- Regression tests: 42/42 relevant existing tests passed. The passing suite does not cover the critical policy bypasses above.

## Worker inventory

| Worker | Profile | Declared skills | Missing skills | `gbrain` | Wrapper/live | Operational classification |
|---|---:|---:|---:|---:|---:|---|
| orchestrator | installed/config-valid | 8 | 6 | missing | missing | one-shot only; policy skillset degraded |
| km-agent | installed/config-valid | 7 | 7 | missing | missing | one-shot only; declared specialty unavailable |
| builder | installed/config-valid | 7 | 2 | missing | missing | one-shot only; partially specialized |
| reviewer | installed/config-valid | 7 | 3 | missing | missing | one-shot only; review closure broken globally |
| qa | installed/config-valid | 4 | 3 | missing | missing | one-shot only; QA specialization degraded |
| researcher | installed/config-valid | 10 | 7 | missing | missing | one-shot only; research specialization degraded |
| ops-watch | installed/config-valid | 5 | 3 | missing | missing | one-shot only; ops specialization degraded |
| maintainer | absent | 8 | 8 | missing | missing | auto-bootstrap can create generic one-shot profile; not role-ready |
| strategist | absent | 5 | 5 | missing | missing | auto-bootstrap can create generic one-shot profile; not role-ready |
| inbox-triage | absent | 6 | 6 | missing | missing | auto-bootstrap can create generic one-shot profile; not role-ready |

Notes:
- No duplicate worker IDs or profile aliases were found in the current roster.
- All roster model labels are `GPT-5.5`; installed profile model selectors are `openai-codex/gpt-5.6` with reasoning effort `high`. The normal one-shot path does not reconcile this mismatch. The tmux-start path calls model synchronization, so launch paths can select different models.
- Existing profile identity snapshots do not contain the current roster role names. `syncSwarmProfileIdentity` exists but had no production caller in the inspected source.
- Missing skill counts compare exact declared names against installed profile and project `SKILL.md` frontmatter names. They are capability-contract failures, not evidence that similarly named general tools are absent.

## Confirmed defects and repair map

### P0-1 — Dispatch accepts non-roster workers and auto-creates profiles

Evidence:
- `swarm-dispatch.ts:243-258` validates only worker-ID syntax.
- `swarm-dispatch.ts:1087-1167` creates a mission, derives a fallback roster from submitted IDs, and launches assignments without checking canonical roster membership.
- `swarm-roster.ts:116-128` silently falls back on missing or malformed roster data.
- `runWorker` calls `ensureSwarmProfileConfig`, so a syntactically valid arbitrary ID can become a generic profile.

Repair:
1. Fail closed when the canonical roster cannot be read or validated.
2. Reject every dispatch ID not present in that validated roster.
3. Separate explicit administrator profile provisioning from assignment dispatch.

Proof criteria:
- API tests show unknown IDs, absent roster, malformed YAML, and duplicate IDs return a non-2xx response and create no profile, mission, runtime file, or child process.
- Valid roster IDs still dispatch.

Rollback: feature-flag strict roster enforcement for one release; rollback restores legacy acceptance only after an operator-visible warning.
Greenlight: **HOLD — human approval required before changing routing semantics.**

### P0-2 — Human greenlight policy is not enforced

Evidence:
- `greenlightRequiredFor` is defined in `swarm-roster.ts:38` and populated in `swarm.yaml` but is not evaluated in the production dispatch path.
- No immutable approval record, approver identity, scope, expiry, or candidate hash is required before launch.

Repair:
1. Add a server-side gate evaluator before mission creation and before each launch.
2. Match task/action against structured risk classes rather than free-text substring policy.
3. Require an immutable approval record containing mission, assignment, action class, approver, timestamp, candidate hash, and expiry.
4. Never accept worker-authored text as human approval.

Proof criteria:
- Destructive/publishing/deployment/credential/spend actions are blocked with a stable gate code until a valid human approval is recorded.
- Approval for one hash/action cannot authorize another; expired/revoked approvals fail closed.
- Audit log proves who approved what and when.

Rollback: disable only the new action after verifying no side effect occurred; preserve approval/audit records.
Greenlight: **HOLD — security/control-plane review plus explicit human approval required.**

### P0-3 — Dependency ordering is stored but bypassed

Evidence:
- `dependsOn` is parsed and stored (`swarm-dispatch.ts:243-258`, `swarm-missions.ts:196-214`).
- Initial dispatch maps the complete assignment array directly through `mapWithConcurrency` (`swarm-dispatch.ts:1161-1168`).
- No `readyQueuedAssignments` check exists in dispatch or orchestrator-loop.

Repair:
1. Resolve stable client assignment keys to generated IDs before launch.
2. Validate missing references and cycles.
3. Launch only assignments whose dependencies are terminal-success and whose required review/approval gates are satisfied.

Proof criteria:
- A→B integration test proves B never starts before A's accepted checkpoint/review.
- Missing/cyclic dependencies return a deterministic error.
- Failed/blocked/cancelled parent behavior is explicitly tested.

Rollback: pause affected missions; do not flatten dependencies silently.
Greenlight: **HOLD — human approval required because scheduling semantics change.**

### P0-4 — Review-required missions cannot reliably complete

Evidence:
- `deriveMissionState` keeps required checkpoints in `reviewing` (`swarm-missions.ts:120-126`).
- `markMissionAssignmentsReviewedByWorker` can close them, but in production it is only imported by `swarm-orchestrator-loop.ts`; no call was found.
- `markMissionAssignmentReviewed` had no production caller.
- Review requirement can be explicitly supplied as `false`, overriding keyword inference, and roster-level `reviewRequired` is not applied.

Repair:
1. Require a reviewer assignment linked to the candidate assignment/hash.
2. Parse a structured reviewer verdict (`APPROVE`/`REJECT`) and call a single state-transition service.
3. Apply roster/mission policy server-side; do not trust client `reviewRequired=false` for protected classes.
4. Reject self-review and stale-candidate review.

Proof criteria:
- Implementation checkpoint remains `reviewing` until an independent reviewer approves the same hash.
- Rejection returns it to a defined remediation state.
- Self-review, wrong assignment, missing verdict, and stale hash do not complete the mission.

Rollback: leave missions in `reviewing`; never auto-mark them done.
Greenlight: **HOLD — human approval required for review-state policy.**

### P1-1 — Concurrency and broadcast restrictions are advisory only

Evidence:
- Roster fields exist at `swarm-roster.ts:39-41`.
- Dispatch uses only request/global `maxConcurrency` (`swarm-dispatch.ts:1126-1127`) and accepts legacy broadcasts without evaluating `acceptsBroadcast`.
- No per-worker active-task count or lease is checked.

Repair:
- Add transactional per-worker leases, enforce `maxConcurrentTasks`, and reject/skip broadcast-disabled workers.

Proof criteria:
- Concurrent requests cannot exceed each worker's limit; duplicate active assignment is deterministic; lease cleanup survives timeout/crash; broadcast-disabled workers are never launched through broadcast.

Rollback: stop admitting new work and drain leases before reverting.
Greenlight: **HOLD — human approval required for scheduler changes.**

### P1-2 — Declared worker capability contracts do not match runtime

Evidence:
- 50/67 declared skill assignments are unavailable by exact installed/project manifest name.
- `gbrain` is declared for every worker and configured for none.
- Three roster profiles are absent; automatic bootstrap creates config but not the declared specialty skills.

Repair:
- Define a validated capability manifest per worker; install or remove each declaration; make provisioning atomic and fail dispatch when required capabilities are missing.

Proof criteria:
- For every worker, a preflight resolves each required skill/MCP/tool to a loadable runtime entry and executes one harmless smoke probe.
- Missing required capability marks the worker unavailable and prevents routing.

Rollback: restore prior manifest/profile snapshot; worker remains unavailable until preflight passes.
Greenlight: **HOLD — inventory owner must approve each install/removal; credentials require separate handling.**

### P1-3 — All persistent/live wrappers are absent and wrapper names are non-portable

Evidence:
- All 10 declared wrappers are absent from `~/.local/bin`.
- Names contain `:`, which is non-portable on Windows.
- tmux-start checks the exact wrapper path and returns 400 when absent.
- One-shot Hermes invocation remains structurally available.

Repair:
- Replace colon-bearing wrapper filenames with portable names or remove wrapper indirection; generate and verify wrappers during explicit provisioning.

Proof criteria:
- Each worker passes wrapper existence, executable, profile binding, cwd, environment, and harmless launch/exit smoke tests on Windows and supported Unix hosts.

Rollback: retain one-shot fallback; remove only generated wrappers from the failed version.
Greenlight: **HOLD — human approval required for executable generation.**

### P1-4 — Model and identity synchronization are launch-path dependent

Evidence:
- Roster labels all workers `GPT-5.5`; installed profiles select `openai-codex/gpt-5.6`/`high`.
- tmux-start performs model sync, while normal one-shot dispatch only ensures a config exists.
- identity sync exists but no production caller was found; installed startup snapshots do not contain current roster roles.

Repair:
- Choose one source of truth and perform validated, idempotent reconciliation during explicit provisioning, not implicitly per launch.

Proof criteria:
- One-shot and persistent launch report identical model/provider/effort and current role identity; drift is surfaced without silent mutation.

Rollback: restore profile config/identity backup and pin last-known-good model.
Greenlight: **HOLD — human approval required because model/provider changes affect cost and behavior.**

### P1-5 — Proof checkpoints are syntactic claims, not objective proof

Evidence:
- `parseSwarmCheckpoint` requires six labels and a known state, but accepts arbitrary text for files, commands, result, blocker, and next action.
- A worker can claim `STATE: DONE`; no artifact existence, command exit status, test output, git diff, or hash is verified.

Repair:
- Introduce typed proof contracts by task class and collect server-side evidence handles (artifact hash/path, command+exit code, test report, candidate revision).

Proof criteria:
- Forged/missing paths, nonexistent commands, failed tests, stale hashes, and incomplete fields cannot produce an accepted DONE transition.
- Evidence is immutable, bounded, redacted, and traceable to the executing worker.

Rollback: retain raw checkpoints as narrative evidence while typed verification is disabled; do not treat them as approved completion.
Greenlight: **HOLD — schema/security review required; credential-bearing output must be redacted.**

### P2-1 — Existing tests do not exercise the safety invariants

Evidence:
- Relevant tests pass (5 files, 42 tests), while confirmed bypasses remain.

Repair:
- Add adversarial integration tests for roster fail-closed behavior, unknown IDs, dependencies, approval gates, review closure, concurrency leases, broadcast restrictions, capability preflight, and proof verification.

Proof criteria:
- Tests fail against the current implementation and pass only with the corresponding repair; CI runs them on Windows and one Unix environment.

Rollback: tests remain even if implementation rolls back, documenting known unsafe behavior.
Greenlight: **GREEN for test-only additions; HOLD for runtime/config changes.**

## Safe repair order

1. Test-only red tests for P0 invariants (**greenlight: test-only GREEN**).
2. Strict canonical roster validation and unknown-worker rejection (**HOLD**).
3. Immutable approval/gate service and audit record (**HOLD**).
4. Dependency scheduler and transactional per-worker leases (**HOLD**).
5. Review verdict/state transition tied to candidate hash (**HOLD**).
6. Typed proof verification (**HOLD**).
7. Explicit capability/profile provisioning and portable live-launch wrappers (**HOLD**).
8. Enable repaired routes in shadow mode, then canary one harmless mission after human approval.

## Verification log

- Parsed `swarm.yaml`; checked uniqueness, profile aliases, wrappers, profile existence, model drift, skill manifests, and configured MCP names.
- Ran `hermes --profile <id> config check` for all seven installed roster profiles: exit 0 for each.
- Ran: `pnpm exec vitest run src/server/swarm-roster.test.ts src/server/swarm-profile-config.test.ts src/server/swarm-missions.test.ts src/routes/api/-swarm-dispatch.test.ts src/routes/api/-conductor-spawn.test.ts`
- Result: 5 test files passed, 42 tests passed.
- No worker definition, profile, credential, routing config, or runtime policy was changed.

## Final gate state

Audit artifact: **GREEN**.
Test-only repair work: **GREEN**.
Any runtime, worker-profile, skill, MCP, wrapper, model, approval-policy, review-policy, or routing change: **HOLD pending explicit human greenlight and evidence-specific rollback plan.**
