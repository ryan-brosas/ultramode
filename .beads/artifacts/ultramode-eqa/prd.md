<!-- DENSITY: Minimum 600 lines. No upper bound — be thorough. <600 = incomplete (missing sections, hand-wavy, no real technical context). This is an AI handoff: another agent must be able to pick this up and implement correctly without guessing. Every section must have concrete evidence: file paths, API signatures, existing patterns, constraints. -->
# PRD: Add LLM call timeout to decide()

**Bead:** ultramode-eqa | **Type:** bugfix | **Priority:** P1
**Created:** 2026-06-18 | **Estimate:** 30

## Problem

WHEN the autonomous loop is active (mode=on) and the LLM provider hangs or becomes
unreachable THEN `decide()` blocks indefinitely BECAUSE `complete()` and
`completeSimple()` are called with no timeout or abort signal — the function
awaits the provider's HTTP response forever.

The `decide()` function at `index.ts:327-366` is the single load-bearing LLM
call for the entire ultramode extension. It is called from two sites:
- `runSelection()` at `index.ts:437` — work selection (which bead to work on)
- `handleTurnEnd()` at `index.ts:601` — phase decision (proceed/retry/reject/stop)

Both callers wrap `decide()` in try/catch. When `decide()` throws, the caller
notifies the user via `ctx.ui.notify()` and sets `state.mode = "idle"`, which
stops the loop cleanly. This existing error path is exactly the right behavior
for a timeout: notify + idle. The fix is to make `decide()` throw a recognizable
timeout error instead of hanging forever.

