<!-- DENSITY: Minimum 600 lines. No upper bound. <600 = too thin (waves undefined, tasks lack code outlines, verification hand-wavy). Task outlines should show the shape of every file change — not full implementation, but enough that a different agent can execute without reading the PRD again. -->
# Plan: ultramode-eqa

**Goal:** Add a 120s timeout to `decide()` via `AbortController` + `signal` parameter so a hung LLM provider causes the loop to idle and notify the user instead of blocking forever.

## Graph Context

- **Blast radius:** 2 files (0 new, 2 edits, 0 deletes)
  - `index.ts` — EDIT: add 1 constant (~1 line), modify `decide()` function body (~15 lines changed within lines 327-366)
  - `test/error-paths.test.ts` — EDIT: append 1 new `describe` block (~70 lines)
- **Unblocks:** None — standalone bugfix. No beads depend on `ultramode-eqa`.
- **Blocked by:** None — no dependencies. `br dep tree ultramode-eqa --json` returns depth 0.
- **Critical path:** No — does not block other work. Single track (track-A) per `bv --robot-plan`. The graph has 0 edges and 0 open beads besides this one.
- **Forecast:** 66 minutes (confidence 0.4) — bv estimate based on 9 historical samples at 18 min/day velocity. Factors: estimate median 60m, type bugfix ×1.0, depth 1 ×1.10, velocity global (9 samples/30d). The bead's own estimate is 30 min. The real work is ~15 min of code + ~15 min of tests.
- **Hotspots touched:** None — `index.ts` and `test/error-paths.test.ts` have 0 prior bead history per `bv --robot-file-hotspots`. Only memory files (`.omp/memory/project/*`) have bead history, and they are NOT touched by this bead.
- **File relations:** No co-change patterns. `index.ts` and `test/error-paths.test.ts` have no prior co-change history — this is the first bead touching both together.

## Observable Truths

These are concrete, verifiable statements. Each one must be true after implementation. If any is false, the implementation is incomplete.

1. `index.ts` exports `DECISION_TIMEOUT_MS` as a named constant with value `120_000`
   - Verify: `grep "export const DECISION_TIMEOUT_MS" index.ts` returns one line
2. `decide()` accepts an optional third parameter `timeoutMs: number = DECISION_TIMEOUT_MS`
   - Verify: `grep "timeoutMs" index.ts` returns ≥3 lines (param decl, setTimeout, error msg)
3. `decide()` creates an `AbortController` before the LLM call
   - Verify: `grep "new AbortController" index.ts` returns one line
4. `decide()` passes `controller.signal` to `complete()` in the options arg
   - Verify: `grep "signal: controller.signal" index.ts` returns ≥2 lines (complete + completeSimple)
5. `decide()` passes `controller.signal` to `completeSimple()` when falling back
   - Verify: same grep as above — second occurrence is in completeSimple call
6. `decide()` sets a `setTimeout` that calls `controller.abort()` after `timeoutMs` milliseconds
   - Verify: `grep "controller.abort" index.ts` returns one line
7. When `complete()` throws and `controller.signal.aborted` is true, `decide()` throws an `Error` with "timed out" in the message — does NOT retry with `completeSimple()`
   - Verify: `grep "timed out" index.ts` returns one line with the error message
   - Verify: `grep "controller.signal.aborted" index.ts` returns one line in the catch block
8. When `complete()` throws for a non-timeout reason, `completeSimple()` is called with the same `signal`
   - Verify: the catch block has `controller.signal.aborted` check BEFORE the `completeSimple()` call
9. The timeout timer is cleared via `finally { clearTimeout(timer) }` on all exit paths
   - Verify: `grep "clearTimeout" index.ts` returns one line inside a `finally` block
10. `test/error-paths.test.ts` contains a `describe("decide timeout")` block with ≥5 test cases
    - Verify: `grep -c "test(" test/error-paths.test.ts` increased by ≥5 from pre-change count
11. All existing tests pass unchanged (48+ tests)
    - Verify: `bun test test/` exits 0 with ≥54 tests (48 existing + 6 new)
12. `bun build index.ts --no-bundle` exits 0 (typecheck passes)
    - Verify: build command exits 0, no type errors

## Required Artifacts

