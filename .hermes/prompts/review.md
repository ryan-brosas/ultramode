---
description: "5 parallel review agents independently review, then findings are scored and filtered at ≥80 threshold."
argument-hint: "<bead-id or defaults to HEAD changes>"
---

## Bead ID Resolution

`$ARGUMENTS` may be a short suffix (3-6 chars, e.g. `0ks`) or a full ID. Resolve it:

1. Try `br show "$ARGUMENTS" --json` — if it returns the bead, use that ID.
2. If it fails, suffix-match: `br list --status open --status in_progress --status closed --json`, filter IDs ending with `$ARGUMENTS`.
3. If exactly one match → use it. If multiple → list them and ask the user. If none → STOP: "No bead found matching $ARGUMENTS."

Use the resolved ID as `BEAD_ID` for all steps below.

## Prerequisites (CHECK FIRST)

1. `.beads/artifacts/$BEAD_ID/completion-evidence.json` exists with verification results.
2. `git diff HEAD~1` (or `git diff main...HEAD`) shows changes to review.
3. Bead status is not `closed`.

If no evidence: STOP. "Run /verify first — no verification evidence for $BEAD_ID."
If no changes: STOP. "No changes to review. Run /ship first."
If closed: STOP. "$BEAD_ID is already closed."

## Phase 0: Skip Check

Before launching review agents, check if review is needed:

| Condition | Action |
|-----------|--------|
| `.beads/artifacts/$BEAD_ID/review-report.md` already exists with `approved` | Skip — already reviewed. Report existing findings. |
| Bead is `draft` status | Skip — draft beads aren't ready for review. |
| Diff is trivial (< 20 lines, only comments/whitespace) | Skip — "Trivial change. Mark `approved` with note." |

If skipping: write a minimal review-report.md with `verdict: approved`, `findings: []`, reason for skip. Then report and stop.

## Phase 1: Graph Context

Use Hermes shell execution for graph queries:

```bash
bv --robot-file-hotspots --format json
bv --robot-file-relations <changed-files> --format json
br show "$BEAD_ID" --json
```

Use this to understand blast radius and risk context. Skip if `bv` is unavailable.

## Phase 2: Read PRD + Plan

Read `.beads/artifacts/$BEAD_ID/prd.md` and `.beads/artifacts/$BEAD_ID/plan.md`. Extract:
- Requirements checklist (from PRD)
- Implementation tasks (from plan)
- Non-goals and constraints

These are the spec the implementation must satisfy.

## Phase 3: Read Changed Files

For each changed production file:

```bash
bv --robot-file-beads <file> --format json
git log --oneline -5 -- <file>
```

Read the full file changes via `git diff`. Focus on the diff, not the whole file.

## Phase 4: Launch 5 Parallel Review Agents

Launch each via Hermes `delegate_task`, and run them in parallel when possible. Each agent returns a list of findings with preliminary confidence scores.

### Agent 1: Spec Compliance (PRD)

Assignment:
- Read `.beads/artifacts/$BEAD_ID/prd.md`.
- For each requirement:
  - Does the implementation satisfy it?
  - Is anything missing or incomplete?
  - Did the implementation add scope beyond the PRD?

Return:
```json
[{ "requirement": "string", "satisfied": true, "issue": null, "confidence": 0 }]
```

### Agent 2: Spec Compliance (Plan)

Assignment:
- Read `.beads/artifacts/$BEAD_ID/plan.md`.
- For each task:
  - Was it completed?
  - Are there stubs, TODOs, or placeholder implementations?
  - Does the implementation match the task description?

Return:
```json
[{ "task": "string", "completed": true, "issue": null, "confidence": 0 }]
```

### Agent 3: Bug Scan

Assignment:
- Read ONLY the git diff (changed lines, not whole files).
- Scan for:
  - Obvious logic errors (off-by-one, inverted conditions, missing null checks)
  - Error handling gaps (uncaught promises, missing try/catch on fallible ops)
  - Resource leaks (unclosed handles, missing cleanup)
  - Race conditions (shared mutable state without synchronization)

Focus on LARGE bugs. Skip pedantic nitpicks and style issues.
Ignore pre-existing bugs in unchanged code.
Ignore issues linters/typecheckers would catch.

Return:
```json
[{ "file": "path", "line": 1, "issue": "string", "severity": "critical|high|medium", "confidence": 0 }]
```

### Agent 4: Git History Context

Assignment:
- For each changed file, check `git blame` and `git log` on the modified lines:
  - Do recent changes to the same lines reveal a pattern of bugs?
  - Do the modified functions have a history of reverts or hotfixes?
  - Do commit messages on nearby code mention related issues?

Return:
```json
[{ "file": "path", "line": 1, "issue": "string", "evidence": "string", "confidence": 0 }]
```

### Agent 5: Code Comment Compliance

Assignment:
- Read comments in the changed files (not the diff — the actual file).
- For each comment that states a rule, constraint, or warning (for example: `// IMPORTANT: always check X before Y`):
  - Does the implementation comply?
  - Are comments now stale/misleading after this change?

Return:
```json
[{ "file": "path", "line": 1, "comment": "string", "complies": true, "issue": null, "confidence": 0 }]
```

## Phase 5: Confidence Scoring

