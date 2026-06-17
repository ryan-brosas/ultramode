---
description: "Test + evidence. Graph-informed — checks completeness against impact, file history, and downstream effects."
argument-hint: "<bead-id>"
---

## Bead ID Resolution

`$ARGUMENTS` may be a short suffix (3-6 chars, e.g. `0ks`) or a full ID. Resolve it:

1. Try `br show "$ARGUMENTS" --json` — if it returns the bead, use that ID.
2. If it fails, suffix-match: `br list --status open --status in_progress --status closed --json`, filter IDs ending with `$ARGUMENTS`.
3. If exactly one match → use it. If multiple → list them and ask the user. If none → STOP: "No bead found matching $ARGUMENTS."

Use the resolved ID as `BEAD_ID` for all steps below.
## Prerequisites (CHECK FIRST)

Before doing ANYTHING, verify:
1. Bead $BEAD_ID is claimed or in_progress: `br show "$BEAD_ID" --json` — status must be `in_progress` or have changes to verify.
2. `.beads/artifacts/$BEAD_ID/plan.md` exists — the verification section specifies what to check.

If bead not started: STOP. Tell the user: "Run /ship first — bead not in progress."
If plan missing: STOP. Tell the user: "Run /plan first — no verification plan exists."
Do NOT proceed. Do NOT "helpfully" skip ahead.

You are verifying bead $BEAD_ID. Use the graph to check completeness.

## Phase 1: Graph Context

```bash
bv --robot-triage --format json              # Is this bead still relevant?
bv --robot-alerts --format json              # Any alerts on this bead?
br show "$BEAD_ID" --json                    # Bead details
```

## Phase 2: File Coverage

Check that all expected files were actually changed:

```bash
git diff --name-only HEAD~1                  # Actual changed files
```

Compare against the plan's blast radius. If blast radius includes files not changed, verify they were intentionally skipped.

## Phase 3: Run Verification

Read the plan's verification section: `.beads/artifacts/$BEAD_ID/plan.md` → Full Verification.

Run only the checks that prove the changed behavior:
- Feature: run the project's test suite (`npm test`, `cargo test`, `pytest`)
- Bugfix: reproduce the original symptom — it should now pass
- Task/chore: build succeeds, lint clean

Run the actual commands. Do not claim pass without output.

```bash
br lint "$BEAD_ID" --json                    # Lint the bead
bv --robot-suggest --format json             # Hygiene check
```

## Phase 4: Write Completion Evidence

1. **Read the template**: `read .omp/templates/completion-evidence.json`
2. **Fill in every `{placeholder}`** with the actual results from Phase 3. Separate passed, failed, and unchecked. Be honest — a failed check recorded as "passed" is worse than no evidence at all.
3. **Write** to `.beads/artifacts/$BEAD_ID/completion-evidence.json`

Every check in `passedChecks` and `failedChecks` must include the exact command run, what was expected, and what actually happened. No vague "tests passed" — show the command and output.

`uncheckedRisks` must list every risk from the plan's Risks table that wasn't covered by verification, with a reason why.

`followUps` captures work discovered during verification that should become its own bead.

## Phase 5: Report

```
Bead: $BEAD_ID | Status: VERIFIED/FAILED
Checks passed: <N>/<N> | Failed: <N>
Evidence: .beads/artifacts/$BEAD_ID/completion-evidence.json
Next: /review $BEAD_ID (if verified) or fix issues (if failed)
```