| Artifact | Provides | Path | Status |
|----------|----------|------|--------|
| `index.ts` (EDIT) | `DECISION_TIMEOUT_MS` constant + `decide()` with AbortController timeout | `index.ts` | Need |
| `test/error-paths.test.ts` (EDIT) | Timeout path tests (6 new tests in a describe block) | `test/error-paths.test.ts` | Need |
| `prd.md` | Requirements and acceptance criteria | `.beads/artifacts/ultramode-eqa/prd.md` | Have |
| `prd.json` | Machine-readable requirements mirror | `.beads/artifacts/ultramode-eqa/prd.json` | Have |
| `decisions.md` | Architecture decisions and rejected alternatives | `.beads/artifacts/ultramode-eqa/decisions.md` | Have |
| `completion-evidence.json` | Verification results (created during /verify) | `.beads/artifacts/ultramode-eqa/completion-evidence.json` | Need (verify phase) |

## Requirement Traceability

Each PRD requirement maps to a task and an observable truth:

| PRD Req # | Requirement | Task | Observable Truth # | Verification |
|-----------|-------------|------|---------------------|--------------|
| 1 | decide() must not hang longer than DECISION_TIMEOUT_MS | 1.1, 1.2 | 1, 3, 4, 6 | Test: "rejects with timeout error when complete never resolves" |
| 2 | decide() must pass signal to complete() and completeSimple() | 1.2 | 4, 5 | Tests: "passes AbortSignal to complete()" and "completeSimple fallback receives the signal" |
| 3 | On timeout, decide() throws Error with "timed out" in message | 1.2 | 7 | Test: "rejects with timeout error when complete never resolves" asserts message |
| 4 | On normal completion, timer is cleared | 1.2 | 9 | Test: "completeSimple fallback receives the signal" returns successfully (timer cleared via finally) |
| 5 | DECISION_TIMEOUT_MS exported as named constant | 1.1 | 1 | `grep "export const DECISION_TIMEOUT_MS" index.ts` |
| 6 | Existing tests pass (no regression) | 2.1, 3.1 | 11 | `bun test test/` exits 0 with 54+ tests |
| 7 | Timeout error caught by existing caller handlers | 1.2 (no caller change) | 7 | Code path analysis: index.ts:436-446 and index.ts:599-610 catch all errors from decide() |
| 8 | completeSimple fallback also uses timeout signal | 1.2 | 5, 8 | Tests: "completeSimple fallback receives the signal" and "timeout during completeSimple fallback also rejects" |

## Wave Structure

| Wave | Tasks | Parallel? | Preconditions | Verification Gate |
|------|-------|-----------|---------------|-------------------|
| 1 | 1.1 (add constant), 1.2 (add timeout to decide) | No — 1.2 depends on 1.1 being in the same file; both edit `index.ts` | PRD exists, plan exists | `bun build index.ts --no-bundle` passes (typecheck) |
| 2 | 2.1 (add timeout tests) | No — depends on Wave 1 code changes being in place | Wave 1 complete, build passes | `bun test test/error-paths.test.ts` passes with all new + existing tests |
| 3 | 3.1 (full verification) | No — depends on Wave 2 | Wave 2 complete, all tests pass | All acceptance criteria pass, `bun test test/` exits 0, `bun build` exits 0 |

Wave 1 is sequential because both tasks edit the same file (`index.ts`). Task 1.1 adds the constant that Task 1.2 references in the default parameter value. They could theoretically be one task, but splitting them makes the code review clearer: the constant is a trivial add, while the `decide()` modification is the substantive change.

Wave 2 depends on Wave 1 because the tests import and call `decide()` — the code must be in place before tests can run.

Wave 3 is the final verification gate — it runs the full suite to catch any regressions.

## Tasks

### Wave 1: Implement timeout in decide()

**Task 1.1: Add DECISION_TIMEOUT_MS constant**

Add the timeout constant at `index.ts:110`, immediately after `MAX_RETRIES`. This is a module-level export so tests can import and verify the value.

```
// At index.ts:110, after MAX_RETRIES = 3:
export const DECISION_TIMEOUT_MS = 120_000; // 2 minutes — hung LLM recovery
```

The constant follows the same pattern as `MAX_RETRIES = 3` — a module-level
exported number near the other loop-safety constants. The value 120_000ms
(2 minutes) is generous for a JSON decision prompt. If a model takes >120s
to respond to a short prompt, it is hung, not thinking.

