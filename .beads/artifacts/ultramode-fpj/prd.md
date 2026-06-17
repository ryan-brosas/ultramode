<!-- DENSITY: Minimum 600 lines. No upper bound — be thorough. <600 = incomplete (missing sections, hand-wavy, no real technical context). This is an AI handoff: another agent must be able to pick this up and implement correctly without guessing. Every section must have concrete evidence: file paths, API signatures, existing patterns, constraints. -->
# PRD: se247 extension: agentic senior-engineer loop using runEphemeralTurn for decisions and sendUserMessage for phase chaining, stopping at /pr for human merge

**Bead:** ultramode-fpj | **Type:** feature | **Priority:** P1
**Created:** 2026-06-17 | **Estimate:** 240 minutes

## Problem

WHEN a developer wants autonomous 24/7 senior-engineer development on an OMP+br+bv project, THEN they must manually drive each workflow phase (`/create` → `/plan` → `/ship` → `/verify` → `/review` → `/pr`) by typing commands one at a time, BECAUSE the template's commands are single-turn and human-driven — every phase ends with "Next: /plan $BEAD_ID" as a suggestion, not an action, and no mechanism exists to chain phases automatically or make judgment decisions about what work deserves attention.

This affects any team using the omp-template who wants unattended development — the template provides the governance substrate (workflow-gate, review agents, evidence requirements, memory audit) but no autonomous loop to drive it. The template's commands are designed for interactive human-driven sessions. Without an autonomous layer, the template's full value — graph-informed work selection, phase-gated implementation, evidence-enforced verification — requires a human in the chair for every phase transition. The cost is lost developer time on mechanical phase chaining and missed opportunities for overnight/weekend autonomous work on ready beads.

## Scope

### In Scope

- `index.ts` — the OMP extension entry point (default export function)
- `prompts/decision-prompt.md` — the senior-engineer decision prompt template used by `runEphemeralTurn`
- `prompts/selection-prompt.md` — the work-selection prompt template used on `session_start` and after bead completion
- `package.json` — OMP plugin manifest with `omp.extensions` field pointing to `index.ts`
- `/ultramode` control command (on/off/status/continue) registered via `pi.registerCommand`
- `turn_end` event handler — detects phase completion, calls `runEphemeralTurn` for decision, injects next phase via `sendUserMessage`
- `session_start` event handler — runs work selection if loop is active
- `tool_call` event handler — blocks edits outside the active bead's worktree (scope enforcement)
- State persistence via `ctx.sessionManager.appendCustomEntry("ultramode-control", {mode, beadId, phase, retries})`
- State reconstruction via `ctx.sessionManager.getBranch()` on session restart
- Retry cap: 3 attempts per phase, then mark bead blocked and pick next
- Dashboard widget or status notifications via `ctx.ui.notify()`
- Stops at `/pr` — never injects `/close`
- README.md with install + usage instructions

### Out of Scope

- Modifying omp-template commands (`/create`, `/plan`, `/ship`, etc.) — the extension drives existing commands, does not modify them
- Auto-merge — RULE #6 ("the human always gets the last call on merges") is preserved; the extension stops at `/pr`
- Auto-`/close` — the `/close` memory audit requires human approval (`close.md:99-117`); the extension never runs `/close`
- CI/log ingestion — feeding failing tests and alerts back into `br` as beads is future scope
- Budget/rate-limit accounting — preventing runaway spend is future scope
- Multi-terminal coordination beyond `br reserve` — the extension uses `br reserve` for file claiming but does not implement cross-process locking
- Custom tools — the extension does not register new tools via `pi.registerTool`; it uses existing template commands
- Provider/model configuration — the extension uses the session's configured model; it does not override model selection
- The `runEphemeralTurn` `schema` parameter — `runEphemeralTurn` does not support structured output; the extension parses JSON from free text with fail-safe fallback to "stop"

## Requirements

