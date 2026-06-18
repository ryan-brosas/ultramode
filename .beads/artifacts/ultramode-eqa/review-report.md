# Review Report: ultramode-eqa

## Verdict

`changes-requested` — 4 high-confidence findings, all low/medium severity, 0 criticals. The implementation is functionally correct (54/54 tests pass, build clean, all 8 PRD requirements satisfied), but 4 minor gaps exist between the PRD's stated acceptance criteria and the exact test assertions, plus one stale planning artifact.

**Ready for close:** false

## Review Summary

- Agents run: 5 (SpecPRD, SpecPlan, BugScan, GitHistory, CommentCompliance)
- Total raw findings: 5
- High-confidence (≥80): 4
- False positives filtered: 1 (SpecPlan duplicate of context-capsule finding, merged)

## Findings

### #1: PRD acceptance criterion "rejects within 200ms" not explicitly asserted (confidence: 82)

- **Agent:** SpecPRD
- **Severity:** low
- **File:** `test/error-paths.test.ts`#343-350
- **Issue:** PRD requirement #1 acceptance criterion (prd.md:607) states "verify it rejects within 200ms". The test "rejects with timeout error when complete never resolves" asserts `.rejects.toThrow("timed out")` but does not assert a wall-clock upper bound. In practice the test uses `timeoutMs=50` and resolves in ~50ms (suite total 305ms), so behavior is correct — but the explicit timing assertion the PRD specified is absent.
- **Recommendation:** Either (a) add an explicit timing assertion (e.g. measure elapsed time and assert `< 200ms`), or (b) update the PRD acceptance criterion to match the actual verification method (assertion of rejection + the test using a short timeout override is sufficient evidence). Option (b) is simpler and more honest — wall-clock timing assertions are fragile and environment-dependent.

### #2: PRD acceptance criterion "opts.signal.aborted is false at call time" not asserted (confidence: 85)

- **Agent:** SpecPRD
- **Severity:** low
- **File:** `test/error-paths.test.ts`#352-366, #368-383
- **Issue:** PRD requirement #2 acceptance criterion (prd.md:98, also prd.json:17) explicitly states "verify `opts.signal.aborted` is false at call time". Both signal tests assert `opts.signal instanceof AbortSignal` but neither asserts `opts.signal.aborted === false`. The signal is in fact not aborted at call time (abort only fires in the timer callback after `timeoutMs`), so behavior is correct — but the specific sub-assertion the PRD asked for is missing.
- **Recommendation:** Add `expect(calls[0].signal.aborted).toBe(false)` to the "passes AbortSignal to complete()" test and `expect(simpleCalls[0].signal.aborted).toBe(false)` to the "completeSimple fallback receives the signal" test. Two one-line additions.

### #3: context-capsule.md line 22 says "MUST NOT use Promise.race" — contradicts shipped code (confidence: 90)

- **Agent:** SpecPlan
- **Severity:** low
- **File:** `.beads/artifacts/ultramode-eqa/context-capsule.md`#22
- **Issue:** The context capsule (a planning artifact handed to the /ship agent) still contains constraint #6: "MUST NOT use `Promise.race` — The native `signal` parameter on `complete()`/`completeSimple()` cancels the underlying HTTP request. `Promise.race` would leave the HTTP connection open." The shipped implementation at `index.ts:380` uses `Promise.race([callLLM(), timeout])`. `decisions.md` was updated (Decision #1 rewritten, Rejected Alternative #1 marked OVERTURNED), and `prd.md` risk table was corrected — but `context-capsule.md` was not updated. A future developer reading the context capsule would see a "MUST NOT" constraint that the code violates.
- **Recommendation:** Update `context-capsule.md` line 22 to reflect the shipped approach: "Use `AbortController` + `signal` AND `Promise.race` together (defense-in-depth). See decisions.md Decision #1." This is a planning artifact, not production code, so the impact is documentation accuracy only — but stale constraints in handoff documents cause real confusion.

