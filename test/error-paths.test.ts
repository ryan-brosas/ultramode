import { describe, expect, test } from "bun:test";
import {
  importIndex,
  installPiAiMock,
  mockExtensionAPI,
  mockExtensionContext,
  type MockExtensionAPI,
} from "./mocks.ts";

describe("decide error paths", () => {
  test("throws no active model when ctx.model is undefined", async () => {
    installPiAiMock();
    const { decide } = await importIndex("no-model-undefined");
    const ctx = mockExtensionContext({ model: undefined });

    await expect(decide(ctx, "test prompt")).rejects.toThrow("no active model");
  });

  test("throws no active model when ctx.model is null", async () => {
    installPiAiMock();
    const { decide } = await importIndex("no-model-null");
    const ctx = mockExtensionContext({ model: null });

    await expect(decide(ctx, "test prompt")).rejects.toThrow("no active model");
  });

  test("throws no API key when getApiKey returns undefined", async () => {
    installPiAiMock();
    const { decide } = await importIndex("no-api-key");
    const ctx = mockExtensionContext({
      model: { provider: "test", id: "test-model" },
      getApiKeyResult: undefined,
    });

    await expect(decide(ctx, "test prompt")).rejects.toThrow("no API key");
  });

  test("falls back to completeSimple when complete throws", async () => {
    const completeCalls: string[] = [];
    const completeSimpleCalls: string[] = [];

    installPiAiMock({
      complete: async () => {
        completeCalls.push("complete");
        throw new Error("stream provider failed");
      },
      completeSimple: async () => {
        completeSimpleCalls.push("completeSimple");
        return {
          content: [{ type: "text", text: "fallback text" }],
        };
      },
    });

    const { decide } = await importIndex("fallback");
    const ctx = mockExtensionContext({
      model: { provider: "test", id: "test-model" },
      getApiKeyResult: "test-api-key",
    });

    const result = await decide(ctx, "test prompt");

    expect(result).toBe("fallback text");
    expect(completeCalls).toHaveLength(1);
    expect(completeSimpleCalls).toHaveLength(1);
  });
});

// ─── Risk 2: hasPendingMessages re-entrancy guard ────────────────────────────
// The guard at index.ts:804 (inside the turn_end handler) must prevent
// handleTurnEnd from running when there are pending messages. These tests
// register the ultramode() factory, capture the turn_end handler via
// mockExtensionAPI.onHandlers, and invoke it directly.

describe("hasPendingMessages re-entrancy guard", () => {
  test("turn_end handler skips handleTurnEnd when hasPendingMessages is true", async () => {
    installPiAiMock();

    const { default: ultramode, getState } = await importIndex(
      "guard-pending-true"
    );
    const pi = mockExtensionAPI({
      execResults: [{ stdout: "{}", code: 0 }],
    });
    const ctx = mockExtensionContext({
      model: { provider: "test", id: "test-model" },
      getApiKeyResult: "test-api-key",
      hasPendingMessages: true,
    });

    // Register the extension — captures turn_end handler in onHandlers.
    ultramode(pi);

    // Activate the loop so mode === "on" (guard only acts when on).
    const state = getState(ctx);
    state.mode = "on";
    state.beadId = "ultramode-guard";
    state.phase = "planning";

    // Invoke the captured turn_end handler.
    const handler = (pi as unknown as MockExtensionAPI).onHandlers.get(
      "turn_end"
    );
    expect(handler).toBeDefined();
    await handler?.({ message: { content: "should be skipped" } }, ctx);

    // handleTurnEnd should NOT have run: no bv triage exec call, no
    // sendUserMessage, no decide invocation. The exec spy should have
    // zero calls (handleTurnEnd calls pi.exec for bv triage).
    const execCalls = (pi as unknown as MockExtensionAPI).exec.calls;
    expect(execCalls).toHaveLength(0);

    // State should be unchanged — no persistState, no retries.
    const after = getState(ctx);
    expect(after.retries).toBe(0);
    expect(after.phase).toBe("planning");
  });

  test("turn_end handler proceeds to handleTurnEnd when hasPendingMessages is false", async () => {
    // Mock decide() to return a stop decision so handleTurnEnd completes
    // without side effects beyond the exec call for bv triage.
    const stopJson = JSON.stringify({
      action: "stop",
      reasoning: "test stop",
    });
    installPiAiMock({
      complete: async () => ({
        content: [{ type: "text", text: stopJson }],
      }),
    });

    const { default: ultramode, getState } = await importIndex(
      "guard-pending-false"
    );
    const pi = mockExtensionAPI({
      execResults: [{ stdout: "{}", code: 0 }],
    });
    const ctx = mockExtensionContext({
      model: { provider: "test", id: "test-model" },
      getApiKeyResult: "test-api-key",
      hasPendingMessages: false,
    });

    ultramode(pi);

    const state = getState(ctx);
    state.mode = "on";
    state.beadId = "ultramode-guard";
    state.phase = "planning";

    const handler = (pi as unknown as MockExtensionAPI).onHandlers.get(
      "turn_end"
    );
    expect(handler).toBeDefined();
    await handler?.({ message: { content: "should proceed" } }, ctx);

    // handleTurnEnd should have run: at least one exec call for bv triage.
    const execCalls = (pi as unknown as MockExtensionAPI).exec.calls;
    expect(execCalls.length).toBeGreaterThanOrEqual(1);

    // The stop decision should have idled the loop.
    const after = getState(ctx);
    expect(after.mode).toBe("idle");
  });
});

