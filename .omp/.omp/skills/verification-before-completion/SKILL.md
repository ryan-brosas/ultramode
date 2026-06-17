---
name: verification-before-completion
description: Use when about to claim work is complete — requires running verification and confirming output before success claims. Evidence before assertions, always.
---

# Verification Before Completion

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** Evidence before claims, always.

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this message, you cannot claim it passes.

**Violating the letter of this rule is violating the spirit of this rule.**

## When to Use

- Before claiming tests/lint/build pass or a bug is fixed
- Before committing, opening PRs, or stating completion
- Before advancing from `/ship` to `/verify`, or `/verify` to `/review`

## When NOT to Use

- While still actively coding without a completion claim
- When you cannot run verification yet (resolve dependencies first)

## Progressive Verification Escalation

Verification depth scales with session activity. The more you do, the more you verify.

| Session Activity | Minimum Verification | When |
|------------------|---------------------|------|
| 1-2 edits | Run the specific check (lint, typecheck, test for changed file) | After each edit |
| 3-5 edits | Full lint + typecheck + related tests | Before next edit batch |
| 6+ edits | Full suite (lint + typecheck + test + build) | Before claiming done |
| Before commit/push | At minimum: lint + typecheck | Always |
| Before `/pr` or `/close` | Full suite + completion evidence stamp | Always |

**Never say "it should work."** Run the command, read the output, report the result.

## The Gate Function

```
BEFORE claiming any status:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   → NO: State actual status with evidence
   → YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying.
```

## Verification Checklist

- [ ] Identify the exact command that proves the claim
- [ ] Run the full command (fresh — no cached results)
- [ ] Read the full output and exit code
- [ ] Confirm the output matches the claim
- [ ] Only then state the completion claim with evidence

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|---------------|
| "Tests pass" | Test command output: 0 failures | Previous run, "should pass" |
| "Linter clean" | Linter output: 0 errors | Partial check, extrapolation |
| "Build succeeds" | Build command: exit 0 | Linter passing, "logs look good" |
| "Bug fixed" | Test original symptom: passes | Code changed, assumed fixed |
| "Regression test works" | Red-green cycle verified | Test passes once |
| "Requirements met" | Line-by-line checklist against PRD | Tests passing alone |

## Red Flags — STOP

Using any of these? You're about to lie. Stop and run verification:

- "should", "probably", "seems to"
- "This should fix it", "That should resolve the issue"
- "I'm fairly certain", "Based on my understanding"
- "It's just a minor change", "Nothing else should be affected"
- "All done!", "Ready for review", "Committing now"

**If any of these appear in your draft, delete them and replace with actual verification output.**

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence ≠ evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter ≠ compiler ≠ tests |
| "I'm tired" | Exhaustion ≠ excuse |
| "Partial check is enough" | Partial proves nothing |
| "Different words so rule doesn't apply" | Spirit over letter |

## Project Type Detection

Detect what verification commands are available:

| Project Type | Detect Via | Lint | Typecheck | Test | Build |
|-------------|------------|------|-----------|------|-------|
| Node/TypeScript | `package.json` | `npm run lint` or `npx oxlint` | `npm run typecheck` or `npx tsc --noEmit` | `npm test` or `npx vitest run` | `npm run build` |
| Rust | `Cargo.toml` | `cargo clippy -- -D warnings` | (included in build) | `cargo test` | `cargo build` |
| Python | `pyproject.toml` | `ruff check .` | `mypy .` | `pytest` | — |
| Go | `go.mod` | `golangci-lint run` | (included in build) | `go test ./...` | `go build ./...` |
| Bun | `bun.lock` or `bunfig.toml` | `bun run lint` | `bun run typecheck` | `bun test` | `bun run build` |

If no package manifest or script exists, report that gate as not applicable with evidence.

## Parallel Execution

Run independent gates simultaneously to reduce wall-clock time:

```
Parallel: typecheck + lint → both must pass
Sequential: test → build (ship only)
```

Total time = max(typecheck, lint) + test, not typecheck + lint + test.

## Smart Verification

### Incremental by Default

Unless shipping or `--full` is passed, verify only what changed:

- **Lint**: scoped to changed files
- **Test**: scoped to related tests for changed files
- **Typecheck**: always full (type errors propagate across files)

### Verification Cache

If you just verified and nothing changed, don't re-verify:

1. After gates pass, note the commit/state
2. Before running gates, compare current state to last verified state
3. If match → report cached PASS, skip redundant work
4. Cache is always bypassed for `--full` and `/ship`/`/pr`

## Completion Evidence Stamp

The structured evidence record for terminal actions (`/close`, `/pr`):

```
.beads/artifacts/<bead-id>/completion-evidence.json
```

Contract:

- `/close` and `/pr` require fresh PASS evidence
- Evidence records: gate names, statuses, commands run, fingerprint (file hashes)
- Evidence must NOT include: raw stdout/stderr, secrets, credentials, private logs
- The evidence file itself is excluded from fingerprint input

Minimal stamp:

```json
{
  "beadId": "<id>",
  "timestamp": "<ISO 8601>",
  "gates": {
    "lint": "PASS",
    "typecheck": "PASS",
    "test": "PASS",
    "build": "PASS"
  },
  "fingerprint": "<sha256 of changed file paths + hashes>",
  "verdict": "READY"
}
```

## Phantom Completion Detection

Tasks can "pass" verification while containing stub implementations:

- Functions that return hardcoded values
- Error handling that silently swallows exceptions
- Empty test suites (0 tests, "all pass")
- TODOs disguised as implementations
- Feature flags hardcoded to bypass logic

**Check:** grep changed files for `TODO`, `FIXME`, `stub`, `placeholder`, `not implemented`, `return null`, `pass` (Python), empty function bodies. If found → BLOCK.

## Key Patterns

**Tests:**
```
✅ [Run test command] [See: 34/34 pass] "All tests pass"
❌ "Should pass now" / "Looks correct"
```

**Regression tests (TDD Red-Green):**
```
✅ Write → Run (pass) → Revert fix → Run (MUST FAIL) → Restore → Run (pass)
❌ "I've written a regression test" (without red-green verification)
```

**Build:**
```
✅ [Run build] [See: exit 0] "Build passes"
❌ "Linter passed" (linter doesn't check compilation)
```

**Requirements:**
```
✅ Re-read PRD → Create checklist → Verify each → Report gaps or completion
❌ "Tests pass, phase complete"
```

## Anti-Patterns

| Anti-Pattern | Why It Fails | Instead |
|-------------|-------------|--------|
| Claiming "looks good" without running checks | Subjective, error-prone | Run the tool and show output |
| Only running lint | Doesn't catch type or logic errors | Pair lint with typecheck and test |
| Running full gates on every tiny edit | Slows development | Minimal gate during dev, full before ship |
| Trusting previous run results | Code may have changed | Fresh run every time |
| Skipping verification after "trivial" edits | Trivial edits cause bugs too | At minimum: lint + typecheck |
