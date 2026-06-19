---
description: "Wave-sequence into implementation plan. Graph-informed — uses bv for tracks, impact, forecasting, and capacity."
argument-hint: "<bead-id>"
---

## Bead ID Resolution

`$ARGUMENTS` may be a short suffix (3-6 chars, e.g. `0ks`) or a full ID. Resolve it:

1. Try `br show "$ARGUMENTS" --json` — if it returns the bead, use that ID.
2. If it fails, suffix-match: `br list --status open --status in_progress --status closed --json`, then filter IDs ending with `$ARGUMENTS`.
3. If exactly one match → use it. If multiple → list them and ask the user. If none → STOP: "No bead found matching $ARGUMENTS."

Use the resolved ID as `BEAD_ID` for all steps below.
Before doing ANYTHING, verify:
1. `.beads/artifacts/$BEAD_ID/prd.md` exists
2. `.beads/artifacts/$BEAD_ID/prd.json` exists
3. PRD has all sections filled (Problem, Scope, Requirements, Approach, Success Criteria) — no placeholders

If PRD missing: STOP. Tell the user: "Run /create first — no PRD found for $BEAD_ID."
If PRD has placeholders: STOP. Tell the user: "PRD incomplete — run /create to fill all sections."
Do NOT proceed. Do NOT "helpfully" skip ahead.

You are planning implementation for bead $BEAD_ID. Use the graph to inform sequencing.

## Phase 1: Graph Context

```bash
bv --robot-plan --format json                 # Execution tracks — parallel-safe waves
bv --robot-insights --format json             # Graph metrics — PageRank, critical path
bv --robot-file-hotspots --format json        # Riskiest files — touch with care
bv --robot-forecast "$BEAD_ID" --format json  # ETA prediction
br show "$BEAD_ID" --json                     # Bead details
br dep tree "$BEAD_ID" --json                 # Full dependency tree
```

From the graph:
- What tracks exist — group work into parallel waves
- What's the blast radius — which files will change
- What's the ETA — is this realistic for one session?
- What files are hotspots — touch with extra care

## Phase 2: Decompose

Break the work into tasks. For each task:
- What it does (1-2 sentences)
- Files it touches (check `bv --robot-file-hotspots` for hot files)
- Dependencies (what must finish first)
- Can it run in parallel? (check `bv --robot-plan` tracks)
- Estimated minutes

## Phase 3: Wave-Sequence

Organize tasks into waves:

```
Wave 1 (parallel): tasks with no dependencies
Wave 2 (parallel): tasks that depend only on Wave 1
Wave N: tasks that depend on Wave N-1
```

Within a wave, tasks that touch different files can run in parallel.

## Phase 4: Write Artifacts

**For each artifact below, follow this exact process:**
1. **Read the template** with `read_file` from `.hermes/templates/<name>`.
2. **Fill in every `{placeholder}`** with concrete evidence from Phases 1-3. Delete no sections. Add no new top-level sections. Replace every `{placeholder}` — no `{placeholder}` left unfilled.
3. **Write the filled file** to `.beads/artifacts/$BEAD_ID/<name>` using `write_file`.
4. If you must revise an already-written artifact, use `patch` for targeted updates instead of rewriting blindly.

### plan.md

Template: `.hermes/templates/plan.md`

Fill from graph context (Phase 1) and decomposition (Phases 2-3):
- **Graph Context**: blast radius (N files, M new/O edits/P deletes), unblocks, blocked by, critical path, forecast, hotspots
- **Observable Truths**: falsifiable statements — what "done" looks like
- **Required Artifacts table**: what files, what they provide, path, status
- **Wave Structure table**: wave #, tasks, parallel?, preconditions, verification gate
- **Tasks per wave** with code outlines (NOT implementation, just the shape — function signatures, types, key logic flow)
- **Full Verification** section with exact bash commands and expected output

### tasks.md

Template: `.hermes/templates/tasks.md`

- YAML metadata per task: depends_on, parallel, conflicts_with, files, estimated_minutes
- Concrete checkboxes per task step — no vague "implement X"
- Verification check per task — a command that proves the task is done

### context-capsule.md

Template: `.hermes/templates/context-capsule.md`

- Objective (one paragraph — what are we building and why)
- Key patterns with file references (what to copy, preserve, or avoid)
- Constraints (MUST/SHOULD lists — hard boundaries for implementation)
- File ownership table (allowed vs forbidden per task)
- Graph context summary (blast radius, related beads, file history, hotspots)

## Phase 5: Verify

```bash
br lint "$BEAD_ID" --json
bv --robot-suggest --format json
br dep cycles --json                         # Must be empty
ls .beads/artifacts/"$BEAD_ID"/plan.md .beads/artifacts/"$BEAD_ID"/tasks.md .beads/artifacts/"$BEAD_ID"/context-capsule.md
# Density check: each artifact must be ≥600 lines
echo "Plan: $(wc -l < .beads/artifacts/$BEAD_ID/plan.md) lines (minimum 600)"
echo "Tasks: $(wc -l < .beads/artifacts/$BEAD_ID/tasks.md) lines (minimum 600)"
echo "PRD:  $(wc -l < .beads/artifacts/$BEAD_ID/prd.md) lines (minimum 600)"
echo "Bundle: $(cat .beads/artifacts/$BEAD_ID/*.md | wc -l) lines (minimum 1800 across all artifacts)"

br sync --flush-only
```

## Phase 6: Report

```
Plan: $BEAD_ID
Waves: <N> | Tasks: <N> total, <N> parallel
Blast radius: <N files> (<M new, O edits, P deletes)
Forecast: <N minutes>
Verification gates: <N>
Next: /ship $BEAD_ID
```