| # | Requirement | Priority | Acceptance Criteria |
|---|------------|----------|---------------------|
| 1 | The extension loads on session start when installed via `omp install` | MUST | `omp install` completes; on next `omp` launch, `session_start` fires and `ctx.ui.notify` shows "ultramode loaded" |
| 2 | `/ultramode on` activates the autonomous loop | MUST | Running `/ultramode on` sets mode to "on", persists state via `appendCustomEntry`, and triggers work selection |
| 3 | `/ultramode off` deactivates the loop | MUST | Running `/ultramode off` sets mode to "off", persists state, and stops injecting phase commands |
| 4 | `/ultramode status` shows current state | MUST | Running `/ultramode status` outputs: mode, current bead ID, current phase, retry count, and last decision reasoning |
| 5 | `/ultramode continue` resumes after `/pr` or human intervention | MUST | After a PR is merged and `/ultramode continue` is run, the extension picks the next ready bead and starts `/create` |
| 6 | On `session_start` with mode="on", the extension selects work | MUST | `session_start` handler calls `runEphemeralTurn` with a selection prompt containing `bv --robot-triage` and `br scheduler --json` output; the decision's chosen bead ID is captured and `/create` is injected |
| 7 | On `turn_end` with mode="on", the extension decides next action | MUST | `turn_end` handler calls `runEphemeralTurn` with a decision prompt containing the agent's last output, current phase, bead artifacts, and retry count; the decision's action (proceed/reject/retry/stop) is acted upon |
| 8 | Decisions are LLM-driven, not mechanical string matching | MUST | The decision prompt is passed to `runEphemeralTurn`; the extension does not regex-match "Next:" markers — it asks the LLM to decide based on context |
| 9 | Phase chaining uses `sendUserMessage` | MUST | When the decision is "proceed", `ctx.session.sendUserMessage` is called with the next phase command (e.g. `/plan $BEAD_ID`); the agent receives it as a user message and executes the command |
| 10 | The extension stops at `/pr` | MUST | When the decision detects that `/pr` has completed (PR URL in output or phase=pr complete), the extension sets mode to "idle", notifies the user, and does not inject `/close` |
| 11 | The extension never runs `/close` | MUST | No code path in `index.ts` injects `/close` or `/merge`; the `nextPhase()` function's terminal case is `/pr` |
| 12 | Retry cap: 3 attempts per phase | MUST | `state.retries` increments on each retry; when `retries >= 3`, the extension calls `br update <id> --status blocked` and picks the next bead |
| 13 | Tool-call scope enforcement | SHOULD | `tool_call` handler blocks `edit`/`write` calls where `event.input.path` does not start with the worktree path (if a worktree is active); returns `{block: true, reason: "ultramode: scope violation — outside worktree"}` |
| 14 | State survives session restart | MUST | State is persisted via `appendCustomEntry("ultramode-control", {mode, beadId, phase, retries})`; on `session_start`, `ctx.sessionManager.getBranch()` is scanned for the last `ultramode-control` entry to reconstruct state |
| 15 | Dashboard widget shows loop status | SHOULD | `ctx.ui.setWidget("ultramode", ...)` renders a status line showing: mode, bead ID, phase, retries — visible in the TUI status bar |
| 16 | Decision prompt includes bv triage + br scheduler output | MUST | The selection prompt and decision prompt both include JSON output from `bv --robot-triage --format json` and `br scheduler --json` (or `br list --status ready --json` as fallback) |
| 17 | Decision prompt includes bead artifacts | SHOULD | When a bead is active, the decision prompt includes the PRD title, plan status, and completion-evidence status from `.beads/artifacts/$BEAD_ID/` |
| 18 | Failure handling: mark blocked and move on | MUST | When `runEphemeralTurn` returns "retry" and retries are exhausted, or when the decision is "reject", the extension calls `br update <id> --status blocked --notes "ultramode: <reasoning>"` and picks the next ready bead |
| 19 | Notifications on key events | SHOULD | `ctx.ui.notify()` is called on: loop start, bead selection, phase advancement, PR created, bead blocked, loop stop |
| 20 | The extension coexists with existing extensions | MUST | The extension does not conflict with `workflow-gate.ts` or `native-command-override.ts`; it registers its own command name (`ultramode`) and its own event handlers without shadowing existing ones |

## Technical Context

**Key files:**
- `index.ts` — NEW (~400-500 lines) — the extension entry point
- `prompts/decision-prompt.md` — NEW (~80 lines) — decision prompt template
- `prompts/selection-prompt.md` — NEW (~60 lines) — work selection prompt template
- `package.json` — NEW (~30 lines) — OMP plugin manifest
- `README.md` — NEW (~50 lines) — install + usage docs

**APIs / systems touched:**
- `ExtensionAPI` from `@oh-my-pi/pi-coding-agent` — the extension API surface
- `pi.on("turn_end", handler)` — end of user→agent turn; handler receives `{message, toolResults}`
- `pi.on("session_start", handler)` — session load; handler receives `ctx` with session manager
- `pi.on("tool_call", handler)` — pre-execution interception; handler can return `{block: boolean, reason: string}`
- `pi.registerCommand("ultramode", {handler})` — registers the `/ultramode` slash command
- `ctx.session.sendUserMessage(content, options)` — injects a user message into the conversation; the agent processes it as if the user typed it
- `ctx.session.runEphemeralTurn({promptText, signal?, onTextDelta?, dedupeReply?})` — runs an LLM call using the session's model with `toolChoice: "none"`; returns `{replyText, assistantMessage}`; does not pollute the conversation
- `ctx.sessionManager.appendCustomEntry(customType, data)` — persists state as a custom entry in the session journal; survives restart
- `ctx.sessionManager.getBranch()` — returns the session entry list; used to reconstruct state by scanning for `ultramode-control` entries
- `ctx.ui.notify(message, level)` — shows a notification in the TUI
- `ctx.ui.setWidget(name, renderer)` — registers a TUI status widget
- `ctx.cwd` — the working directory of the session
- `pi.exec(cmd, args)` — executes a command and returns `{stdout, code}`; used to call `br` and `bv`

