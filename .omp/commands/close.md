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

Read `.beads/artifacts/$BEAD_ID/review-report.md`. Confirm:
- No unresolved findings (severity `critical` or `high` must be addressed)
- `ready_for_close` is `true`
- Residual risks are documented and accepted

## Phase 1.5: Memory Audit

Before closing the bead, audit the project's durable memory files. The conventions.md Memory File Maintenance section mandates: **"Every `/close`: agent checks if any conventions/decisions/gotchas were discovered during the bead and proposes updates."**

This phase is a structural gate — you cannot close a bead without auditing memory. Stale memory degrades every subsequent agent's decision quality.

### Sub-step a: Gather Evidence

Read the bead's artifacts to understand what changed:

- `.beads/artifacts/$BEAD_ID/prd.md` — what was supposed to change
- `.beads/artifacts/$BEAD_ID/plan.md` — what was planned (if exists)
- `.beads/artifacts/$BEAD_ID/completion-evidence.json` — what actually happened
- `git log --oneline -20` — recent commit history
- `git diff HEAD~1 --name-only` — files changed (if applicable)

### Sub-step b: Read Current Memory State

Read all 5 memory files exactly as they exist on disk:

1. `.omp/memory/project/project.md`
2. `.omp/memory/project/conventions.md`
3. `.omp/memory/project/decisions.md`
4. `.omp/memory/project/gotchas.md`
5. `.omp/memory/project/tech-stack.md`

### Sub-step c: Detect Drift

For each memory file, answer the checklist question explicitly. You MUST state a conclusion for every file — silence is not evidence of checking.

| Memory File | Check Question | Specific Triggers |
|-------------|----------------|-------------------|
| project.md | Does "Current Phase" reflect reality after this bead? | Status changed? Milestone achieved? "Next" field stale? "The Goal" needs refinement? |
| conventions.md | Were any conventions introduced, changed, or removed? | New command, new git rule, workflow step change, new agent convention, memory rule change, skill structure change |
| decisions.md | Were any architecture decisions made that aren't recorded? | Choice between 2+ viable alternatives with long-term consequences. NOT: implementation details, process steps, bug fixes |
| gotchas.md | Were any pitfalls or workarounds discovered? Did any existing gotchas become stale? | New 5-column entry (Date, Area, Gotcha, Impact, Mitigation) needed? Template bootstrap gotcha now obsolete? |
| tech-stack.md | Were any tool versions, dependencies, or verification commands changed? | New br/bv version, new dependency, new verification command, new constraint |

For each file, output:

```
**<file>:** <No drift | Drift detected | Uncertain> — <evidence>
```

### Sub-step d: Propose Updates

For each file where drift is detected, show the exact current content and the proposed change:

```
--- <file-path> (current)
+++ <file-path> (proposed)
@@ <section>
-<current verbatim text>
+<proposed verbatim text>

Apply this update to <file>? (yes/no/skip)
```

IMPORTANT: Do NOT auto-approve any proposal. Do NOT edit any file without explicit user confirmation. Every proposal must be shown as a diff first. Proposals must be concrete — verbatim text to add/change/remove. No vagueness.

If no drift is detected in any file:
- Output: "No memory file updates needed."
- Proceed directly to Phase 2.

### Sub-step e: Apply or Reject

For each user response:
- "yes" → Apply the edit using the edit tool. Re-read the file to confirm the change applied correctly.
- "no" → Document: "Rejected: <file> — <description>"
- "skip" → Document: "Skipped: <file> — user will handle manually"

After all proposals are resolved:

IF at least one "yes":
  - Apply all approved edits
  - Report: "Memory audit complete. Applied: <list>. Rejected: <list>. Skipped: <list>."
  - Proceed to Phase 2.

IF zero "yes" (all "no" or "skip"):
  - STOP. Do NOT proceed to Phase 2.
  - Output: "Memory audit blocked close — user rejected all proposed updates."
  - Output: "Bead $BEAD_ID remains open. Resolve memory drift manually or re-run /close."
  - Do NOT run `br close`.

### Prohibited Behaviors

- NEVER auto-approve or skip the approval prompt — every edit requires user "yes"
- NEVER edit a memory file without showing the diff first
- NEVER proceed to Phase 2 if ALL proposals were rejected
- NEVER skip the audit because "the bead was small" — audit every close, every time
- NEVER use `honcho_remember` as a substitute for memory file updates
- NEVER propose vague updates ("consider updating X") — be concrete
- NEVER delete user-authored content without explicit justification in the proposal
- NEVER edit a file without re-reading it immediately before applying (race condition defense)

### Edge Cases

| Situation | Action |
|-----------|--------|
| Memory file is missing | Report "Missing: <path>". Ask "Continue without it? (yes/no)". If no → STOP. |
| Memory file is malformed | Report "Warning: <file> appears malformed — <issue>". Propose fix separately. |
| PRD missing | Fall back to git diff only. Note "Partial audit — no PRD context." |
| Bead directly touched memory files | Report and verify consistency with bead scope. |
| No git diff available | Note limitation. Proceed with available evidence. |
| Update exceeds size target | Warn. Offer: apply anyway / trim / skip. |
| User aborts mid-audit | Stop immediately. No edits. Report "Audit aborted. Bead still open." |
| Can't determine if drift exists | Report "Uncertain: <file> — <reason>". Ask for manual review. |

## Phase 2: Close

```bash
ACTOR="${BR_ACTOR:-assistant}"
br close --actor "$ACTOR" "$BEAD_ID" --reason "Completed. See .beads/artifacts/$BEAD_ID/ for evidence." --json
```

## Phase 3: Check Queue Impact

```bash
br ready --json                              # Newly unblocked work
br blocked --json                            # Confirm no new blockers
```

## Phase 4: Sync

```bash
br sync --flush-only
git add .beads/ && git commit -m "close: $BEAD_ID"
```

## Phase 5: Session End

```bash
git pull --rebase
br sync --flush-only
git add .beads/ && git commit -m "Update issues"
git push
git status  # MUST show "up to date with origin"
```

## Phase 6: Report

```
Closed: $BEAD_ID
Summary: <one-line summary of what was built>
Evidence: .beads/artifacts/$BEAD_ID/
Unblocks: <list of newly actionable beads, or "None">
Follow-ups: <suggested new beads for residual work, or "None">
```
