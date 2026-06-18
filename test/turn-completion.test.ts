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
  indexModule = await importIndex("turn-completion");
});

// ─── isAgentTurnComplete ────────────────────────────────────────────────────
// OMP fires turn_end after EVERY LLM call, including intermediate turns where
// the assistant emitted toolCall blocks and will continue working. The decision
// loop must only fire when the agent is done — no toolCall blocks in the message.

describe("isAgentTurnComplete", () => {
  test("returns false when content has toolCall blocks", () => {
    const message = {
      role: "assistant",
      content: [
        { type: "text", text: "Let me read that file." },
        { type: "toolCall", id: "1", name: "read", arguments: { path: "foo.ts" } },
      ],
    };
    expect(indexModule.isAgentTurnComplete(message)).toBe(false);
  });

  test("returns true when content is text-only", () => {
    const message = {
      role: "assistant",
      content: [{ type: "text", text: "Done implementing the feature." }],
    };
    expect(indexModule.isAgentTurnComplete(message)).toBe(true);
  });

  test("returns true when content includes thinking but no toolCall", () => {
    const message = {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "analyzing the approach..." },
        { type: "text", text: "The PRD is complete." },
      ],
    };
    expect(indexModule.isAgentTurnComplete(message)).toBe(true);
  });

  test("returns true for plain string content", () => {
    const message = { role: "assistant", content: "simple text response" };
    expect(indexModule.isAgentTurnComplete(message)).toBe(true);
  });

  test("returns false when content has only toolCall (no text)", () => {
    const message = {
      role: "assistant",
      content: [
        { type: "toolCall", id: "1", name: "edit", arguments: { path: "a.ts" } },
      ],
    };
    expect(indexModule.isAgentTurnComplete(message)).toBe(false);
  });

  test("returns false for null/undefined/non-object", () => {
    expect(indexModule.isAgentTurnComplete(null)).toBe(false);
    expect(indexModule.isAgentTurnComplete(undefined)).toBe(false);
    expect(indexModule.isAgentTurnComplete("string")).toBe(false);
  });
});

// ─── handleTurnEnd skips intermediate turns ──────────────────────────────────
// When the agent is mid-work (toolCall blocks present), handleTurnEnd must NOT
// gather evidence, call the LLM, or inject commands. This is the fix for the
// server-burn / terminal-freeze bug.

describe("handleTurnEnd skips intermediate tool-calling turns", () => {
  test("does not call LLM or exec when message has toolCall blocks", async () => {
    // Track whether complete() was called
    let completeCallCount = 0;
    installPiAiMock({
      complete: async () => {
        completeCallCount++;
        return { content: [{ type: "text", text: '{"action":"proceed","reasoning":"ok","nextCommand":"/plan"}' }] };
      },
    });

    const { handleTurnEnd, getState } = await importIndex(
      "turn-completion-intermediate"
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
    state.phase = "creating";
    state.retries = 0;

    // Message with toolCall — agent is still working
    await handleTurnEnd(pi, ctx, {
      role: "assistant",
      content: [
        { type: "text", text: "Reading the file..." },
        { type: "toolCall", id: "1", name: "read", arguments: { path: "index.ts" } },
      ],
    });

    // No LLM call should have happened
    expect(completeCallCount).toBe(0);
    // No commands injected
    const sendCalls = (pi as unknown as MockExtensionAPI).sendUserMessage.calls;
    expect(sendCalls).toHaveLength(0);
  });

  test("does call LLM when message is text-only (turn complete)", async () => {
    let completeCallCount = 0;
    installPiAiMock({
      complete: async () => {
        completeCallCount++;
        return { content: [{ type: "text", text: '{"action":"proceed","reasoning":"ok","nextCommand":"/plan"}' }] };
      },
    });

    const { handleTurnEnd, getState } = await importIndex(
      "turn-completion-final"
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
    state.phase = "creating";
    state.retries = 0;

    // Text-only message — agent is done
    await handleTurnEnd(pi, ctx, {
      role: "assistant",
      content: [{ type: "text", text: "PRD is complete." }],
    });

    // LLM was called
    expect(completeCallCount).toBe(1);
  });
});