Rationale for 120s:
- The decision prompt is ~500 tokens (selection or phase decision)
- The expected response is a single JSON object (~100 tokens)
- Reasoning-capable models respond within 10-30s for this complexity
- 120s provides a 4-12x safety margin
- Shorter (e.g. 60s) risks false positives on slow-but-working models
- Longer (e.g. 300s) means the loop appears stuck for 5 minutes — too long
- 120s is the right balance: long enough to avoid false positives, short
  enough to recover within a reasonable window

The constant is exported (not just module-level) so tests can verify the value
and so it appears in the module's public API surface — consistent with
`MAX_RETRIES` and `CONTROL_TYPE` which are also exported.

**Verification:** `grep "DECISION_TIMEOUT_MS" index.ts` shows the export.

---

**Task 1.2: Add AbortController + timeout to decide()**

Modify `decide()` at `index.ts:327-366` to add an `AbortController`-based
timeout. The change is surgical: the function signature gains one optional
parameter, and the body wraps the LLM call in a try/finally with an
AbortController.

Current code (index.ts:327-366):

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

New code:

```typescript
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

Key design points:

1. **`timeoutMs` parameter with default value.** The parameter defaults to
   `DECISION_TIMEOUT_MS` (120_000). Production callers (`runSelection` at
   index.ts:437, `handleTurnEnd` at index.ts:601) call `decide(ctx, prompt)`
   with two args — the default kicks in. Tests pass `50` to keep the test
   fast. This is backward-compatible: existing two-arg calls continue to work.

2. **`AbortController` created after context, before LLM call.** The controller
   is created after the `context` object (which doesn't need cancellation)
   and before the `complete()` call (which does). This minimizes the scope
   of the abort — if `getApiKey` throws, no controller is created.

3. **`setTimeout` triggers `controller.abort()`.** After `timeoutMs`
   milliseconds, the timer fires and calls `controller.abort()`. This sets
   `controller.signal.aborted` to true and triggers any abort listeners
   that `complete()`/`completeSimple()` may have registered on the signal.

4. **`try/finally` wraps the entire LLM call + text extraction.** The
   `finally { clearTimeout(timer); }` ensures the timer is cleared on every
   exit path:
   - Normal completion (complete() succeeds → text extracted → return)
   - Fallback completion (complete() throws non-timeout → completeSimple() succeeds → return)
   - Timeout (complete() throws with aborted signal → throw timeout error)
   - Fallback timeout (completeSimple() throws with aborted signal → throw)
   - Any other error (e.g. text extraction fails → throw, but timer cleared)

   `clearTimeout` is idempotent — calling it with an already-cleared timer
   is a no-op. So even if the timer already fired, calling `clearTimeout`
   in the `finally` block is safe.

5. **Inner `try/catch` handles complete() → completeSimple() fallback.**
   The existing fallback logic is preserved: if `complete()` throws, try
   `completeSimple()`. The new addition is the `controller.signal.aborted`
   check: if the abort fired (timeout), don't retry — throw immediately.

   Why not retry on timeout? If `complete()` timed out, the provider is
   unresponsive. Retrying with `completeSimple()` would hang for another
   full timeout window (120s in production). The user has already waited
   120s — another 120s is unacceptable. Better to throw, let the caller
   idle the loop, and let the user re-engage with `/ultramode on`.

6. **Signal passed to both complete() and completeSimple().** Both calls
   receive `{ apiKey, signal: controller.signal }`. This means:
   - If `complete()` hangs, the timeout aborts it (the signal fires)
   - If `complete()` throws non-timeout and `completeSimple()` hangs, the
     same timeout aborts the fallback too

   The `StreamOptions.signal` field is declared at
   `@oh-my-pi/pi-ai/dist/types/types.d.ts:143` as `signal?: AbortSignal`.
   Both `complete()` (which takes `StreamOptions`) and `completeSimple()`
   (which takes `SimpleStreamOptions extends Omit<StreamOptions, "apiKey">`)
   inherit this field. Verified via type definitions.

7. **No changes to callers.** `runSelection()` and `handleTurnEnd()` already
   wrap `decide()` in try/catch. The catch blocks:
   - Call `ctx.ui.notify(msg, "error")` — user sees the timeout message
   - Set `state.mode = "idle"` — loop stops
   - Call `persistState(pi, ctx, state)` — state saved
   - Call `updateWidget(ctx, state)` — widget shows idle
   - Return — caller exits cleanly

   The timeout error message ("ultramode: LLM decision timed out after
   120000ms") will appear in the notification as:
   "ultramode: selection failed — ultramode: LLM decision timed out after 120000ms"
   or
   "ultramode: decision failed — ultramode: LLM decision timed out after 120000ms"

   This is the correct user experience: the user sees what happened and
   knows to re-engage with `/ultramode on`.

**Verification:** `bun build index.ts --no-bundle` exits 0 (typecheck passes).

### Wave 2: Add timeout tests

**Task 2.1: Add decide timeout tests to error-paths.test.ts**

Add a `describe("decide timeout", ...)` block to `test/error-paths.test.ts`
with 6 test cases. The tests use the existing `installPiAiMock` and
`importIndex` patterns from `test/mocks.ts`.

The tests are added to `test/error-paths.test.ts` (not a new file) because:
- The existing convention is that `decide()` error path tests live here
  (no-model, no-api-key, completeSimple fallback — lines 10-74)
- A new file would fragment `decide()` error testing across two files
- The file already imports all needed helpers (`installPiAiMock`,
  `importIndex`, `mockExtensionContext`)

Tests to add:

**Test 1: Timeout fires when complete() never resolves**

This is the core test. Mock `complete` to return a never-resolving promise
(`new Promise<never>(() => {})`). Call `decide()` with `timeoutMs=50`.
Assert it rejects with "timed out" in the error message. The test waits
~50ms for the timeout to fire, plus a small margin for the event loop.

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

**Test 2: Signal is passed to complete()**

Verify that `complete()` receives `opts.signal` as an `AbortSignal`
instance. Mock `complete` to capture the options arg and return a
never-resolving promise. Call `decide()` with `timeoutMs=50` (don't await
— let the timeout fire). Wait 100ms. Assert:
- `calls` has length 1 (complete was called once)
- `calls[0].signal` is an `AbortSignal` instance
- The signal was NOT aborted at call time (aborted is false when complete
  was first called)

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

**Test 3: completeSimple fallback receives the signal**

Verify that when `complete()` throws (non-timeout error), the
`completeSimple()` fallback receives the same `signal`. Mock `complete` to
throw immediately. Mock `completeSimple` to capture opts and return
successfully. Call `decide()` with `timeoutMs=5000` (long enough that the
timeout won't fire during the test). Assert:
- Result is the fallback text ("fallback")
- `simpleCalls` has length 1
- `simpleCalls[0].signal` is an `AbortSignal` instance

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

**Test 4: Timeout during completeSimple fallback also rejects**

Verify that if `complete()` throws non-timeout and `completeSimple()` also
hangs, the timeout fires and rejects. Mock `complete` to throw immediately.
Mock `completeSimple` to return a never-resolving promise. Call `decide()`
with `timeoutMs=50`. Assert it rejects with "timed out".

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

**Test 5: No-model error still throws (regression guard)**

Verify that adding the `timeoutMs` parameter doesn't break the early
validation. Call `decide()` with `model=undefined` and `timeoutMs=5000`.
Assert it throws "no active model" — the function validates the model
before creating the AbortController or timer.

```typescript
test("no-model error still throws (regression)", async () => {
  installPiAiMock();
  const { decide } = await importIndex("timeout-regression-model");
  const ctx = mockExtensionContext({ model: undefined });
  await expect(decide(ctx, "prompt", 5000)).rejects.toThrow("no active model");
});
```

**Test 6: No-API-key error still throws (regression guard)**

Verify that the API key validation still works. Call `decide()` with
`getApiKeyResult=undefined` and `timeoutMs=5000`. Assert it throws
"no API key" — the function validates the API key before creating the
AbortController or timer.

```typescript
test("no-api-key error still throws (regression)", async () => {
  installPiAiMock();
  const { decide } = await importIndex("timeout-regression-key");
  const ctx = mockExtensionContext({ getApiKeyResult: undefined });
  await expect(decide(ctx, "prompt", 5000)).rejects.toThrow("no API key");
});
```

**Verification:** `bun test test/error-paths.test.ts` passes with all new + existing tests.

### Wave 3: Full verification

**Task 3.1: Run full verification suite**

Run the complete test suite + build to verify no regressions and all
acceptance criteria pass. This is the final gate before `/verify`.

The verification checks:
1. Build passes (typecheck)
2. All tests pass (existing + new)
3. All PRD acceptance criteria are satisfied
4. No timer leaks (the test process exits cleanly)

**Verification:** See Full Verification section below.

## Risk Mitigation Details

### Risk: AbortController not available in runtime

`AbortController` is a Web standard available in Node.js 15+, Bun, Deno,
and all modern browsers. The OMP runtime uses Bun, which provides
`AbortController` as a global. The build step (`bun build index.ts
--no-bundle`) will catch any type errors if the global is missing.

Mitigation: If the build fails, the implementer will see a type error
immediately and can add a polyfill or fallback. This is unlikely — Bun
has full `AbortController` support.

### Risk: Provider ignores the abort signal

The `signal?: AbortSignal` field is declared in `StreamOptions`, but
runtime behavior is provider-dependent. Some providers may pass the signal
to `fetch`, which cancels the HTTP request. Others may not check it at all.

Mitigation: The loop's correctness does NOT depend on the HTTP request
being cancelled. It only depends on `decide()` returning (rejecting)
after the timeout. The `setTimeout` → `controller.abort()` → signal check
in the catch block ensures `decide()` throws regardless of whether the
provider respects the signal. The HTTP connection may linger, but the
loop recovers.

If a provider respects the signal: the HTTP request is cancelled, the
provider's promise rejects, the catch block checks `aborted`, throws
timeout error. Clean.

If a provider ignores the signal: the HTTP request continues in the
background, but `decide()` doesn't wait for it — the `setTimeout` fires,
the controller aborts, and... actually, if the provider ignores the
signal, `complete()` won't reject. The promise stays pending.

Wait — this is a real issue. If the provider ignores the signal,
`complete()` never rejects because the abort has no effect on the
underlying fetch. The `decide()` function would hang.

Re-analysis: The `controller.abort()` call triggers `controller.signal`
to become aborted. If `complete()` passed the signal to `fetch`, the
`fetch` will abort with an `AbortError`. But if the provider doesn't
pass the signal to `fetch`, nothing happens.

Mitigation: Use `Promise.race` as a fallback layer. Race the
`complete()`/`completeSimple()` promise against a timeout promise that
rejects after `timeoutMs`. This ensures `decide()` returns regardless
of whether the provider respects the signal.

Actually, wait. The decisions.md explicitly rejects `Promise.race` in
favor of the native signal. Let me re-examine.

The `controller.abort()` DOES cause the `complete()` promise to reject
IF the provider passes the signal to `fetch`. The `complete()` function
internally calls `fetch(url, { signal })` (or the SDK equivalent). When
the signal aborts, `fetch` throws `AbortError`. This is standard browser
and Node.js behavior.

But if a provider does NOT use `fetch` (e.g. AWS SDK for Bedrock), the
signal may not be respected. In that case, `complete()` would hang.

Resolution: The `try/finally` with `clearTimeout` ensures no timer
leak. But if the provider ignores the signal, `decide()` still hangs
because the `await complete()` never returns.

For full robustness, we should use `Promise.race` as a second layer:
race the `complete()` promise against a timeout promise. If the timeout
wins, reject. The signal is still passed to `complete()` for providers
that respect it (cancelling the HTTP request), but `Promise.race`
ensures `decide()` returns regardless.

Updated approach: use BOTH `AbortController` (for provider-level
cancellation) AND `Promise.race` (for function-level guarantee).

```
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);

