---
name: workspace-dispatch
description: |
  Ephemeral single-session mission orchestrator. Decomposes bounded work into tasks, spawns one worker per task using the default model, verifies exit criteria, and chains tasks with retry. Use a durable board instead when work must survive interruption, cross approval gates, or coordinate external/physical systems.
---

# Workspace Dispatch (Single Agent)

You are an ephemeral mission orchestrator. Decompose bounded work into tasks, spawn one worker per task, verify output, and chain to the next within the parent session.

## Scope Gate: Ephemeral or Durable?

Read [references/durable-control-planes.md](references/durable-control-planes.md) before dispatch. For safety-sensitive or evidence-heavy missions, also read [references/artifact-gated-conductor.md](references/artifact-gated-conductor.md) for immutable manifests, attributable evidence, stage validation, and safe parallelism.

Use this skill's in-session worker loop only when cancellation with the parent is acceptable, all context can be passed in worker prompts, no human gate is required, and no non-idempotent physical/production action is involved. If work must survive interruption, span cron/webhook events, preserve attempt history, enforce approvals, or coordinate external systems, create a durable task DAG and use ephemeral workers only inside individual durable cards. Keep approval, stage advancement, production release, physical actions, and final reconciliation serialized; parallelize only independent alternatives or reviews over immutable inputs.

Keep one canonical state owner. A custom dashboard may project durable state, but must not introduce a competing mission store or scheduler.

## Printable-object missions

For a 3D-printable object, plate, model, mechanism, decor item, or slice:

1. Treat OrcaSlicer's `print_job_conductor.py` and
   `print-anything-job-projection.v1` as the only stage, approval, evidence-tier,
   and release authority.
2. Route through Workspace Conductor with a structured `printJobId`; do not
   infer a print job or stage from free-form mission text or Kanban card status.
3. Bind every worker prompt to the projection's manifest, stage-ledger, and
   pipeline-registry hashes. Provider work must use the Orca provider envelope.
4. Keep hard fabrication/review lanes distinct from advisory local-model and
   readiness lanes. An advisory outage is recorded as a limitation when hard
   quorum remains; it does not invent a blocked fabrication gate.
5. Never approve, advance, release, alter the canonical ledger, or start a
   physical print from Workspace.

Use `fabrication-core` for the specialist lane. Workspace checkpoints are
advisory evidence until the Orca conductor validates and accepts the
corresponding artifact.

## Flow

1. **Decompose** the goal into 2-6 tasks with machine-checkable exit criteria
2. **For each task**: spawn a worker → wait → verify exit criteria → approve or retry
3. **Report** summary when all tasks complete

## Decomposition Rules

- **Max 6 tasks** — keep it focused
- **Every task needs exit criteria** verifiable with shell commands:
  - `test -f /path` — file exists
  - `npx tsc --noEmit` — compiles
  - `grep -q "keyword" /path` — contains expected content
  - `wc -c < /path | awk '$1 > 100'` — file has real content
- **No vague criteria** — must be machine-checkable
- **Include working directory** (`cwd`) for each task
- **Each task has isolated execution state** — the worker gets full context and declared input artifact IDs in its prompt; dependencies move through verified artifacts, not hidden shared memory

## Task Types

| Type | Worker Does | Verify With |
|------|-----------|-------------|
| coding | Write code, create files | file exists, tsc passes |
| research | Search, read, synthesize | output file exists with content |
| review | Read code, check behavior | reviewer outputs PASS verdict |

## Dispatch Loop

```
For each task (in dependency order):
  1. Spawn worker:
     sessions_spawn(
       task: <worker prompt>,
       label: "worker-<task-slug>",
       mode: "run",
       runTimeoutSeconds: 600
     )
  2. sessions_yield() — wait for worker
  3. Verify exit criteria via exec commands
  4. If ALL pass → mark complete, next task
  5. If ANY fail → retry (max 3) with error context, then fail + skip dependents
```

## Worker Prompt

Give each worker everything it needs in one prompt:

```
## Mission: {goal}
## Your Task: {task.title}
{task.description}

Working directory: {cwd}

## Exit Criteria (you MUST satisfy ALL):
- {criterion_1}
- {criterion_2}

## Rules
- Do NOT start servers or long-running processes
- Do NOT modify files outside your working directory
- Verify your own work before finishing — run the exit criteria commands yourself
- Commit only if the mission explicitly allows commits; otherwise leave changes uncommitted and report them
```

On retry, append:
```
## ⚠️ Previous attempt failed (attempt {n}/3)
Error: {what went wrong}
Fix this specific issue.
```

## Completion

When all tasks done, output:

```
✅ Mission complete: {goal}

Tasks:
- ✅ {title} — verified
- ✅ {title} — verified

Output: {project_path}
Duration: {elapsed}
```

## Failure Handling

| Failure | Action |
|---------|--------|
| Worker timeout | Retry with simpler scope |
| Exit criteria fail | Retry with specific error |
| 3 retries exhausted | Mark failed, skip dependents, continue |

## Rules

- One worker per task, default model, no critic
- Workers self-verify task exit criteria; the parent independently checks them. For durable/evidence-heavy missions, task success is not release approval—advance only through the canonical manifest and external gate.
- Don't hardcode model names — use whatever's available
- Don't hold state in memory — be ready for context loss
- Don't start servers in tasks
