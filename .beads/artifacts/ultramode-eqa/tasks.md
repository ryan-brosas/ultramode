<!-- DENSITY: Minimum 600 lines. No upper bound. <600 = too thin — tasks lack detail, verification steps are vague, dependencies undefined. Every task needs a yaml block, concrete verification steps, and enough detail for parallel execution without reading the PRD or plan. -->
# Tasks: ultramode-eqa

## 1. Implement timeout constant

### 1.1 Add DECISION_TIMEOUT_MS constant

```yaml
depends_on: []
parallel: false
conflicts_with: []
files: ["index.ts"]
estimated_minutes: 2
```

**Context:** The constant `DECISION_TIMEOUT_MS` is a module-level export
that defines the maximum time (in milliseconds) the autonomous loop will
wait for an LLM decision before timing out. It is placed near `MAX_RETRIES`
because both are loop-safety constants. The value 120_000ms (2 minutes) is
generous for a JSON decision prompt — if a reasoning-capable model takes
longer than 120s to respond to a ~500-token prompt, it is likely hung, not
thinking.

The constant is exported (not just module-level) so:
1. Tests can import and verify the value (`import { DECISION_TIMEOUT_MS }`)
2. It appears in the module's public API surface, consistent with
   `MAX_RETRIES`, `CONTROL_TYPE`, `PHASE_WHITELIST`, etc.
3. The `decide()` function's default parameter references it

**Steps:**

- [ ] Open `index.ts` and locate line 110 (`export const MAX_RETRIES = 3;`)
- [ ] Add immediately after line 110:
  ```typescript
  export const DECISION_TIMEOUT_MS = 120_000; // 2 minutes — hung LLM recovery
  ```
