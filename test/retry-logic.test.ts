import { beforeAll, describe, expect, test } from "bun:test";
import type * as IndexModule from "../index.ts";
import type { Phase } from "../index.ts";
import {
  importIndex,
  installPiAiMock,
  mockExtensionAPI,
  mockExtensionContext,
  type MockExtensionAPI,
} from "./mocks.ts";

let indexModule: typeof IndexModule;

const retryablePhases: Exclude<Phase, "selecting">[] = [
  "creating",
  "planning",
  "shipping",
  "verifying",
  "reviewing",
  "pr",
];

beforeAll(async () => {
  installPiAiMock();
  indexModule = await importIndex("retry-logic");
});

// ─── Constant invariants (sanity checks) ────────────────────────────────────

describe("retry logic constants", () => {
  test("retry command map points at the current phase command, not the next command", () => {
    for (const phase of retryablePhases) {
      const retryCommand = indexModule.COMMAND_FROM_PHASE[phase];
      const nextCommand = indexModule.PHASE_WHITELIST[phase];

      if (phase !== "pr") {
        expect(retryCommand).not.toBe(nextCommand);
      }
    }
  });

  test("selecting has no command to re-inject", () => {
    expect(indexModule.COMMAND_FROM_PHASE.selecting).toBeNull();
  });

  test("creating retry re-injects create instead of advancing to plan", () => {
    expect(indexModule.COMMAND_FROM_PHASE.creating).toBe("/create");
    expect(indexModule.PHASE_WHITELIST.creating).toBe("/plan");
  });

  test("planning retry re-injects plan instead of advancing to ship", () => {
    expect(indexModule.COMMAND_FROM_PHASE.planning).toBe("/plan");
    expect(indexModule.PHASE_WHITELIST.planning).toBe("/ship");
  });

  test("shipping retry re-injects ship instead of advancing to verify", () => {
    expect(indexModule.COMMAND_FROM_PHASE.shipping).toBe("/ship");
    expect(indexModule.PHASE_WHITELIST.shipping).toBe("/verify");
  });
});

// ─── Behavioral tests: exercise the actual retry branch ──────────────────────
// These tests invoke handleTurnEnd with a mocked decide() returning a retry
// decision, then assert on sendUserMessage / pi.exec / state mutations.
// They would FAIL if the retry branch used PHASE_WHITELIST instead of
// COMMAND_FROM_PHASE, or if the no-command case idled instead of resetting.