**Existing code to NOT modify:**
- `.omp/extensions/workflow-gate.ts` — the extension must not interfere with the workflow gate's PRD/plan density checks; it relies on the gate to prevent unplanned edits
- `.omp/extensions/native-command-override.ts` — the extension must not interfere with `/plan` and `/review` command interception
- `.omp/commands/*.md` — the extension drives these commands via `sendUserMessage`; it does not modify them
- `.omp/skills/*/SKILL.md` — the extension does not modify skills
- `.omp/templates/*.md` — the extension does not modify templates

**Proven patterns (from autoresearch extension):**
The built-in `autoresearch` extension (`createAutoresearchExtension` in the OMP binary) implements the exact pattern this extension needs:
- Creates dedicated git branches with a prefix (`autoresearch/*`)
- Runs a persistent loop: setup → experiment → log → iterate
- Uses `appendEntry("autoresearch-control", {mode, goal})` for state persistence
- Registers tools (`init_experiment`, `run_experiment`, `log_experiment`, `update_notes`)
- Has a dashboard widget (`ctx.ui.setWidget("autoresearch", ...)`)
- Auto-commits on the branch
- Handles failure: `revertFailedExperiment`, `discard` mode, max-experiments cap
- Registers a `/autoresearch` slash command via `pi.registerCommand`
- Reconstructs state on session start via `reconstructControlState(ctx.sessionManager.getBranch())`

The `ultramode` extension follows this proven architecture but replaces the experiment loop with a beads-workflow phase-chaining loop, and adds LLM-driven decision-making via `runEphemeralTurn`.

**Extension API verification (from `strings` analysis of the OMP binary):**

The following API surface was verified by extracting strings from the OMP binary at `/home/ryan/.local/share/mise/installs/github-can1357-oh-my-pi/16.0.1/omp`:

1. `runEphemeralTurn` — confirmed in `AgentSession`:
   ```typescript
   async runEphemeralTurn(args) {
     const model = this.model;
     if (!model) throw new Error("No active model on session");
     const apiKey = await this.#modelRegistry.getApiKey(model, this.sessionId);
     // ... builds context snapshot, streams with toolChoice: "none"
     // Returns: { replyText, assistantMessage }
   }
   ```
   Called as: `ctx.session.runEphemeralTurn({promptText, signal, onTextDelta, dedupeReply})`

2. `sendUserMessage` — confirmed in extension context:
   ```typescript
   sendUserMessage: this.#sendExtensionUserMessage
   // and:
   sendUserMessage: (content, options) => {
     const sendPromise = session2.sendUserMessage(content, options)
   ```
   Called as: `ctx.session.sendUserMessage(content, options)`

3. `turn_end` event — confirmed in event catalog:
   ```typescript
   pi.on("turn_end", async (_event, ctx) => {
     ctx.ui.setStatus("tokens", `~${ctx.getContextUsage()?.tokens ?? "?"} tokens`);
   });
   ```
   Event shape: `{type: "turn_end", turnIndex, message, toolResults}`

4. `session_start` event — confirmed in hello-extension docs:
   ```typescript
   pi.on("session_start", async (_event, ctx) => {
     ctx.ui.notify("My extension loaded!", "info");
   });
   ```

5. `tool_call` event — confirmed in workflow-gate.ts (existing extension):
   ```typescript
   pi.on("tool_call", async (event) => {
     // event.toolName, event.input.path
     return { block: true, reason: "..." };
   });
   ```

6. `appendCustomEntry` — confirmed in autoresearch:
   ```typescript
   api3.appendEntry("autoresearch-control", { mode, goal });
   ```
   Called as: `ctx.sessionManager.appendCustomEntry("ultramode-control", {mode, beadId, phase, retries})`

7. `registerCommand` — confirmed in autoresearch:
   ```typescript
   api3.registerCommand("autoresearch", {
     description: "...",
     handler: async (args, ctx) => { ... }
   });
   ```

8. `getBranch` for state reconstruction — confirmed in autoresearch:
   ```typescript
   const control = reconstructControlState(ctx.sessionManager.getBranch());
   ```
   The `reconstructControlState` function scans entries for `autoresearch-control` custom type.

**Existing extension patterns (from `workflow-gate.ts`):**

The existing `workflow-gate.ts` extension demonstrates:
- `pi.exec("br", ["list", "--status", "open", ...])` — executing br commands from extension context
- Caching bead ID with 30s TTL
- `readFileSync` for artifact density checks
- `existsSync` for artifact existence checks
- Blocking tool calls with `{block: true, reason: "..."}`

