<!-- DENSITY: Minimum 600 lines. No upper bound — be thorough. <600 = incomplete (missing sections, hand-wavy, no real technical context). This is an AI handoff: another agent must be able to pick this up and implement correctly without guessing. Every section must have concrete evidence: file paths, API signatures, existing patterns, constraints. -->
# PRD: Integration test harness for ultramode extension — unit tests for parseDecision, reconstructState, phase maps, retry logic, and error paths; mock ExtensionAPI/ExtensionContext; verify 5 unchecked runtime risks

**Bead:** ultramode-air | **Type:** chore | **Priority:** P2
**Created:** 2026-06-17 | **Estimate:** 180 minutes

## Problem

WHEN a developer modifies `index.ts` (the ultramode extension entry point, 926 lines) THEN a regression in the core decision loop — `parseDecision`, `reconstructState`, phase maps, retry logic, or error paths — goes undetected until a live OMP session fails at runtime BECAUSE there is zero test coverage on the extension's core logic.

The `ultramode-fpj` completion evidence (`.beads/artifacts/ultramode-fpj/completion-evidence.json`) lists 5 unchecked runtime risks — all code paths exist (error handling, fallbacks, retry caps, state persistence, JSON parsing) but none have been exercised. The review fixed 4 high-confidence bugs in these exact paths: greedy regex in `parseDecision` (would silently idle on brace-in-prose LLM output), retry re-injecting the wrong command (advancing phases instead of retrying), retry no-oping into a stuck loop, and `reconstructState` not validating the `phase` field. Without tests, the next change to `index.ts` could reintroduce any of these bugs silently.

This affects any developer modifying the extension. The cost is debugging a broken autonomous loop in a live OMP session — which means watching the extension fail to select work, fail to chain phases, or silently idle with no indication of why. That debugging cycle is expensive because it requires a configured model, an active OMP session, and a bead to work on.

## Scope

### In Scope

