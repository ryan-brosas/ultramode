import { beforeAll, describe, expect, test } from "bun:test";
import type * as IndexModule from "../index.ts";
import {
  importIndex,
  installPiAiMock,
  mockExtensionContext,
  type MockSessionEntry,
} from "./mocks.ts";

let indexModule: typeof IndexModule;

beforeAll(async () => {
  installPiAiMock();
  indexModule = await importIndex("reconstruct-state");
});

function controlEntry(data: unknown): MockSessionEntry {
  return { type: "custom", customType: indexModule.CONTROL_TYPE, data };
}

describe("reconstructState", () => {
  test("reconstructs a valid persisted state", () => {
    const ctx = mockExtensionContext({
      sessionEntries: [
        controlEntry({
          mode: "on",
          beadId: "ultramode-xyz",
          phase: "planning",
          retries: 2,
          lastDecision: "proceed with plan",
          worktreePath: null,
        }),
      ],
    });

    const state = indexModule.reconstructState(ctx);

    expect(state).toMatchObject({
      mode: "on",
      beadId: "ultramode-xyz",
      phase: "planning",
      retries: 2,
      lastDecision: "proceed with plan",
      worktreePath: null,
    });
  });

  test("falls back to selecting when the persisted phase is invalid", () => {
    const ctx = mockExtensionContext({
      sessionEntries: [
        controlEntry({ mode: "on", beadId: "test-1", phase: "shipp", retries: 0 }),
      ],
    });

    const state = indexModule.reconstructState(ctx);

    expect(state.phase).toBe("selecting");
  });

  test("skips entries with non-object data", () => {
    const ctx = mockExtensionContext({ sessionEntries: [controlEntry("not an object")] });

    const state = indexModule.reconstructState(ctx);

    expect(state).toEqual(indexModule.createState());
  });

  test("applies defaults for missing nullable and numeric fields", () => {
    const ctx = mockExtensionContext({ sessionEntries: [controlEntry({ mode: "on" })] });

    const state = indexModule.reconstructState(ctx);

    expect(state).toMatchObject({
      mode: "on",
      beadId: null,
      phase: "selecting",
      retries: 0,
      lastDecision: null,
      worktreePath: null,
    });
  });

  test("skips entries with invalid mode", () => {
    const ctx = mockExtensionContext({
      sessionEntries: [controlEntry({ mode: "running", beadId: "x" })],
    });

    const state = indexModule.reconstructState(ctx);

    expect(state).toEqual(indexModule.createState());
  });

  test("returns default state when no control entries exist", () => {
    const ctx = mockExtensionContext({ sessionEntries: [] });

    const state = indexModule.reconstructState(ctx);

    expect(state).toEqual(indexModule.createState());
  });

  test("uses the last valid control entry", () => {
    const ctx = mockExtensionContext({
      sessionEntries: [
        controlEntry({ mode: "on", beadId: "first", phase: "creating", retries: 0 }),
        controlEntry({ mode: "on", beadId: "second", phase: "planning", retries: 1 }),
      ],
    });

    const state = indexModule.reconstructState(ctx);

    expect(state.beadId).toBe("second");
    expect(state.phase).toBe("planning");
    expect(state.retries).toBe(1);
  });

  test("skips non-custom and wrong-customType entries", () => {
    const ctx = mockExtensionContext({
      sessionEntries: [
        { type: "user_message", data: { text: "hello" } },
        { type: "custom", customType: "other-extension", data: { mode: "on" } },
        controlEntry({ mode: "on", beadId: "real", phase: "creating", retries: 0 }),
      ],
    });

    const state = indexModule.reconstructState(ctx);

    expect(state.beadId).toBe("real");
    expect(state.phase).toBe("creating");
  });
});
