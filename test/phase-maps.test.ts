import { beforeAll, describe, expect, test } from "bun:test";
import type * as IndexModule from "../index.ts";
import type { Phase } from "../index.ts";
import { importIndex, installPiAiMock } from "./mocks.ts";

let indexModule: typeof IndexModule;

const phases: Phase[] = [
  "selecting",
  "brainstorming",
  "creating",
  "planning",
  "shipping",
  "verifying",
  "reviewing",
  "pr",
];

beforeAll(async () => {
  installPiAiMock();
  indexModule = await importIndex("phase-maps");
});

describe("phase maps", () => {
  test("PHASE_WHITELIST has every phase and pr is terminal", () => {
    expect(Object.keys(indexModule.PHASE_WHITELIST).sort()).toEqual([...phases].sort());
    expect(indexModule.PHASE_WHITELIST.pr).toBeNull();
  });

  test("PHASE_WHITELIST defines sequential workflow progression", () => {
    expect(indexModule.PHASE_WHITELIST).toEqual({
      selecting: "/brainstorm",
      brainstorming: "/create",
      creating: "/plan",
      planning: "/ship",
      shipping: "/verify",
      verifying: "/review",
      reviewing: "/pr",
      pr: null,
    });
  });

  test("COMMAND_FROM_PHASE is the reverse of PHASE_FROM_COMMAND", () => {
    for (const [command, phase] of Object.entries(indexModule.PHASE_FROM_COMMAND)) {
      expect(indexModule.COMMAND_FROM_PHASE[phase]).toBe(command);
    }

    for (const [phase, command] of Object.entries(indexModule.COMMAND_FROM_PHASE)) {
      if (command !== null) {
        expect(indexModule.PHASE_FROM_COMMAND[command]).toBe(phase);
      }
    }
  });
  test("allowed commands contain workflow phases only", () => {
    expect(indexModule.ALLOWED_PHASE_COMMANDS.size).toBe(7);
    for (const command of ["/brainstorm", "/create", "/plan", "/ship", "/verify", "/review", "/pr"]) {
      expect(indexModule.ALLOWED_PHASE_COMMANDS.has(command)).toBe(true);
    }
  });

  test("no phase map can inject close or merge commands", () => {
    const forbidden = ["/close", "/merge"];

    for (const value of Object.values(indexModule.PHASE_WHITELIST)) {
      expect(forbidden).not.toContain(value);
    }
    for (const value of Object.values(indexModule.COMMAND_FROM_PHASE)) {
      expect(forbidden).not.toContain(value);
    }
    for (const value of Object.keys(indexModule.PHASE_FROM_COMMAND)) {
      expect(forbidden).not.toContain(value);
    }
    for (const command of forbidden) {
      expect(indexModule.ALLOWED_PHASE_COMMANDS.has(command)).toBe(false);
    }
  });

  test("VALID_PHASES contains every phase", () => {
    expect(indexModule.VALID_PHASES.size).toBe(phases.length);
    for (const phase of phases) {
      expect(indexModule.VALID_PHASES.has(phase)).toBe(true);
    }
  });

  test("MAX_RETRIES remains capped at 3", () => {
    expect(indexModule.MAX_RETRIES).toBe(3);
  });
});
