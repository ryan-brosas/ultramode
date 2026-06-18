import { beforeAll, describe, expect, test } from "bun:test";
import type * as IndexModule from "../index.ts";
import {
  importIndex,
  installPiAiMock,
  mockExtensionAPI,
  mockExtensionContext,
  type MockExtensionAPI,
} from "./mocks.ts";

let indexModule: typeof IndexModule;

beforeAll(async () => {
  installPiAiMock();
  indexModule = await importIndex("injection-mode");
});

// ─── Injection mode: steer vs followUp ──────────────────────────────────────
// runSelection runs from command-handler/session_start paths, which can still
// be inside an active AgentSession prompt. It must queue as steer: direct prompt
// throws AgentBusyError while followUp-only may not auto-drain without an
// assistant/tool tail. handleTurnEnd runs after assistant output, so followUp
// is safe there.

describe("injectCommand delivery mode", () => {
  test("runSelection uses steer for select decision", async () => {
    const selectJson = JSON.stringify({
      action: "select",
      beadId: "ultramode-test",
      reasoning: "ready to work",
    });
    installPiAiMock({
      complete: async () => ({
        content: [{ type: "text", text: selectJson }],
      }),
    });

    // Re-import to pick up the new mock
    const { runSelection, getState } = await importIndex(
      "injection-select-direct"
    );
    const pi = mockExtensionAPI({
      execResults: [
        // bv --robot-triage
        { stdout: "{}", code: 0 },
        // br scheduler
        { stdout: '{"recommendations":[]}', code: 0 },
        // br list fallback
        { stdout: "[]", code: 0 },
        // br update --claim
        { stdout: "{}", code: 0 },
        // br show (createWorktree)
        { stdout: '{"id":"ultramode-test","title":"test"}', code: 0 },
      ],
    });
    const ctx = mockExtensionContext({
      model: { provider: "test", id: "test-model" },
      getApiKeyResult: "test-api-key",
    });

    const state = getState(ctx);
    state.mode = "on";

    await runSelection(pi, ctx);

    const sendCalls = (pi as unknown as MockExtensionAPI).sendUserMessage.calls;
    expect(sendCalls.length).toBeGreaterThanOrEqual(1);

    const createCall = sendCalls.find(([cmd]) =>
      cmd.includes("You are formalizing work into a tracked br bead")
    );
    expect(createCall).toBeDefined();
    expect(createCall![0]).not.toStartWith("/create");
    expect(createCall![0]).toContain("ultramode-test");
    // Selection path runs while the command prompt may still be processing, so
    // queue the expanded command body as steer instead of direct prompt.
    expect(createCall![1]).toEqual({ deliverAs: "steer" });
  });

  test("runSelection uses steer for brainstorm decision", async () => {
    const brainstormJson = JSON.stringify({
      action: "brainstorm",
      createDescription: "improve CI workflow",
      reasoning: "no ready beads, brainstorm",
    });
    installPiAiMock({
      complete: async () => ({
        content: [{ type: "text", text: brainstormJson }],
      }),
    });

    const { runSelection, getState } = await importIndex(
      "injection-brainstorm-direct"
    );
    const pi = mockExtensionAPI({
      execResults: [
        { stdout: "{}", code: 0 },
        { stdout: '{"recommendations":[]}', code: 0 },
        { stdout: "[]", code: 0 },
      ],
    });
    const ctx = mockExtensionContext({
      model: { provider: "test", id: "test-model" },
      getApiKeyResult: "test-api-key",
    });

    const state = getState(ctx);
    state.mode = "on";

    await runSelection(pi, ctx);

    const sendCalls = (pi as unknown as MockExtensionAPI).sendUserMessage.calls;
    const brainstormCall = sendCalls.find(([cmd]) =>
      cmd.includes("You are brainstorming work")
    );
    expect(brainstormCall).toBeDefined();
    expect(brainstormCall![0]).not.toStartWith("/brainstorm");
    expect(brainstormCall![0]).toContain("improve CI workflow");
    expect(brainstormCall![1]).toEqual({ deliverAs: "steer" });
  });

  test("runSelection uses steer for description fast-path", async () => {
    const { runSelection, getState } = await importIndex(
      "injection-description-direct"
    );
    const pi = mockExtensionAPI({});
    const ctx = mockExtensionContext({
      model: { provider: "test", id: "test-model" },
      getApiKeyResult: "test-api-key",
    });

    const state = getState(ctx);
    state.mode = "on";

    await runSelection(pi, ctx, "fix the bug in auth module");

    const sendCalls = (pi as unknown as MockExtensionAPI).sendUserMessage.calls;
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0][0]).toContain("You are formalizing work into a tracked br bead");
    expect(sendCalls[0][0]).toContain("fix the bug in auth module");
    expect(sendCalls[0][0]).not.toStartWith("/create");
    // Steer queues safely if the slash-command turn is still processing.
    expect(sendCalls[0][1]).toEqual({ deliverAs: "steer" });
  });

  test("handleTurnEnd uses followUp for proceed decision", async () => {
    const proceedJson = JSON.stringify({
      action: "proceed",
      nextCommand: "/plan",
      reasoning: "create phase complete",
    });
    installPiAiMock({
      complete: async () => ({
        content: [{ type: "text", text: proceedJson }],
      }),
    });

    const { handleTurnEnd, getState } = await importIndex(
      "injection-proceed-followup"
    );
    const pi = mockExtensionAPI({
      execResults: [
        // bv triage in handleTurnEnd
        { stdout: "{}", code: 0 },
      ],
    });
    const ctx = mockExtensionContext({
      model: { provider: "test", id: "test-model" },
      getApiKeyResult: "test-api-key",
    });

    const state = getState(ctx);
    state.mode = "on";
    state.beadId = "ultramode-test";
    state.phase = "creating";
    state.retries = 0;

    await handleTurnEnd(pi, ctx, { content: "assistant output" });

    const sendCalls = (pi as unknown as MockExtensionAPI).sendUserMessage.calls;
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0][0]).toContain("You are planning implementation for bead $BEAD_ID");
    expect(sendCalls[0][0]).toContain('br show "ultramode-test" --json');
    expect(sendCalls[0][0]).not.toStartWith("/plan");
    // followUp: second argument has deliverAs: "followUp"
    expect(sendCalls[0][1]).toEqual({ deliverAs: "followUp" });
  });

  test("handleTurnEnd uses followUp for retry decision", async () => {
    const retryJson = JSON.stringify({
      action: "retry",
      reasoning: "fix and retry",
    });
    installPiAiMock({
      complete: async () => ({
        content: [{ type: "text", text: retryJson }],
      }),
    });

    const { handleTurnEnd, getState } = await importIndex(
      "injection-retry-followup"
    );
    const pi = mockExtensionAPI({
      execResults: [{ stdout: "{}", code: 0 }],
    });
    const ctx = mockExtensionContext({
      model: { provider: "test", id: "test-model" },
      getApiKeyResult: "test-api-key",
    });

    const state = getState(ctx);
    state.mode = "on";
    state.beadId = "ultramode-test";
    state.phase = "planning";
    state.retries = 0;

    await handleTurnEnd(pi, ctx, { content: "assistant output" });

    const sendCalls = (pi as unknown as MockExtensionAPI).sendUserMessage.calls;
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0][0]).toContain('br show "ultramode-test" --json');
    expect(sendCalls[0][0]).toContain("Feedback from previous attempt: fix and retry");
    expect(sendCalls[0][1]).toEqual({ deliverAs: "followUp" });
  });
});