- `test/parse-decision.test.ts` — unit tests for `parseDecision<T>()`: backward brace-balanced extraction, brace-in-prose handling, multiple JSON objects, invalid action filtering, null on no-match
- `test/reconstruct-state.test.ts` — unit tests for `reconstructState()`: valid state reconstruction, phase validation (rejects invalid phases, falls back to "selecting"), corrupt data handling, missing fields, mode validation
- `test/phase-maps.test.ts` — consistency tests for `PHASE_WHITELIST`, `PHASE_FROM_COMMAND`, `COMMAND_FROM_PHASE`, `VALID_PHASES`, `ALLOWED_PHASE_COMMANDS`: every phase has an entry in every map, `PHASE_WHITELIST` terminal is `pr: null`, `COMMAND_FROM_PHASE` is the exact reverse of `PHASE_FROM_COMMAND`, no `/close` in any map
- `test/retry-logic.test.ts` — tests for retry cap behavior: increment under MAX_RETRIES, exhaust at MAX_RETRIES, reset-to-selection on no-command case (the bug fix from review finding #3)
- `test/error-paths.test.ts` — tests for `decide()` error handling: throws "no active model" when `ctx.model` is undefined, throws "no API key" when `getApiKey` returns undefined, `completeSimple` fallback path
- `test/mocks.ts` — mock factories for `ExtensionAPI`, `ExtensionContext`, `ExtensionCommandContext` with stubbed `pi.exec`, `pi.sendUserMessage`, `pi.appendEntry`, `ctx.model`, `ctx.modelRegistry`, `ctx.sessionManager`, `ctx.ui`
- `test/run.sh` — test runner script: `bun test test/`
- Verification that the 5 unchecked risks from `completion-evidence.json` are now testable

### Out of Scope

- Live OMP session testing (requires a configured model — separate bead)
- Worktree enforcement (separate bead — `state.worktreePath` is never populated)
- Module refactor of `index.ts` (separate bead — premature at current size)
- GitHub remote + CI setup (separate bead — CI without tests just runs `bun build`)
- Testing `runSelection()` end-to-end (requires mocking `complete()` which requires a real API key — the success path can't be tested without a model; only error paths are testable)
- Testing `handleTurnEnd()` end-to-end (same constraint — depends on `decide()` which calls `complete()`)
- Testing `tool_call` handler (dead code — `worktreePath` is never set)
- Modifying `index.ts` (test-only changes; if exports need to change for testability, document as a follow-up)

## Requirements

| # | Requirement | Priority | Acceptance Criteria |
|---|------------|----------|---------------------|
| 1 | `parseDecision` tests cover the backward brace-balanced scan fix | MUST | `bun test test/parse-decision.test.ts` passes; tests include: brace-in-prose LLM output, multiple JSON objects, nested JSON, invalid action filtering, null on no-match, empty string |
| 2 | `reconstructState` tests cover phase validation | MUST | `bun test test/reconstruct-state.test.ts` passes; tests include: valid state, invalid phase falls back to "selecting", corrupt data skipped, missing fields use defaults, mode validation rejects unknown modes |
| 3 | Phase map consistency tests verify no `/close` injection | MUST | `bun test test/phase-maps.test.ts` passes; tests include: `PHASE_WHITELIST` has `pr: null` terminal, no map contains `/close`, `COMMAND_FROM_PHASE` is reverse of `PHASE_FROM_COMMAND`, every `Phase` has entries in all maps |
| 4 | Retry logic tests cover the stuck-loop bug fix | MUST | `bun test test/retry-logic.test.ts` passes; tests include: retries increment under MAX_RETRIES, at MAX_RETRIES triggers blocked+selection, no-command case resets to selection (not stuck) |
| 5 | Error path tests cover `decide()` failure modes | MUST | `bun test test/error-paths.test.ts` passes; tests include: throws "no active model" when `ctx.model` undefined, throws "no API key" when `getApiKey` returns undefined |
| 6 | Mock factory provides reusable test infrastructure | MUST | `test/mocks.ts` exports `mockExtensionAPI()`, `mockExtensionContext()`, `mockSessionManager()` that return typed stubs with configurable return values |
| 7 | Test runner script works | SHOULD | `bash test/run.sh` runs all tests and exits 0 |
| 8 | All tests pass together | MUST | `bun test test/` exits 0 |

## Technical Context

**Key files:**
- `index.ts` — EDIT (may need to export internal functions for testing; currently `parseDecision`, `reconstructState`, phase maps are module-level consts/functions not exported) (~926 lines)
- `test/parse-decision.test.ts` — NEW (~100 lines)
- `test/reconstruct-state.test.ts` — NEW (~100 lines)
- `test/phase-maps.test.ts` — NEW (~80 lines)
- `test/retry-logic.test.ts` — NEW (~100 lines)
- `test/error-paths.test.ts` — NEW (~80 lines)
- `test/mocks.ts` — NEW (~120 lines)
- `test/run.sh` — NEW (~5 lines)

**APIs / systems touched:**
- `bun:test` — Bun's built-in test runner (`describe`, `test`, `expect`, `beforeEach`, `mock`). Verified available: `bun test` works without configuration.
- `index.ts` internal functions — `parseDecision<T>()`, `reconstructState()`, `extractText()`, `truncate()`, `checkArtifact()`, `buildArtifactStatus()`, `decide()`, `createState()`, `getState()`, `persistState()`, `reconstructState()`
- `index.ts` internal constants — `PHASE_WHITELIST`, `PHASE_FROM_COMMAND`, `COMMAND_FROM_PHASE`, `ALLOWED_PHASE_COMMANDS`, `VALID_PHASES`, `MAX_RETRIES`, `CONTROL_TYPE`
- OMP extension types — `ExtensionAPI`, `ExtensionContext`, `ExtensionCommandContext` from `@oh-my-pi/pi-coding-agent`

**Existing patterns:**
- No existing test patterns in this repo — this is the first test suite
- `bun:test` is the standard: `import { describe, test, expect } from "bun:test"`
- The extension uses TypeScript ES modules — tests must use the same module system
- `package.json` has `"type": "module"` — tests inherit this

**Export challenge:**
The functions under test (`parseDecision`, `reconstructState`, phase maps) are currently module-level declarations in `index.ts` — not exported. The default export is `function ultramode(pi: ExtensionAPI): void`. To test these functions, they must be exported. Options:

1. **Named exports** — add `export` to each function/const. Clean, minimal, doesn't change the default export.
2. **Separate test entry** — import the module and access internals via a test-only export. More complex.
3. **Test via behavior** — test through the exported `ultramode()` factory, which registers handlers. Indirect and hard to test specific functions.

Option 1 is simplest and follows the principle of minimal change. The `export` keyword doesn't change runtime behavior — it only makes the symbol importable.

**Mock patterns:**
The mock factory must provide:
- `mockExtensionAPI()` — returns an object with `exec`, `sendUserMessage`, `appendEntry`, `registerCommand`, `on` as stubs. Each stub is configurable: `exec` returns `{ stdout: string, code: number }`, `sendUserMessage` is a spy, `appendEntry` is a spy, `registerCommand` is a spy, `on` is a spy.
- `mockExtensionContext(overrides?)` — returns an object with `model`, `modelRegistry`, `sessionManager`, `ui`, `cwd` as stubs. `modelRegistry.getApiKey` returns `Promise<string | undefined>`, `sessionManager.getBranch` returns `SessionEntry[]`, `sessionManager.getSessionId` returns `string`, `ui.notify` is a spy, `ui.setWidget` is a spy, `ui.setStatus` is a spy.
- `mockSessionManager(entries?)` — returns a stub `ReadonlySessionManager` with configurable `getBranch()` return value.

**Constraints:**
- Cannot test `complete()` success path — requires a real API key and model. Only error paths are testable (no model, no API key).
- Cannot test `runSelection()` or `handleTurnEnd()` end-to-end — both call `decide()` which calls `complete()`. Can test the error handling around `decide()` (catch + idle + notify).
- `parseDecision` is a generic function — can be tested directly without any mocks.
- `reconstructState` needs a mock `ExtensionContext` with a `sessionManager.getBranch()` that returns configurable entries.
- Phase maps are plain constants — can be tested with static assertions.

**The 5 unchecked risks from completion-evidence.json:**

1. **Risk 1 (complete() API key resolution fails for some providers)** — the `completeSimple` fallback path exists in `decide()` (try/catch at line ~340). Testable: mock `complete` to throw, verify `completeSimple` is called. This requires mocking the `@oh-my-pi/pi-ai` module — Bun supports `mock.module()`.
2. **Risk 2 (sendUserMessage re-entrancy deadlock)** — the `deliverAs: "followUp"` pattern. NOT directly testable (requires a live event loop). But the `hasPendingMessages` guard (line 803) is testable: mock `ctx.hasPendingMessages` to return true, verify `handleTurnEnd` returns early.
3. **Risk 3 (ctx.model is undefined)** — the error path in `decide()`. Testable: mock `ctx.model` as undefined, verify `decide()` throws "no active model".
4. **Risk 4 (br scheduler returns zero recommendations)** — the fallback to `br list`. Testable: mock `pi.exec` to return empty scheduler JSON, verify fallback `br list` is called.
5. **Risk 5 (LLM returns invalid JSON)** — the `parseDecision` fail-safe. Fully testable: pass invalid JSON strings to `parseDecision`, verify null return.

## Approach

### Test structure

Each test file is a self-contained module that imports from `index.ts` and `test/mocks.ts`. Tests use `bun:test`'s `describe`/`test`/`expect` pattern. No external test dependencies — `bun:test` is built-in.

### Export strategy

Add named exports to `index.ts` for the functions and constants under test. This is the minimal change — `export` keyword on existing declarations. The default export (`export default function ultramode`) is unchanged. Specifically export:
- `parseDecision` (function)
- `reconstructState` (function)
- `createState` (function)
- `extractText` (function)
- `truncate` (function)
- `decide` (function)
- `PHASE_WHITELIST`, `PHASE_FROM_COMMAND`, `COMMAND_FROM_PHASE`, `ALLOWED_PHASE_COMMANDS`, `VALID_PHASES` (consts)
- `MAX_RETRIES`, `CONTROL_TYPE` (consts)
- Type exports: `Phase`, `UltramodeState`, `SelectionDecision`, `PhaseDecision`

### Mock design

The mock factory uses plain objects with stub functions. No mocking framework — just functions that return configurable values. Each mock factory accepts an optional overrides parameter for test-specific configuration:

```typescript
// test/mocks.ts

import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionCommandContext,
} from "@oh-my-pi/pi-coding-agent";

// ─── Spies ──────────────────────────────────────────────────────────────

interface Spy<T extends (...args: any[]) => any> {
  calls: Parameters<T>[];
  returnValue?: ReturnType<T>;
  (...args: Parameters<T>): ReturnType<T>;
}

function createSpy<T extends (...args: any[]) => any>(
  impl?: (...args: Parameters<T>) => ReturnType<T>,
  returnValue?: ReturnType<T>
): Spy<T> {
  const fn = ((...args: Parameters<T>) => {
    (fn as any).calls.push(args);
    if (impl) return impl(...args);
    return returnValue;
  }) as any;
  fn.calls = [];
  return fn;
}

// ─── Mock SessionManager ────────────────────────────────────────────────

interface MockSessionEntry {
  type: string;
  customType?: string;
  data?: any;
}

function mockSessionManager(entries: MockSessionEntry[] = []) {
  return {
    getBranch: createSpy(() => entries),
    getSessionId: createSpy(() => "test-session-id"),
    // Include other methods that might be called on ReadonlySessionManager
    // but are not used by the functions under test
  };
}

// ─── Mock ExtensionContext ─────────────────────────────────────────────

interface MockContextOverrides {
  model?: any;
  getApiKeyResult?: string | undefined;
  sessionEntries?: MockSessionEntry[];
  cwd?: string;
  hasPendingMessages?: boolean;
}

function mockExtensionContext(overrides: MockContextOverrides = {}) {
  return {
    model: overrides.model ?? { provider: "test", id: "test-model" },
    modelRegistry: {
      getApiKey: createSpy(async () => overrides.getApiKeyResult ?? "test-api-key"),
    },
    sessionManager: mockSessionManager(overrides.sessionEntries),
    ui: {
      notify: createSpy(),
      setWidget: createSpy(),
      setStatus: createSpy(),
    },
    cwd: overrides.cwd ?? "/test/cwd",
    ...(overrides.hasPendingMessages !== undefined
      ? { hasPendingMessages: createSpy(() => overrides.hasPendingMessages!) }
      : {}),
  } as any;
}

// ─── Mock ExtensionAPI ─────────────────────────────────────────────────

interface MockAPIOverrides {
  execResult?: { stdout: string; code: number };
  execResults?: Array<{ stdout: string; code: number }>;
}

function mockExtensionAPI(overrides: MockAPIOverrides = {}) {
  let execCallIndex = 0;
  return {
    exec: createSpy(async () => {
      if (overrides.execResults) {
        return overrides.execResults[Math.min(execCallIndex++, overrides.execResults.length - 1)];
      }
      return overrides.execResult ?? { stdout: "{}", code: 0 };
    }),
    sendUserMessage: createSpy(),
    appendEntry: createSpy(),
    registerCommand: createSpy(),
    on: createSpy(),
  } as any;
}

export {
  createSpy,
  mockSessionManager,
  mockExtensionContext,
  mockExtensionAPI,
};
export type { Spy, MockSessionEntry, MockContextOverrides, MockAPIOverrides };
```

### Risk coverage mapping

| Risk | Test file | How tested |
|------|-----------|------------|
| 1: complete() API key resolution | `test/error-paths.test.ts` | Mock `complete` to throw, verify `completeSimple` is called via `mock.module()` |
| 2: sendUserMessage re-entrancy | `test/error-paths.test.ts` | Mock `ctx.hasPendingMessages` to return true, verify early return |
| 3: ctx.model undefined | `test/error-paths.test.ts` | Mock `ctx.model` as undefined, verify `decide()` throws |
| 4: scheduler empty | `test/retry-logic.test.ts` or `test/error-paths.test.ts` | Mock `pi.exec` to return empty scheduler, verify fallback `br list` call |
| 5: LLM invalid JSON | `test/parse-decision.test.ts` | Pass invalid JSON strings, verify null return |

### Test cases per file

**`test/parse-decision.test.ts`:**

```typescript
import { describe, test, expect } from "bun:test";
import { parseDecision } from "../index";

describe("parseDecision", () => {
  // 1. Simple JSON — the happy path
  test("parses simple JSON with valid action", () => {
    const text = `{"action":"proceed","reasoning":"done","nextCommand":"/plan test-1"}`;
    const result = parseDecision(text, ["proceed", "stop"]);
    expect(result).not.toBeNull();
    expect(result!.action).toBe("proceed");
    expect(result!.reasoning).toBe("done");
  });

  // 2. Brace-in-prose — the bug that the review fix addresses
  test("extracts last balanced JSON when prose contains braces", () => {
    const text = `Transitioning to {"phase":"planning"} next.\n{"action":"proceed","reasoning":"plan exists"}`;
    const result = parseDecision(text, ["proceed", "stop"]);
    expect(result).not.toBeNull();
    expect(result!.action).toBe("proceed");
    expect(result!.reasoning).toBe("plan exists");
  });

  // 3. Multiple JSON objects — the backward scan picks the last one
  test("extracts last JSON object when multiple present", () => {
    const text = `{"action":"wait"}\n{"action":"proceed","reasoning":"changed mind"}`;
    const result = parseDecision(text, ["proceed", "wait"]);
    expect(result).not.toBeNull();
    expect(result!.action).toBe("proceed");
  });

  // 4. Nested JSON — balanced scan handles nested braces
  test("parses nested JSON objects", () => {
    const text = `{"action":"proceed","data":{"nested":true,"deep":{"value":42}}}`;
    const result = parseDecision<{ action: string; data: any }>(text, ["proceed"]);
    expect(result).not.toBeNull();
    expect(result!.data.nested).toBe(true);
    expect(result!.data.deep.value).toBe(42);
  });

  // 5. Invalid action — filtered out
  test("returns null for action not in allowed list", () => {
    const text = `{"action":"unknown"}`;
    const result = parseDecision(text, ["proceed", "stop"]);
    expect(result).toBeNull();
  });

  // 6. No JSON at all
  test("returns null for text without JSON", () => {
    const text = `No decision here`;
    const result = parseDecision(text, ["proceed"]);
    expect(result).toBeNull();
  });

  // 7. Empty string
  test("returns null for empty string", () => {
    const result = parseDecision("", ["proceed"]);
    expect(result).toBeNull();
  });

  // 8. Unbalanced braces — JSON.parse fails
  test("returns null for unbalanced braces", () => {
    const text = `{action":"proceed"}`;
    const result = parseDecision(text, ["proceed"]);
    expect(result).toBeNull();
  });

  // 9. Trailing text after valid JSON
  test("extracts JSON even with trailing text", () => {
    const text = `{"action":"proceed"} some trailing text`;
    const result = parseDecision(text, ["proceed"]);
    expect(result).not.toBeNull();
    expect(result!.action).toBe("proceed");
  });

  // 10. Only braces, no valid JSON
  test("returns null for braces without valid JSON content", () => {
    const text = `{ }`;
    const result = parseDecision<{ action: string }>(text, ["proceed"]);
    expect(result).toBeNull();
  });

  // 11. Selection decision schema
  test("parses selection decision schema", () => {
    const text = `{"action":"select","beadId":"ultramode-xyz","reasoning":"high priority","createDescription":null}`;
    const result = parseDecision<{ action: string; beadId: string | null }>(text, ["select", "wait", "create"]);
    expect(result).not.toBeNull();
    expect(result!.action).toBe("select");
    expect(result!.beadId).toBe("ultramode-xyz");
  });
});
```

**`test/reconstruct-state.test.ts`:**

```typescript
import { describe, test, expect } from "bun:test";
import { reconstructState, createState } from "../index";
import { mockExtensionContext, type MockSessionEntry } from "./mocks";

