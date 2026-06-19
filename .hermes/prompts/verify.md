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
1. Bead `$BEAD_ID` is claimed or `in_progress`: `br show "$BEAD_ID" --json` — status must be `in_progress` or have changes to verify.
2. `.beads/artifacts/$BEAD_ID/plan.md` exists — the verification section specifies what to check.

If bead not started: STOP. Tell the user: "Run /ship first — bead not in progress."
If plan missing: STOP. Tell the user: "Run /plan first — no verification plan exists."
Do NOT proceed. Do NOT "helpfully" skip ahead.

You are verifying bead `$BEAD_ID`. Use the graph to check completeness.

## Phase 1: Graph Context

```bash
bv --robot-triage --format json              # Is this bead still relevant?
bv --robot-alerts --format json              # Any alerts on this bead?
br show "$BEAD_ID" --json                    # Bead details
```

Run these with the Hermes `terminal` tool and use the JSON output in your reasoning.

## Phase 2: File Coverage

Check that all expected files were actually changed:

```bash
git diff --name-only HEAD~1                  # Actual changed files
```

Compare against the plan's blast radius. If blast radius includes files not changed, verify they were intentionally skipped.

Use Hermes tools to inspect the plan and changed files:
- `read_file` for `.beads/artifacts/$BEAD_ID/plan.md`
- `terminal` for `git diff --name-only HEAD~1`
- `search_files` only if you need to locate related files or confirm paths

## Phase 3: Run Verification

Read the plan's verification section: `.beads/artifacts/$BEAD_ID/plan.md` → **Full Verification**.

Run only the checks that prove the changed behavior:
- Feature: run the project's test suite (`npm test`, `cargo test`, `pytest`)
- Bugfix: reproduce the original symptom — it should now pass
- Task/chore: build succeeds, lint clean

Run the actual commands with the Hermes `terminal` tool. Do not claim pass without output.

```bash
br lint "$BEAD_ID" --json                    # Lint the bead
bv --robot-suggest --format json             # Hygiene check
```

## Phase 4: Write Completion Evidence

1. **Read the template** with Hermes `read_file`: `.hermes/templates/completion-evidence.json`
2. **Fill in every `{placeholder}`** with the actual results from Phase 3. Separate passed, failed, and unchecked. Be honest — a failed check recorded as "passed" is worse than no evidence at all.
3. **Write** the completed JSON with Hermes `write_file` to `.beads/artifacts/$BEAD_ID/completion-evidence.json`

Every check in `passedChecks` and `failedChecks` must include the exact command run, what was expected, and what actually happened. No vague "tests passed" — show the command and output.

`uncheckedRisks` must list every risk from the plan's Risks table that wasn't covered by verification, with a reason why.

`followUps` captures work discovered during verification that should become its own bead.

`artifacts` should point to the concrete outputs that support the verdict.

## Phase 4b: Quality Self-Check

Before reporting success, verify the completion evidence passes these checks:

- [ ] completion-evidence.json parses after stripping supported comment lines
- [ ] Every passedCheck has `command`, `expected`, and `result` fields — no vague "tests passed"
- [ ] Every failedCheck has `command`, `expected`, and `result` fields
- [ ] uncheckedRisks lists every plan risk not covered by verification, with a reason
- [ ] At least one passedCheck includes actual terminal output (not just "exit code 0")
- [ ] No template placeholders remain in the evidence file

```bash
# Verify the evidence parses after stripping supported comments
python3 -c "import json, re, pathlib; content = pathlib.Path('.beads/artifacts/$BEAD_ID/completion-evidence.json').read_text(); content = re.sub(r'^\s*//.*$', '', content, flags=re.MULTILINE); content = re.sub(r'<!--.*?-->', '', content, flags=re.DOTALL); json.loads(content); print('JSON_VALID')" && echo "JSON_VALID" || echo "JSON_INVALID"

# Verify no template placeholders remain
python3 - <<'PY'
from pathlib import Path
path = Path('.beads/artifacts') / '$BEAD_ID' / 'completion-evidence.json'
content = path.read_text()
placeholders = [
    '{bead-id}',
    '{pending|verified|failed}',
    "{one-line verdict — what passed, what didn't, what's unresolved}",
    '{exact command run}',
    '{what should happen}',
    '{what actually happened}',
    "{risk from plan that wasn't verified — and why}",
    '{relative path}',
    '{what this artifact proves or provides}',
    '{bead-id or description of follow-up work}',
]
remaining = [item for item in placeholders if item in content]
if remaining:
    print('PLACEHOLDERS_REMAIN:', ', '.join(remaining))
    raise SystemExit(1)
print('PLACEHOLDERS_OK')
PY

# Verify passedChecks is not empty (unless all checks genuinely failed)
# Manual: open the file and confirm each entry has concrete command output
```

If any check fails, go back to Phase 4 and fix the evidence. Do not report VERIFIED with incomplete evidence.

## Phase 5: Report

```
Bead: $BEAD_ID | Status: VERIFIED/FAILED
Checks passed: <N>/<N> | Failed: <N>
Evidence: .beads/artifacts/$BEAD_ID/completion-evidence.json
Next: /review $BEAD_ID (if verified) or fix issues (if failed)
```
