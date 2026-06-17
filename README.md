# ultramode

An OMP extension that drives the beads workflow (`/create` → `/plan` → `/ship` → `/verify` → `/review` → `/pr`) autonomously. An LLM "decision agent" picks what to work on, decides whether each phase succeeded, and injects the next phase command. The loop stops at `/pr` — the human merges.

## Install

```bash
omp install <repo-url>
```

Or clone into `~/.omp/plugins/node_modules/ultramode/`:

```bash
git clone <repo-url> ~/.omp/plugins/node_modules/ultramode
```

Restart OMP. The extension loads on session start and shows a notification: "ultramode loaded".

## Usage

```
/ultramode on        Activate the autonomous loop (selects work and starts driving phases)
/ultramode off       Deactivate the loop (stops injecting phase commands)
/ultramode status    Show current state: mode, bead ID, phase, retries, last decision
/ultramode continue  Resume after a PR is merged (picks next ready bead)
```

### Requirements

- A reasoning-capable model must be configured as the session model. The extension uses it for LLM-driven decisions via `complete()` from `@oh-my-pi/pi-ai`.
- The project must use the beads workflow (`br` + `bv` installed, `.beads/` directory present).
- The project's commands must follow the beads workflow (`/create`, `/plan`, `/ship`, `/verify`, `/review`, `/pr`).

### How it works

1. **Selection:** On `/ultramode on`, the extension runs `bv --robot-triage --format json` and `br scheduler --json` (or `br list` as fallback), feeds the output to the LLM with a selection prompt, and asks it to pick the best bead to work on.

2. **Phase chaining:** The extension injects phase commands (`/create`, `/plan`, `/ship`, `/verify`, `/review`, `/pr`) via `sendUserMessage`. After each phase completes (turn_end), the LLM decides whether to proceed, retry, reject, or stop.

3. **Decision agent:** Each decision is LLM-driven, not mechanical string matching. The decision prompt includes the current phase, retry count, last agent output, and artifact existence (prd.md, plan.md, completion-evidence.json, review-report.md).

4. **Retry cap:** 3 retries per phase. After 3 failed retries, the bead is marked `blocked` via `br update --status blocked` and the loop picks the next bead.

5. **Stop at /pr:** When `/pr` completes (PR URL detected in output), the extension sets mode to `idle` and notifies: "PR created — waiting for human merge. Run /ultramode continue after merge." The extension never runs `/close` — the human merges and closes.

6. **State persistence:** State is persisted via `appendEntry("ultramode-control", state)` in the session journal. On session restart, the extension reconstructs state by scanning the journal for `ultramode-control` entries.

## Architecture

The extension replaces the PRD's `runEphemeralTurn` (not accessible to extensions) with `complete()` from `@oh-my-pi/pi-ai`. This is the load-bearing correction: `runEphemeralTurn` exists only on `AgentSession` (internal class), not on `ExtensionContext` or `ExtensionAPI`.

The decision call path:
```
turn_end → decide(ctx, prompt) → complete(model, context, { apiKey }) → parse JSON → act
```

Where:
- `ctx.model` — the session's configured model
- `ctx.modelRegistry.getApiKey(model)` — resolves the API key
- `complete()` — from `@oh-my-pi/pi-ai`, returns `AssistantMessage`
- `pi.sendUserMessage(command, { deliverAs: "followUp" })` — injects the next phase command

## Files

- `index.ts` — extension entry point (factory function, event handlers, command handler, decision logic)
- `prompts/selection-prompt.md` — work-selection prompt template
- `prompts/decision-prompt.md` — phase-decision prompt template
- `package.json` — OMP plugin manifest

## License

MIT
