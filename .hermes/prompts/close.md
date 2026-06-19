---
description: "Close the active bead only after evidence exists and the remaining follow-ups are explicit."
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
1. `.beads/artifacts/$BEAD_ID/completion-evidence.json` exists with passing verification.
2. `.beads/artifacts/$BEAD_ID/review-report.md` exists with `ready_for_close: true` or verdict `approved`.

If no evidence: STOP. Tell the user: "Run /verify first — no completion evidence for $BEAD_ID."
If no review: STOP. Tell the user: "Run /review first — no review report for $BEAD_ID."
If review found unresolved issues: STOP. List the unresolved findings. "Address these before closing."
Do NOT proceed. Do NOT "helpfully" skip ahead.

Close the active bead.

## Phase 1: Read Review

Read `.beads/artifacts/$BEAD_ID/review-report.md` using Hermes file tools. Confirm:
- No unresolved findings (severity `critical` or `high` must be addressed)
- `ready_for_close` is `true`
- Residual risks are documented and accepted

## Phase 2: Close

Use Hermes shell execution:

```bash
ACTOR="${BR_ACTOR:-assistant}"
br close --actor "$ACTOR" "$BEAD_ID" --reason "Completed. See .beads/artifacts/$BEAD_ID/ for evidence." --json
```

## Phase 3: Check Queue Impact

Use Hermes shell execution:

```bash
br ready --json                              # Newly unblocked work
br blocked --json                            # Confirm no new blockers
```

## Phase 4: Sync

Use Hermes shell execution:

```bash
br sync --flush-only
git add .beads/ && git commit -m "close: $BEAD_ID"
```

## Phase 5: Session End

Use Hermes shell execution:

```bash
git pull --rebase
br sync --flush-only
git add .beads/ && git commit -m "Update issues"
git push
git status  # MUST show "up to date with origin"
```

## Phase 6: Report

```text
Closed: $BEAD_ID
Summary: <one-line summary of what was built>
Evidence: .beads/artifacts/$BEAD_ID/
Unblocks: <list of newly actionable beads, or "None">
Follow-ups: <suggested new beads for residual work, or "None">
```