The `ultramode` extension reuses these patterns for:
- Calling `bv --robot-triage --format json` via `pi.exec`
- Calling `br scheduler --json` via `pi.exec`
- Reading bead artifacts via `readFileSync` / `existsSync`
- Blocking scope-violating tool calls

**Makora provider extension (reference for package structure):**

The `omp-makora-provider` plugin at `~/.omp/plugins/node_modules/omp-makora-provider/` demonstrates:
- `package.json` with `"omp": {"extensions": ["./index.ts"]}` manifest
- `import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent"`
- Default export function: `export default function (pi: ExtensionAPI) { ... }`
- Installable via `omp plugin install`

The `ultramode` extension follows this package structure exactly.

**br/bv command surface (from br/bv skills):**

Commands the extension will call via `pi.exec`:
- `br list --status open --status in_progress --json` — active beads
- `br scheduler --json` — evidence-ranked ready work (falls back to `br list --status open --json` if scheduler is unavailable)
- `br show <id> --json` — bead details
- `br update <id> --claim --actor "$ACTOR" --json` — claim a bead
- `br update <id> --status blocked --notes "..." --json` — mark blocked
- `bv --robot-triage --format json` — triage recommendations
- `bv --robot-suggest --format json` — hygiene suggestions

The extension resolves `ACTOR` from `process.env.BR_ACTOR || "ultramode"`.

## Approach

### Architecture: Two-tier agentic loop

The extension implements a two-tier architecture that separates *deciding* from *doing*:

**Tier 1 — Decision Agent (the "senior engineer")**

Uses `ctx.session.runEphemeralTurn` to make judgment calls. This is a pure LLM call with `toolChoice: "none"` — it does not execute tools, does not pollute the conversation, and returns a text reply that the extension parses.

The decision agent is called at three points:
1. **Work selection** (`session_start` or after bead completion) — "What should I work on?" Given bv triage + br scheduler output, decide which bead (if any) deserves attention. Apply senior judgment: reject low-value work, escalate work that needs redesign.
2. **Phase advancement** (`turn_end` after a phase completes) — "Did this phase actually succeed, and what's next?" Given the agent's output, current phase, bead artifacts, and retry count, decide: proceed to next phase, retry with a different approach, mark blocked, or stop (at `/pr`).
3. **Failure handling** (`turn_end` after a failed phase) — "Should I retry or escalate?" Given the error output and retry count, decide: retry (if <3 attempts), mark blocked (if >=3 attempts), or reject the bead entirely.