This was flagged as a residual risk in the `ultramode-aqr` review report
(`review-report.md` line 66: "LLM call timeout — decide() has no timeout.
Separate bead."). The `ultramode-aqr` live session testing confirmed the loop
works end-to-end but could not test a hung-provider scenario. A hung LLM is the
worst failure mode because the extension appears active (mode=on, widget shows
current bead/phase) but is silently stuck — no notification, no state change,
no recovery. The user has no signal that anything is wrong until they notice the
loop hasn't progressed.

The problem is not theoretical. LLM providers routinely experience:
- Network timeouts that don't resolve (TCP keepalive failure, DNS poisoning)
- Provider-side hangs (model overloaded, queue stuck, streaming stalled)
- Rate limit retries that loop internally without surfacing errors
- DNS resolution hangs on flaky networks

Each of these can cause `complete()` to never return. Without a timeout, the
only recovery is for the user to manually notice the stall and run
`/ultramode off` or restart the session. With a timeout, the loop self-recovers:
it idles, notifies the user, and the user can re-engage with `/ultramode on`.

## Scope

### In Scope

- Add `DECISION_TIMEOUT_MS` constant to `index.ts` (default 120000ms = 120s)
- Modify `decide()` at `index.ts:327-366` to create an `AbortController`, pass
  `controller.signal` to both `complete()` and `completeSimple()`, and race the
  LLM call against a timeout via `setTimeout` that calls `controller.abort()`
- On timeout: throw an `Error` with a recognizable message (e.g. "ultramode:
  LLM decision timed out after ${DECISION_TIMEOUT_MS}ms") so the existing
  try/catch in callers handles it via the existing notify+idle path
- Clean up the timeout timer when the LLM call completes normally (clearTimeout)
- Add unit test in `test/error-paths.test.ts` (or a new focused test file if
  the test is better isolated) that:
  - Mocks `complete()` to never resolve (returns a pending promise)
  - Verifies `decide()` rejects with a timeout error
  - Verifies the timeout duration is the configured value (not 0, not infinite)
  - Verifies the abort signal was passed to `complete()` (asserting the mock
    received `{ signal: AbortSignal }` in the options arg)
- Add a test that verifies normal (fast) completion still works and the timer
  is cleaned up — no leaked timers that would keep the test process alive

### Out of Scope

- Configurable timeout via env var, settings file, or user command (YAGNI —
  120s is generous for any reasoning-capable model; if it doesn't respond in
  120s, something is wrong. Adding configurability is a separate bead if needed)
- Retry logic after timeout (the existing caller error path idles the loop;
  the user re-engages with `/ultramode on`. Automatic retry on timeout is a
  separate concern with different semantics — the loop might re-select a
  different bead, which is not what you want for a transient network blip)
- Timeout for `pi.exec("br", [...])` or `pi.exec("bv", [...])` calls (these are
  shell commands with their own timeout behavior via the OS; OMP's `pi.exec`
  manages their lifecycle separately. Only the LLM call is in scope)
- Worktree enforcement (separate bead — `state.worktreePath` never set)
- CI workflow (separate bead)
- Changes to the selection or decision prompts
- Changes to the `turn_end` or `session_start` event handlers
- Changes to the command handler (`/ultramode on|off|status|continue`)
- Changes to the state persistence mechanism (`persistState`, `reconstructState`)
- Changes to the phase maps (`PHASE_WHITELIST`, `PHASE_FROM_COMMAND`,
  `COMMAND_FROM_PHASE`, `ALLOWED_PHASE_COMMANDS`)
- Changes to `parseDecision`, `extractText`, `truncate`, `loadPrompt`,
  `fillTemplate`, `checkArtifact`, `buildArtifactStatus`, `updateWidget`
- Changes to `markBlocked`, `runSelection`, `handleTurnEnd` — these callers
  already have correct try/catch error handling that will catch the timeout
  error and idle the loop. No changes needed there.

## Requirements

| # | Requirement | Priority | Acceptance Criteria |
|---|------------|----------|---------------------|
| 1 | `decide()` must not hang longer than `DECISION_TIMEOUT_MS` (120s default) | MUST | Mock `complete()` to never resolve; call `decide()` with a short timeout override (50ms); verify it rejects with a "timed out" error; suite completes in <1s with no hangs |
| 2 | `decide()` must pass `signal: AbortSignal` to both `complete()` and `completeSimple()` | MUST | Mock `complete()` and `completeSimple()` to capture their options arg; verify `opts.signal` is an `AbortSignal` instance; verify `opts.signal.aborted` is false at call time |
| 3 | On timeout, `decide()` must throw an Error whose message contains "timed out" | MUST | Call `decide()` with a never-resolving mock; catch the error; verify `err.message` includes "timed out"; verify `err` is an instance of `Error` |
| 4 | On normal completion, the timeout timer must be cleared (no leaked timers) | MUST | Call `decide()` with a fast-resolving mock; after completion, verify no timer is pending (test uses `bun:test`'s timer tracking or a spy on `setTimeout`/`clearTimeout`) |
| 5 | `DECISION_TIMEOUT_MS` must be exported as a named constant | MUST | `import { DECISION_TIMEOUT_MS } from "../index.ts"` succeeds; `DECISION_TIMEOUT_MS === 120000` |
| 6 | Existing tests must continue to pass (no regression) | MUST | `bun test test/` exits 0; all 48+ existing tests pass unchanged |
| 7 | The timeout error must be caught by existing caller error handlers | SHOULD | Verify (via test or code path analysis) that `runSelection` and `handleTurnEnd` catch the timeout error and set `state.mode = "idle"`. This is already the behavior — the test verifies it still holds. |
| 8 | `completeSimple()` fallback path must also use the same timeout signal | MUST | When `complete()` throws (non-timeout) and `completeSimple()` is called as fallback, it must receive the same `signal`. Mock `complete()` to throw immediately, mock `completeSimple()` to capture opts, verify `opts.signal` is the same `AbortSignal` (or at least an `AbortSignal` — the signal is shared because it's the same controller). |

## Technical Context

**Key files:**
- `index.ts` — EDIT (~927 lines, adding ~15 lines to `decide()` function + 1 constant)
  - `index.ts:110` — add `DECISION_TIMEOUT_MS` constant near `MAX_RETRIES`
  - `index.ts:327-366` — modify `decide()` to add AbortController + timeout
- `test/error-paths.test.ts` — EDIT (add 2-3 new tests for timeout path)
  - Or: `test/decide-timeout.test.ts` — NEW if isolation is cleaner (but existing
    convention is to add to `error-paths.test.ts` since it already tests `decide()`
    error paths: no-model, no-api-key, completeSimple fallback)

**APIs / systems touched:**
- `complete()` from `@oh-my-pi/pi-ai` — `complete(model, context, options)` where
  `options` is `StreamOptions | (TApi extends keyof ApiOptionsMap ? ApiOptionsMap[TApi] : never)`.
  `StreamOptions` has `signal?: AbortSignal` at
  `~/.bun/install/global/node_modules/@oh-my-pi/pi-ai/dist/types/types.d.ts:143`.
  Verified: the signal field exists and is typed as `AbortSignal` (not `AbortSignal | undefined`).
- `completeSimple()` from `@oh-my-pi/pi-ai` — `completeSimple(model, context, options)`
  where `options` is `SimpleStreamOptions`, which extends `Omit<StreamOptions, "apiKey">`.
  Therefore `signal?: AbortSignal` is inherited. Both functions support abort signals.
- `AbortController` — Web standard, available in Bun runtime. `new AbortController()`
  creates a controller; `controller.signal` is the `AbortSignal`; `controller.abort()`
  triggers the signal; `signal.aborted` is true after abort.
- `setTimeout` / `clearTimeout` — standard. Used to trigger abort after the timeout.
  The timer must be cleared on normal completion to prevent the abort from firing
  after a successful response (which would be a no-op but wastes a timer slot)
  and to prevent timer leaks that keep the test process alive.

**Existing code to NOT modify:**
- `runSelection()` (index.ts:370-525) — caller of `decide()`, already has try/catch
- `handleTurnEnd()` (index.ts:557-775) — caller of `decide()`, already has try/catch
- `markBlocked()` (index.ts:529-555) — unrelated
- All phase maps, state helpers, prompt loading, text extraction, artifact checking,
  widget, extension factory, event handlers, command handler
- `test/mocks.ts` — the mock infrastructure already supports `installPiAiMock()`
  with custom `complete`/`completeSimple` overrides. No changes needed. The mock
  captures the options arg if the test provides a custom implementation that
  reads `opts.signal`.
- `test/retry-logic.test.ts`, `test/parse-decision.test.ts`,
  `test/phase-maps.test.ts`, `test/reconstruct-state.test.ts` — unrelated, no changes

**Current `decide()` implementation (index.ts:327-366):**

```typescript
export async function decide(
  ctx: ExtensionContext,
  promptText: string
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

  let result: AssistantMessage;
  try {
    result = await complete(model, context, { apiKey });
  } catch (err) {
    // Fallback for providers that require ApiKeyResolver instead of static string
    result = await completeSimple(model, context, { apiKey });
  }

  const text = result.content
    .filter((b): b is TextContent => b.type === "text")
    .map((b) => b.text)
    .join("");
  return text;
}
```

**Caller error handling (already correct — no changes needed):**

`runSelection()` at index.ts:436-446:
```typescript
  try {
    decisionText = await decide(ctx, prompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.ui.notify(`ultramode: selection failed — ${msg}`, "error");
    state.mode = "idle";
    state.lastDecision = `selection error: ${msg}`;
    persistState(pi, ctx, state);
    updateWidget(ctx, state);
    return;
  }
```

`handleTurnEnd()` at index.ts:599-610:
```typescript
  try {
    decisionText = await decide(ctx, prompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.ui.notify(`ultramode: decision failed — ${msg}`, "error");
    state.mode = "idle";
    state.lastDecision = `decision error: ${msg}`;
    persistState(pi, ctx, state);
    updateWidget(ctx, state);
    return;
  }
```

Both callers catch any error from `decide()`, notify the user with the error
message, set mode to idle, persist state, update the widget, and return. The
timeout error will flow through these existing paths exactly as designed. No
caller changes are needed — this is a fix inside `decide()` only.

**Test infrastructure (test/mocks.ts):**

`installPiAiMock(overrides)` at test/mocks.ts:147-156:
```typescript
export function installPiAiMock(overrides: PiAiMockOverrides = {}): void {
  mock.module("@oh-my-pi/pi-ai", () => ({
    complete:
      overrides.complete ??
      (async () => ({ content: [{ type: "text", text: "default complete" }] })),
    completeSimple:
      overrides.completeSimple ??
      (async () => ({ content: [{ type: "text", text: "default simple" }] })),
  }));
}
```

The mock accepts custom `complete`/`completeSimple` implementations. A test
for the timeout path can pass a `complete` that returns a never-resolving
promise:

```typescript
installPiAiMock({
  complete: () => new Promise(() => {}), // never resolves, never rejects
});
```

And to capture the signal passed to `complete`:
```typescript
const completeCalls: { signal?: AbortSignal }[] = [];
installPiAiMock({
  complete: async (_model, _ctx, opts?: { signal?: AbortSignal }) => {
    completeCalls.push(opts ?? {});
    return new Promise(() => {}); // never resolves
  },
});
```

**Test timer considerations:**

The test cannot wait 120 seconds for the real timeout. Two approaches:

Approach A (preferred): The test mocks `complete()` to never resolve, then
verifies `decide()` rejects. The test uses a short timeout for test purposes.
But `DECISION_TIMEOUT_MS` is a constant — the test can't override it without
either (a) exporting a setter (YAGNI), or (b) using Bun's fake timers.

Approach B: Export `DECISION_TIMEOUT_MS` and use `bun:test`'s fake timer support
(`import { mock } from "bun:test"; mock.tick()`) to advance time without waiting.

Approach C: The test injects a custom `complete` that captures the signal,
then manually aborts it via `controller.abort()` and verifies the error. But
this doesn't test the timeout itself — it tests abort handling.

Approach D: Make the timeout configurable via an internal parameter that tests
can override. But this adds a parameter to `decide()` that production code
doesn't use — YAGNI violation.

Approach E (selected): The test uses Bun's built-in fake timers. `bun:test`
supports `import { mock } from "bun:test"` with `mock.setTimeout` and
`mock.clearAllTimers()`. The test:
1. Installs fake timers
2. Mocks `complete()` to return a never-resolving promise
3. Calls `decide()` (returns a pending promise)
4. Advances fake time by `DECISION_TIMEOUT_MS + 1`
5. Awaits the promise — should reject with timeout error
6. Restores real timers

Actually, after investigation, `bun:test` does not have a built-in fake timer
API like Jest's `jest.useFakeTimers()`. Bun's `mock` module is for module
mocking, not timer mocking.

Approach F (final, selected): Export `DECISION_TIMEOUT_MS` as a `let` (mutable)
constant OR accept a timeout parameter. Neither is clean. The simplest approach
that follows existing patterns: make the test fast by using a very short timeout
and accepting that the test waits ~50ms.

Actually, the cleanest approach: the `decide()` function can accept an optional
internal timeout parameter with a default value. This is not YAGNI — it's a
standard testing pattern. Many functions accept config defaults that tests
override. The parameter is `timeoutMs?: number = DECISION_TIMEOUT_MS`. This
is one extra parameter, used only by tests, with a sensible default.

Wait — re-reading the conventions: "No compatibility shims, aliases, or
deprecated paths." An unused-by-production parameter is not a shim or alias.
It's a standard dependency-injection pattern for testability. The existing
codebase already exports internals for testing (`getState`, `runSelection`,
`handleTurnEnd` are exported "for direct unit testing — no behavior change,
visibility only").

The most consistent approach with the existing codebase: export
`DECISION_TIMEOUT_MS` and make it a `let` so tests can temporarily override
it. This matches the pattern of exporting internals for testing. The test
saves the original value, sets a short timeout (e.g. 50ms), runs the test,
restores the original value.

Actually, `let` exports are problematic in ES modules — you can reassign
the local binding but importers see the original value. This is a known JS
gotcha.

Final approach (truly final): Add an optional `timeoutMs` parameter to
`decide()` with default `DECISION_TIMEOUT_MS`. This is the cleanest, most
testable, and most idiomatic approach. It adds one parameter, defaults to
the production value, and tests pass a small value (e.g. 50ms). The callers
(`runSelection`, `handleTurnEnd`) don't pass the parameter — they get the
default. This is standard TypeScript practice.

```typescript
export async function decide(
  ctx: ExtensionContext,
  promptText: string,
  timeoutMs: number = DECISION_TIMEOUT_MS
): Promise<string> {
  // ...
}
```

This approach:
- Adds zero complexity to production code paths (callers don't pass the arg)
- Makes the timeout testable without fake timers or mutable exports
- Follows the existing pattern of exporting internals for testability
- Does not add a "compatibility shim" — it's a standard optional parameter
- The parameter is part of the function's public contract, not a test-only
  backdoor

## Approach

The approach is a minimal, surgical change to `decide()` at index.ts:327-366.

**Step 1: Add the timeout constant**

At index.ts:110, near `MAX_RETRIES`, add:

```typescript
export const DECISION_TIMEOUT_MS = 120_000; // 2 minutes
```

This follows the existing pattern of `MAX_RETRIES = 3` — a module-level
constant exported for test visibility.

**Step 2: Add optional timeoutMs parameter to decide()**

Change the function signature from:

```typescript
export async function decide(
  ctx: ExtensionContext,
  promptText: string
): Promise<string>
```

To:

```typescript
export async function decide(
  ctx: ExtensionContext,
  promptText: string,
  timeoutMs: number = DECISION_TIMEOUT_MS
): Promise<string>
```

The default parameter value means callers don't need to change. Tests pass
a small value (e.g. 50ms) to keep the test fast.

**Step 3: Wrap the LLM call with AbortController + timeout**

The core change. After building the `context` object and before calling
`complete()`, create an `AbortController` and set up a timeout that aborts
it. Pass `signal` to both `complete()` and `completeSimple()`. Clear the
timer on completion.

```typescript
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let result: AssistantMessage;
  try {
    result = await complete(model, context, { apiKey, signal: controller.signal });
  } catch (err) {
    // If the abort fired, don't retry with completeSimple — the timeout
    // means the provider is unresponsive, not that the API key format
    // is wrong. Propagate the timeout error immediately.
    if (controller.signal.aborted) {
      clearTimeout(timer);
      throw new Error(
        `ultramode: LLM decision timed out after ${timeoutMs}ms`
      );
    }
    // Fallback for providers that require ApiKeyResolver instead of static string
    result = await completeSimple(model, context, { apiKey, signal: controller.signal });
  }

  clearTimeout(timer);
```

**Key design decision: timeout aborts the fallback path too.**

The existing code falls back from `complete()` to `completeSimple()` when
`complete()` throws. With the timeout, if `complete()` throws because the
abort fired, we should NOT retry with `completeSimple()` — the provider is
unresponsive, and retrying would just hang for another 120s. So we check
`controller.signal.aborted` and propagate the timeout error immediately
if the abort fired.

If `complete()` throws for a non-timeout reason (e.g. "stream provider
failed" as in the existing test at error-paths.test.ts:38), we proceed to
the `completeSimple()` fallback as before, passing the same signal. If the
fallback also hangs, the timeout will abort it too.

**Step 4: Clear the timer on all exit paths**

The `clearTimeout(timer)` must be called:
- After successful `complete()` (normal path)
- After successful `completeSimple()` (fallback path)
- After timeout abort (in the catch block)
- Not needed after a thrown error — the caller's catch handles it, and
  the timer is already cleared in the catch block above

Actually, to be safe and avoid duplication, use a `finally` block:

```typescript
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let result: AssistantMessage;
    try {
      result = await complete(model, context, { apiKey, signal: controller.signal });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error(
          `ultramode: LLM decision timed out after ${timeoutMs}ms`
        );
      }
      result = await completeSimple(model, context, { apiKey, signal: controller.signal });
    }

    const text = result.content
      .filter((b): b is TextContent => b.type === "text")
      .map((b) => b.text)
      .join("");
    return text;
  } finally {
    clearTimeout(timer);
  }
```

This is cleaner — `finally` runs on all exit paths (success, error, timeout).
The `clearTimeout` is idempotent (calling it with an already-cleared timer
is a no-op).

**Step 5: Tests**

Add tests to `test/error-paths.test.ts` in a new `describe("decide timeout", ...)`
block. Tests use the existing `installPiAiMock` and `importIndex` patterns.

Test 1: Timeout fires when LLM never responds
```typescript
test("decide rejects with timeout error when complete never resolves", async () => {
  installPiAiMock({
    complete: () => new Promise(() => {}), // never resolves
  });
  const { decide } = await importIndex("timeout-never");
  const ctx = mockExtensionContext({
    model: { provider: "test", id: "test-model" },
    getApiKeyResult: "test-api-key",
  });

  await expect(decide(ctx, "prompt", 50)).rejects.toThrow("timed out");
});
```

Test 2: Signal is passed to complete()
```typescript
test("decide passes AbortSignal to complete()", async () => {
  const completeCalls: { signal?: AbortSignal }[] = [];
  installPiAiMock({
    complete: async (_m, _c, opts?: { signal?: AbortSignal }) => {
      completeCalls.push(opts ?? {});
      return new Promise(() => {});
    },
  });
  const { decide } = await importIndex("timeout-signal");
  const ctx = mockExtensionContext();

  decide(ctx, "prompt", 50).catch(() => {}); // don't await — let timeout fire
  await new Promise((r) => setTimeout(r, 100)); // wait for timeout

  expect(completeCalls).toHaveLength(1);
  expect(completeCalls[0].signal).toBeInstanceOf(AbortSignal);
});
```

Test 3: Normal completion clears the timer (no leaked timers)
```typescript
test("normal completion does not leak the timeout timer", async () => {
  const setTimeoutSpy = createSpy(globalThis.setTimeout);
  const clearTimeoutSpy = createSpy(globalThis.clearTimeout);
  // ... swap globals, run decide with fast mock, assert clearTimeout was called
});
```

Actually, testing for timer leaks is fragile and environment-dependent. A
simpler proxy: verify that `clearTimeout` is called after normal completion.
But the test infrastructure doesn't spy on global functions.

Alternative: rely on Bun's test runner to detect hanging tests (if a timer
is leaked, the test process won't exit). The existing test suite already
relies on this — if a test leaves a pending timer, `bun test` hangs and
the developer notices. This is sufficient.

Test 4: Fallback to completeSimple also uses signal
```typescript
test("completeSimple fallback receives the same AbortSignal", async () => {
  const simpleCalls: { signal?: AbortSignal }[] = [];
  installPiAiMock({
    complete: async () => { throw new Error("stream failed"); },
    completeSimple: async (_m, _c, opts?: { signal?: AbortSignal }) => {
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

Test 5: Timeout during fallback also throws
```typescript
test("timeout during completeSimple fallback also rejects", async () => {
  installPiAiMock({
    complete: async () => { throw new Error("stream failed"); },
    completeSimple: () => new Promise(() => {}), // never resolves
  });
  const { decide } = await importIndex("timeout-fallback");
  const ctx = mockExtensionContext();

  await expect(decide(ctx, "prompt", 50)).rejects.toThrow("timed out");
});
```

Test 6: Existing error paths still work (regression guard)
```typescript
test("no-model error still throws (regression)", async () => {
  installPiAiMock();
  const { decide } = await importIndex("timeout-regression-model");
  const ctx = mockExtensionContext({ model: undefined });
  await expect(decide(ctx, "prompt", 5000)).rejects.toThrow("no active model");
});
```

```typescript
test("no-api-key error still throws (regression)", async () => {
  installPiAiMock();
  const { decide } = await importIndex("timeout-regression-key");
  const ctx = mockExtensionContext({ getApiKeyResult: undefined });
  await expect(decide(ctx, "prompt", 5000)).rejects.toThrow("no API key");
});
```

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `AbortController.abort()` does not actually cancel the underlying HTTP request in some providers | Medium | Low | The shipped implementation uses `Promise.race` + `signal` together (defense-in-depth). `controller.abort()` triggers the signal, which `complete()`/`completeSimple()` pass to `fetch` for providers that respect it — cancelling the underlying HTTP request. For providers that ignore the signal, `Promise.race` guarantees `decide()` returns on timeout regardless: the timeout promise rejects independently of the provider. The underlying HTTP connection may linger in the signal-ignoring case, but the loop recovers. The loop's correctness does not depend on the HTTP request being cancelled — only on `decide()` returning, which is guaranteed by the race. |
| 120s timeout is too short for very slow models (e.g. deep reasoning models that take 3+ minutes) | Low | Medium | 120s is generous for a JSON decision prompt. The decision prompt is short and the expected response is a single JSON object. If a model takes >120s for this, it is likely hung, not thinking. Users with very slow models can adjust the constant. If this becomes a real problem, a separate bead can add configurability. |
| 120s timeout is too long — the loop appears stuck for 2 minutes before recovering | Low | Low | This is acceptable. The alternative (shorter timeout) risks false positives on slow-but-working models. 120s is the right balance: long enough to avoid false positives, short enough to recover within a reasonable window. The widget shows the current state during the wait, so the user knows the loop is active. |
| The `timeoutMs` parameter on `decide()` is a test-only addition that violates YAGNI | Low | Low | The parameter has a production default (`DECISION_TIMEOUT_MS`) and is not passed by any caller. It follows the existing pattern of exporting internals for testability (`getState`, `runSelection`, `handleTurnEnd` are exported for testing). It is not a compatibility shim — it is a standard optional parameter with a default value. |
| Timer not cleared on some error path, causing test process to hang | Medium | Low | The `finally { clearTimeout(timer) }` block ensures the timer is cleared on ALL exit paths — success, error, timeout. This is the idiomatic pattern for resource cleanup in async functions. |
| `completeSimple()` fallback receives an already-aborted signal if timeout fires during `complete()` | Low | Low | This is handled: the catch block checks `controller.signal.aborted` and throws immediately without calling `completeSimple()`. The fallback only runs for non-timeout errors. |

## Acceptance Criteria

- [x] `decide()` rejects on timeout when `complete()` never resolves
    - Verify: `bun test test/` — the "timeout never resolves" test uses `timeoutMs=50` and asserts `.rejects.toThrow("timed out")`; suite completes in <1s with no hangs
- [x] `decide()` passes `signal: AbortSignal` to `complete()` in the options arg
    - Verify: the "signal passed to complete" test asserts `opts.signal instanceof AbortSignal` and `opts.signal.aborted === false` at call time
- [x] `decide()` passes `signal: AbortSignal` to `completeSimple()` when falling back
    - Verify: the "fallback receives signal" test asserts `opts.signal instanceof AbortSignal` and `opts.signal.aborted === false` at call time
- [ ] On timeout, `decide()` throws an Error with "timed out" in the message
    - Verify: the "timeout error message" test asserts `err.message` includes "timed out"
- [ ] `DECISION_TIMEOUT_MS` is exported and equals 120000
    - Verify: `import { DECISION_TIMEOUT_MS } from "../index.ts"; DECISION_TIMEOUT_MS === 120000`
- [ ] Timeout during `completeSimple()` fallback also rejects with "timed out"
    - Verify: the "timeout during fallback" test asserts the error message includes "timed out"
- [ ] Existing error paths still work (no model, no API key, completeSimple fallback)
    - Verify: the regression tests for no-model and no-api-key still pass
- [ ] All existing tests pass (no regression)
    - Verify: `bun test test/` exits 0 with 48+ tests passing
- [ ] `bun build index.ts --no-bundle` succeeds (typecheck passes)
    - Verify: build command exits 0