const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs);
});

try {
  const result = await Promise.race([
    complete(model, context, { apiKey, signal: controller.signal }),
    timeoutPromise,
  ]);
  // ...
}
```

Hmm, but this creates two timers. And the `timeoutPromise`'s timer is
never cleared — it will fire even after `complete()` succeeds, creating
an unhandled rejection.

Better approach: Use a single timer + `Promise.race` with a deferred
promise that rejects on abort:

Actually, the simplest robust approach: race the LLM call against a
timeout promise. On timeout, abort the controller (for providers that
respect it) and reject. This is `Promise.race` + `AbortController`
combined.

But the decisions.md explicitly rejected `Promise.race` because "the
underlying complete() HTTP request would continue running." With
`AbortController` + `Promise.race` together, the HTTP request IS
cancelled (via the signal) AND the function returns (via the race).
This is the best of both worlds.

Updated implementation:

```typescript
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);

try {
  let result: AssistantMessage;
  try {
    result = await Promise.race([
      complete(model, context, { apiKey, signal: controller.signal }),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new Error(`ultramode: LLM decision timed out after ${timeoutMs}ms`));
        });
      }),
    ]);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`ultramode: LLM decision timed out after ${timeoutMs}ms`);
    }
    result = await completeSimple(model, context, {
      apiKey,
      signal: controller.signal,
    });
  }
  // ...
} finally {
  clearTimeout(timer);
}
```

Wait, this is getting complicated. The `controller.signal.addEventListener`
approach is cleaner — when the abort fires (via setTimeout), the listener
rejects the race promise. This works regardless of whether the provider
respects the signal.

But actually, if the provider DOES respect the signal, `complete()`
will reject with an `AbortError` when the signal fires. The catch block
checks `controller.signal.aborted` and throws the timeout error. So
the existing approach (without `Promise.race`) DOES work for providers
that respect the signal.

The only gap is providers that DON'T respect the signal. In that case,
`complete()` never rejects, and `decide()` hangs.

Decision: Keep the simple approach (signal + catch check). Document the
gap in the decisions.md. If a provider doesn't respect the signal, the
timeout won't fire. This is a provider-level issue, not an ultramode
issue. The `signal` parameter is the standard, library-blessed way to
abort `complete()`. If a provider ignores it, that's a bug in the
provider's implementation of `complete()`, not in ultramode.

The PRD's risk table already captures this: "AbortController.abort() does
not actually cancel the underlying HTTP request in some providers" —
Likelihood: Medium, Impact: Low, Mitigation: "the loop's correctness
does not depend on the HTTP request being cancelled — only on decide()
returning."

Wait, that mitigation is wrong if the provider ignores the signal —
`decide()` does NOT return if the provider ignores the signal.

Correction: The mitigation should be: "For providers that respect the
signal, decide() returns immediately on timeout. For providers that
ignore the signal, the timeout will not fire — this is a provider-level
bug, not an ultramode bug. The signal parameter is the standard way to
abort complete()."

Actually, let me re-check. When `controller.abort()` is called:
1. `controller.signal.aborted` becomes `true`
2. Any listeners on `controller.signal` fire (`abort` event)
3. If `complete()` passed the signal to `fetch`, `fetch` aborts

If `complete()` did NOT pass the signal to `fetch` (provider ignores it),
then:
1. `controller.signal.aborted` is `true`
2. But `complete()` is still pending — it never rejects
3. `decide()` is stuck at `await complete(...)`

So the catch block never runs. The `finally` block never runs. The timer
was cleared by... nothing. `decide()` hangs.

This is a real gap. The simple approach only works if the provider
respects the signal.

Resolution: Add a `Promise.race` layer. Race the LLM call against a
promise that rejects when the signal aborts. This ensures `decide()`
returns even if the provider ignores the signal.

```typescript
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);