// ─── Risk 4: br scheduler returns zero recommendations → br list fallback ─────
// runSelection() must fall back to `br list` when `br scheduler` returns
// zero recommendations. This exercises the actual fallback branch.

describe("scheduler fallback to br list", () => {
  test("runSelection falls back to br list when scheduler has no recommendations", async () => {
    // Mock decide() to return a wait decision so runSelection completes
    // without side effects beyond the exec calls.
    const waitJson = JSON.stringify({
      action: "wait",
      reasoning: "no ready work",
    });
    installPiAiMock({
      complete: async () => ({
        content: [{ type: "text", text: waitJson }],
      }),
    });

    const { runSelection, getState } = await importIndex("sched-fallback");
    const pi = mockExtensionAPI({
      execResults: [
        // bv --robot-triage call
        { stdout: "{}", code: 0 },
        // br scheduler --json call (returns empty recommendations)
        { stdout: '{"recommendations":[]}', code: 0 },
        // br list fallback call (returns empty list)
        { stdout: "[]", code: 0 },
      ],
    });
    const ctx = mockExtensionContext({
      model: { provider: "test", id: "test-model" },
      getApiKeyResult: "test-api-key",
    });

    // Activate the loop so runSelection operates in mode "on".
    const state = getState(ctx);
    state.mode = "on";

    await runSelection(pi, ctx);

    // Verify the three exec calls were: bv triage, br scheduler, br list.
    const execCalls = (pi as unknown as MockExtensionAPI).exec.calls;
    expect(execCalls).toHaveLength(3);

    // Call 0: bv triage
    expect(execCalls[0][0]).toBe("bv");
    expect(execCalls[0][1]).toContain("--robot-triage");

    // Call 1: br scheduler
    expect(execCalls[1][0]).toBe("br");
    expect(execCalls[1][1][0]).toBe("scheduler");
    expect(execCalls[1][1]).toContain("--json");

    // Call 2: br list fallback
    expect(execCalls[2][0]).toBe("br");
    expect(execCalls[2][1][0]).toBe("list");
    expect(execCalls[2][1]).toContain("--status");
    expect(execCalls[2][1]).toContain("open");
    expect(execCalls[2][1]).toContain("--json");

    // The wait decision should have idled the loop.
    const after = getState(ctx);
    expect(after.mode).toBe("idle");
  });

  test("runSelection skips br list fallback when scheduler has recommendations", async () => {
    const waitJson = JSON.stringify({
      action: "wait",
      reasoning: "has work but waiting",
    });
    installPiAiMock({
      complete: async () => ({
        content: [{ type: "text", text: waitJson }],
      }),
    });

    const { runSelection, getState } = await importIndex("sched-no-fallback");
    const pi = mockExtensionAPI({
      execResults: [
        // bv --robot-triage call
        { stdout: "{}", code: 0 },
        // br scheduler --json call (returns recommendations → no fallback)
        { stdout: '{"recommendations":[{"id":"ultramode-x"}]}', code: 0 },
      ],
    });
    const ctx = mockExtensionContext({
      model: { provider: "test", id: "test-model" },
      getApiKeyResult: "test-api-key",
    });

    const state = getState(ctx);
    state.mode = "on";

    await runSelection(pi, ctx);

    // Only 2 exec calls: bv triage + br scheduler. No br list fallback.
    const execCalls = (pi as unknown as MockExtensionAPI).exec.calls;
    expect(execCalls).toHaveLength(2);

    expect(execCalls[1][0]).toBe("br");
    expect(execCalls[1][1][0]).toBe("scheduler");

    const after = getState(ctx);
    expect(after.mode).toBe("idle");
  });
});

describe("context helpers", () => {
  test("extractText reads string content", async () => {
    installPiAiMock();
    const { extractText } = await importIndex("extract-string");

    expect(extractText({ content: "hello" })).toBe("hello");
  });

  test("extractText joins text content blocks", async () => {
    installPiAiMock();
    const { extractText } = await importIndex("extract-blocks");
    const message = {
      content: [
        { type: "text", text: "hello " },
        { type: "image", data: "ignored" },
        { type: "text", text: "world" },
      ],
    };

    expect(extractText(message)).toBe("hello world");
  });

  test("extractText returns empty text for nullish or missing content", async () => {
    installPiAiMock();
    const { extractText } = await importIndex("extract-empty");

    expect(extractText(null)).toBe("");
    expect(extractText({})).toBe("");
  });

  test("truncate leaves short text unchanged", async () => {
    installPiAiMock();
    const { truncate } = await importIndex("truncate-short");

    expect(truncate("short", 100)).toBe("short");
  });

  test("truncate shortens long text and appends a marker", async () => {
    installPiAiMock();
    const { truncate } = await importIndex("truncate-long");

    const result = truncate("this is a long string", 10);

    expect(result).toContain("[truncated]");
    expect(result.startsWith("this is a ")).toBe(true);
  });
});