- [ ] Verify the constant is at module level, exported, and near `MAX_RETRIES`
- [ ] Verify there are no duplicate declarations of `DECISION_TIMEOUT_MS`
- [ ] Verify: `grep -n "DECISION_TIMEOUT_MS" index.ts` shows the export on one line near line 111
- [ ] Verify: `bun build index.ts --no-bundle` still passes (the constant alone shouldn't break anything, but check)

## 2. Implement timeout in decide()

### 2.1 Add AbortController + timeout to decide()

```yaml
depends_on: ["1.1"]
parallel: false
conflicts_with: []
files: ["index.ts"]
estimated_minutes: 10
```

**Context:** The `decide()` function at `index.ts:327-366` is the single
load-bearing LLM call for the entire ultramode extension. It is called
from `runSelection()` (index.ts:437) and `handleTurnEnd()` (index.ts:601).
Both callers wrap it in try/catch and handle errors by notifying the user
and idling the loop.

The current `decide()` has no timeout — if `complete()` hangs, `decide()`
blocks forever. This task adds an `AbortController`-based timeout that
makes `decide()` throw a recognizable timeout error after `timeoutMs`
milliseconds. The existing caller error handlers catch this error and
idle the loop.

The approach uses the native `signal?: AbortSignal` parameter on
`complete()`/`completeSimple()` (declared at
`@oh-my-pi/pi-ai/dist/types/types.d.ts:143`). When the timeout fires,
`controller.abort()` triggers the signal. If the provider respects the
signal, `complete()` rejects with an `AbortError`. The catch block
checks `controller.signal.aborted` and throws the timeout error.

**Design decision — simple approach vs. Promise.race:**

The simple approach (signal only) works for providers that respect
`AbortSignal` (the vast majority). For providers that ignore the signal,
`decide()` may hang. This is a provider-level bug, not an ultramode bug.
Using `Promise.race` as a second layer would add complexity and introduce
its own risks (unhandled rejections, timer cleanup). The simple approach
is chosen per YAGNI — if a specific provider is known to ignore the
signal, a separate bead can add `Promise.race`.

**Steps:**

- [ ] Read `index.ts:327-366` — the current `decide()` function
- [ ] Change the function signature to add `timeoutMs` parameter:
  - From: `export async function decide(ctx: ExtensionContext, promptText: string): Promise<string>`
  - To: `export async function decide(ctx: ExtensionContext, promptText: string, timeoutMs: number = DECISION_TIMEOUT_MS): Promise<string>`
- [ ] After the `context` object construction (after line 351, the closing `};` of the context object) and before the `let result` declaration (line 353), add:
  ```typescript
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  ```
- [ ] Wrap the LLM call + text extraction in a `try { ... } finally { clearTimeout(timer); }` block:
  - The `try` block must contain: the `let result` declaration, the inner `try/catch` for complete→completeSimple fallback, the text extraction, and the `return text;`
  - The `finally` block must contain only: `clearTimeout(timer);`
- [ ] Inside the inner try block, modify the `complete()` call to pass `signal`:
  - From: `result = await complete(model, context, { apiKey });`
  - To: `result = await complete(model, context, { apiKey, signal: controller.signal });`
- [ ] In the catch block, add the aborted check BEFORE the `completeSimple()` fallback:
  ```typescript
  if (controller.signal.aborted) {
    throw new Error(
      `ultramode: LLM decision timed out after ${timeoutMs}ms`
    );
  }
  ```
  This must be the FIRST statement in the catch block, before the
  `completeSimple()` call. The reason: if the timeout fired during
  `complete()`, we should NOT retry with `completeSimple()` — the
  provider is unresponsive, and retrying would hang for another full
  timeout window.
- [ ] Modify the `completeSimple()` fallback call to pass `signal`:
  - From: `result = await completeSimple(model, context, { apiKey });`
  - To: `result = await completeSimple(model, context, { apiKey, signal: controller.signal });`
- [ ] Move the `const text = result.content...` extraction and `return text;` inside the outer try block (before the finally)
- [ ] Verify the `finally` block contains only `clearTimeout(timer);`
- [ ] Verify the complete function structure matches this shape:
  ```typescript
  export async function decide(
    ctx: ExtensionContext,
    promptText: string,
    timeoutMs: number = DECISION_TIMEOUT_MS
  ): Promise<string> {
    // ... model check, apiKey check, context construction ...

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let result: AssistantMessage;
      try {
        result = await complete(model, context, {
          apiKey,
          signal: controller.signal,
        });
      } catch (err) {
        if (controller.signal.aborted) {
          throw new Error(
            `ultramode: LLM decision timed out after ${timeoutMs}ms`
          );
        }
        result = await completeSimple(model, context, {
          apiKey,
          signal: controller.signal,
        });
      }

      const text = result.content
        .filter((b): b is TextContent => b.type === "text")
        .map((b) => b.text)
        .join("");
      return text;
    } finally {
      clearTimeout(timer);
    }
  }
  ```

**Verification:**

- [ ] `bun build index.ts --no-bundle` exits 0 (typecheck passes)
- [ ] `grep -n "AbortController" index.ts` shows `new AbortController()` on one line
- [ ] `grep -n "controller.signal" index.ts` shows at least 3 usages:
  - `controller.abort()` in the setTimeout callback
  - `signal: controller.signal` in the `complete()` call
  - `signal: controller.signal` in the `completeSimple()` call
  - `controller.signal.aborted` in the catch block
  - (4 total, but grep for "controller.signal" catches all)
- [ ] `grep -n "clearTimeout" index.ts` shows 1 usage in the finally block
- [ ] `grep -n "timed out" index.ts` shows 1 line with the error throw
- [ ] `grep -n "timeoutMs" index.ts` shows at least 3 lines:
  - parameter declaration (`timeoutMs: number = DECISION_TIMEOUT_MS`)
  - setTimeout call (`setTimeout(() => controller.abort(), timeoutMs)`)
  - error message (`timed out after ${timeoutMs}ms`)

## 3. Add timeout tests

### 3.1 Add decide timeout test block to error-paths.test.ts

```yaml
depends_on: ["2.1"]
parallel: false
conflicts_with: []
files: ["test/error-paths.test.ts"]
estimated_minutes: 15
```

**Context:** The test file `test/error-paths.test.ts` already contains
tests for `decide()` error paths: no-model (line 11), no-api-key (line 27),
completeSimple fallback (line 38). The new tests follow the same pattern:
use `installPiAiMock()` to mock `complete`/`completeSimple`, use
`importIndex(label)` to get a cache-busted import of `index.ts`, use
`mockExtensionContext()` to create a test context.

The tests are added to this file (not a new file) because:
1. The existing convention is that `decide()` error path tests live here
2. The file already imports all needed helpers
3. A new file would fragment `decide()` error testing across two files

The `describe("decide timeout", ...)` block is appended after the last
existing describe block (`describe("context helpers", ...)` which ends
at line 334).

**Test strategy:**

Each test uses `timeoutMs=50` (50ms) to keep the test fast. The test
waits at most ~100ms (50ms timeout + 50ms margin). The existing test
suite runs in ~1s; adding 6 tests with ~100ms each adds ~600ms —
acceptable.

For tests that need the LLM call to hang (never resolve), the mock
returns `new Promise<never>(() => {})` — a promise that never resolves
and never rejects. This simulates a hung provider.

For tests that need to capture the signal passed to `complete()` or
`completeSimple()`, the mock captures the `opts` argument and pushes it
to an array. After the test, assertions check `opts.signal`.

**Steps:**

- [ ] Open `test/error-paths.test.ts`
- [ ] Read the existing test structure — note the imports at lines 1-8 and the `describe` blocks
- [ ] Verify the file imports `installPiAiMock`, `importIndex`, `mockExtensionContext` from `./mocks.ts` (lines 2-7)
- [ ] Add a new `describe("decide timeout", ...)` block at the END of the file (after the `context helpers` describe block)

- [ ] Add test 1 — "rejects with timeout error when complete never resolves":
  ```typescript
  test("rejects with timeout error when complete never resolves", async () => {
    installPiAiMock({
      complete: () => new Promise<never>(() => {}),
    });
    const { decide } = await importIndex("timeout-never-resolves");
    const ctx = mockExtensionContext();
    await expect(decide(ctx, "prompt", 50)).rejects.toThrow("timed out");
  });
  ```
  This test verifies:
  - `decide()` rejects (not resolves) when `complete()` never responds
  - The error message contains "timed out"
  - The timeout fires within a reasonable time (50ms + margin)
  - The test uses `timeoutMs=50` to keep it fast

- [ ] Add test 2 — "passes AbortSignal to complete()":
  ```typescript
  test("passes AbortSignal to complete()", async () => {
    const calls: { signal?: AbortSignal }[] = [];
    installPiAiMock({
      complete: async (_m: unknown, _c: unknown, opts?: { signal?: AbortSignal }) => {
        calls.push(opts ?? {});
        return new Promise<never>(() => {});
      },
    });
    const { decide } = await importIndex("timeout-signal-passed");
    const ctx = mockExtensionContext();
    decide(ctx, "prompt", 50).catch(() => {});
    await new Promise((r) => setTimeout(r, 100));
    expect(calls).toHaveLength(1);
    expect(calls[0].signal).toBeInstanceOf(AbortSignal);
  });
  ```
  This test verifies:
  - `complete()` receives an options object with a `signal` field
  - The `signal` is an `AbortSignal` instance
  - The mock captures the options arg for assertion
  - The test doesn't await `decide()` — it lets the timeout fire, then
    checks the captured calls. The `.catch(() => {})` prevents unhandled
    rejection.

- [ ] Add test 3 — "completeSimple fallback receives the signal":
  ```typescript
  test("completeSimple fallback receives the signal", async () => {
    const simpleCalls: { signal?: AbortSignal }[] = [];
    installPiAiMock({
      complete: async () => { throw new Error("stream failed"); },
      completeSimple: async (_m: unknown, _c: unknown, opts?: { signal?: AbortSignal }) => {
        simpleCalls.push(opts ?? {});
        return { content: [{ type: "text", text: "fallback" }] };
      },
    });
    const { decide } = await importIndex("timeout-fallback-signal");
    const ctx = mockExtensionContext();
    const result = await decide(ctx, "prompt", 5000);
    expect(result).toBe("fallback");
    expect(simpleCalls).toHaveLength(1);
    expect(simpleCalls[0].signal).toBeInstanceOf(AbortSignal);
  });
  ```
  This test verifies:
  - When `complete()` throws a non-timeout error, `completeSimple()` is called
  - `completeSimple()` receives the `signal` in its options arg
  - The signal is an `AbortSignal` instance
  - The result is the fallback text
  - The test uses `timeoutMs=5000` (long timeout) to ensure the timeout
    doesn't fire during the fallback path — we're testing signal passing,
    not timeout behavior

- [ ] Add test 4 — "timeout during completeSimple fallback also rejects":
  ```typescript
  test("timeout during completeSimple fallback also rejects", async () => {
    installPiAiMock({
      complete: async () => { throw new Error("stream failed"); },
      completeSimple: () => new Promise<never>(() => {}),
    });
    const { decide } = await importIndex("timeout-fallback-also");
    const ctx = mockExtensionContext();
    await expect(decide(ctx, "prompt", 50)).rejects.toThrow("timed out");
  });
  ```
  This test verifies:
  - When `complete()` throws non-timeout and `completeSimple()` also hangs,
    the timeout fires and rejects with "timed out"
  - The `completeSimple()` fallback is not immune to the timeout
  - The same `controller.signal` is used for both calls

- [ ] Add test 5 — "no-model error still throws (regression)":
  ```typescript
  test("no-model error still throws (regression)", async () => {
    installPiAiMock();
    const { decide } = await importIndex("timeout-regression-model");
    const ctx = mockExtensionContext({ model: undefined });
    await expect(decide(ctx, "prompt", 5000)).rejects.toThrow("no active model");
  });
  ```
  This test verifies:
  - Adding the `timeoutMs` parameter doesn't break the model validation
  - The function still throws "no active model" when `ctx.model` is undefined
  - The `timeoutMs` parameter is not used before the model check — the
    function validates the model first, then creates the controller
  - Uses `timeoutMs=5000` to ensure the timeout doesn't fire during
    the validation (which is synchronous and immediate)

- [ ] Add test 6 — "no-api-key error still throws (regression)":
  ```typescript
  test("no-api-key error still throws (regression)", async () => {
    installPiAiMock();
    const { decide } = await importIndex("timeout-regression-key");
    const ctx = mockExtensionContext({ getApiKeyResult: undefined });
    await expect(decide(ctx, "prompt", 5000)).rejects.toThrow("no API key");
  });
  ```
  This test verifies:
  - Adding the `timeoutMs` parameter doesn't break the API key validation
  - The function still throws "no API key" when `getApiKey` returns undefined
  - The `timeoutMs` parameter is not used before the API key check
  - Uses `timeoutMs=5000` to ensure the timeout doesn't fire

**Verification:**

- [ ] `bun test test/error-paths.test.ts` passes with all tests (existing + 6 new)
- [ ] `grep -c "decide timeout" test/error-paths.test.ts` returns 1
- [ ] `grep -c "test(" test/error-paths.test.ts` increased by 6 from pre-change count
- [ ] No test hangs — the test suite completes within ~2s (1s existing + ~600ms new)

## 4. Verification

### 4.1 Full verification suite

```yaml
depends_on: ["1.1", "2.1", "3.1"]
parallel: false
conflicts_with: []
files: []
estimated_minutes: 5
```

**Context:** This is the final verification gate. It runs the complete
test suite + build to verify no regressions and all acceptance criteria
pass. The results are recorded in `completion-evidence.json` during the
`/verify` phase.

**Steps:**

- [ ] Run build: `bun build index.ts --no-bundle` — must exit 0
  - This verifies TypeScript typecheck passes. The `signal` field on
    `StreamOptions` is typed as `AbortSignal`, and passing
    `controller.signal` (which is `AbortSignal`) should typecheck.
  - If this fails, check that `DECISION_TIMEOUT_MS` is defined before
    `decide()` uses it in the default parameter
- [ ] Run all tests: `bun test test/` — must exit 0 with 54+ tests passing
  - 48 existing tests (parse-decision, phase-maps, reconstruct-state,
    retry-logic, error-paths)
  - 6 new tests in the "decide timeout" describe block
  - If any existing test fails, the `timeoutMs` parameter may have broken
    a call site — check that no caller passes a third positional argument
- [ ] Verify DECISION_TIMEOUT_MS export: `grep "DECISION_TIMEOUT_MS" index.ts`
  - Expected: at least 2 lines (constant definition + usage in default param)
- [ ] Verify decide() signature: `grep "timeoutMs" index.ts`
  - Expected: at least 3 lines (param, setTimeout, error message)
- [ ] Verify AbortController: `grep "AbortController" index.ts`
  - Expected: 1 line — `new AbortController()`
- [ ] Verify signal passing: `grep "signal: controller.signal" index.ts`
  - Expected: 2 lines — one in complete() call, one in completeSimple() call
- [ ] Verify timer cleanup: `grep "clearTimeout" index.ts`
  - Expected: 1 line in the finally block
- [ ] Verify timeout error message: `grep "timed out" index.ts`
  - Expected: 1 line with the error throw
- [ ] Verify aborted check: `grep "controller.signal.aborted" index.ts`
  - Expected: 1 line in the catch block
- [ ] Verify test describe block: `grep "decide timeout" test/error-paths.test.ts`
  - Expected: 1 line — `describe("decide timeout", () => {`
- [ ] Confirm no existing tests broke — all 48 pre-existing tests still pass
- [ ] Confirm new tests pass — 6 new tests in the "decide timeout" block
- [ ] Confirm no test hangs — the test process exits cleanly (no leaked timers)
- [ ] Record results in `completion-evidence.json`

**Verification:**

- [ ] All above checks pass
- [ ] `bun build index.ts --no-bundle && bun test test/` exits 0
- [ ] All PRD acceptance criteria satisfied (8 requirements, all MUST/SHOULD)

## 5. Appendix — Full Test Code Outline

This section contains the complete test code to add to `test/error-paths.test.ts`.
The implementer can copy this block verbatim — it follows all existing patterns
in the file (imports, mock setup, `importIndex` labels, assertion style).

```typescript

// ─── Risk 5: decide() timeout — hung LLM recovery ──────────────────────────
// The decide() function must not hang longer than the configured timeout.
// When complete()/completeSimple() never resolves, decide() must reject
// with a "timed out" error. The existing caller error handlers (runSelection,
// handleTurnEnd) catch this error and idle the loop.

describe("decide timeout", () => {
  test("rejects with timeout error when complete never resolves", async () => {
    // Mock complete() to return a never-resolving promise — simulates a
    // hung provider. decide() should reject with "timed out" after the
    // timeout period (50ms for test speed).
    installPiAiMock({
      complete: () => new Promise<never>(() => {}),
    });
    const { decide } = await importIndex("timeout-never-resolves");
    const ctx = mockExtensionContext();
    await expect(decide(ctx, "prompt", 50)).rejects.toThrow("timed out");
  });

  test("passes AbortSignal to complete()", async () => {
    // Verify that complete() receives opts.signal as an AbortSignal.
    // The mock captures the options arg, then returns a never-resolving
    // promise so the timeout fires. We don't await decide() — we let
    // the timeout fire and then check the captured calls.
    const calls: { signal?: AbortSignal }[] = [];
    installPiAiMock({
      complete: async (_m: unknown, _c: unknown, opts?: { signal?: AbortSignal }) => {
        calls.push(opts ?? {});
        return new Promise<never>(() => {});
      },
    });
    const { decide } = await importIndex("timeout-signal-passed");
    const ctx = mockExtensionContext();
    // Fire and forget — the timeout will reject, .catch prevents unhandled rejection
    decide(ctx, "prompt", 50).catch(() => {});
    // Wait for the timeout to fire and the promise to settle
    await new Promise((r) => setTimeout(r, 100));
    // Verify complete() was called with a signal
    expect(calls).toHaveLength(1);
    expect(calls[0].signal).toBeInstanceOf(AbortSignal);
  });

  test("completeSimple fallback receives the signal", async () => {
    // When complete() throws a non-timeout error, completeSimple() is the
    // fallback. Verify it also receives the signal. The mock for complete()
    // throws immediately (non-timeout), and completeSimple() captures opts
    // and returns successfully. timeoutMs=5000 ensures the timeout doesn't
    // fire during this test.
    const simpleCalls: { signal?: AbortSignal }[] = [];
    installPiAiMock({
      complete: async () => { throw new Error("stream failed"); },
      completeSimple: async (_m: unknown, _c: unknown, opts?: { signal?: AbortSignal }) => {
        simpleCalls.push(opts ?? {});
        return { content: [{ type: "text", text: "fallback" }] };
      },
    });
    const { decide } = await importIndex("timeout-fallback-signal");
    const ctx = mockExtensionContext();
    const result = await decide(ctx, "prompt", 5000);
    // Result is the fallback text from completeSimple()
    expect(result).toBe("fallback");
    // completeSimple() was called exactly once
    expect(simpleCalls).toHaveLength(1);
    // The signal was passed
    expect(simpleCalls[0].signal).toBeInstanceOf(AbortSignal);
  });

  test("timeout during completeSimple fallback also rejects", async () => {
    // When complete() throws non-timeout AND completeSimple() also hangs,
    // the timeout must fire and reject. This verifies the same controller
    // and signal are used for both calls — the timeout covers the fallback too.
    installPiAiMock({
      complete: async () => { throw new Error("stream failed"); },
      completeSimple: () => new Promise<never>(() => {}),
    });
    const { decide } = await importIndex("timeout-fallback-also");
    const ctx = mockExtensionContext();
    await expect(decide(ctx, "prompt", 50)).rejects.toThrow("timed out");
  });

  test("no-model error still throws (regression)", async () => {
    // Adding the timeoutMs parameter must not break the model validation.
    // The function should still throw "no active model" before creating
    // any AbortController or timer. Uses timeoutMs=5000 to ensure the
    // timeout doesn't fire during the synchronous validation.
    installPiAiMock();
    const { decide } = await importIndex("timeout-regression-model");
    const ctx = mockExtensionContext({ model: undefined });
    await expect(decide(ctx, "prompt", 5000)).rejects.toThrow("no active model");
  });

  test("no-api-key error still throws (regression)", async () => {
    // Adding the timeoutMs parameter must not break the API key validation.
    // The function should still throw "no API key" before creating any
    // AbortController or timer.
    installPiAiMock();
    const { decide } = await importIndex("timeout-regression-key");
    const ctx = mockExtensionContext({ getApiKeyResult: undefined });
    await expect(decide(ctx, "prompt", 5000)).rejects.toThrow("no API key");
  });
});
```

## 6. Appendix — Full decide() Implementation Outline

This section contains the complete implementation of the modified `decide()`
function. The implementer can use this as a reference — it shows the exact
shape of the code after all changes from tasks 1.1 and 2.1 are applied.

```typescript
// index.ts — after changes from tasks 1.1 and 2.1

// Line ~111 (after MAX_RETRIES):
export const DECISION_TIMEOUT_MS = 120_000; // 2 minutes — hung LLM recovery

// Lines ~327-380 (modified decide function):
export async function decide(
  ctx: ExtensionContext,
  promptText: string,
  timeoutMs: number = DECISION_TIMEOUT_MS
): Promise<string> {
  const model = ctx.model;
  if (!model) throw new Error("ultramode: no active model on session");

  const apiKey = await ctx.modelRegistry.getApiKey(model, undefined);
  if (!apiKey)
    throw new Error(
      `ultramode: no API key for ${model.provider}/${model.id}`
    );

  const context: Context = {
    systemPrompt: [
      "You are a senior staff engineer managing an autonomous development loop. Return ONLY valid JSON.",
    ],
    messages: [
      {
        role: "user",
        content: promptText,
        timestamp: Date.now(),
      } as Message,
    ],
  };

  // Timeout setup: AbortController + timer that aborts after timeoutMs
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let result: AssistantMessage;
    try {
      // Pass signal to complete() — provider can cancel the HTTP request
      result = await complete(model, context, {
        apiKey,
        signal: controller.signal,
      });
    } catch (err) {
      // If the abort fired (timeout), don't retry with completeSimple() —
      // the provider is unresponsive, retrying would hang for another
      // full timeout window. Propagate the timeout error immediately.
      if (controller.signal.aborted) {
        throw new Error(
          `ultramode: LLM decision timed out after ${timeoutMs}ms`
        );
      }
      // Fallback for providers that require ApiKeyResolver instead of static string.
      // Pass the same signal — if the fallback also hangs, the timeout covers it.
      result = await completeSimple(model, context, {
        apiKey,
        signal: controller.signal,
      });
    }

    // Extract text from the response content blocks
    const text = result.content
      .filter((b): b is TextContent => b.type === "text")
      .map((b) => b.text)
      .join("");
    return text;
  } finally {
    // Clear the timer on ALL exit paths — success, error, timeout.
    // clearTimeout is idempotent (no-op if already fired).
    clearTimeout(timer);
  }
}
```

## 7. Appendix — Verification Command Output Examples

This section shows expected output for each verification command,
so the implementer can compare against actual results.

### Build output
```bash
$ bun build index.ts --no-bundle
# Expected: no output (exit 0). If there are type errors, bun prints them.
```

### Test output
```bash
$ bun test test/
# Expected output (abbreviated):
# error-paths.test.ts:
#   decide error paths:
#     ✓ throws no active model when ctx.model is undefined
#     ✓ throws no active model when ctx.model is null
#     ✓ throws no API key when getApiKey returns undefined
#     ✓ falls back to completeSimple when complete throws and passes apiKey to both
#   hasPendingMessages re-entrancy guard:
#     ✓ turn_end handler skips handleTurnEnd when hasPendingMessages is true
#     ✓ turn_end handler proceeds to handleTurnEnd when hasPendingMessages is false
#   scheduler fallback to br list:
#     ✓ runSelection falls back to br list when scheduler has no recommendations
#     ✓ runSelection skips br list fallback when scheduler has recommendations
#   context helpers:
#     ✓ extractText reads string content
#     ✓ extractText joins text content blocks
#     ✓ extractText returns empty text for nullish or missing content
#     ✓ truncate leaves short text unchanged
#     ✓ truncate shortens long text and appends a marker
#   decide timeout:                              ← NEW
#     ✓ rejects with timeout error when complete never resolves   ← NEW
#     ✓ passes AbortSignal to complete()                          ← NEW
#     ✓ completeSimple fallback receives the signal                ← NEW
#     ✓ timeout during completeSimple fallback also rejects        ← NEW
#     ✓ no-model error still throws (regression)                   ← NEW
#     ✓ no-api-key error still throws (regression)                ← NEW
#
# parse-decision.test.ts:
#   ✓ ... (existing tests)
# phase-maps.test.ts:
#   ✓ ... (existing tests)
# reconstruct-state.test.ts:
#   ✓ ... (existing tests)
# retry-logic.test.ts:
#   ✓ ... (existing tests)
#
# 54 pass
# 0 fail
```

### Grep outputs
```bash
$ grep "DECISION_TIMEOUT_MS" index.ts
# Expected:
# export const DECISION_TIMEOUT_MS = 120_000; // 2 minutes — hung LLM recovery
#   timeoutMs: number = DECISION_TIMEOUT_MS

$ grep "timeoutMs" index.ts
# Expected (3+ lines):
#   timeoutMs: number = DECISION_TIMEOUT_MS
# const timer = setTimeout(() => controller.abort(), timeoutMs);
#   `ultramode: LLM decision timed out after ${timeoutMs}ms`

$ grep "AbortController" index.ts
# Expected:
# const controller = new AbortController();

$ grep "signal: controller.signal" index.ts
# Expected (2 lines):
#     signal: controller.signal,
#     signal: controller.signal,

$ grep "clearTimeout" index.ts
# Expected:
#     clearTimeout(timer);

$ grep "timed out" index.ts
# Expected:
#   `ultramode: LLM decision timed out after ${timeoutMs}ms`

$ grep "controller.signal.aborted" index.ts
# Expected:
#       if (controller.signal.aborted) {

$ grep "decide timeout" test/error-paths.test.ts
# Expected:
# describe("decide timeout", () => {
```
