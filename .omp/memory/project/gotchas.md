---
purpose: Known pitfalls, warnings, and workarounds — what will bite the next developer
updated: 2026-06-18
---

# Gotchas: Ultramode

Every entry must include impact and mitigation. A gotcha without a mitigation is just a complaint.

## Active Warnings

| Date | Area | Gotcha | Impact | Mitigation |
|------|------|--------|--------|------------|
| 2026-06 | API | `runEphemeralTurn` does NOT exist on `ExtensionContext` or `ExtensionAPI` | PRD claimed it was accessible; code that calls `ctx.session.runEphemeralTurn` will fail to compile | Use `complete()` from `@oh-my-pi/pi-ai` with `ctx.model` + `ctx.modelRegistry.getApiKey(model)` |
| 2026-06 | API | `ExtensionContext` has no `session` property — only `sessionManager: ReadonlySessionManager` | Code using `ctx.session.*` will fail | All session operations go through `pi` (first arg): `pi.sendUserMessage`, `pi.appendEntry`, `pi.exec`. Read-only state via `ctx.sessionManager.getBranch()` |
| 2026-06 | API | `sendUserMessage` from `turn_end` can re-enter the agent loop if called synchronously | Deadlock — the turn_end handler is still on the stack | Use `deliverAs: "followUp"` to queue the message for after the turn completes |
| 2026-06 | workflow | `br scheduler --json` returns `candidate_count: 0` when no beads are ready | Selection fails with empty scheduler | Fall back to `br list --status open --status in_progress --json`. If both empty, decision returns `{"action": "wait"}` and the loop idles |
| 2026-06 | workflow | `ctx.model` may be undefined if no model is configured | `decide()` throws "no active model on session" | Catch the error in `turn_end` handler, notify user via `ctx.ui.notify("ultramode: no model configured", "error")`, set `state.mode = "idle"` |
| 2026-06 | workflow | The workflow-gate blocks `edit`/`write` until PRD + plan exist at ≥600 lines | Can't scaffold files before `plan.md` is materialized | Write to `.beads/` always passes the gate. For repo-root files, ensure `plan.md` meets the 600-line density check, or use `OMP_SKIP_BEADS_WORKFLOW=1` for emergencies |
| 2026-06 | API | `complete()` may reject a static `apiKey` string for providers requiring `ApiKeyResolver` | LLM call fails with type error | Fallback to `completeSimple()` which accepts `ApiKey` (string or resolver). The `decide()` helper tries `complete()` first, catches, then retries with `completeSimple()` |
| 2026-06 | API | `setTimeout(fn, Infinity)` fires at ~1ms due to timer clamping (Infinity > 2^31-1 triggers HTML spec minimum) | Passing `timeoutMs=Infinity` intending 'no timeout' causes immediate timeout that wins the race against any real LLM call | `decide()` validates: `if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error(...)` |
| 2026-06 | testing | Test mocks returning `new Promise<never>(() => {})` ignore `AbortSignal` — `controller.abort()` does not cause the promise to reject | Signal-only timeout approaches are untestable with standard mocks; `decide()` hangs and tests time out at 5000ms | Use `Promise.race` between the LLM call and a timeout promise that rejects independently of the provider. The signal is still passed for defense-in-depth but `Promise.race` guarantees the function returns |
| 2026-06 | testing | `mock.module()` in Bun applies only on the NEXT import of the mocked module — a static `import` in the test file loads the real module before the mock registers | Tests silently exercise production `@oh-my-pi/pi-ai` instead of the mock, causing network calls or wrong behavior | Use cache-busted dynamic imports: `import(\`../index.ts?${label}-${Date.now()}\`)`. The `importIndex(label)` helper in `test/mocks.ts` does this. Never `import ... from "../index"` at module top-level in tests that mock `@oh-my-pi/pi-ai` |
| 2026-06 | testing | Non-interactive mode (`omp -p`) terminates before async extension command handlers complete — `runSelection`, `decide()`, and `persistState` are cut short | Live testing of async extension behavior fails in `-p` mode; no `ultramode-control` entries persist to journal | Use interactive PTY mode: `python3 -c "import pty; pty.fork(); ..."` with `--model zai-org/GLM-5.2-FP8`. Send `\r` (carriage return) to submit input, not `\n` |
| 2026-06 | testing | PTY sessions that only run extension commands (no LLM prompts) may not persist session journals to disk — `SessionManager.#shouldHaveSessionFile()` requires `#historyContainsAssistantMessage()` to return true | State persistence tests fail because no journal file is created on disk, even though `pi.appendEntry()` fires and `getBranch()` returns entries in-memory | Send a prompt that produces an LLM response (e.g. "say hi") to trigger assistant message creation, which triggers journal disk persistence |

## Template Bootstrap Gotchas

> These gotchas ship with the OMP Beads Template. They apply to any project using this template.

| Date | Area | Gotcha | Impact | Mitigation |
|------|------|--------|--------|------------|
| 2026-06 | workflow | The workflow gate only understands the active bead if `br list --status open --status in_progress --json` works | Gate won't block edits, agents write without PRD/plan | Verify `br` is initialized and beads exist before relying on the gate |
| 2026-06 | workflow | The gate blocks `edit` and `write` but shell-based mutation bypasses it | Agent can circumvent gate via `bash` tool | Trust the gate as a signal, not a hard boundary. Agent conventions are the real enforcement. |
| 2026-06 | workflow | Implementing without a bead or plan | Untracked work, no evidence, no review, no PR | Always `/create` + `/plan` before `/ship` |
| 2026-06 | commands | Commands are prompt templates, not compiled code | Inconsistent behavior across models and sessions | Keep commands explicit and deterministic. Test with different models. |
| 2026-06 | omp | OMP loads from `.omp/` — moving files to `.pi/` stops native discovery | Silent breakage, agent loses skills and commands | Never create `.pi/` directory. Everything lives under `.omp/`. |
| 2026-06 | bv | `bv` requires git history — robot commands return empty until at least one commit exists | Graph queries fail silently | Create at least one commit before relying on bv |
| 2026-06 | models | Lazy/small models skip steps, assume context, don't follow workflow | Wrong output, missing evidence, skipped verification | Use thinking/reasoning-capable models for workflow phases. Explicit prompts compensate for weaker models. |

## How to Add a Gotcha

1. Date = when discovered (YYYY-MM).
2. Area = the subsystem (workflow, bv, br, skills, commands, memory, git, API, <your-component>).
3. Gotcha = what happens — be specific ("bv returns empty" not "bv is broken").
4. Impact = concrete consequence ("no graph context for review" not "bad").
5. Mitigation = actionable — something the next person can DO.

Remove entries once the underlying bug is fixed. Keep entries for ongoing design constraints.