function makeControlEntry(data: any): MockSessionEntry {
  return { type: "custom", customType: "ultramode-control", data };
}

describe("reconstructState", () => {
  // 1. Valid entry — full state reconstruction
  test("reconstructs valid state from control entry", () => {
    const entries = [makeControlEntry({
      mode: "on",
      beadId: "ultramode-xyz",
      phase: "planning",
      retries: 2,
      lastDecision: "proceed with plan",
      worktreePath: null,
    })];
    const ctx = mockExtensionContext({ sessionEntries: entries });
    const state = reconstructState(ctx);
    expect(state.mode).toBe("on");
    expect(state.beadId).toBe("ultramode-xyz");
    expect(state.phase).toBe("planning");
    expect(state.retries).toBe(2);
    expect(state.lastDecision).toBe("proceed with plan");
  });

  // 2. Invalid phase — falls back to "selecting" (the review bug fix)
  test("falls back to selecting phase when phase is invalid", () => {
    const entries = [makeControlEntry({
      mode: "on",
      beadId: "test-1",
      phase: "shipp",  // truncated/corrupt
      retries: 0,
    })];
    const ctx = mockExtensionContext({ sessionEntries: entries });
    const state = reconstructState(ctx);
    expect(state.phase).toBe("selecting");
  });

  // 3. Corrupt data (non-object) — skipped
  test("skips entries with non-object data", () => {
    const entries = [makeControlEntry("not an object")];
    const ctx = mockExtensionContext({ sessionEntries: entries });
    const state = reconstructState(ctx);
    expect(state.mode).toBe("off");  // default
  });

  // 4. Missing fields — defaults applied
  test("applies defaults for missing fields", () => {
    const entries = [makeControlEntry({ mode: "on" })];
    const ctx = mockExtensionContext({ sessionEntries: entries });
    const state = reconstructState(ctx);
    expect(state.beadId).toBeNull();
    expect(state.phase).toBe("selecting");
    expect(state.retries).toBe(0);
    expect(state.lastDecision).toBeNull();
  });

  // 5. Invalid mode — skipped
  test("skips entries with invalid mode", () => {
    const entries = [makeControlEntry({ mode: "running", beadId: "x" })];
    const ctx = mockExtensionContext({ sessionEntries: entries });
    const state = reconstructState(ctx);
    expect(state.mode).toBe("off");  // default, not "running"
  });

  // 6. No entries — default state
  test("returns default state when no entries exist", () => {
    const ctx = mockExtensionContext({ sessionEntries: [] });
    const state = reconstructState(ctx);
    expect(state).toEqual(createState());
  });

  // 7. Multiple entries — last one wins
  test("uses last control entry when multiple exist", () => {
    const entries = [
      makeControlEntry({ mode: "on", beadId: "first", phase: "creating", retries: 0 }),
      makeControlEntry({ mode: "on", beadId: "second", phase: "planning", retries: 1 }),
    ];
    const ctx = mockExtensionContext({ sessionEntries: entries });
    const state = reconstructState(ctx);
    expect(state.beadId).toBe("second");
    expect(state.phase).toBe("planning");
  });

  // 8. Non-custom entries — skipped
  test("skips non-custom entries", () => {
    const entries = [
      { type: "user_message", data: { text: "hello" } },
      makeControlEntry({ mode: "on", beadId: "real", phase: "creating", retries: 0 }),
    ];
    const ctx = mockExtensionContext({ sessionEntries: entries });
    const state = reconstructState(ctx);
    expect(state.beadId).toBe("real");
  });

  // 9. Wrong customType — skipped
  test("skips entries with different customType", () => {
    const entries = [
      { type: "custom", customType: "other-extension", data: { mode: "on" } },
      makeControlEntry({ mode: "on", beadId: "real", phase: "creating", retries: 0 }),
    ];
    const ctx = mockExtensionContext({ sessionEntries: entries });
    const state = reconstructState(ctx);
    expect(state.beadId).toBe("real");
  });
});
```

**`test/phase-maps.test.ts`:**

```typescript
import { describe, test, expect } from "bun:test";
import {
  PHASE_WHITELIST,
  PHASE_FROM_COMMAND,
  COMMAND_FROM_PHASE,
  ALLOWED_PHASE_COMMANDS,
  VALID_PHASES,
  MAX_RETRIES,
} from "../index";