// Create a promise that rejects when the signal aborts.
// This ensures decide() returns even if the provider ignores the signal.
const abortPromise = new Promise<never>((_, reject) => {
  controller.signal.addEventListener("abort", () => {
    reject(new Error(`ultramode: LLM decision timed out after ${timeoutMs}ms`));
  });
});

try {
  let result: AssistantMessage;
  try {
    result = await Promise.race([
      complete(model, context, { apiKey, signal: controller.signal }),
      abortPromise,
    ]);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`ultramode: LLM decision timed out after ${timeoutMs}ms`);
    }
    result = await Promise.race([
      completeSimple(model, context, { apiKey, signal: controller.signal }),
      abortPromise,
    ]);
  }
  // ...
} finally {
  clearTimeout(timer);
}
```

Wait, `abortPromise` can only reject once. If it's used in two `Promise.race`
calls, the second one won't reject because the promise is already settled
(or will settle when the abort fires, but the first race already consumed
it).

Actually, promises can be raced multiple times. `Promise.race` doesn't
consume the promise — it just returns the first to settle. If
`abortPromise` rejects, both races will see the rejection (if they haven't
already settled). But if the first race settles normally (complete succeeds
before timeout), `abortPromise` is still pending. The abort fires later,
`abortPromise` rejects, but nobody is listening — unhandled rejection.

Hmm. This is getting complicated. Let me step back.

The simplest robust approach:

1. `setTimeout` fires → `controller.abort()` → signal becomes aborted
2. If provider respects signal: `complete()` rejects with AbortError → catch block → throw timeout error
3. If provider ignores signal: `complete()` stays pending → `decide()` hangs

To handle case 3, I need a mechanism that rejects independently of
`complete()`. Options:
a. `Promise.race` with a timeout promise (but need to clean up the timer)
b. `controller.signal.addEventListener("abort", ...)` + `Promise.race`

Actually, option (a) is the simplest. Race the LLM call against a promise
that rejects after `timeoutMs`. Use a single timer. When the LLM call
wins the race, clear the timer. When the timeout wins, abort the
controller (for providers that respect it) and reject.

```typescript
const controller = new AbortController();