### #4: Test comment implies caller error handlers are tested — they are not (confidence: 90)

- **Agent:** CommentCompliance
- **Severity:** low
- **File:** `test/error-paths.test.ts`#336-340
- **Issue:** The comment block above the `describe("decide timeout")` block states: "The existing caller error handlers (runSelection, handleTurnEnd) catch this error and idle the loop." This claim is factually true (verified at `index.ts:459-468` and `index.ts:623-632` — both callers have try/catch that calls `ctx.ui.notify`, sets `state.mode='idle'`, calls `persistState`, `updateWidget`, and returns), but none of the 6 tests in this block invoke `runSelection()` or `handleTurnEnd()`. All 6 tests call `decide()` directly. The comment presents an untested claim as part of what "this test block verifies", which could mislead a reader into thinking caller behavior is asserted here.
- **Recommendation:** Either (a) drop the third sentence from the comment ("The existing caller error handlers (runSelection, handleTurnEnd) catch this error and idle the loop."), or (b) rephrase to clarify it's verified separately: "Caller error handlers (runSelection, handleTurnEnd) catch this error and idle the loop — verified by code inspection at index.ts:459-468 and index.ts:623-632, not by this test block."

## Spec ↔ Code Adherence

- PRD requirement coverage: 8/8 requirements implemented and functionally satisfied
- Plan task coverage: 4/4 tasks completed (Wave 1: constant + decide() rewrite; Wave 2: 6 tests; Wave 3: full verification; Risk Mitigation Deviation Assessment)
- Drift from plan: The plan specified signal-only (no `Promise.race`). The /ship implementation uses `Promise.race` + signal (defense-in-depth). This deviation is **acceptable and necessary**: (1) the plan's own tests mock `complete()` to return `new Promise<never>(() => {})` — these mocks ignore the abort signal, so signal-only would cause `decide()` to hang and tests to time out at 5000ms; (2) the plan's own Risk Mitigation Details (plan.md:518-546) explicitly identified the signal-only gap and concluded `Promise.race` + signal together was the correct approach; (3) `decisions.md` was updated to document the deviation (Decision #1, Rejected Alternative #1 overturned). The implementation is MORE robust than the plan specified — it closes the gap the plan identified but chose not to fix for YAGNI reasons.

## Residual Risks

- **Provider ignores abort signal** — NOT verified live. The `Promise.race` approach addresses this gap (the timeout promise rejects independently of the provider), and the unit test "rejects with timeout error when complete never resolves" proves the path works against a never-resolving mock. However, no live provider test was run. A real provider that ignores the signal behaves identically to a never-resolving promise from `decide()`'s perspective, so the test is a faithful proxy. Accepted.
- **120s timeout too short for slow models** — NOT verified. 120s is a judgment call based on the decision prompt being a short JSON response. Only verifiable in production with a real slow model. Accepted.
- **120s timeout too long (UX)** — NOT verified. This is a UX judgment call, not a correctness issue. No live session test measured the perceived delay. Accepted.
- **Timer cleanup** — PARTIALLY verified. The `finally` block ensures `clearTimeout` runs on all exit paths. The test suite completing in 305ms with no hanging process is indirect evidence. No test explicitly asserts `clearTimeout` was called. Accepted — the PRD's own Approach section (prd.md:530-537) explicitly accepted this verification method.

## Summary

The implementation is functionally correct and all 8 PRD requirements are satisfied — 54/54 tests pass, build typechecks clean, and the `Promise.race` + signal defense-in-depth approach is more robust than the plan's signal-only design. The 4 findings are all low-severity documentation/test-assertion gaps: two missing test assertions that the PRD's acceptance criteria explicitly asked for, one stale planning artifact (`context-capsule.md`) that contradicts the shipped code, and one misleading test comment. None are blocking, but all should be addressed before `/close` — the fixes are small (2 one-line test assertions, 1 doc update, 1 comment rewording).
