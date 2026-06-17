---
purpose: Architecture decision records with rationale and confidence
updated: 2026-06-18
---

# Decisions: Ultramode

Every architecture decision that affects the shape of the project goes here.
Use the table. Dates, rationale, and confidence are required.

## Decision Log

| # | Date | Decision | Rationale | Confidence |
|---|------|----------|-----------|------------|
| 1 | 2026-06 | Build as a standalone OMP extension (`.ts` default export), not an external daemon | Extensions run in-process with access to `turn_end`, `sendUserMessage`, `appendEntry`, `ctx.ui.notify`, and `ctx.ui.setWidget`. An external daemon would lose all of this and require JSON parsing of `omp -p` output. The `autoresearch` built-in extension proves the loop pattern works end-to-end. | High |
| 2 | 2026-06 | Use `complete()` from `@oh-my-pi/pi-ai` for LLM decisions, not `runEphemeralTurn` | `runEphemeralTurn` exists ONLY on `AgentSession` (internal class — `agent-session.d.ts:1033`). It is NOT exposed to extensions. `ExtensionContext` has no `session` property. `complete()` takes `Model` + `Context` + `{ apiKey }` and returns `AssistantMessage`. The extension has `ctx.model` and `ctx.modelRegistry.getApiKey(model)`. | High |
| 3 | 2026-06 | Use `pi.sendUserMessage` for phase chaining on `turn_end` | `sendUserMessage` injects a user message that the agent processes as if the user typed it. `deliverAs: "followUp"` queues the message for delivery after the current turn unwinds, avoiding re-entrancy deadlock. The template's command interception (`native-command-override.ts` for `/plan` and `/review`) works normally. | High |
| 4 | 2026-06 | Stop at `/pr`, never run the merge-phase command | RULE #6 ("the human always gets the last call on merges"). The merge-phase command has a mandatory human approval gate. Auto-merging violates both system-prompt rules and the template's governance. The extension stops at `/pr`; the human merges and runs `/close`. | High |
| 5 | 2026-06 | Persist state via `pi.appendEntry("ultramode-control", state)` | Same pattern as `autoresearch` (`appendEntry("autoresearch-control", {mode, goal})`). Custom entries survive session restart and are reconstructable via `ctx.sessionManager.getBranch()`. No external state file needed. | High |
| 6 | 2026-06 | Parse JSON from `complete()` free text with fail-safe to "stop" | `complete()` does not support structured output. The extension extracts the first `{...}` block via regex, parses it, and validates the `action` field. If parsing fails, the loop stops and notifies the user — never proceeds blindly with an ambiguous action. | Medium |
| 7 | 2026-06 | Hard retry cap: 3 attempts per phase | Prevents infinite loops on failing beads. After 3 retries, the bead is marked blocked via `br update --status blocked` and the extension picks the next ready bead. Matches the template's existing guardrail ("Max 3 fix cycles"). | High |
| 8 | 2026-06 | Use `pi.exec` to call `br` and `bv` commands | The `workflow-gate.ts` extension demonstrates `pi.exec("br", [...])` for executing br commands from extension context. The ultramode extension reuses this pattern for `bv --robot-triage --format json` and `br scheduler --json`. | High |
| 9 | 2026-06 | Register `/ultramode` command with subcommands (on/off/status/continue) | The `autoresearch` extension registers `/autoresearch` via `pi.registerCommand`. The ultramode extension follows the same pattern. Subcommands parsed from the args string. | High |
| 10 | 2026-06 | Ship as a standalone plugin repo (`ultramode`), not in the omp-template | The omp-template is a template — it shouldn't ship a specific autonomous loop. The extension is a standalone package installable via `omp install`, usable across any project that uses the template. Modeled on `omp-makora-provider` package structure. | High |

## How to Add a Decision

1. Assign the next sequential `#`.
2. Date = month of decision (e.g. `2026-06`).
3. Decision = one sentence. Concrete, not abstract.
4. Rationale = what we rejected, what we accepted, why. Enough that someone 6 months later can follow.
5. Confidence = High (multiple sources confirmed), Medium (strong consensus but one uncertainty), Low (experiment, subject to change).
