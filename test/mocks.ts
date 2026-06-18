import { mock } from "bun:test";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@oh-my-pi/pi-coding-agent";
import type * as IndexModule from "../index.ts";

type MaybePromise<T> = T | Promise<T>;

export interface Spy<Args extends readonly unknown[] = readonly unknown[], Return = unknown> {
  (...args: Args): Return;
  calls: Args[];
}

export function createSpy<Args extends readonly unknown[], Return>(
  impl: (...args: Args) => Return
): Spy<Args, Return> {
  const fn = ((...args: Args): Return => {
    fn.calls.push(args);
    return impl(...args);
  }) as Spy<Args, Return>;
  fn.calls = [];
  return fn;
}

export interface MockSessionEntry {
  type: string;
  customType?: string;
  data?: unknown;
}

export function mockSessionManager(entries: MockSessionEntry[] = []) {
  return {
    getBranch: createSpy<[], MockSessionEntry[]>(() => entries),
    getSessionId: createSpy<[], string>(() => "test-session-id"),
  };
}

export interface MockContextOverrides {
  model?: unknown;
  getApiKeyResult?: string | undefined;
  sessionEntries?: MockSessionEntry[];
  cwd?: string;
  hasPendingMessages?: boolean;
}

export function mockExtensionContext(
  overrides: MockContextOverrides = {}
): ExtensionContext {
  const model = Object.hasOwn(overrides, "model")
    ? overrides.model
    : { provider: "test", id: "test-model" };
  const apiKeyResult = Object.hasOwn(overrides, "getApiKeyResult")
    ? overrides.getApiKeyResult
    : "test-api-key";
  const ctx = {
    model,
    modelRegistry: {
      getApiKey: createSpy<[unknown, unknown], Promise<string | undefined>>(
        async () => apiKeyResult
      ),
    },
    sessionManager: mockSessionManager(overrides.sessionEntries),
    ui: {
      notify: createSpy<[string, string], void>(() => undefined),
      setWidget: createSpy<[string, string[]], void>(() => undefined),
      setStatus: createSpy<[string, string], void>(() => undefined),
    },
    cwd: overrides.cwd ?? "/test/cwd",
    ...(Object.hasOwn(overrides, "hasPendingMessages")
      ? {
          hasPendingMessages: createSpy<[], boolean>(
            () => overrides.hasPendingMessages === true
          ),
        }
      : {}),
  };
  // Test boundary: the mock implements only members used by exported functions.
  return ctx as unknown as ExtensionContext;
}

export interface MockAPIOverrides {
  execResult?: { stdout: string; code: number };
  execResults?: Array<{ stdout: string; code: number }>;
}

export interface MockExtensionAPI {
  exec: Spy<[string, string[]], Promise<{ stdout: string; code: number }>>;
  sendUserMessage: Spy<[string, { deliverAs?: "steer" | "followUp" }?], void>;
  appendEntry: Spy<[string, unknown], void>;
  registerCommand: Spy<
    [
      string,
      { handler: (args: string, ctx: ExtensionCommandContext) => MaybePromise<void> }
    ],
    void
  >;
  on: Spy<[string, (...args: readonly unknown[]) => MaybePromise<unknown>], void>;
  onHandlers: Map<string, (...args: readonly unknown[]) => MaybePromise<unknown>>;
}

export function mockExtensionAPI(overrides: MockAPIOverrides = {}): MockExtensionAPI {
  let execCallIndex = 0;
  const onHandlers = new Map<string, (...args: readonly unknown[]) => MaybePromise<unknown>>();
  const api: MockExtensionAPI = {
    exec: createSpy<[string, string[]], Promise<{ stdout: string; code: number }>>(
      async (_cmd: string, args: string[]) => {
        void args;
        if (overrides.execResults && overrides.execResults.length > 0) {
          const result = overrides.execResults[
            Math.min(execCallIndex, overrides.execResults.length - 1)
          ];
          execCallIndex += 1;
          return result;
        }
        return overrides.execResult ?? { stdout: "{}", code: 0 };
      }
    ),
    sendUserMessage: createSpy<[string, { deliverAs?: "steer" | "followUp" }?], void>(
      () => undefined
    ),
    appendEntry: createSpy<[string, unknown], void>(() => undefined),
    registerCommand: createSpy<
      [
        string,
        { handler: (args: string, ctx: ExtensionCommandContext) => MaybePromise<void> }
      ],
      void
    >(() => undefined),
    on: createSpy<[string, (...args: readonly unknown[]) => MaybePromise<unknown>], void>(
      (event: string, handler: (...args: readonly unknown[]) => MaybePromise<unknown>) => {
        onHandlers.set(event, handler);
      }
    ),
    onHandlers,
  };
  // Test boundary: the mock implements only members used by the extension tests.
  return api as unknown as MockExtensionAPI;
}

interface PiAiMockOverrides {
  complete?: () => MaybePromise<unknown>;
  completeSimple?: () => MaybePromise<unknown>;
}

export function installPiAiMock(overrides: PiAiMockOverrides = {}): void {
  mock.module("@oh-my-pi/pi-ai", () => ({
    complete:
      overrides.complete ??
      (async () => ({ content: [{ type: "text", text: "default complete" }] })),
    completeSimple:
      overrides.completeSimple ??
      (async () => ({ content: [{ type: "text", text: "default simple" }] })),
  }));
}

export async function importIndex(label: string): Promise<typeof IndexModule> {
  // Test exception: cache-busted dynamic import is required so Bun applies the module mock before index.ts loads.
  return await import(`../index.ts?${label}-${Date.now()}`);
}
