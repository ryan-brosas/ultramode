# Context Capsule: ultramode-eqa

## Objective

Add a 120-second timeout to the `decide()` function in `index.ts` using `AbortController` and the native `signal` parameter on `complete()`/`completeSimple()`. When the LLM provider hangs, `decide()` currently blocks forever — the loop appears active but is silently stuck. With this fix, `decide()` will throw a timeout error that the existing caller error handlers (`runSelection`, `handleTurnEnd`) catch to notify the user and idle the loop. This is a surgical change to one function plus tests — no caller changes, no new files, no new dependencies.

## Key Patterns

- **Exported internals for testing** — The codebase exports `getState`, `runSelection`, `handleTurnEnd`, `parseDecision`, phase maps, `MAX_RETRIES`, and `CONTROL_TYPE` as named exports for direct unit testing. `DECISION_TIMEOUT_MS` follows this pattern. Reference: `index.ts:110` for `MAX_RETRIES`, `index.ts:114` for `CONTROL_TYPE`, conventions.md line 34.
- **Module mocking with cache-busted imports** — Tests use `installPiAiMock()` from `test/mocks.ts` which calls `bun:test`'s `mock.module("@oh-my-pi/pi-ai", ...)`. Tests import `index.ts` via `importIndex(label)` which does `import(\`../index.ts?${label}-${Date.now()}\`)` to bust the Bun module cache so the mock registers before the module loads. Reference: `test/mocks.ts:147-161`.
- **Optional parameter with production default** — The `timeoutMs` parameter defaults to `DECISION_TIMEOUT_MS`. Production callers don't pass the arg; tests pass a small value. This matches the codebase pattern of exporting internals — the parameter is part of the public contract, not a test backdoor. Reference: conventions.md line 34, `index.ts:327`.
- **try/catch with notify+idle error path** — Both callers of `decide()` wrap it in try/catch. On error, they call `ctx.ui.notify(msg, "error")`, set `state.mode = "idle"`, call `persistState()`, call `updateWidget()`, and return. The timeout error flows through this existing path. Reference: `index.ts:436-446` (runSelection), `index.ts:599-610` (handleTurnEnd).
- **complete() → completeSimple() fallback** — `decide()` tries `complete()` first, falls back to `completeSimple()` if it throws. This handles providers that require `ApiKeyResolver` instead of a static string. The timeout must not break this fallback — if `complete()` throws for a non-timeout reason, `completeSimple()` is still called with the same signal. Reference: `index.ts:354-359`, test at `test/error-paths.test.ts:38-74`.

## Constraints

1. **MUST NOT modify callers** — `runSelection()` (index.ts:370-525) and `handleTurnEnd()` (index.ts:557-775) must not change. They already have correct try/catch error handling.
2. **MUST NOT add new files** — The test goes in `test/error-paths.test.ts` (existing convention for `decide()` error path tests). No `test/decide-timeout.test.ts`.
3. **MUST NOT add npm dependencies** — `AbortController`, `setTimeout`, `clearTimeout` are all runtime globals. No imports needed.
4. **MUST NOT change the `complete()` → `completeSimple()` fallback logic** — The fallback only changes to: (a) pass `signal`, and (b) skip fallback when the signal is already aborted (timeout fired during `complete()`).
5. **MUST use `finally { clearTimeout(timer) }`** — Not manual `clearTimeout` at each exit point. The `finally` block is the idiomatic cleanup pattern.
6. **Use `AbortController` + `signal` AND `Promise.race` together (defense-in-depth)** — The native `signal` parameter on `complete()`/`completeSimple()` cancels the underlying HTTP request for providers that respect it. `Promise.race` guarantees `decide()` returns on timeout regardless of provider behavior. Both layers are needed: signal-only is untestable (mocks ignore abort signals) and hangs if a provider ignores the signal. See decisions.md Decision #1 and Rejected Alternative #1 (overturned during /ship).
7. **MUST NOT use env vars or config files** — `DECISION_TIMEOUT_MS` is a hardcoded constant. Configurability is YAGNI.
8. **MUST pass all existing tests** — 48+ existing tests must pass unchanged. The `timeoutMs` parameter is backward-compatible (optional with default).
9. **SHOULD keep the timeout at 120s** — 120s is generous for a JSON decision prompt. Shorter risks false positives on slow models. Longer means the loop appears stuck.
10. **MUST NOT modify `test/mocks.ts`** — The existing `installPiAiMock` already accepts custom `complete`/`completeSimple` implementations. No changes needed.

## File Ownership

| Task | Allowed | Forbidden |
|------|---------|-----------|
| 1.1 (add constant) | `index.ts` (line ~111 only) | All other files, all other lines in index.ts |
| 1.2 (add timeout to decide) | `index.ts` (lines 327-366 only — the `decide()` function) | All other files, all other functions in index.ts |
| 2.1 (add tests) | `test/error-paths.test.ts` (append new describe block) | All other files, existing tests in error-paths.test.ts |
| 3.1 (verification) | None (read-only) | All files |

## Graph Context

- **Blast radius:** 2 files (0 new, 2 edits, 0 deletes) — `index.ts` and `test/error-paths.test.ts`
- **Related beads:** 0 — standalone bugfix, no dependencies, no dependents
- **File history:** `index.ts` has 0 prior bead history per `bv --robot-file-hotspots`. `test/error-paths.test.ts` has 0 prior bead history. Only memory files (`.omp/memory/project/*`) have bead history — these are NOT touched.
- **Hotspots touched:** None — no files with >3 bead history are modified
- **Critical path:** No — single track (track-A), does not block other work
- **Forecast:** 66 min (bv estimate, confidence 0.4) / 30 min (PRD estimate) — real work is ~15 min code + ~15 min tests
