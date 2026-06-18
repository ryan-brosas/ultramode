# Review Report: ultramode-air

## Verdict

`approved` — Previous review's 3 high-confidence findings (retry tests pass for wrong reason, hasPendingMessages guard unexercised, mockExtensionAPI dead/Risk 4 uncovered) are all resolved. Re-review found 2 new medium-severity test-quality issues (missing `beadId` assertion in no-command test, misleading comment); both were fixed inline during this review.

**Ready for close:** true

## Review Summary

- Agents run: 5 (Spec PRD, Spec Plan, Bug Scan, Git History, Comment Compliance)
- Total raw findings: 4 (3 satisfied-with-notes from PRD + 1 new bug + 1 comment issue)
- High-confidence (≥80): 2 (both addressed inline)
- False positives filtered: 2 (Git History: [] no findings; Plan: 1 finding at conf 100, no issue)

## Findings

### #1: No-command retry test missing beadId assertion (confidence: 80) — ADDRESSED

- **Agent:** Bug Scan
- **Severity:** medium
- **File:** `test/retry-logic.test.ts`#224-276
- **Issue:** The "no-command retry case resets to selection" test asserts `after.phase === "selecting"` and `after.retries === 0`, but both were already true before `handleTurnEnd` was called (state was initialized with `phase: "selecting"`, `retries: 0`). The critical missing assertion was `expect(after.beadId).toBeNull()` — without it, if the no-command branch idled without clearing `beadId`, the test would still pass. Mutation testing by the reviewer confirmed: replacing the reset branch with `state.mode='idle'` left the test passing. Same class of bug as original finding #1 (tests that pass for the wrong reason).
- **Recommendation:** Applied — added `expect(after.beadId).toBeNull()` at line 274. The no-command test now verifies that `beadId` is cleared from `"ultramode-nocmd"` to `null`, which would fail if the reset branch were removed.

### #2: Misleading comment in retries-increment test (confidence: 85) — ADDRESSED

- **Agent:** Comment Compliance
- **Severity:** medium (comment accuracy, not test correctness)
- **File:** `test/retry-logic.test.ts`#150
- **Issue:** Comment stated "Third retry: 2 → 3 (at cap, next call should trigger blocked branch)" but the test never performs a third `handleTurnEnd` call — it only asserts `MAX_RETRIES === 3`. The comment described an action that does not occur in the test, creating confusion about what the test verifies.
- **Recommendation:** Applied — rewrote comment to "Confirm MAX_RETRIES is 3 (the blocked branch is tested separately below)." at line 150.

## Spec ↔ Code Adherence

- PRD requirement coverage: 8/8 requirements implemented. All 5 unchecked risks from the PRD are now genuinely exercised:
  - Risk 1 (complete() API key resolution): `completeSimple` fallback tested in `error-paths.test.ts`#36-64.
  - Risk 2 (sendUserMessages re-entrancy): `hasPendingMessages` guard tested via `turn_end` handler in `error-paths.test.ts`#76-118. Guard verified to skip `handleTurnEnd` when pending=true, proceed when false.
  - Risk 3 (ctx.model undefined): tested in `error-paths.test.ts`#11-24.
  - Risk 4 (br scheduler empty): `runSelection` fallback tested in `error-paths.test.ts`#172-228. Fallback to `br list` verified when recommendations empty, skipped when non-empty.
  - Risk 5 (LLM invalid JSON): tested in `parse-decision.test.ts`.
- Plan task coverage: 9/9 tasks completed (Wave 1: 1.1, 1.2; Wave 2: 2.1-2.5; Wave 3: 3.1, 3.2).
- Drift from plan: `extractText` signature tightened from `any` to `unknown` (type-safety improvement, not behavior change). `mocks.ts` exports `installPiAiMock` and `importIndex` helpers beyond PRD Req #6 (implement module-mocking the PRD prescribes at Risk 1). `getState`, `runSelection`, `handleTurnEnd` exported to enable behavioral tests (fix for original review findings).

## Residual Risks

- Live OMP session behavior: out of scope per PRD. Accepted.
- Worktree enforcement: out of scope per PRD. Accepted.
- `runSelection()` success path (decision.action === "select"): not directly tested because it requires `decide()` to return a select decision with a beadId, then calls `pi.exec("br", ["update", ...])` — the error path and fallback are tested, but the select-success path relies on `complete()` mocking which is exercised indirectly. Accepted as a follow-up consideration.

## Summary

The previous review's 3 high-confidence findings are all genuinely resolved: retry tests now invoke `handleTurnEnd` with mocked `decide()` and assert on `sendUserMessage`/`state` mutations, the `hasPendingMessages` guard is tested via the actual `turn_end` handler, and `runSelection`'s scheduler fallback is exercised directly. The re-review found 2 new medium test-quality issues (a missing `beadId` assertion and a misleading comment), both fixed inline during this review. All 48 tests pass, build succeeds, lint clean. This bead is safe to merge.
