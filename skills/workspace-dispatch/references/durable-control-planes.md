# Durable control planes versus ephemeral worker dispatch

Use this decision guide before decomposing a mission.

## Choose the orchestration class first

Use an **ephemeral dispatch loop** only when all work:

- can finish inside the parent session;
- may be cancelled if the parent is interrupted;
- has no human approval gate;
- has no non-idempotent physical or production side effect;
- can pass complete context in each worker prompt;
- does not need a durable audit trail beyond final artifacts.

Use a **durable task DAG** when any work:

- must survive parent/session interruption;
- spans hours, days, cron ticks, webhooks, or external systems;
- requires dependencies, retries, attempt history, or human approval;
- produces evidence that downstream workers must consume reliably;
- performs physical, destructive, release, merge, or other separately authorized actions.

The durable board/database is the sole lifecycle authority. Ephemeral delegates may run inside one durable card, but their results must be normalized back into that card's handoff.

## One canonical state owner

Do not distribute lifecycle truth among a custom mission JSON file, worker chat history, a dashboard-local Kanban, and a native queue. Classify components as:

- **control plane:** canonical tasks, states, dependencies, attempts, logs, comments;
- **worker lane:** executes one claimed task and terminates it through the control plane;
- **trigger:** cron/webhook creates or annotates work but does not own state;
- **specialist executor:** tool or service that creates artifacts/evidence;
- **projection:** UI that reads canonical state without maintaining a second scheduler.

If a custom UI is valuable, adapt it into a projection or thin client instead of retaining a competing store.

## Durable role boundaries

- **Orchestrator:** decompose, link, route, enforce workspace/authorization boundaries, synthesize handoffs. Do not implement or self-review.
- **Worker:** execute one bounded card in its pinned workspace.
- **Reviewer/QA:** independently verify evidence; do not patch the artifact being reviewed.
- **Human:** complete explicit approval cards for ambiguous, destructive, release, or physical actions.
- **External system:** return status and evidence through an idempotent mapping; never become hidden workflow truth.

## Workspace isolation

- Give parallel writers separate directories or worktrees.
- Keep persistent artifacts outside disposable scratch workspaces.
- Use one designated aggregator to update a shared manifest.
- Put paths and hashes in durable completion metadata.
- Never use unstructured chat history as the only handoff.

## Approval pattern

Model each approval as an initially blocked/manual task. Downstream work depends on that task reaching `done`. Store a structured decision containing:

```json
{
  "schema": "approval-gate/v1",
  "gate": "engineering-release",
  "decision": "approved",
  "actor": "...",
  "approved_at": "...",
  "subject_sha256": "...",
  "scope": "..."
}
```

Bind approval to an artifact hash so later changes cannot inherit stale approval. Independent review may inform a human gate but cannot silently replace it.

## Artifact/evidence handoff

Use small structured metadata on the durable run and store large artifacts at persistent paths:

```json
{
  "schema": "task-evidence/v1",
  "task_id": "...",
  "stage_id": "...",
  "attempt": 1,
  "status": "passed",
  "inputs": [{"uri": "...", "sha256": "...", "provenance": "..."}],
  "outputs": [{"uri": "...", "sha256": "...", "media_type": "..."}],
  "toolchain": [{"name": "...", "version": "...", "config_id": "..."}],
  "claims": [{"claim": "...", "oracle": "...", "result": "pass", "evidence_refs": ["..."]}],
  "warnings": [],
  "retry": {"hypothesis": "...", "budget_remaining": 1, "on_failure": "..."}
}
```

## Retry policy

Separate:

1. **Process retries** — crashes, timeouts, spawn failures, transient provider errors. Bound with runtime limits and a small circuit breaker.
2. **Causal retries** — a failed design, implementation, geometry, test, or process hypothesis. Require a revised hypothesis and diagnostic evidence.

Never automatically retry non-idempotent physical, destructive, merge, publish, or release actions. Repeated identical blockers escalate to human triage. Review failure routes to a corrective predecessor task; reviewers do not implement.

## Trigger policy

- **Cron:** diagnostics, reconciliation, anomaly alerts; not workflow truth or approval.
- **Webhooks:** authenticated and idempotent intake/status evidence. Authentication proves sender identity, not trustworthiness of payload text; constrain capabilities.
- **Ephemeral delegates:** bounded research/inspection within a durable card; synchronous lifetime is not durable execution.

Use stable ingress idempotency keys and serialize intake if the underlying dedup check is not transactionally unique.

## Verification checklist

- exactly one canonical lifecycle store;
- explicit dependency and attempt history;
- correct choice between ephemeral and durable orchestration;
- task-specific workspace isolation;
- artifact paths and hashes in handoffs;
- human gates for separately authorized actions;
- process and causal retry budgets are distinct;
- cron/webhooks only trigger or reconcile;
- custom dashboards are projections, not competing schedulers.