describe("retry branch behavior via handleTurnEnd", () => {
  test("re-injects COMMAND_FROM_PHASE command (not PHASE_WHITELIST) on retry", async () => {
    const retryJson = JSON.stringify({
      action: "retry",
      reasoning: "test retry",
    });

    installPiAiMock({
      complete: async () => ({
        content: [{ type: "text", text: retryJson }],
      }),
    });

    const { handleTurnEnd, getState, CONTROL_TYPE } = await importIndex(
      "retry-command-dir"
    );
    const pi = mockExtensionAPI();
    const ctx = mockExtensionContext({
      model: { provider: "test", id: "test-model" },
      getApiKeyResult: "test-api-key",
    });

    // Set state: mode on, bead claimed, in planning phase, 0 retries.
    const state = getState(ctx);
    state.mode = "on";
    state.beadId = "ultramode-test";
    state.phase = "planning";
    state.retries = 0;

    await handleTurnEnd(pi, ctx, { content: "assistant output" });

    // Retry should re-inject /plan (COMMAND_FROM_PHASE.planning),
    // NOT /ship (PHASE_WHITELIST.planning).
    const sendCalls = (pi as unknown as MockExtensionAPI).sendUserMessage.calls;
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0][0]).toBe("/plan ultramode-test");
    expect(sendCalls[0][1]).toEqual({ deliverAs: "followUp" });

    // State: retries incremented, still on, same bead.
    const after = getState(ctx);
    expect(after.retries).toBe(1);
    expect(after.mode).toBe("on");
    expect(after.beadId).toBe("ultramode-test");
    expect(after.phase).toBe("planning");
    void CONTROL_TYPE;
  });

  test("retries increment up to MAX_RETRIES via handleTurnEnd", async () => {
    const retryJson = JSON.stringify({
      action: "retry",
      reasoning: "retry increment",
    });

    installPiAiMock({
      complete: async () => ({
        content: [{ type: "text", text: retryJson }],
      }),
    });

    const { handleTurnEnd, getState, MAX_RETRIES } = await importIndex(
      "retry-increment"
    );
    const pi = mockExtensionAPI();
    const ctx = mockExtensionContext({
      model: { provider: "test", id: "test-model" },
      getApiKeyResult: "test-api-key",
    });

    const state = getState(ctx);
    state.mode = "on";
    state.beadId = "ultramode-inc";
    state.phase = "creating";
    state.retries = 0;

    // First retry: 0 → 1
    await handleTurnEnd(pi, ctx, { content: "output 1" });
    expect(getState(ctx).retries).toBe(1);

    // Second retry: 1 → 2 (still under cap)
    await handleTurnEnd(pi, ctx, { content: "output 2" });
    expect(getState(ctx).retries).toBe(2);

    // Confirm MAX_RETRIES is 3 (the blocked branch is tested separately below).
    expect(MAX_RETRIES).toBe(3);
  });

  test("at MAX_RETRIES triggers blocked branch and resets to selection", async () => {
    const retryJson = JSON.stringify({
      action: "retry",
      reasoning: "exhausted",
    });

    // Track br update calls for blocked status.
    const brCalls: string[][] = [];
    installPiAiMock({
      complete: async () => ({
        content: [{ type: "text", text: retryJson }],
      }),
    });

    const { handleTurnEnd, getState, MAX_RETRIES } = await importIndex(
      "retry-cap"
    );
    const pi = mockExtensionAPI({
      execResults: [
        // bv triage call in handleTurnEnd
        { stdout: "{}", code: 0 },
        // br update --status blocked call in markBlocked
        { stdout: "{}", code: 0 },
        // bv triage call in runSelection (reset path)
        { stdout: "{}", code: 0 },
        // br scheduler call in runSelection
        { stdout: '{"recommendations":[]}', code: 0 },
        // br list fallback in runSelection
        { stdout: "[]", code: 0 },
      ],
    });
    const ctx = mockExtensionContext({
      model: { provider: "test", id: "test-model" },
      getApiKeyResult: "test-api-key",
    });

    // Track all exec args to verify br update --status blocked fired.
    const execSpy = (pi as unknown as MockExtensionAPI).exec;
    const origImpl = execSpy;
    const trackedExec = ((...args: [string, string[]]) => {
      brCalls.push(args[1]);
      return origImpl(...args);
    }) as typeof origImpl;
    (pi as unknown as MockExtensionAPI).exec = trackedExec;

    const state = getState(ctx);
    state.mode = "on";
    state.beadId = "ultramode-blocked";
    state.phase = "planning";
    state.retries = MAX_RETRIES; // already at cap

    await handleTurnEnd(pi, ctx, { content: "final output" });

    // The blocked branch should have called br update --status blocked.
    const blockedCall = brCalls.find(
      (args) =>
        args[0] === "update" &&
        args.includes("--status") &&
        args.includes("blocked")
    );
    expect(blockedCall).toBeDefined();
    expect(blockedCall![1]).toBe("ultramode-blocked");

    // State should reset to selection.
    const after = getState(ctx);
    expect(after.beadId).toBeNull();
    expect(after.phase).toBe("selecting");
    expect(after.retries).toBe(0);
  });

  test("no-command retry case resets to selection instead of silently idling", async () => {
    const retryJson = JSON.stringify({
      action: "retry",
      reasoning: "no command",
    });

    installPiAiMock({
      complete: async () => ({
        content: [{ type: "text", text: retryJson }],
      }),
    });

    const { handleTurnEnd, getState } = await importIndex("retry-no-cmd");
    const pi = mockExtensionAPI({
      execResults: [
        // bv triage in handleTurnEnd
        { stdout: "{}", code: 0 },
        // bv triage in runSelection
        { stdout: "{}", code: 0 },
        // br scheduler in runSelection
        { stdout: '{"recommendations":[]}', code: 0 },
        // br list fallback in runSelection
        { stdout: "[]", code: 0 },
      ],
    });
    const ctx = mockExtensionContext({
      model: { provider: "test", id: "test-model" },
      getApiKeyResult: "test-api-key",
    });

    // Phase = selecting → COMMAND_FROM_PHASE.selecting is null → can't re-inject.
    const state = getState(ctx);
    state.mode = "on";
    state.beadId = "ultramode-nocmd";
    state.phase = "selecting";
    state.retries = 0;

    await handleTurnEnd(pi, ctx, { content: "output" });

    // Should NOT have sent a retry message (no command to re-inject).
    const sendCalls = (pi as unknown as MockExtensionAPI).sendUserMessage.calls;
    // The only sendUserMessage call, if any, should be from runSelection
    // (e.g. /create), not a retry of a selecting-phase command.
    const retryCall = sendCalls.find(([cmd]) =>
      cmd.startsWith("/select")
    );
    expect(retryCall).toBeUndefined();

    // State should have reset to selection (beadId cleared, retries 0).
    const after = getState(ctx);
    expect(after.beadId).toBeNull();
    expect(after.retries).toBe(0);
    expect(after.phase).toBe("selecting");
  });
});