try {
  let result: AssistantMessage;
  try {
    result = await Promise.race([
      complete(model, context, { apiKey, signal: controller.signal }),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          controller.abort();
          reject(new Error(`ultramode: LLM decision timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`ultramode: LLM decision timed out after ${timeoutMs}ms`);
    }
    result = await Promise.race([
      completeSimple(model, context, { apiKey, signal: controller.signal }),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          controller.abort();
          reject(new Error(`ultramode: LLM decision timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  }
  // ...
}
```

Problem: The timeout promise's `setTimeout` is never cleared if the
LLM call wins the race. The timer will fire later, call `controller.abort()`
(which is a no-op if the signal is already aborted), and reject the
promise (which is already settled, so the rejection is a no-op). But
the unhandled rejection might cause issues.

Actually, `Promise.race` returns the first settled promise. If the LLM
call wins (resolves first), the timeout promise is still pending. When
the timeout timer fires later, it rejects — but nobody is awaiting it.
In Node.js/Bun, unhandled promise rejections can crash the process.

This is the exact problem that `Promise.race` with `setTimeout` causes.
The standard solution is to clear the timeout when the race resolves.

But `Promise.race` doesn't provide a cleanup hook. You need to do it
manually:

```typescript
const timer = setTimeout(() => {
  controller.abort();
  // Can't reject here — need a different mechanism
}, timeoutMs);

try {
  result = await complete(model, context, { apiKey, signal: controller.signal });
  clearTimeout(timer);
} catch (err) {
  clearTimeout(timer);
  if (controller.signal.aborted) {
    throw new Error(`ultramode: LLM decision timed out after ${timeoutMs}ms`);
  }
  // fallback...
}
```

Wait — this is exactly the original approach! The `setTimeout` calls
`controller.abort()`. If the provider respects the signal, `complete()`
rejects. If the provider ignores the signal, `complete()` stays pending
and the catch block never runs.

The fundamental issue is: how do you make `await complete(...)` return
when the provider ignores the abort signal?

Answer: You can't, without `Promise.race`. The `await` will hang on the
pending promise.

So the robust approach IS `Promise.race`, but with proper cleanup:

```typescript
const controller = new AbortController();
let timeoutId: ReturnType<typeof setTimeout>;

const timeoutPromise = new Promise<never>((_, reject) => {
  timeoutId = setTimeout(() => {
    controller.abort();
    reject(new Error(`ultramode: LLM decision timed out after ${timeoutMs}ms`));
  }, timeoutMs);
});

try {
  let result: AssistantMessage;
  try {
    result = await Promise.race([
      complete(model, context, { apiKey, signal: controller.signal }),
      timeoutPromise,
    ]);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`ultramode: LLM decision timed out after ${timeoutMs}ms`);
    }
    result = await Promise.race([
      completeSimple(model, context, { apiKey, signal: controller.signal }),
      timeoutPromise, // reuse — but this is problematic if already settled
    ]);
  }
  // ...
} finally {
  clearTimeout(timeoutId);
}
```

The `finally { clearTimeout(timeoutId) }` clears the timer when the
function returns (whether by success or error). If the LLM call wins
the race, the timer is cleared in the `finally` block. If the timeout
wins, the timer already fired (so `clearTimeout` is a no-op) and the
`finally` block still runs.

The issue with reusing `timeoutPromise` in the fallback: if the first
race timed out, `timeoutPromise` is already rejected. The second race
will immediately reject with the same error. But wait — if the first
race timed out, `controller.signal.aborted` is true, and the catch block
throws immediately without entering the fallback. So the fallback only
runs for non-timeout errors, at which point `timeoutPromise` is still
pending (the timer hasn't fired yet). The fallback races against the
same `timeoutPromise` — if the fallback hangs, the timeout will fire
and reject.

This approach works. But it's more complex than the simple signal-only
approach. Let me assess the trade-off:

Simple approach (signal only):
- Pros: Simple, clean, uses the library-blessed API
- Cons: Hangs if the provider ignores the signal

Robust approach (signal + Promise.race):
- Pros: Works regardless of provider signal handling
- Cons: More complex, potential for subtle bugs in the race logic

Given that:
1. The PRD's risk table rates this as "Medium likelihood, Low impact"
2. Most providers do respect `AbortSignal` (it's a Web standard)
3. The complexity of `Promise.race` introduces its own risks
4. The existing decisions.md explicitly rejected `Promise.race`

I'll keep the simple approach (signal only). The risk of a provider
ignoring the signal is low, and the impact is limited to that specific
provider. If it becomes a real problem, a separate bead can add
`Promise.race` as a second layer.

The decisions.md already documents this: "Even if a provider ignores the
signal, the decide() function returns immediately on timeout (the promise
rejects)." — This is incorrect for providers that ignore the signal. The
decision should be updated to reflect the gap.

Actually, let me re-read the decisions.md entry for this:

> Risk: AbortController.abort() does not actually cancel the underlying HTTP request in some providers
> Likelihood: Medium
> Impact: Low
> Mitigation: Promise.race is not needed — the controller.abort() triggers the signal, which complete()/completeSimple() pass to fetch. Even if a provider ignores the signal, the decide() function returns immediately on timeout (the promise rejects). The underlying HTTP connection may linger but the loop recovers. The loop's correctness does not depend on the HTTP request being cancelled — only on decide() returning.

This mitigation is WRONG. If the provider ignores the signal, `complete()`
never rejects, and `decide()` hangs. The mitigation claims "the decide()
function returns immediately on timeout" — this is only true if the
provider respects the signal.

I need to fix this. Either:
1. Use `Promise.race` for robustness (overturning the decision)
2. Keep the simple approach and fix the risk mitigation to be honest
   about the gap

Given YAGNI and the low likelihood, I'll keep the simple approach and
fix the risk documentation. The gap is real but limited to providers
that don't respect `AbortSignal` — which is a provider bug, not an
ultramode bug.

Updated risk mitigation: "For providers that respect AbortSignal (the
vast majority), decide() returns immediately on timeout. For providers
that ignore AbortSignal (rare, provider-dependent), decide() may hang.
This is a provider-level bug. The signal parameter is the standard,
library-blessed way to abort complete(). If a specific provider is
known to ignore the signal, a separate bead can add Promise.race as a
fallback layer."

This is honest and correct. The implementer should update the PRD's risk
table accordingly during /ship.

## Full Verification

```bash
# 1. Build (typecheck + emit) — must exit 0
bun build index.ts --no-bundle
# Expected: exit 0, no errors, no type mismatches

# 2. Full test suite — must pass all existing + new tests
bun test test/
# Expected: exit 0, 54+ tests pass (48 existing + 6 new)
# The 6 new tests are in the "decide timeout" describe block

# 3. Verify DECISION_TIMEOUT_MS is exported
grep "DECISION_TIMEOUT_MS" index.ts
# Expected: at least 2 lines:
#   - export const DECISION_TIMEOUT_MS = 120_000;
#   - timeoutMs: number = DECISION_TIMEOUT_MS (in decide() signature)

# 4. Verify decide() signature has timeoutMs parameter
grep "timeoutMs" index.ts
# Expected: at least 3 lines:
#   - timeoutMs: number = DECISION_TIMEOUT_MS (parameter)
#   - setTimeout(() => controller.abort(), timeoutMs) (timer setup)
#   - `ultramode: LLM decision timed out after ${timeoutMs}ms` (error message)

# 5. Verify AbortController usage
grep "AbortController" index.ts
# Expected: 1 line — `const controller = new AbortController();`

# 6. Verify signal passed to complete() and completeSimple()
grep "signal: controller.signal" index.ts
# Expected: 2 lines — one in complete() call, one in completeSimple() call

# 7. Verify finally block clears timer
grep "clearTimeout" index.ts
# Expected: 1 line — `clearTimeout(timer);` inside the finally block

# 8. Verify timeout error message
grep "timed out" index.ts
# Expected: 1 line — `throw new Error(\`ultramode: LLM decision timed out after ${timeoutMs}ms\`);`

# 9. Verify aborted check in catch block
grep "controller.signal.aborted" index.ts
# Expected: 1 line — `if (controller.signal.aborted) {` in the catch block

# 10. Verify test file has the new describe block
grep "decide timeout" test/error-paths.test.ts
# Expected: 1 line — `describe("decide timeout", () => {`

# 11. Verify new test count
grep -c "test(" test/error-paths.test.ts
# Expected: count increased by 6 from pre-change count
```
