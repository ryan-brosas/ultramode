---
description: "Create a pull request from bead artifacts, verification evidence, and review findings."
argument-hint: "<bead-id>"
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(gh pr create:*), Bash(gh pr view:*), Read, Glob
disable-model-invocation: false
---

## Bead ID Resolution

`$ARGUMENTS` may be a short suffix (3-6 chars, e.g. `0ks`) or a full ID. Resolve it:

1. Try `br show "$ARGUMENTS" --json` — if it returns the bead, use that ID.
2. If it fails, suffix-match: `br list --status open --status in_progress --status closed --json`, filter IDs ending with `$ARGUMENTS`.
3. If exactly one match → use it. If multiple → list them and ask the user. If none → STOP: "No bead found matching $ARGUMENTS."

Use the resolved ID as `BEAD_ID` for all steps below.

## Prerequisites (CHECK FIRST)

Before doing ANYTHING, verify:

1. `.beads/artifacts/$BEAD_ID/review-report.md` exists with verdict `approved`.
2. `.beads/artifacts/$BEAD_ID/completion-evidence.json` exists — no `failedChecks` without resolution.
3. Current branch has unmerged commits (not on main/master).

If no review: STOP. "Run /review first — no review report for $BEAD_ID."
If review has `changes-requested` or `blocked`: STOP. "Review found issues — address before PR."
If on main/master: STOP. "Create a feature branch for $BEAD_ID first."
Do NOT proceed. Do NOT "helpfully" skip ahead.

## Context

- Current branch: !`git branch --show-current`
- Unmerged commits: !`git log origin/main..HEAD --oneline || git log main..HEAD --oneline`
- Changed files: !`git diff --stat origin/main...HEAD || git diff --stat main...HEAD`
- Bead: !`br show "$BEAD_ID" --json 2>/dev/null || echo '{"id":"$BEAD_ID"}'`

## Artifacts to Read

Read these in parallel:
- `.beads/artifacts/$BEAD_ID/prd.md` — problem and requirements
- `.beads/artifacts/$BEAD_ID/plan.md` — implementation plan
- `.beads/artifacts/$BEAD_ID/completion-evidence.json` — verification results
- `.beads/artifacts/$BEAD_ID/review-report.md` — review findings and verdict

## Your Task

Create a PR in a single message. Do not send any other text or messages besides the tool calls.

### PR Title

```
<bead-id>: <one-line summary of the change>
```

### PR Body

```markdown
## What

<2-4 bullet points from prd.md problem statement and plan.md implementation>

## Why

<1-2 sentences linking to the PRD motivation>

## Verification

- <N>/<N> checks passed (from completion-evidence.json)
- <list key passing checks>

## Review

- Verdict: <approved>
- Findings: <N> (<M critical, O high, P medium, Q low>)
- Residual risks: <list from review report>

---

🤖 Generated with [OMP](https://omp.sh) | Bead: `$BEAD_ID` | Worktree: `.worktree/!`git branch --show-current``
```

### PR Command

```bash
gh pr create \
  --title "$BEAD_ID: <summary>" \
  --body "<body from above>" \
  --base main
```

### After Success

Report:
```
PR: <url>
Bead: $BEAD_ID
Verification: <N>/<N> passed
Review: approved
Next: /close $BEAD_ID (after merge)
```