The decision prompt is the core of the "senior engineer" behavior. It instructs the LLM to:
- Evaluate whether work is worth doing (not just whether it's ready)
- Diagnose root cause, not just symptoms
- Verify that a phase actually succeeded (not just that it appeared to)
- Apply judgment about retry vs. escalation
- Return structured JSON: `{"action": "proceed|reject|retry|stop", "reasoning": "...", "nextCommand": "/plan $BEAD_ID"}`

**Tier 2 — Executor Agent (the "implementer")**

The main OMP session receives decisions as user messages via `ctx.session.sendUserMessage`. When the decision is "proceed", the extension injects the next phase command (e.g. `/plan ultramode-fpj`). The agent processes this as a normal user message — the template's command interception (`native-command-override.ts` for `/plan` and `/review`, direct file-command dispatch for others) expands it into the full command body, and the agent executes the phase.

The executor agent is governed by the template's existing machinery:
- `workflow-gate.ts` blocks edits until PRD + plan exist (≥600 lines density)
- `/verify` requires actual command output in `completion-evidence.json`
- `/review` runs 5 parallel agents with ≥80 confidence filtering
- The PRD's Out-of-Scope section prevents scope creep
- RULE #6 prevents auto-merge

The extension does not bypass any of these — it relies on them.

### Data flow

```
session_start (mode="on")
  │
  ├─ pi.exec("bv", ["--robot-triage", "--format", "json"]) → triage JSON
  ├─ pi.exec("br", ["scheduler", "--json"]) → ready work JSON
  │
  ├─ ctx.session.runEphemeralTurn({
  │    promptText: selectionPrompt(triage, scheduler, recentCommits)
  │  }) → {replyText: '{"beadId": "ultramode-xyz", "reasoning": "..."}'}
  │
  ├─ parse JSON (fail-safe: if parse fails, notify + stop)
  ├─ state.beadId = parsed.beadId
  ├─ ctx.sessionManager.appendCustomEntry("ultramode-control", state)
  ├─ ctx.ui.notify("ultramode: selected bead {beadId} — {reasoning}")
  │
  └─ ctx.session.sendUserMessage("/create {reasoning}")
       │
       ▼
  [agent executes /create, produces prd.md]
       │
       ▼
  turn_end fires
  │
  ├─ read agent output from event.message
  ├─ read bead artifacts (prd.md exists? plan.md exists?)
  │
  ├─ ctx.session.runEphemeralTurn({
  │    promptText: decisionPrompt(lastOutput, phase="create", beadId, artifacts, retries)
  │  }) → {replyText: '{"action": "proceed", "nextCommand": "/plan ultramode-xyz"}'}
  │
  ├─ parse JSON (fail-safe: stop on parse failure)
  ├─ state.phase = "plan"
  ├─ ctx.sessionManager.appendCustomEntry("ultramode-control", state)
  │
  └─ ctx.session.sendUserMessage("/plan ultramode-xyz")
       │
       ▼
  [agent executes /plan, produces plan.md + tasks.md]
       │
       ▼
  turn_end fires
  │ (same decision loop)
       │
       ▼
  ... /ship → /verify → /review → /pr
       │
       ▼
  turn_end fires after /pr
  │
  ├─ decision: {"action": "stop", "reasoning": "PR created — waiting for human merge"}
  ├─ state.mode = "idle"
  ├─ ctx.sessionManager.appendCustomEntry("ultramode-control", state)
  ├─ ctx.ui.notify("ultramode: PR created for {beadId}. Waiting for human merge. Run /ultramode continue after merge.")
  │
  └─ (loop pauses — no more injections until /ultramode continue)
```

### State machine

The extension tracks a simple state machine:

```
States: off → selecting → creating → planning → shipping → verifying → reviewing → pr → idle → (loop back to selecting on /ultramode continue)

Transitions:
  off → selecting: /ultramode on
  selecting → creating: decision = "proceed" with beadId
  creating → planning: decision = "proceed" after /create completes
  planning → shipping: decision = "proceed" after /plan completes
  shipping → verifying: decision = "proceed" after /ship completes
  verifying → reviewing: decision = "proceed" after /verify completes
  reviewing → pr: decision = "proceed" after /review completes
  pr → idle: decision = "stop" after /pr completes
  idle → selecting: /ultramode continue

Failure transitions:
  any → retry: decision = "retry" and retries < 3
  any → blocked: decision = "retry" and retries >= 3, or decision = "reject"
  blocked → selecting: pick next bead
```

State is persisted via `appendCustomEntry("ultramode-control", {mode, beadId, phase, retries, lastDecision})` after every transition. On `session_start`, the extension calls `ctx.sessionManager.getBranch()` and scans for the last `ultramode-control` entry to reconstruct state.

### Decision prompt design

The decision prompt is the core of the "senior engineer" behavior. It is loaded from `prompts/decision-prompt.md` (for phase advancement) and `prompts/selection-prompt.md` (for work selection).

The decision prompt structure:

```
You are a senior staff engineer managing an autonomous development loop.

## Current State
- Bead: {beadId}
- Phase: {phase}
- Retries: {retries}

## Repository State
{bv_triage_json}

## Ready Work
{br_scheduler_json}

## What Just Happened
{last_agent_output}

## Bead Artifacts
- PRD exists: {yes/no} ({lines} lines)
- Plan exists: {yes/no} ({lines} lines)
- Tasks exist: {yes/no}
- Completion evidence exists: {yes/no}
- Review report exists: {yes/no}, verdict: {verdict}

## Your Decision

Apply senior engineering judgment:
1. Did the previous phase actually succeed? (Check for real evidence, not just completion claims)
2. Is this work still worth doing? (Reject if the problem is a symptom, not the root cause)
3. Should we proceed, retry with a different approach, or stop?
4. If proceeding, what is the next phase command?

Return JSON:
{"action": "proceed|reject|retry|stop", "reasoning": "...", "nextCommand": "/<phase> <beadId>"}

If you cannot decide, return {"action": "stop", "reasoning": "undecidable"}.
```

The selection prompt structure:

```
You are a senior staff engineer selecting work for an autonomous development loop.

## Repository State
{bv_triage_json}

## Ready Work
{br_scheduler_json}

## Recent Activity
{recent_commits}

## Your Decision

Apply senior engineering judgment:
1. Is there work worth doing right now? (If not, return {"action": "wait"})
2. Which bead should we work on? (Pick the highest-impact, lowest-risk ready bead)
3. Is the stated problem the real problem, or a symptom? (Reject symptom-only work)
4. Should we create a new bead instead? (If no ready work matches current needs)

Return JSON:
{"action": "select|wait|create", "beadId": "<id>", "reasoning": "...", "createDescription": "<desc>"}

If you cannot decide, return {"action": "wait", "reasoning": "undecidable"}.
```

Both prompts are stored as markdown files in `prompts/` and loaded at runtime via `readFileSync(new URL(relativePath, import.meta.url), "utf8")` — the same pattern `omp-makora-provider` uses for `models.json`.

### JSON parsing with fail-safe

`runEphemeralTurn` returns free text, not structured output. The extension parses the decision JSON from the reply text:

1. Extract the first `{...}` JSON block from the reply text using a regex
2. Parse it with `JSON.parse`
3. Validate: `action` must be one of `proceed|reject|retry|stop|select|wait|create`
4. If parsing or validation fails: default to `{"action": "stop", "reasoning": "decision parse failure: <error>"}` — fail-safe to stop, not to proceed blindly

This is the safe default: if the LLM's decision can't be parsed, the loop stops and notifies the user rather than proceeding with an ambiguous action.

### Scope enforcement (tool_call handler)

The `tool_call` handler enforces worktree scope when a worktree is active:

```typescript
pi.on("tool_call", async (event) => {
  if (state.mode !== "on" || !state.worktreePath) return;
  if (event.toolName !== "edit" && event.toolName !== "write") return;
  const path = event.input?.path;
  if (typeof path !== "string") return;
  // Allow .beads/ and .omp/ paths always
  if (path.startsWith(".beads/") || path.startsWith(".omp/")) return;
  // Block paths outside the worktree
  if (!path.startsWith(state.worktreePath)) {
    return { block: true, reason: `ultramode: scope violation — edits outside worktree ${state.worktreePath}` };
  }
});
```

This is a SHOULD, not a MUST — it only applies when a worktree is active. In non-worktree mode, the workflow-gate already enforces that edits require PRD + plan.

### Coexistence with existing extensions

The extension registers:
- Command name: `ultramode` (no collision with `plan`, `review`, or built-in commands)
- Event handlers: `turn_end`, `session_start`, `tool_call` (additive — multiple handlers can register for the same event)
- Custom entry type: `ultramode-control` (no collision with `autoresearch-control`)
- Widget name: `ultramode` (no collision with `autoresearch`)

It does not:
- Override any existing command
- Block any existing tool call (unless scope violation is detected)
- Modify any existing extension's behavior
- Shadow any existing command name

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `runEphemeralTurn` is not accessible from extension context (only from internal session code) | Medium | High | Write a 5-line test extension first that calls `runEphemeralTurn` on `session_start`. If it throws, fall back to `pi.exec("omp", ["-p", ...])` as a subprocess fallback for decisions. |
| `sendUserMessage` during `turn_end` handler causes deadlock (re-entrant turn) | Medium | High | Autoresearch already chains messages after turn events using the same pattern. If deadlock occurs, defer the injection via `queueMicrotask(() => ctx.session.sendUserMessage(...))` to break the re-entrancy. |
| Decision prompt produces unparseable JSON | Medium | Medium | Fail-safe parsing: default to `{"action": "stop"}` on parse failure. Notify the user with the raw reply text for debugging. |
| Model quality is insufficient for senior-engineer decisions | Medium | High | The decision prompt explicitly requests structured JSON output and provides a rubric. Document that the session model should be a reasoning-capable model (e.g. Claude, GPT-4). The extension cannot override model selection. |
| Loop runs forever on a failing bead | Low | Medium | Hard retry cap: 3 attempts per phase, then mark blocked and pick next bead. No infinite retry loops. |
| Multiple terminals collide on the same bead | Medium | High | Use `br update <id> --claim` before starting work. If claim fails (another terminal claimed it), pick a different bead. `br reserve` handles file-level claiming. |
| The extension blocks legitimate user edits in non-worktree mode | Low | Low | Scope enforcement only applies when `state.worktreePath` is set. In non-worktree mode, the workflow-gate handles edit gating. |
| `bv` or `br` commands fail or return malformed JSON | Medium | Medium | All `pi.exec` calls are wrapped in try/catch. On failure, the decision prompt includes "bv/br unavailable" and the LLM decides based on available context. |
| State reconstruction fails on session restart | Low | Medium | `getBranch()` is always available. If no `ultramode-control` entry is found, default to `mode: "off"` and notify the user to run `/ultramode on`. |
| Decision latency (2-10s per LLM call) slows the loop | Low | Low | This is acceptable — a senior engineer doesn't decide in 50ms. The latency is bounded by the model's response time. No mitigation needed. |
| Token cost: decision calls add spend on top of executor calls | Medium | Low | Roughly 2x the token cost of mechanical chaining. The trade is judgment. Document in README. |
| The extension's `tool_call` handler conflicts with `workflow-gate.ts` | Low | Medium | Both register `tool_call` handlers. OMP allows multiple handlers — they are additive. The ultramode handler only blocks on scope violations; the workflow-gate blocks on missing PRD/plan. They don't conflict. |

## Acceptance Criteria

- [ ] `omp install` works from the GitHub repo
    - Verify: `omp install <repo-url>` completes; `omp` launch shows "ultramode loaded" notification
- [ ] `/ultramode on` starts the loop
    - Verify: `/ultramode on` → state persisted, work selection runs, a bead is selected, `/create` is injected
- [ ] `/ultramode off` stops the loop
    - Verify: `/ultramode off` → state persisted, no more phase injections on `turn_end`
- [ ] `/ultramode status` shows current state
    - Verify: `/ultramode status` → outputs mode, bead ID, phase, retries, last decision
- [ ] `/ultramode continue` resumes after `/pr`
    - Verify: after `/pr` completes and `/ultramode continue` is run → next bead selected, `/create` injected
- [ ] Decisions use `runEphemeralTurn`, not string matching
    - Verify: read `index.ts` — `runEphemeralTurn` is called in the `turn_end` handler; no regex matching of "Next:" markers
- [ ] Phase chaining uses `sendUserMessage`
    - Verify: read `index.ts` — `ctx.session.sendUserMessage` is called with the next phase command when decision is "proceed"
- [ ] The extension stops at `/pr`
    - Verify: run a full loop on a test bead — after `/pr` completes, mode is set to "idle", no `/close` injected
- [ ] The extension never runs `/close`
    - Verify: `grep -c 'close' index.ts` returns 0 matches for `/close` injection; `nextPhase()` terminal case is `/pr`
- [ ] Retry cap: 3 attempts
    - Verify: read `index.ts` — `retries >= 3` triggers `br update --status blocked` and picks next bead
- [ ] State survives restart
    - Verify: `/ultramode on`, kill `omp`, restart `omp` → `session_start` reconstructs state from `getBranch()`, mode is "on"
- [ ] Decision prompt includes bv triage + br scheduler
    - Verify: read `prompts/decision-prompt.md` and `prompts/selection-prompt.md` — both include `{bv_triage_json}` and `{br_scheduler_json}` placeholders
- [ ] Tool-call scope enforcement
    - Verify: read `index.ts` — `tool_call` handler blocks edits outside worktree when worktree is active
- [ ] Failure handling marks beads blocked
    - Verify: simulate a failing phase 3 times → `br show <id> --json` shows `status: "blocked"` with ultramode reasoning in notes
- [ ] Coexists with existing extensions
    - Verify: install in a project with `workflow-gate.ts` and `native-command-override.ts` → no command name conflicts, no event handler errors
- [ ] `package.json` has correct `omp.extensions` manifest
    - Verify: `cat package.json | jq '.omp.extensions'` returns `["./index.ts"]`

## Verification Plan

The extension is verified in layers, from unit to integration. Each layer exercises a specific behavioral concern.

### Layer 1: Package structure

- `package.json` exists and has `"omp": {"extensions": ["./index.ts"]}`
- `index.ts` exists and exports a default function
- `prompts/decision-prompt.md` and `prompts/selection-prompt.md` exist
- `README.md` exists with install + usage instructions

Verify:
```bash
test -f package.json && jq -e '.omp.extensions[0] == "./index.ts"' package.json
test -f index.ts && grep -q 'export default function' index.ts
test -f prompts/decision-prompt.md
test -f prompts/selection-prompt.md
test -f README.md
```

### Layer 2: Extension loads

Install the plugin in a test project and verify the extension loads on session start:

```bash
# In a test project with .omp/ and .beads/ directories
omp install /path/to/ultramode
omp -p "echo test"
# Check session log for "ultramode loaded" notification
```

The `session_start` handler should fire and call `ctx.ui.notify("ultramode loaded", "info")`. If it throws, the error is captured in the session log.

### Layer 3: Control command

The `/ultramode` command is registered and accepts subcommands:

```bash
# In an interactive omp session
/ultramode status    # Should output: mode=off, beadId=none, phase=none, retries=0
/ultramode on        # Should set mode=on, trigger work selection
/ultramode off       # Should set mode=off, stop injecting
/ultramode continue  # Should pick next bead and start /create
```

### Layer 4: runEphemeralTurn accessibility

This is the highest-risk requirement. Verify that `ctx.session.runEphemeralTurn` is callable from the extension context:

```typescript
// In the session_start handler, add a test call:
try {
  const result = await ctx.session.runEphemeralTurn({
    promptText: "Reply with the word OK."
  });
  ctx.ui.notify(`ultramode: runEphemeralTurn accessible — got ${result.replyText.slice(0, 20)}`, "info");
} catch (err) {
  ctx.ui.notify(`ultramode: runEphemeralTurn FAILED — ${err.message}`, "error");
  // Fall back to mechanical chaining or subprocess decision calls
}
```

If the call fails, the extension falls back to `pi.exec("omp", ["-p", "--mode", "json", decisionPrompt])` as a subprocess — less efficient but functional.

### Layer 5: Phase chaining

Create a test bead with a trivial PRD and plan, then run `/ultramode on`. Verify:

1. The extension selects the test bead (or creates one)
2. `/create` is injected via `sendUserMessage`
3. After `/create` completes, `turn_end` fires and the decision agent is called
4. The decision returns `{"action": "proceed", "nextCommand": "/plan <bead-id>"}`
5. `/plan` is injected
6. The chain continues through `/ship`, `/verify`, `/review`, `/pr`
7. After `/pr`, the decision returns `{"action": "stop"}` and mode is set to "idle"

Verify by watching the TUI for phase transitions and checking `ctx.ui.notify` messages.

### Layer 6: Failure handling

Create a bead that will fail during `/ship` (e.g. a plan that requires editing a nonexistent file). Verify:

1. `/ship` fails
2. `turn_end` fires, decision agent returns `{"action": "retry"}`
3. Retry counter increments
4. After 3 retries, the bead is marked blocked via `br update --status blocked`
5. The extension picks the next bead

Verify:
```bash
br show <bead-id> --json | jq '.status'  # Should be "blocked"
br show <bead-id> --json | jq '.notes'   # Should contain "ultramode:" prefix
```

### Layer 7: State persistence

1. Run `/ultramode on`
2. Kill the `omp` process (Ctrl+C or `kill`)
3. Restart `omp` in the same project
4. Verify `session_start` reconstructs state:
   - Mode is "on"
   - Bead ID is preserved
   - Phase is preserved
   - Retries are preserved

Verify by checking the `ultramode-control` entries in the session log and the `/ultramode status` output.

## Non-Functional Requirements

### Performance

- Decision latency: 2-10 seconds per `runEphemeralTurn` call (bounded by model response time). Acceptable — the loop is not latency-sensitive.
- State persistence: `appendCustomEntry` is a synchronous write to the session journal. Negligible overhead.
- `pi.exec` calls to br/bv: 100-500ms each. Acceptable — called once per turn_end, not per tool call.
- Memory: the extension holds a small state object (~100 bytes). No memory growth concerns.

### Reliability

- All `pi.exec` calls are wrapped in try/catch. If br or bv fails, the decision prompt includes "unavailable" and the LLM decides with available context.
- All `runEphemeralTurn` calls are wrapped in try/catch. If the LLM call fails, the loop stops and notifies the user.
- All JSON parsing is fail-safe: parse failures default to `{"action": "stop"}`, not to proceeding blindly.
- State is persisted after every state transition. If the process crashes mid-transition, the next session_start reconstructs from the last known state.

### Security

- The extension does not handle credentials, API keys, or tokens.
- The extension does not execute arbitrary user input — it injects pre-defined phase commands (`/create`, `/plan`, etc.) and LLM-decided bead IDs.
- The `tool_call` handler blocks edits outside the worktree, preventing scope violations.
- The extension respects RULE #6: it never auto-merges or runs `/close`.
- The decision prompt does not include secrets from bead artifacts — it only reads file existence and line counts, not file contents (except the PRD title).

### Compatibility

- Requires OMP v16.0.1+ (verified API surface).
- Requires `br` and `bv` in PATH.
- Requires a project with `.beads/` and `.omp/` directories (the omp-template or a derivative).
- Coexists with `workflow-gate.ts`, `native-command-override.ts`, and the `autoresearch` extension.
- Does not require any specific model — but decision quality scales with model reasoning capability.

## Dependencies

| Dependency | Type | Required | Notes |
|------------|------|---------|-------|
| `@oh-my-pi/pi-coding-agent` | npm | Yes | Extension API types. Available in the OMP runtime; no install needed. |
| `br` | CLI | Yes | Bead tracker. Must be in PATH. |
| `bv` | CLI | Yes | Graph analyzer. Must be in PATH. |
| OMP v16.0.1+ | Runtime | Yes | Extension API with `runEphemeralTurn`, `sendUserMessage`, `turn_end`, `registerCommand`. |
| omp-template | Project | Yes | The extension drives template commands. Works with any project using the omp-template structure. |

## Glossary

- **Decision Agent**: the LLM call via `runEphemeralTurn` that decides what to do next. Pure reasoning, no tools, no conversation pollution.
- **Executor Agent**: the main OMP session that receives phase commands via `sendUserMessage` and executes them. Governed by the template's workflow-gate and review agents.
- **Phase**: a step in the beads workflow (`create`, `plan`, `ship`, `verify`, `review`, `pr`). Each phase is a template command.
- **Bead**: a tracked work item in `br`. Has a PRD, plan, tasks, and artifacts.
- **Worktree**: an isolated git worktree for a bead's work. Created by `/create --worktree`.
- **State**: the extension's persisted state: `{mode, beadId, phase, retries, lastDecision, worktreePath}`. Persisted via `appendCustomEntry("ultramode-control", state)`.
- **Loop**: the autonomous cycle: select work → create → plan → ship → verify → review → pr → idle → (continue) → select work.
- **Idle**: the state after `/pr` completes. The loop pauses and waits for `/ultramode continue`.
- **Blocked**: a bead status set by the extension when retries are exhausted or the decision is "reject". The bead is marked blocked in `br` and the extension picks the next bead.
