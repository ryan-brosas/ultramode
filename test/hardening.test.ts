import { describe, expect, test } from "bun:test";
import type * as IndexModule from "../index.ts";
import type { Phase } from "../index.ts";
import {
  importIndex,
  installPiAiMock,
  mockExtensionAPI,
  mockExtensionContext,
  type MockExtensionAPI,
} from "./mocks.ts";

// ─── Deliverable 1: Phase-gated evidence gathering ─────────────────────────
// gatherVerificationEvidence() must skip bun test / bun build / git diff for
// brainstorming/creating/planning phases. Only shipping→verifying transitions
// produce real code that needs checking. shouldRunHeavyChecks() is the helper.

describe("phase-gated evidence gathering", () => {
  test("shouldRunHeavyChecks returns false for brainstorming, creating, planning", async () => {
    const { shouldRunHeavyChecks } = await importIndex("heavy-checks-false");
    const lightPhases: Phase[] = ["brainstorming", "creating", "planning"];
    for (const phase of lightPhases) {
      expect(shouldRunHeavyChecks(phase)).toBe(false);
    }
  });

  test("shouldRunHeavyChecks returns true for shipping and verifying", async () => {
    const { shouldRunHeavyChecks } = await importIndex("heavy-checks-true");
    expect(shouldRunHeavyChecks("shipping")).toBe(true);
    expect(shouldRunHeavyChecks("verifying")).toBe(true);
  });

  test("handleTurnEnd with planning phase does not spawn bun test or bun build", async () => {
    // During planning, gatherVerificationEvidence must skip bun test / bun build.
    // We verify by checking the exec spy for "bun" calls.
    const stopJson = JSON.stringify({ action: "stop", reasoning: "test" });
    installPiAiMock({
      complete: async () => ({
        content: [{ type: "text", text: stopJson }],
      }),
    });

    const { handleTurnEnd, getState } = await importIndex("no-bun-in-planning");
    const pi = mockExtensionAPI({
      execResults: [{ stdout: "{}", code: 0 }], // bv triage only
    });
    const ctx = mockExtensionContext({
      model: { provider: "test", id: "test-model" },
      getApiKeyResult: "test-api-key",
    });

    const state = getState(ctx);
    state.mode = "on";
    state.beadId = "ultramode-test";
    state.phase = "planning";

    await handleTurnEnd(pi, ctx, { content: "assistant output" });

    const execCalls = (pi as unknown as MockExtensionAPI).exec.calls;
    // bv triage runs (1 call), but bun test and bun build must NOT run.
    const bunCalls = execCalls.filter(([cmd]) => cmd === "bun");
    expect(bunCalls).toHaveLength(0);
    // git diff should also be skipped in planning phase.
    const gitDiffCalls = execCalls.filter(
      ([cmd, args]) =>
        cmd === "git" && args[0] === "diff"
    );
    expect(gitDiffCalls).toHaveLength(0);
  });

  test("handleTurnEnd with shipping phase spawns bun test and bun build", async () => {
    // During shipping, heavy checks should run.
    const stopJson = JSON.stringify({ action: "stop", reasoning: "test" });
    installPiAiMock({
      complete: async () => ({
        content: [{ type: "text", text: stopJson }],
      }),
    });

    const { handleTurnEnd, getState } = await importIndex("bun-in-shipping");
    const pi = mockExtensionAPI({
      execResults: [
        { stdout: "", code: 0 }, // git diff --stat
        { stdout: "", code: 0 }, // git status --short
        { stdout: "", code: 0 }, // bun test
        { stdout: "", code: 0 }, // bun build
        { stdout: "{}", code: 0 }, // bv triage
      ],
    });
    const ctx = mockExtensionContext({
      model: { provider: "test", id: "test-model" },
      getApiKeyResult: "test-api-key",
    });

    const state = getState(ctx);
    state.mode = "on";
    state.beadId = "ultramode-test";
    state.phase = "shipping";

    await handleTurnEnd(pi, ctx, { content: "assistant output" });

    const execCalls = (pi as unknown as MockExtensionAPI).exec.calls;
    const bunCalls = execCalls.filter(([cmd]) => cmd === "bun");
    expect(bunCalls.length).toBeGreaterThanOrEqual(2); // bun test + bun build
  });
});

// ─── Deliverable 2: Rate-limited decision calls ────────────────────────────
// decide() calls are rate-limited to once per DECISION_COOLDOWN_MS (60s).
// If handleTurnEnd fires within the cooldown window, it skips.

