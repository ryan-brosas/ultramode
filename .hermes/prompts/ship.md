---
description: "Implement. Graph-informed — checks file history, impact, and related work before coding."
argument-hint: "<bead-id>"
---

## Bead ID Resolution

`$ARGUMENTS` may be a short suffix (3-6 chars, e.g. `0ks`) or a full ID. Resolve it:

1. Run `br show "$ARGUMENTS" --json` with the `terminal` tool — if it returns the bead, use that ID.
2. If it fails, suffix-match: run `br list --status open --status in_progress --status closed --json`, then filter IDs ending with `$ARGUMENTS`.
3. If exactly one match → use it. If multiple → list them and ask the user. If none → STOP: "No bead found matching $ARGUMENTS."

Use the resolved ID as `BEAD_ID` for all steps below.

## Prerequisites (CHECK FIRST)

Before doing ANYTHING, verify:
1. `.beads/artifacts/$BEAD_ID/prd.md` exists — this defines WHAT to build
2. `.beads/artifacts/$BEAD_ID/plan.md` exists — this defines HOW to build it
3. `.beads/artifacts/$BEAD_ID/tasks.md` exists — this decomposes HOW into steps

Use `read_file` to inspect these files. If you need to check existence first, use `terminal`.

If PRD missing: STOP. Tell the user: "Run /create first — no PRD found for $BEAD_ID."
If plan missing: STOP. Tell the user: "Run /plan first — no plan found for $BEAD_ID."
If tasks missing: STOP. Tell the user: "Run /plan first — no tasks found for $BEAD_ID."

You are implementing bead $BEAD_ID. The PRD defines WHAT to build, the plan defines HOW. Both must stay in sync.

## Phase 0: PRD-Plan Alignment

Before touching any code, verify the plan hasn't drifted from the PRD:

1. **Read the PRD** with `read_file`: `.beads/artifacts/$BEAD_ID/prd.md`
   - Note every MUST requirement (these are the contract)
   - Note every explicit Out of Scope boundary (do not cross these)
   - Note the Success Criteria (these are the proof of completion)

2. **Read the plan** with `read_file`: `.beads/artifacts/$BEAD_ID/plan.md`
   - Does every MUST requirement have a corresponding task?
   - Do the verification gates cover every Success Criterion?
   - Does the plan touch anything the PRD marked Out of Scope?

3. **If the plan is misaligned:**
   - Missing requirements → STOP. "Plan doesn't cover PRD requirement #N. Run /plan to update."
   - Plan exceeds scope → STOP. "Plan includes <X> which PRD marked Out of Scope. Fix the plan or update the PRD."
   - Plan tasks don't map to requirements → warn but proceed (the plan may decompose differently than the PRD organized them)

4. **If aligned**: proceed to Phase 1.

## Phase 1: Graph Check

Use the `terminal` tool to run:

```bash
bv --robot-triage --format json              # Have priorities shifted?
bv --robot-alerts --format json              # Any new blockers or stale issues?
br show "$BEAD_ID" --json                    # Bead details
br dep tree "$BEAD_ID" --json                # Dependencies
```

If priorities shifted or new blockers appeared, report before proceeding.

## Phase 2: File Context

Before editing any file, check its history.

Use the `terminal` tool to run:

```bash
bv --robot-file-beads <file> --format json     # What tasks touched this file?
bv --robot-file-relations <file> --format json # What files co-change with this?
```

**Token efficiency:** For tasks touching >5 files, check only the 3 most critical files (by blast radius) plus any hotspots (`bv --robot-file-hotspots`). Use `--format toon` for large result sets.

This prevents:
- Reverting someone else's work
- Missing files that should co-change
- Breaking changes that depend on patterns in the file

## Phase 3: Claim

Use the `terminal` tool to run:

```bash
ACTOR="${BR_ACTOR:-assistant}"
br update --actor "$ACTOR" "$BEAD_ID" --status in_progress --claim --json
```

## Phase 4: Implement

Follow the plan in `.beads/artifacts/$BEAD_ID/plan.md`. Cross-reference the PRD at each step.

For each task:
1. Read context capsule with `read_file` (`.beads/artifacts/$BEAD_ID/context-capsule.md`)
2. Check file history (Phase 2)
3. **Cross-check the PRD**: which requirement(s) does this task satisfy? If a task doesn't trace to a PRD requirement, ask: is this scope creep?
4. Implement the change using Hermes editing tools (`write_file` for full rewrites, `patch` for targeted edits)
5. Update `.beads/artifacts/$BEAD_ID/progress.txt` — mark task done
6. Run the wave's verification gate before starting next wave
7. **Re-read the PRD's Out of Scope** before starting each wave — if you're about to touch something excluded, STOP

## Phase 5: Verify

Use the `terminal` tool to run:

```bash
br lint "$BEAD_ID" --json                    # Lint changed files
br dep cycles --json                         # Must still be empty
```

Run project-specific verification (tests, build, typecheck) before proceeding.

## Phase 5c: Quality Self-Check

Before reporting success, verify the implementation passes these checks:

- [ ] All tasks in plan.md/tasks.md are marked complete — progress.txt updated
- [ ] No stub functions, TODO comments, or placeholder implementations in changed files
- [ ] Every verification gate from the plan was actually run — not skipped
- [ ] No files outside the plan's blast radius were modified (unless documented)
- [ ] PRD requirements traced to implementation — every MUST requirement has code

```bash
# Check for stubs/TODOs in files changed by the current /ship work
git diff --name-only HEAD | xargs -r grep -l "TODO\|FIXME\|STUB\|NotImplemented" 2>/dev/null
# Should output nothing — if files appear, review and address or document why

# Verify progress.txt is up to date
cat .beads/artifacts/$BEAD_ID/progress.txt
# All tasks should show completed state

# Verify no out-of-scope files changed by the current /ship work
git diff --name-only HEAD
# Compare against plan.md blast radius — any unexpected files need justification
```

If any check fails, go back to Phase 4 and address the issue. Do not report IMPLEMENTED with stubs or incomplete tasks.

## Phase 5b: Auto-Commit

Create a scoped commit for the `/ship` implementation before reporting success.

Use the `terminal` tool to run:

```bash
br sync --flush-only
git status --short
git add <files changed by this bead>
git add .beads/
git commit -m "feat: implement $BEAD_ID"
```

Stage only implementation files changed for this bead plus bead sync/progress artifacts. Do not stage unrelated user changes. If the correct conventional prefix is not `feat`, use `fix`, `refactor`, `docs`, or `test` to match the actual change. If there is nothing to commit, record that observed status in the report instead of fabricating a commit.

## Phase 6: Report

```
Bead: $BEAD_ID | Status: IMPLEMENTED
Files changed: <N> (<+additions> <-deletions>)
Verification gates passed: <N>/<N>
Next: /verify $BEAD_ID
```

## Guardrails

- Always use `read_file` before editing workflow/spec files you need to inspect
- Always check file history before editing (`bv --robot-file-beads`)
- Always check co-changing files (`bv --robot-file-relations`)
- Use `terminal` for bash/CLI commands
- Use `write_file` or `patch` for edits; do not rely on shell redirection for file editing
- If graph check reveals priority shift, ask before proceeding
- Keep edits scoped to the bead
- For discovered work >2 min, ask before creating a bead