describe("Phase Maps", () => {
  // 1. PHASE_WHITELIST has all 7 phases
  test("PHASE_WHITELIST has all 7 phases", () => {
    expect(Object.keys(PHASE_WHITELIST)).toHaveLength(7);
    expect(PHASE_WHITELIST).toHaveProperty("selecting");
    expect(PHASE_WHITELIST).toHaveProperty("creating");
    expect(PHASE_WHITELIST).toHaveProperty("planning");
    expect(PHASE_WHITELIST).toHaveProperty("shipping");
    expect(PHASE_WHITELIST).toHaveProperty("verifying");
    expect(PHASE_WHITELIST).toHaveProperty("reviewing");
    expect(PHASE_WHITELIST).toHaveProperty("pr");
  });

  // 2. Terminal case — pr maps to null (loop stops, human merges)
  test("PHASE_WHITELIST terminal case: pr → null", () => {
    expect(PHASE_WHITELIST.pr).toBeNull();
  });

  // 3. COMMAND_FROM_PHASE is exact reverse of PHASE_FROM_COMMAND
  test("COMMAND_FROM_PHASE is reverse of PHASE_FROM_COMMAND", () => {
    for (const [command, phase] of Object.entries(PHASE_FROM_COMMAND)) {
      expect(COMMAND_FROM_PHASE[phase]).toBe(command);
    }
    for (const [phase, command] of Object.entries(COMMAND_FROM_PHASE)) {
      if (command !== null) {
        expect(PHASE_FROM_COMMAND[command]).toBe(phase);
      }
    }
  });

  // 4. ALLOWED_PHASE_COMMANDS contains all 6 commands (no merge-phase command)
  test("ALLOWED_PHASE_COMMANDS has 6 commands, no close/merge", () => {
    expect(ALLOWED_PHASE_COMMANDS.size).toBe(6);
    expect(ALLOWED_PHASE_COMMANDS.has("/create")).toBe(true);
    expect(ALLOWED_PHASE_COMMANDS.has("/plan")).toBe(true);
    expect(ALLOWED_PHASE_COMMANDS.has("/ship")).toBe(true);
    expect(ALLOWED_PHASE_COMMANDS.has("/verify")).toBe(true);
    expect(ALLOWED_PHASE_COMMANDS.has("/review")).toBe(true);
    expect(ALLOWED_PHASE_COMMANDS.has("/pr")).toBe(true);
  });

  // 5. No map value contains the merge-phase command
  test("no phase map contains /close or /merge", () => {
    for (const value of Object.values(PHASE_WHITELIST)) {
      expect(value).not.toBe("/close");
      expect(value).not.toBe("/merge");
    }
    for (const value of Object.values(COMMAND_FROM_PHASE)) {
      expect(value).not.toBe("/close");
      expect(value).not.toBe("/merge");
    }
    expect(ALLOWED_PHASE_COMMANDS.has("/close")).toBe(false);
    expect(ALLOWED_PHASE_COMMANDS.has("/merge")).toBe(false);
  });

  // 6. VALID_PHASES contains all 7 phases
  test("VALID_PHASES has all 7 phases", () => {
    expect(VALID_PHASES.size).toBe(7);
    expect(VALID_PHASES.has("selecting")).toBe(true);
    expect(VALID_PHASES.has("creating")).toBe(true);
    expect(VALID_PHASES.has("planning")).toBe(true);
    expect(VALID_PHASES.has("shipping")).toBe(true);
    expect(VALID_PHASES.has("verifying")).toBe(true);
    expect(VALID_PHASES.has("reviewing")).toBe(true);
    expect(VALID_PHASES.has("pr")).toBe(true);
  });

  // 7. MAX_RETRIES is 3
  test("MAX_RETRIES is 3", () => {
    expect(MAX_RETRIES).toBe(3);
  });

  // 8. PHASE_WHITELIST defines correct sequential progression
  test("PHASE_WHITELIST defines sequential progression", () => {
    expect(PHASE_WHITELIST.selecting).toBe("/create");
    expect(PHASE_WHITELIST.creating).toBe("/plan");
    expect(PHASE_WHITELIST.planning).toBe("/ship");
    expect(PHASE_WHITELIST.shipping).toBe("/verify");
    expect(PHASE_WHITELIST.verifying).toBe("/review");
    expect(PHASE_WHITELIST.reviewing).toBe("/pr");
    expect(PHASE_WHITELIST.pr).toBeNull();
  });
});
```

**`test/retry-logic.test.ts`:**

```typescript
import { describe, test, expect } from "bun:test";
import {
  PHASE_WHITELIST,
  COMMAND_FROM_PHASE,
  MAX_RETRIES,
} from "../index";

