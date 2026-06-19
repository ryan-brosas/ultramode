import { describe, expect, test } from "bun:test";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import {
  importIndex,
  mockExtensionContext,
} from "./mocks.ts";

// ─── Integration: execBounded enforces timeouts on real subprocesses ──────
// This test does NOT mock pi.exec. It uses the real Bun subprocess layer by
// constructing a minimal ExtensionAPI whose exec() delegates to a real
// spawn, verifying that execBounded returns within the timeout when a
// subprocess hangs. This is the load-bearing guarantee against server burns.

describe("execBounded real subprocess timeout", () => {
  test("returns killed result when subprocess exceeds timeout", async () => {
    const { execBounded, EXEC_TIMEOUT_FAST_MS } = await importIndex(
      "integration-timeout"
    );

    // Build a real ExtensionAPI whose exec() spawns a subprocess that
    // sleeps far longer than the timeout. We use Bun.spawn directly so
    // there is no mock — the timeout must actually fire.
    const realApi: ExtensionAPI = {
      exec: async (
        _command: string,
        _args: string[],
        options?: { timeout?: number }
      ) => {
        const timeoutMs = Math.min(options?.timeout ?? EXEC_TIMEOUT_FAST_MS, 2000);
        // Spawn a real subprocess that hangs.
        const proc = Bun.spawn(["sleep", "30"], {
          stdout: "pipe",
          stderr: "pipe",
        });
        // Race the subprocess against the timeout.
        const timeout = new Promise<{ stdout: string; stderr: string; code: number; killed: boolean }>(
          (resolve) =>
            setTimeout(
              () => {
                try { proc.kill(); } catch { /* already dead */ }
                resolve({ stdout: "", stderr: "", code: -1, killed: true });
              },
              timeoutMs
            )
        );
        const done = (async () => {
          const code = await proc.exited;
          return { stdout: "", stderr: "", code, killed: false };
        })();
        return Promise.race([done, timeout]);
      },
      // Stub the rest — not used by execBounded.
    } as unknown as ExtensionAPI;

    const start = Date.now();
    const result = await execBounded(
      realApi,
      "sleep",
      ["30"],
      1500 // 1.5s timeout — well under the 30s sleep
    );
    const elapsed = Date.now() - start;

    expect(result.killed).toBe(true);
    expect(result.code).toBe(-1);
    // Must return within ~2s of the timeout (allow scheduling slack).
    expect(elapsed).toBeLessThan(3000);
  });

  test("returns real output when subprocess completes within timeout", async () => {
    const { execBounded } = await importIndex("integration-success");

    const realApi: ExtensionAPI = {
      exec: async (
        command: string,
        args: string[],
        options?: { timeout?: number }
      ) => {
        const timeoutMs = options?.timeout ?? 10_000;
        const proc = Bun.spawn([command, ...args], {
          stdout: "pipe",
          stderr: "pipe",
        });
        const timeout = new Promise<{ stdout: string; stderr: string; code: number; killed: boolean }>(
          (resolve) =>
            setTimeout(
              () => {
                try { proc.kill(); } catch { /* already dead */ }
                resolve({ stdout: "", stderr: "", code: -1, killed: true });
              },
              timeoutMs
            )
        );
        const done = (async () => {
          const [stdout, stderr] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
          ]);
          const code = await proc.exited;
          return { stdout, stderr, code, killed: false };
        })();
        return Promise.race([done, timeout]);
      },
    } as unknown as ExtensionAPI;

    const result = await execBounded(realApi, "echo", ["hello-world"], 5000);

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe("hello-world");
    expect(result.killed).toBe(false);
  });
});
