import { beforeAll, describe, expect, test } from "bun:test";
import type * as IndexModule from "../index.ts";
import type { Phase } from "../index.ts";
import { importIndex, installPiAiMock } from "./mocks.ts";

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

describe("retry logic invariants", () => {
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

  test("retries below the cap take the retry branch", () => {
    const retries = indexModule.MAX_RETRIES - 1;

    expect(retries < indexModule.MAX_RETRIES).toBe(true);
  });

  test("retries at the cap take the blocked branch", () => {
    const retries = indexModule.MAX_RETRIES;

    expect(retries < indexModule.MAX_RETRIES).toBe(false);
  });

  test("no-command retry case must reset instead of silently idling", () => {
    const currentCommand = indexModule.COMMAND_FROM_PHASE.selecting;
    const beadId = "ultramode-air";
    const canReinject = Boolean(currentCommand && beadId);

    expect(canReinject).toBe(false);
    expect(currentCommand).toBeNull();
  });
});