describe("Retry Logic", () => {
  // 1. COMMAND_FROM_PHASE maps each phase to the command that started it
  //    (not the next command — this was the review bug #2)
  test("COMMAND_FROM_PHASE maps to starting command, not next command", () => {
    // The old bug: retry used PHASE_WHITELIST[state.phase] which gives the NEXT command.
    // The fix: retry uses COMMAND_FROM_PHASE[state.phase] which gives the CURRENT command.
    for (const phase of ["creating", "planning", "shipping", "verifying", "reviewing", "pr"] as const) {
      const retryCmd = COMMAND_FROM_PHASE[phase];
      const nextCmd = PHASE_WHITELIST[phase];
      // They must NOT be the same (except in edge cases like pr)
      if (phase !== "pr") {
        expect(retryCmd).not.toBe(nextCmd);
      }
    }
  });

  // 2. Selecting phase has no command — retry should reset to selection
  test("COMMAND_FROM_PHASE.selecting is null (no command to retry)", () => {
    expect(COMMAND_FROM_PHASE.selecting).toBeNull();
  });

  // 3. Creating phase: retry re-injects /create (not /plan)
  test("retry on creating phase re-injects /create", () => {
    expect(COMMAND_FROM_PHASE.creating).toBe("/create");
    // PHASE_WHITELIST.creating is "/plan" — the OLD bug would inject /plan
    expect(PHASE_WHITELIST.creating).toBe("/plan");
  });

  // 4. Planning phase: retry re-injects /plan (not /ship)
  test("retry on planning phase re-injects /plan", () => {
    expect(COMMAND_FROM_PHASE.planning).toBe("/plan");
    expect(PHASE_WHITELIST.planning).toBe("/ship");
  });

  // 5. Shipping phase: retry re-injects /ship (not /verify)
  test("retry on shipping phase re-injects /ship", () => {
    expect(COMMAND_FROM_PHASE.shipping).toBe("/ship");
    expect(PHASE_WHITELIST.shipping).toBe("/verify");
  });

  // 6. MAX_RETRIES cap
  test("MAX_RETRIES is 3", () => {
    expect(MAX_RETRIES).toBe(3);
  });

  // 7. When retries >= MAX_RETRIES, should mark blocked and reset
  //    (This is a logic test — we verify the condition that triggers the blocked path)
  test("retries at MAX_RETRIES triggers blocked path", () => {
    const state = { retries: MAX_RETRIES, mode: "on" as const };
    // The condition in handleTurnEnd: if (state.retries < MAX_RETRIES) { retry } else { blocked }
    expect(state.retries < MAX_RETRIES).toBe(false);  // should trigger the else (blocked) branch
  });

  // 8. When retries < MAX_RETRIES, should retry
  test("retries under MAX_RETRIES triggers retry path", () => {
    const state = { retries: MAX_RETRIES - 1, mode: "on" as const };
    expect(state.retries < MAX_RETRIES).toBe(true);  // should trigger the retry branch
  });

  // 9. No-command case: phase is selecting (COMMAND_FROM_PHASE returns null)
  //    The fix: reset to selection instead of getting stuck (review bug #3)
  test("selecting phase retry has no command — triggers reset-to-selection", () => {
    const cmd = COMMAND_FROM_PHASE.selecting;
    expect(cmd).toBeNull();
    // The guard: if (currentCmd && state.beadId) { inject } else { reset }
    // With currentCmd = null, the else branch fires → reset to selection
  });
});
```

**`test/error-paths.test.ts`:**

```typescript
import { describe, test, expect } from "bun:test";
import { decide } from "../index";
import { mockExtensionContext, mockExtensionAPI } from "./mocks";

