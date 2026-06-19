---
name: reflection-checkpoints
description: Use during /ship execution to add self-assessment checkpoints that detect scope drift, stalled progress, and premature completion claims. Pairs with verification-before-completion (correctness vs trajectory).
---

# Reflection Checkpoints

Long-running autonomous execution drifts silently. By the time you notice, you've burned context on the wrong thing. Reflection checkpoints force self-assessment at critical moments — catching drift before it compounds.

**Core principle:** Pause to assess, don't just assess to pause.

## When to Use

- During `/ship` after completing 50%+ of tasks
- When a task takes significantly longer than estimated
- Before claiming any task or phase is complete

## When NOT to Use

- Simple, single-task work (< 3 tasks)
- Pure research or exploration commands
- Trivial changes with no scope risk

## The Four Reflection Types

### 1. Mid-Point Check

**Trigger:** After completing ~50% of planned tasks

```
## Mid-Point Reflection

**Progress:** [N/M] tasks complete

### Scope Check
- [ ] Am I still solving the original problem?
- [ ] Have I introduced any unplanned work?
- [ ] Are remaining tasks still correctly scoped?

### Quality Check
- [ ] Do completed tasks actually work (not just "done")?
- [ ] Any verification steps I deferred?
- [ ] Any TODO/FIXME I left that needs addressing?

### Efficiency Check
- [ ] Am I spending context on the right things?
- [ ] Should remaining tasks be parallelized?
- [ ] Any tasks that should be deferred to a follow-up bead?

**Assessment:** [On track / Drifting / Blocked]
**Adjustment:** [None needed / Describe change]
```

### 2. Completion Check

**Trigger:** Before claiming any task or phase is complete

```
## Completion Check

**Claiming complete:** [task/phase name]

### Evidence Audit
- [ ] Verification command was run (not assumed)
- [ ] Output confirms the claim (not inferred)
- [ ] No stub patterns in modified files
- [ ] Imports/exports are wired (not just declared)

### Goal-Backward Check
- [ ] Does this task achieve its stated end-state?
- [ ] Would a user see the expected behavior?
- [ ] If tested manually, would it work?

**Verdict:** [Complete / Needs work: describe what]
```

### 3. Near-Limit Warning

**Trigger:** When context usage is high and remaining tasks may not fit

```
## Near-Limit Warning

**Remaining tasks:** [N]

### Triage
1. What MUST be done before stopping? [list critical]
2. What CAN be deferred? [list deferrable]
3. What should be handed off? [list with context needed]

### Action
- [ ] Compress completed work
- [ ] Prioritize remaining tasks ruthlessly
- [ ] Prepare handoff if needed

**Decision:** [Continue / Compress and continue / Handoff now]
```

### 4. Phase Transition Check

**Trigger:** At phase boundaries (plan→ship, ship→verify, verify→review)

```
## Phase Transition: [Previous] → [Next]

### Previous Phase Assessment
- **Objective met?** [Yes / Partially / No]
- **Artifacts produced:** [list]
- **Open issues carried forward:** [list or "none"]

### Next Phase Readiness
- [ ] Prerequisites satisfied
- [ ] Context is clean (no stale noise)
- [ ] Correct skills loaded for next phase

**Proceed:** [Yes / Need to resolve: describe]
```

## Integration Points

### In `/ship`

After every ceil(totalTasks / 2) tasks, run **Mid-Point Check**. Before each task completion claim, run **Completion Check**.

### At phase boundaries

At each step boundary (plan→ship, ship→verify, verify→review), run **Phase Transition Check**.

### Context pressure

When context is running low, run **Near-Limit Warning** regardless of task position.

## Reflection Log

Append all reflections to `.beads/artifacts/$BEAD_ID/progress.txt` (under a `## Reflections` heading):

```markdown
## Reflection Log

### [timestamp] Mid-Point Check
Assessment: On track
Adjustment: None

### [timestamp] Completion Check — Task 3
Verdict: Complete
Evidence: typecheck pass, test pass (12/12)

### [timestamp] Near-Limit Warning
Decision: Compress and continue
Deferred: Task 6 (cosmetic cleanup) → follow-up bead
```

## Gotchas

- **Don't over-reflect** — these are quick self-checks, not long analyses. Each should take < 30 seconds of reasoning.
- **Don't block on minor drift** — if drift is cosmetic (variable naming, style), note it and continue. Only pause for scope drift.
- **Not a replacement for verification** — reflections assess trajectory, not correctness. Always run actual verification commands.

## Anti-Patterns

| Anti-Pattern | Instead |
|-------------|---------|
| Skipping reflection to "save time" | 5 minutes of reflection saves hours of wrong-direction work |
| Reflecting without documenting decisions | Write it down — unrecorded reflection is wasted |
| Treating reflection as a sign of failure | It's a quality gate, not a backtrack indicator |
| Reflecting only when things go wrong | Check in at success points too — capture what worked |
| No action items from reflection | Every reflection should produce 1-3 concrete next steps |
