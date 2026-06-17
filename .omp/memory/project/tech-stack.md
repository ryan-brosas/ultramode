---
purpose: Tech stack, versions, verification commands, and constraints
updated: 2026-06-18
---

# Tech Stack: Ultramode

## Runtime

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| Language | TypeScript | ES module | `index.ts` — OMP extension entry point |
| Runtime | Bun | latest | OMP runtime resolves `@oh-my-pi/pi-ai` globally |
| Package manager | N/A | — | No npm dependencies — OMP runtime provides all imports |
| Task tracking | br (beads_rust) | 0.2.15 | `which br` — CLI task tracker |
| Graph intelligence | bv (beads_viewer) | 0.17.0 | `which bv` — robot commands for graph analysis |

## Key Dependencies

| Dependency | Purpose | Version |
|------------|---------|---------|
| `@oh-my-pi/pi-ai` | `complete()` function for LLM decisions | resolved by OMP runtime |
| `@oh-my-pi/pi-coding-agent` | `ExtensionAPI`, `ExtensionContext` types | resolved by OMP runtime |

No npm `dependencies` in `package.json` — both are resolved by the OMP runtime (verified: bun resolves `@oh-my-pi/pi-ai` globally; the honcho extension imports `@mariozechner/pi-coding-agent` which is the same package under its original name).

## Verification Commands

```bash
# Typecheck
bun build index.ts --no-bundle

# Lint
# (no linter configured — index.ts is a single file)

# Test
# (no test framework — extension is verified via /ultramode status and end-to-end loop test)

# Build
# (no build step — index.ts is loaded directly by OMP)

# Graph state (always available)
bv --robot-triage --format json
br scheduler --json
br list --status open --status in_progress --json
```

## Security

```bash
# Dependency audit
# (no npm dependencies — nothing to audit)

# Secrets scan
# (no secrets in the extension — API keys resolved via ctx.modelRegistry.getApiKey)
```

## Constraints

- **No npm dependencies:** `@oh-my-pi/pi-ai` and `@oh-my-pi/pi-coding-agent` are resolved by the OMP runtime. Do not add `dependencies` to `package.json`.
- **No `runEphemeralTurn`:** The method exists only on `AgentSession` (internal class), not on `ExtensionContext` or `ExtensionAPI`. Use `complete()` from `@oh-my-pi/pi-ai`.
- **No `/close` injection:** The `PHASE_WHITELIST` maps `pr → null` (terminal). The loop stops at `/pr` and sets mode to `idle`. Never inject `/close` or `/merge`.
- **`deliverAs: "followUp"`:** Phase commands are injected via `pi.sendUserMessage(cmd, { deliverAs: "followUp" })` to avoid re-entrancy deadlock in `turn_end` handlers.
- **Token budget:** Keep each memory file under 2KB. Total memory context under 8KB.
- **Verification gate:** Every bead must pass its verification commands before `/review` or `/pr`.