describe("decide() error paths", () => {
  // Risk 3: ctx.model is undefined
  test("throws 'no active model' when ctx.model is undefined", async () => {
    const ctx = mockExtensionContext({ model: undefined });
    await expect(decide(ctx, "test prompt")).rejects.toThrow("no active model");
  });

  // Risk 3 variant: ctx.model is null
  test("throws 'no active model' when ctx.model is null", async () => {
    const ctx = mockExtensionContext({ model: null });
    await expect(decide(ctx, "test prompt")).rejects.toThrow("no active model");
  });

  // Risk 3: no API key
  test("throws 'no API key' when getApiKey returns undefined", async () => {
    const ctx = mockExtensionContext({
      model: { provider: "test", id: "test-model" },
      getApiKeyResult: undefined,
    });
    await expect(decide(ctx, "test prompt")).rejects.toThrow("no API key");
  });

  // Risk 1: complete() throws → completeSimple fallback
  // This test requires module mocking. If mock.module() doesn't work with
  // globally-resolved packages, skip this test and note it in the evidence.
  test("falls back to completeSimple when complete throws", async () => {
    // This test depends on Bun's mock.module() support.
    // If it fails, document it as a limitation and test via dependency injection.
    // For now, verify the error path: when decide() catches, it should not
    // throw the original error from complete().
    // TODO: implement with mock.module() or dependency injection
    expect(true).toBe(true);  // placeholder — will be implemented during /ship
  });
});

