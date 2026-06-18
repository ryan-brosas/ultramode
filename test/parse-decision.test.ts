import { beforeAll, describe, expect, test } from "bun:test";
import type * as IndexModule from "../index.ts";
import { importIndex, installPiAiMock } from "./mocks.ts";

let indexModule: typeof IndexModule;

beforeAll(async () => {
  installPiAiMock();
  indexModule = await importIndex("parse-decision");
});

describe("parseDecision", () => {
  test("parses simple JSON with a valid action", () => {
    const text = `{"action":"proceed","reasoning":"done","nextCommand":"/plan test-1"}`;

    const result = indexModule.parseDecision(text, ["proceed", "stop"]);

    expect(result).not.toBeNull();
    expect(result?.action).toBe("proceed");
    expect(result).toMatchObject({ reasoning: "done", nextCommand: "/plan test-1" });
  });

  test("extracts the last balanced JSON object when prose contains braces", () => {
    const text = `Transitioning from {creating} to {planning}.\n{"action":"proceed","reasoning":"plan exists"}`;

    const result = indexModule.parseDecision(text, ["proceed", "stop"]);

    expect(result).not.toBeNull();
    expect(result?.action).toBe("proceed");
    expect(result).toMatchObject({ reasoning: "plan exists" });
  });

  test("extracts the last JSON object when multiple objects are present", () => {
    const text = `{"action":"wait","reasoning":"old"}\n{"action":"proceed","reasoning":"changed mind"}`;

    const result = indexModule.parseDecision(text, ["proceed", "wait"]);

    expect(result).not.toBeNull();
    expect(result?.action).toBe("proceed");
    expect(result).toMatchObject({ reasoning: "changed mind" });
  });

  test("parses nested JSON objects", () => {
    const text = `{"action":"proceed","data":{"nested":true,"deep":{"value":42}}}`;

    const result = indexModule.parseDecision<{
      action: string;
      data: { nested: boolean; deep: { value: number } };
    }>(text, ["proceed"]);

    expect(result).not.toBeNull();
    expect(result?.data.nested).toBe(true);
    expect(result?.data.deep.value).toBe(42);
  });

  test("returns null for an action outside the allowed list", () => {
    const result = indexModule.parseDecision(`{"action":"unknown"}`, [
      "proceed",
      "stop",
    ]);

    expect(result).toBeNull();
  });

  test("returns null for text without JSON", () => {
    const result = indexModule.parseDecision("No decision here", ["proceed"]);

    expect(result).toBeNull();
  });

  test("returns null for empty text", () => {
    const result = indexModule.parseDecision("", ["proceed"]);

    expect(result).toBeNull();
  });

  test("returns null for unbalanced braces", () => {
    const result = indexModule.parseDecision(`{action":"proceed"}`, ["proceed"]);

    expect(result).toBeNull();
  });

  test("extracts JSON even when trailing text follows", () => {
    const result = indexModule.parseDecision(`{"action":"proceed"} trailing explanation`, [
      "proceed",
    ]);

    expect(result).not.toBeNull();
    expect(result?.action).toBe("proceed");
  });

  test("returns null for braces without an action", () => {
    const result = indexModule.parseDecision<{ action: string }>(`{}`, ["proceed"]);

    expect(result).toBeNull();
  });

  test("parses selection decision shape", () => {
    const text = `{"action":"select","beadId":"ultramode-xyz","reasoning":"high priority","createDescription":null}`;

    const result = indexModule.parseDecision<{
      action: string;
      beadId: string | null;
      createDescription: string | null;
    }>(text, ["select", "wait", "create"]);

    expect(result).not.toBeNull();
    expect(result?.action).toBe("select");
    expect(result?.beadId).toBe("ultramode-xyz");
    expect(result?.createDescription).toBeNull();
  });
});