For each finding from Phase 4, launch a parallel scoring pass using Hermes `delegate_task` where helpful. Use the rubric below verbatim:

| Score | Meaning |
|-------|---------|
| 0 | Not confident. False positive that doesn't stand up to light scrutiny, or pre-existing issue. |
| 25 | Somewhat confident. Might be real, might be false positive. Could not verify. |
| 50 | Moderately confident. Verified real, but minor or rare. Not important relative to the PR. |
| 75 | Highly confident. Double-checked. Very likely real and important. Directly impacts functionality. |
| 100 | Absolutely certain. Double-checked. Definitely real, happens frequently, evidence confirms. |

For PRD/Plan compliance issues: verify the requirement/task is actually in the artifact, not interpreted.
For bug findings: verify the bug is in changed lines, not pre-existing.
For history findings: verify the evidence supports the claim.

## Phase 6: Filter and Write Report

Filter: keep only findings scored ≥80. If none survive: report "No high-confidence issues."

1. **Read the template**: `.hermes/templates/review-report.md`
2. **Fill in every `{placeholder}`** with the filtered findings from Phases 4-5:
   - **Verdict**: `approved` (0 high-confidence findings or all addressed), `changes-requested` (≥1 high-confidence, no criticals), `blocked` (≥1 critical)
   - **Ready for close**: `true` if verdict is `approved` and no unresolved critical/high findings, `false` otherwise
   - **Review Summary**: fill agent counts and finding stats from Phase 4-5 results
   - **Findings**: each high-confidence (≥80) finding gets its own `### #N` block with title, agent, severity, file, issue, recommendation
   - **Spec ↔ Code Adherence**: from Phase 2-3 reading of PRD + plan — what's covered, what's missing
   - **Residual Risks**: risks from plan not covered by verification — accepted or deferred
   - **Summary**: 2-3 sentence verdict — safe to merge or not
3. **Write** to `.beads/artifacts/$BEAD_ID/review-report.md`

Prefer Hermes file tools for reading/writing prompt artifacts and Hermes shell execution for `git`, `br`, and `bv` commands.

## Phase 6c: Quality Self-Check

Before reporting success, verify the review report passes these checks:

- [ ] review-report.md exists at `.beads/artifacts/$BEAD_ID/review-report.md`
- [ ] review-report.md ≥200 lines (`wc -l`)
- [ ] Verdict is set: `approved`, `changes-requested`, or `blocked`
- [ ] Ready for close is set: `true` or `false`
- [ ] All 5 agents are represented: Spec Compliance (PRD), Spec Compliance (Plan), Bug Scan, Git History, Code Comment Compliance
- [ ] review-report.md is ≥ 200 lines
- [ ] No template placeholders remain in the report
- [ ] Spec ↔ Code Adherence section is filled — not just "N/A"

```bash
# Verify minimum line count
LINES=$(wc -l < .beads/artifacts/$BEAD_ID/review-report.md)
echo "Review report: $LINES lines (minimum 200)"
[ "$LINES" -ge 200 ] || echo "BELOW_MINIMUM — expand the report"

# Verify no template placeholders remain
python3 - <<'PY'
from pathlib import Path
path = Path('.beads/artifacts') / '$BEAD_ID' / 'review-report.md'
content = path.read_text()
placeholders = [
    '{bead-id}',
    '{approved | changes-requested | blocked}',
    '{one-line justification}',
    '{true | false}',
    '{N}',
    '{which agents}',
    '{title}',
    '{0-100}',
    '{which review agent found this}',
    '{critical | high | medium | low}',
    '{path}',
    '{line}',
    "{what's wrong — concrete, specific}",
    '{how to fix — actionable}',
    '{M}',
    '{None | description of deviations and why}',
    "{Risk not covered by verification — and why it's accepted or deferred}",
    '{2-3 sentences — what passed, what needs attention, whether this is safe to merge.}',
]
remaining = [item for item in placeholders if item in content]
if remaining:
    print('PLACEHOLDERS_REMAIN:', ', '.join(remaining))
    raise SystemExit(1)
print('PLACEHOLDERS_OK')
PY

# Verify verdict is set on the verdict line
grep -Eq '^`(approved|changes-requested|blocked)` — .+' .beads/artifacts/$BEAD_ID/review-report.md
# Must return a match
```

If any check fails, go back to Phase 6 and fix the report. Do not report success with a thin review report.

## Phase 6b: Auto-Commit

Create a scoped commit for the `/review` output before reporting success.

```bash
br sync --flush-only
git status --short
git add .beads/
git add .beads/artifacts/"$BEAD_ID"/review-report.md
git commit -m "docs: review $BEAD_ID"
```

Stage only review artifacts and bead sync state. Do not stage unrelated user changes. If there is nothing to commit, record that observed status in the report instead of fabricating a commit.

## Phase 7: Report

```text
Bead: $BEAD_ID | Verdict: <approved|changes-requested|blocked>
Agents: 5 run | Findings: <N> raw → <M> high-confidence (≥80)
Severity: <critical> critical, <high> high, <medium> medium
Ready for close: <true/false>
Next: /pr $BEAD_ID (if approved) or address findings above
```

Set verdict:
- `approved` — 0 high-confidence findings, or all addressed
- `changes-requested` — ≥1 high-confidence finding, no criticals
- `blocked` — ≥1 critical finding