describe("rate-limited decision calls", () => {
  test("handleTurnEnd skips when lastDecisionTime is within cooldown window", async () => {
    const stopJson = JSON.stringify({ action: "stop", reasoning: "test" });
    installPiAiMock({
      complete: async () => ({
        content: [{ type: "text", text: stopJson }],
      }),
    });

    const { handleTurnEnd, getState, DECISION_COOLDOWN_MS } = await importIndex(
      "cooldown-skip"
    );
    expect(DECISION_COOLDOWN_MS).toBe(60_000);

    const pi = mockExtensionAPI();
    const ctx = mockExtensionContext({
      model: { provider: "test", id: "test-model" },
      getApiKeyResult: "test-api-key",
    });

    const state = getState(ctx);
    state.mode = "on";
    state.beadId = "ultramode-test";
    state.phase = "planning";
    // Set lastDecisionTime to now — within the cooldown window.
    state.lastDecisionTime = Date.now();

    await handleTurnEnd(pi, ctx, { content: "assistant output" });

    // handleTurnEnd should have skipped — no exec calls, no sendUserMessage.
    const execCalls = (pi as unknown as MockExtensionAPI).exec.calls;
    expect(execCalls).toHaveLength(0);
    const sendCalls = (pi as unknown as MockExtensionAPI).sendUserMessage.calls;
    expect(sendCalls).toHaveLength(0);
    // State should be unchanged.
    const after = getState(ctx);
    expect(after.phase).toBe("planning");
    expect(after.retries).toBe(0);
  });

  test("handleTurnEnd proceeds when lastDecisionTime is outside cooldown", async () => {
    const stopJson = JSON.stringify({ action: "stop", reasoning: "test" });
    installPiAiMock({
      complete: async () => ({
        content: [{ type: "text", text: stopJson }],
      }),
    });

    const { handleTurnEnd, getState } = await importIndex("cooldown-proceed");
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
    // Set lastDecisionTime to 2 minutes ago — outside the 60s cooldown.
    state.lastDecisionTime = Date.now() - 120_000;

    await handleTurnEnd(pi, ctx, { content: "assistant output" });

    // handleTurnEnd should have run — bv triage exec call present.
    const execCalls = (pi as unknown as MockExtensionAPI).exec.calls;
    expect(execCalls.length).toBeGreaterThanOrEqual(1);
  });

  test("handleTurnEnd proceeds when lastDecisionTime is null", async () => {
    const stopJson = JSON.stringify({ action: "stop", reasoning: "test" });
    installPiAiMock({
      complete: async () => ({
        content: [{ type: "text", text: stopJson }],
      }),
    });

    const { handleTurnEnd, getState } = await importIndex("cooldown-null");
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
    state.lastDecisionTime = null;

    await handleTurnEnd(pi, ctx, { content: "assistant output" });

    const execCalls = (pi as unknown as MockExtensionAPI).exec.calls;
    expect(execCalls.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Deliverable 4: persistState surfaces failures ─────────────────────────
// persistState() must call ui.notify("warning") when appendEntry throws.

describe("persistState error surfacing", () => {
  test("persistState calls ui.notify when appendEntry throws", async () => {
    // persistState is not exported, but it's called internally by
    // handleTurnEnd. We test indirectly: make appendEntry throw, call
    // handleTurnEnd with a stop decision, and verify ui.notify was called
    // with a persistence warning.

    const stopJson = JSON.stringify({ action: "stop", reasoning: "test" });
    installPiAiMock({
      complete: async () => ({
        content: [{ type: "text", text: stopJson }],
      }),
    });

    const { handleTurnEnd, getState, CONTROL_TYPE, createState } =
      await importIndex("persist-notify-handler");
    const pi = mockExtensionAPI({
      execResults: [{ stdout: "{}", code: 0 }],
    });
    // Make appendEntry throw to simulate journal write failure.
    (pi as unknown as MockExtensionAPI).appendEntry = (
      (() => {
        throw new Error("journal disk full");
      }) as unknown as MockExtensionAPI["appendEntry"]
    );

    const ctx = mockExtensionContext({
      model: { provider: "test", id: "test-model" },
      getApiKeyResult: "test-api-key",
    });

    const state = getState(ctx);
    state.mode = "on";
    state.beadId = "ultramode-test";
    state.phase = "planning";

    await handleTurnEnd(pi, ctx, { content: "assistant output" });

    // ui.notify should have been called with a persistence warning.
    const notifyCalls = (
      ctx as unknown as {
        ui: { notify: { calls: [string, string][] } };
      }
    ).ui.notify.calls;
    const persistWarning = notifyCalls.find(([msg]) =>
      msg.includes("state persistence failed")
    );
    expect(persistWarning).toBeDefined();
    expect(persistWarning![1]).toBe("warning");
    expect(persistWarning![0]).toContain("journal disk full");

    // Verify CONTROL_TYPE and createState are exported for completeness.
    expect(CONTROL_TYPE).toBe("ultramode-control");
    expect(createState().mode).toBe("off");
  });
});
