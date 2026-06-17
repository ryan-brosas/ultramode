---
purpose: How we build — naming, code style, workflow, agent conventions, memory system
updated: 2026-06-18
---

# Conventions: Ultramode

## Naming

- **Files:** `kebab-case.md`, `kebab-case.json`, `kebab-case.ts`
- **Functions:** `camelCase` (TypeScript)
- **Classes/Components:** `PascalCase`
- **Constants:** `UPPER_SNAKE_CASE`
- **Bead slugs:** `kebab-case` (e.g. `ultramode-fpj`)
- **Bead prefix:** `ultramode` (no `br-omp` prefix — this repo is the plugin, not the template)

## Languages by Purpose

| Purpose | Language | Notes |
|---------|----------|-------|
| Extension entry point | TypeScript | `index.ts` — OMP extension factory function |
| Prompt templates | Markdown | `prompts/*.md` with `{placeholder}` tokens |
| Configuration | JSON | `package.json` with `omp.extensions` field |

## Extension Structure

The extension is a single `index.ts` file exporting a default factory function `(pi: ExtensionAPI) => void`. Structure:
- State types (`UltramodeState`, `Phase`, decision interfaces)
- Phase maps (`PHASE_WHITELIST` phase→next command, `PHASE_FROM_COMMAND` command→phase, `COMMAND_FROM_PHASE` phase→starting command, `VALID_PHASES`, `ALLOWED_PHASE_COMMANDS`)
- Helper functions (`loadPrompt`, `extractText`, `parseDecision` (backward brace-balanced scan), `checkArtifact`, `buildArtifactStatus`, `decide`)
- Event handlers (`session_start`, `turn_end`, `tool_call`)
- Command handler (`/ultramode` with on/off/status/continue subcommands)
- Sequential phase enforcement: `proceed` validates `nextCommand` against `PHASE_WHITELIST[state.phase]`; retry uses `COMMAND_FROM_PHASE[state.phase]`

## Git

- **Branch:** `feat/<bead-id>-<slug>` (e.g. `feat/ultramode-fpj-autonomous-engineer-extension`)
- **Commit:** conventional commits — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- **PR title:** `<bead-id>: <one-line summary>`

## Workflow

1. **Brainstorm** — `/brainstorm` explores codebase, identifies work
2. **Create** — `/create` produces PRD + decisions.md
3. **Plan** — `/plan` produces plan.md + tasks.md + context-capsule.md
4. **Ship** — `/ship` implements per plan, no scope creep
5. **Verify** — `/verify` runs checks, records evidence
6. **Review** — `/review` runs 5 parallel agents, confidence filter ≥80
7. **PR** — `/pr` opens PR, single-turn execution
8. **Close** — `/close` after merge, suggests next bead

## Agent Conventions

- Evidence before claims — no assertion without observed output
- Read before edit — never guess file content
- Ask before destructive — confirm before deleting user code
- One bead per session — stay focused, don't multitask
- Never implement without a bead and plan — workflow gate enforces this structurally
- Scope changes to the active bead — don't "clean up while you're in here"
- Always `--json` with br/bv commands — parseable output, no screen scraping
- Resolve actor: `ACTOR="${BR_ACTOR:-assistant}"` on all br mutations

## Key API Surface

The extension uses these verified OMP extension APIs (types at `~/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/dist/types/`):

- `pi.on(event, handler)` — register event handlers (session_start, turn_end, tool_call)
- `pi.sendUserMessage(content, { deliverAs: "followUp" })` — inject phase commands
- `pi.appendEntry("ultramode-control", state)` — persist state to session journal
- `pi.exec(cmd, args[])` — run shell commands (br, bv)
- `pi.registerCommand(name, { handler })` — register `/ultramode` command
- `ctx.model` / `ctx.modelRegistry.getApiKey(model)` — LLM model + API key resolution
- `ctx.sessionManager.getBranch()` — reconstruct state from session journal
- `ctx.ui.notify(message, type)` / `ctx.ui.setWidget(key, content)` — user feedback

**Critical:** `runEphemeralTurn` does NOT exist on `ExtensionContext` or `ExtensionAPI`. Use `complete()` from `@oh-my-pi/pi-ai` instead.

## Honcho Memory

- Use Honcho as persistent memory/reasoning, not as scratch state.
- Query Honcho only when prior user or project context can change the answer.
- `honcho_search` finds prior durable context; `honcho_chat` synthesizes preferences or decisions; `honcho_remember` stores one verified durable fact.
- Keep repository files, bead artifacts, and observed tool output authoritative.
- Never store secrets, credentials, command output, temporary todos, or speculation in Honcho.
- Use the smallest sufficient reasoning level: `minimal` for factual lookup, `low` by default, `medium`/`high` for multi-session synthesis, `max` rarely.

## Memory File Maintenance

Memory files are the project's durable context. They MUST stay current.

| File | What goes there | When to update |
|------|----------------|----------------|
| `project.md` | Vision, goals, current phase | After milestones, scope changes |
| `conventions.md` | Naming, workflow, agent rules | When conventions change |
| `decisions.md` | Architecture decisions | When a new decision is made |
| `gotchas.md` | Pitfalls, warnings, workarounds | When a gotcha is discovered |
| `tech-stack.md` | Versions, verification commands, constraints | When dependencies change |

**Update workflow:**
1. After a session that reveals missing context: write the target file, show the diff, get approval, apply.
2. Every `/close`: agent checks if any conventions/decisions/gotchas were discovered during the bead and proposes updates.
3. Audit periodically: are conventions current? Architecture clear? Gotchas captured?
4. Never let memory drift — stale memory is worse than no memory because it teaches wrong patterns.
