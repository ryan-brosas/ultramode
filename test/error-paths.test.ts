import { describe, expect, test } from "bun:test";
import {
  importIndex,
  installPiAiMock,
  mockExtensionContext,
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

describe("context helpers", () => {
  test("hasPendingMessages mock is callable when provided", () => {
    const ctx = mockExtensionContext({ hasPendingMessages: true });

    expect(typeof ctx.hasPendingMessages).toBe("function");
    expect(ctx.hasPendingMessages?.()).toBe(true);
  });

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
