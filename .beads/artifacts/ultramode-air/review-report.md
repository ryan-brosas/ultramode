# Review Report: ultramode-air

## Verdict

`changes-requested` — 3 high-confidence findings: retry-logic tests pass for the wrong reason (assert only on constants, never exercise the retry branch), hasPendingMessages guard test exercises the mock not the code, and mockExtensionAPI is dead infrastructure leaving Risk 4 (scheduler fallback) unexercised.

**Ready for close:** false

## Review Summary

- Agents run: 5 (Spec PRD, Spec Plan, Bug Scan, Git History, Comment Compliance)
- Total raw findings: 5 (2 satisfied-with-notes from PRD/Plan + 3 bug findings)
- High-confidence (≥80): 3
- False positives filtered: 2 (Git History: [] no findings; Comment Compliance: [] no findings)

## Findings

### #1: Retry-logic tests pass for the wrong reason (confidence: 95)

- **Agent:** Bug Scan
- **Severity:** high
- **File:** `test/retry-logic.test.ts`#1-73
- **Issue:** All 8 tests assert only on exported constant values (`COMMAND_FROM_PHASE`, `PHASE_WHITELIST`, `MAX_RETRIES`). None call the actual retry branch in `index.ts`#711-750. Verified empirically by the reviewer: reverting `COMMAND_FROM_PHASE` back to `PHASE_WHITELIST` (the original bug) AND removing the reset-to-selection else branch both produce zero test failures. Tests like "retries at the cap take the blocked branch" assert `MAX_RETRIES < MAX_RETRIES === false` — a tautology that cannot fail regardless of the retry implementation. The PRD (Req #4) claims tests cover "retries increment under MAX_RETRIES, at MAX_RETRIES triggers blocked+selection, no-command case resets to selection (not stuck)" — none of these behaviors are actually exercised.
- **Recommendation:** Add tests that invoke the `turn_end` event handler (or extract the retry decision-handling into a testable function) with a mock `decide()` returning `{action:"retry"}`, then assert: (a) `sendUserMessage` is called with `COMMAND_FROM_PHASE[phase]` not `PHASE_WHITELIST[phase]`, (b) `state.retries` increments, (c) at cap, `markBlocked` path fires (mock `pi.exec` br update), (d) no-command case resets `state.phase` to "selecting" and calls `runSelection`. This requires mocking `decide()` via `mock.module()` on `@oh-my-pi/pi-ai` (already supported by `installPiAiMock`).

### #2: hasPendingMessages guard test exercises the mock, not the code (confidence: 85)

- **Agent:** Bug Scan
- **Severity:** medium
- **File:** `test/error-paths.test.ts`#68-73
- **Issue:** Risk 2 (sendUserMessage re-entrancy guard at `index.ts`#804) is claimed as tested (PRD line 101, risk-coverage table line 242). The test "hasPendingMessages mock is callable when provided" only verifies that the mock spy function itself is callable and returns `true`. It never calls `handleTurnEnd` or the `turn_end` event handler, so it does not verify the early-return behavior of the guard. The guard at `index.ts`#804 (inside the `ultramode()` factory's `turn_end` handler) is never invoked by any test.
- **Recommendation:** Register the `ultramode(pi)` factory with a `mockExtensionAPI` + `mockExtensionContext({hasPendingMessages: true})`, emit a `turn_end` event, and assert that `handleTurnEnd` is NOT called (e.g. `pi.exec` spy has zero calls, or `decide` mock not invoked). Then repeat with `hasPendingMessages: false` and assert the handler proceeds.

### #3: mockExtensionAPI is dead infrastructure; Risk 4 (scheduler fallback) unexercised (confidence: 90)

- **Agent:** Bug Scan
- **Severity:** medium
- **File:** `test/mocks.ts`#88-117
- **Issue:** `mockExtensionAPI()` is exported but never imported or used by any test file (verified: `grep mockExtensionAPI test/*.test.ts` returns no matches outside mocks.ts). Consequently, Risk 4 (scheduler empty → `br list` fallback, PRD line 103, risk-coverage table line 244) has no test coverage despite being claimed in the PRD. The `runSelection()` function (`index.ts`#370-525), which contains the scheduler fallback logic, is never exercised by any test. Risk 4 remains unchecked, contradicting the PRD's claim that all 5 risks are converted to checked.
- **Recommendation:** Add a test that calls `runSelection` (export it or invoke via the `ultramode(pi)` factory's `session_start`/`on` handler) with `mockExtensionAPI({execResults: [{stdout: '{"recommendations":[]}', code: 0}, {stdout: '[]', code: 0}]})` and assert that the second `pi.exec` call uses `br list` args (the fallback). Alternatively, export `runSelection` and test it directly with a mocked `decide()`.

## Spec ↔ Code Adherence

- PRD requirement coverage: 8/8 requirements implemented (all tests pass, all files exist, runner works). However, 3 of the 5 "unchecked risks" the PRD claims to convert to checked (Risks 2, 4, and partially the retry-path aspect of the stuck-loop fix) are not actually exercised by executable tests — see findings #1-#3.
- Plan task coverage: 9/9 tasks completed (Wave 1: 1.1, 1.2; Wave 2: 2.1-2.5; Wave 3: 3.1, 3.2). All verification gates pass.
- Drift from plan: Minor — `extractText` signature tightened from `any` to `unknown` with runtime type narrowing (PRD Export Strategy specified only adding `export`). This is a type-safety improvement, not a behavior change, and does not violate the out-of-scope "no module refactor" constraint. Also `mocks.ts` exports `installPiAiMock` and `importIndex` helpers not specified in PRD Req #6, but these implement the module-mocking approach the PRD itself prescribes (Risk 1, line 100).

## Residual Risks

- Risk 1 (complete() API key resolution fails for some providers): the `completeSimple` fallback path is tested (`test/error-paths.test.ts`#36-64). Accepted as covered.
- Risk 2 (sendUserMessage re-entrancy): guard exists at `index.ts`#804 but NOT exercised by any test — see finding #2. Deferred: requires invoking the `turn_end` handler.
- Risk 3 (ctx.model undefined): tested (`test/error-paths.test.ts`). Accepted as covered.
- Risk 4 (br scheduler returns zero recommendations): fallback exists in `runSelection` (`index.ts`#370-525) but NOT exercised by any test — see finding #3. Deferred: requires invoking `runSelection`.
- Risk 5 (LLM returns invalid JSON): tested (`test/parse-decision.test.ts`). Accepted as covered.
- Live OMP session behavior: out of scope per PRD. Accepted.
- Worktree enforcement: out of scope per PRD. Accepted.

## Summary

The test harness builds, all 44 tests pass, and the 8 PRD requirements are nominally satisfied. However, 3 high-confidence findings reveal that the retry-logic tests, the hasPendingMessages guard test, and the scheduler-fallback risk coverage all pass for the wrong reasons — they assert on constants or mock callability rather than exercising the actual code paths they claim to guard. The tests are not wrong about what they assert, but they do not prove the bug fixes and runtime risks they were created to cover. Address findings #1-#3 by adding tests that invoke the actual `handleTurnEnd`/`runSelection`/`turn_end` handler paths with mocked `decide()` and `pi.exec` before this bead is safe to merge.
