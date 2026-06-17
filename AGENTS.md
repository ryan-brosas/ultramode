# Ultramode

Autonomous senior-engineer loop for OMP — drives the beads workflow (`/create` → `/plan` → `/ship` → `/verify` → `/review` → `/pr`) via LLM decisions and `sendUserMessage` phase chaining, stopping at `/pr` for human merge.

## Setup

```bash
# No dependencies to install — the OMP runtime resolves all imports.
# Install as an OMP plugin:
omp install <repo-url>

# Or clone directly:
git clone <repo-url> ~/.omp/plugins/node_modules/ultramode
```

Verify the extension loads:

```bash
# In an OMP session inside any br/bv project:
/ultramode status
# Expected: mode=off, bead=none, phase=selecting, retries=0/3
```

## Architecture

Single-file TypeScript extension (`index.ts`) with two prompt templates:

- **`index.ts`** — factory function exporting `(pi: ExtensionAPI) => void`. Contains state management, LLM decision helper, work selection, event handlers, and the `/ultramode` command.
- **`prompts/selection-prompt.md`** — work-selection prompt (fed to LLM with bv triage + br scheduler JSON)
- **`prompts/decision-prompt.md`** — phase-decision prompt (fed to LLM with last agent output, artifact status, retry count)

### Key design constraint

The PRD originally specified `ctx.session.runEphemeralTurn(...)` for LLM calls. **This method does not exist on `ExtensionContext` or `ExtensionAPI`** — it's internal to `AgentSession`. The extension uses `complete()` from `@oh-my-pi/pi-ai` instead, with `ctx.model` and `ctx.modelRegistry.getApiKey(model)`.

## Code style

- TypeScript, ES modules (`"type": "module"`)
- No npm dependencies — `@oh-my-pi/pi-ai` and `@oh-my-pi/pi-coding-agent` are resolved by the OMP runtime
- Functions: `camelCase`
- Types/interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Single file (`index.ts`) — no build step, loaded directly by OMP

## Testing

```bash
# Type-check (no bundling):
bun build index.ts --no-bundle

# Verify no injection of the merge-phase command:
grep -c '/close' index.ts  # must be 0

# Verify no reference to the inaccessible method:
grep -c 'runEphemeralTurn' index.ts  # must be 0

# Verify complete() is imported and called:
grep 'from "@oh-my-pi/pi-ai"' index.ts
grep 'await complete(' index.ts

# End-to-end (requires an OMP session with a configured model):
/ultramode on     # activates loop, selects work, drives phases
/ultramode status  # shows current state
/ultramode off     # deactivates
```

## Phase whitelist

The extension never injects the merge-phase command. The `PHASE_WHITELIST` maps:

```
selecting → /create
creating  → /plan
planning  → /ship
shipping  → /verify
verifying → /review
reviewing → /pr
pr        → null  (terminal — human merges)
```

Every `sendUserMessage` call validates the command against `ALLOWED_PHASE_COMMANDS` before injection.

## PR instructions

- Branch: `feat/<bead-id>-<slug>`
- Commit: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)
- PR title: `<bead-id>: <one-line summary>`
- Run `bun build index.ts --no-bundle` before committing — must exit 0

## Guardrails

- **Never inject `/close`** — the loop stops at `/pr`. The human merges and runs `/close`.
- **Never use `runEphemeralTurn`** — use `complete()` from `@oh-my-pi/pi-ai`.
- **Retry cap: 3** — after 3 failed retries, mark bead blocked via `br update --status blocked` and pick next.
- **State persistence** — `pi.appendEntry("ultramode-control", state)` in the session journal; reconstructed via `ctx.sessionManager.getBranch()` on restart.
- **`deliverAs: "followUp"`** — all `sendUserMessage` calls use this to avoid re-entrancy deadlock in `turn_end` handlers.

## Full project context

For the complete OMP workflow context (br/bv conventions, skills map, memory protocol, workflow enforcement), see `.omp/AGENTS.md`.