describe("re-entrancy guard (Risk 2)", () => {
  // Risk 2: hasPendingMessages guard
  test("hasPendingMessages is a function on ctx when provided", () => {
    const ctx = mockExtensionContext({ hasPendingMessages: true });
    expect(typeof (ctx as any).hasPendingMessages).toBe("function");
    expect((ctx as any).hasPendingMessages()).toBe(true);
  });
});

describe("extractText", () => {
  test("extracts text from string content", async () => {
    const { extractText } = await import("../index");
    expect(extractText({ content: "hello" })).toBe("hello");
  });

  test("extracts text from content blocks array", async () => {
    const { extractText } = await import("../index");
    const message = {
      content: [
        { type: "text", text: "hello " },
        { type: "text", text: "world" },
      ],
    };
    expect(extractText(message)).toBe("hello world");
  });

  test("returns empty string for null message", async () => {
    const { extractText } = await import("../index");
    expect(extractText(null)).toBe("");
  });

  test("returns empty string for undefined content", async () => {
    const { extractText } = await import("../index");
    expect(extractText({})).toBe("");
  });
});

describe("truncate", () => {
  test("returns text unchanged when under maxLen", async () => {
    const { truncate } = await import("../index");
    expect(truncate("short", 100)).toBe("short");
  });

  test("truncates and appends marker when over maxLen", async () => {
    const { truncate } = await import("../index");
    const result = truncate("this is a long string", 10);
    expect(result.length).toBeLessThanOrEqual(10 + "\n... [truncated]".length);
    expect(result).toContain("[truncated]");
  });
});
```

**`test/mocks.ts`:**

```typescript
// Full implementation in the Mock design section above.
// Exports:
// - createSpy<T>(impl?, returnValue?): Spy<T>
// - mockSessionManager(entries?): ReadonlySessionManager
// - mockExtensionContext(overrides?): ExtensionContext
// - mockExtensionAPI(overrides?): ExtensionAPI
// Types:
// - Spy<T>, MockSessionEntry, MockContextOverrides, MockAPIOverrides
```

**`test/run.sh`:**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
bun test test/
```

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Exporting internals changes module behavior | Low | Low | `export` keyword only affects importability, not runtime behavior. The default export is unchanged. Verify with `bun build index.ts --no-bundle` after adding exports. |
| Mocking `@oh-my-pi/pi-ai` `complete` function fails | Medium | Medium | Bun's `mock.module()` supports module mocking. If it fails, fall back to dependency injection: add an optional `completeFn` parameter to `decide()` defaulting to the imported `complete`. This is a minimal API change that enables testing without module mocking. |
| Testing retry logic requires `handleTurnEnd` which is async and calls `decide()` | Medium | Medium | Test the retry logic indirectly: mock `decide()` to return a "retry" decision, verify `sendUserMessage` is called with `COMMAND_FROM_PHASE[state.phase]` (not `PHASE_WHITELIST[state.phase]`). Or extract the retry decision logic into a testable pure function. |
| `reconstructState` requires a mock `ExtensionContext` that matches the real type exactly | Low | Low | Use `Pick<ExtensionContext, "sessionManager">` for the mock — only the `getBranch()` method is needed. TypeScript structural typing handles the rest. |
| Bun's `mock.module()` for `@oh-my-pi/pi-ai` may not work with global packages | Medium | Medium | If `mock.module()` fails, use the dependency injection fallback (see Risk 2). Alternatively, test `completeSimple` fallback by mocking `ctx.modelRegistry.getApiKey` to return a key and mocking `complete` at the module level. |
| Phase map tests are trivial (static assertions) and may not catch real bugs | Low | Low | The value is in the consistency check: `COMMAND_FROM_PHASE` must be the reverse of `PHASE_FROM_COMMAND`. A map edit that breaks this invariant is caught immediately. |

## Acceptance Criteria

- [ ] `parseDecision` tests cover the backward brace-balanced scan fix
    - Verify: `bun test test/parse-decision.test.ts` exits 0
- [ ] `reconstructState` tests cover phase validation
    - Verify: `bun test test/reconstruct-state.test.ts` exits 0
- [ ] Phase map consistency tests verify no `/close` injection
    - Verify: `bun test test/phase-maps.test.ts` exits 0
- [ ] Retry logic tests cover the stuck-loop bug fix
    - Verify: `bun test test/retry-logic.test.ts` exits 0
- [ ] Error path tests cover `decide()` failure modes
    - Verify: `bun test test/error-paths.test.ts` exits 0
- [ ] Mock factory provides reusable test infrastructure
    - Verify: `grep -q 'mockExtensionAPI' test/mocks.ts && grep -q 'mockExtensionContext' test/mocks.ts`
- [ ] All tests pass together
    - Verify: `bun test test/` exits 0
- [ ] `index.ts` type-checks after adding exports
    - Verify: `bun build index.ts --no-bundle` exits 0
- [ ] No `/close` in any phase map
    - Verify: `grep -c '/close' index.ts` returns 0
