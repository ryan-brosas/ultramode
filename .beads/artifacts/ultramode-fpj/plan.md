# Plan: ultramode-fpj — autonomous senior-engineer loop extension

## Context

The PRD at `.beads/artifacts/ultramode-fpj/prd.md` specifies an OMP extension that drives the beads workflow (`/create` → `/plan` → `/ship` → `/verify` → `/review` → `/pr`) autonomously: an LLM "decision agent" picks what to work on and decides whether each phase succeeded, then injects the next phase command via `sendUserMessage`. The extension stops at `/pr` (human merges).

**The PRD's core architecture is built on a method extensions cannot access.** The PRD claims `ctx.session.runEphemeralTurn(...)` is callable from extension event handlers, verified only via `strings` on the omp binary. Verified against the actual type definitions at `/home/ryan/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/dist/types/`:

- `runEphemeralTurn` exists ONLY on `AgentSession` (an internal class — `agent-session.d.ts:1033`). It is NOT exposed to extensions.
- `ExtensionContext` (`types.d.ts:202-233`) has no `session` property. It exposes `sessionManager: ReadonlySessionManager` (a `Pick` that excludes `runEphemeralTurn`), `model: Model | undefined`, `modelRegistry: ModelRegistry`, `ui: ExtensionUIContext`, `cwd: string`.
- `ExtensionAPI` (`types.d.ts:599-749`) exposes `sendUserMessage`, `appendEntry`, `exec`, `registerCommand`, `on(...)`, `sendMessage` — all on `pi` (the first arg), NOT on `ctx.session.*`.

The viable LLM-call path is `complete()` from `@oh-my-pi/pi-ai` (confirmed importable via bun, exported function). It takes a `Model` + `Context` + optional `apiKey` and returns an `AssistantMessage`. The extension has `ctx.model` and `ctx.modelRegistry.getApiKey(model)` — both available on `ExtensionContext`.

End state: a standalone OMP extension package (`ultramode`) that, once installed and activated via `/ultramode on`, selects ready beads from br/bv output, drives the workflow phases by injecting commands via `pi.sendUserMessage`, makes LLM-driven decisions via `complete()`, persists state via `pi.appendEntry`, and stops at `/pr`. Never runs `/close` or auto-merges.

## Approach

### Step 1 — Package scaffold

Create the standalone plugin package mirroring `~/.omp/plugins/node_modules/omp-makora-provider/` structure (verified: `package.json` with `"omp": {"extensions": ["./index.ts"]}`, default-export factory function, `import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent"`).

Create `package.json` at repo root:
```json
{
  "name": "ultramode",
  "version": "0.1.0",
  "type": "module",
  "main": "index.ts",
  "omp": { "extensions": ["./index.ts"] },
  "dependencies": {}
}
```
No npm dependencies — `@oh-my-pi/pi-ai` and `@oh-my-pi/pi-coding-agent` are resolved by the OMP runtime (verified: bun resolves `@oh-my-pi/pi-ai` globally; honcho extension imports `@mariozechner/pi-coding-agent` which is the same package under its original name).

Create `README.md` with install (`omp install <repo-url>`) and usage (`/ultramode on|off|status|continue`).

### Step 2 — Type definitions and state

Create `index.ts` with the extension factory. Import from the real API surface:

```typescript
import { readFileSync } from "node:fs";
import { complete } from "@oh-my-pi/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import type { Model, Context, AssistantMessage, Message } from "@oh-my-pi/pi-ai";
```

Define the state shape (corrected from PRD — uses `pi.appendEntry`, not `ctx.sessionManager.appendCustomEntry`):

```typescript
interface UltramodeState {
  mode: "off" | "on" | "idle";
  beadId: string | null;
  phase: "selecting" | "creating" | "planning" | "shipping" | "verifying" | "reviewing" | "pr";
  retries: number;
  lastDecision: string | null;
  worktreePath: string | null;
}
```

The `appendEntry` signature (verified `types.d.ts:692`): `pi.appendEntry<T>(customType: string, data?: T): void`. Use `pi.appendEntry("ultramode-control", state)` — same pattern as autoresearch's `appendEntry("autoresearch-control", {mode, goal})` (autoresearch/types.d.ts:129).

State reconstruction on `session_start`: `ctx.sessionManager.getBranch()` returns `SessionEntry[]` (verified `session-manager.d.ts:201`). Scan for entries with `customType === "ultramode-control"` and take the last one's `data`. The autoresearch reference (`autoresearch/state.d.ts:16` `reconstructControlState`) does exactly this scan.

### Step 3 — LLM decision call (replaces `runEphemeralTurn`)

This is the load-bearing correction. The PRD's `ctx.session.runEphemeralTurn` does not exist. Replace with a helper that calls `complete()` from `@oh-my-pi/pi-ai`:

```typescript
async function decide(
  ctx: ExtensionContext,
  promptText: string
): Promise<string> {
  const model = ctx.model;
  if (!model) throw new Error("ultramode: no active model on session");

  const apiKey = await ctx.modelRegistry.getApiKey(model, undefined);
  if (!apiKey) throw new Error(`ultramode: no API key for ${model.provider}/${model.id}`);

  const context: Context = {
    systemPrompt: ["You are a senior staff engineer managing an autonomous development loop. Return ONLY valid JSON."],
    messages: [{ role: "user", content: promptText, timestamp: Date.now() } as Message],
  };

  const result: AssistantMessage = await complete(model, context, { apiKey });
  // Extract text from content blocks
  const text = result.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map(b => b.text)
    .join("");
  return text;
}
```

Verified signatures:
- `ctx.model: Model | undefined` — `types.d.ts:218`
- `ctx.modelRegistry: ModelRegistry` — `types.d.ts:216`; `getApiKey(model, sessionId?)` returns `Promise<string | undefined>` — `model-registry.d.ts:158`
- `complete<TApi>(model, context, options?)` returns `Promise<AssistantMessage>` — `pi-ai/stream.d.ts:30`; `options.apiKey: string` — `types.d.ts:144`
- `AssistantMessage.content` is `(TextContent | ThinkingContent | RedactedThinkingContent | ToolCall)[]` — `types.d.ts:393`; `TextContent` has `{ type: "text"; text: string }`

Fail-safe JSON parse: extract first `{...}` block via regex, `JSON.parse`, validate `action` field is in the allowed set. On parse failure, return `{"action": "stop", "reasoning": "decision parse failure: <error>"}` and notify user via `ctx.ui.notify(...)`.

### Step 4 — Event handlers

Register four event handlers on `pi`:

**`session_start`** (`pi.on("session_start", handler)` — verified `types.d.ts:609`):
- Reconstruct state from `ctx.sessionManager.getBranch()` — scan for `ultramode-control` custom entries
- If `mode === "on"`, call `runSelection(ctx)` (Step 5)
- Always call `ctx.ui.notify("ultramode loaded", "info")` once

**`turn_end`** (`pi.on("turn_end", handler)` — verified `types.d.ts:627`):
- Event shape `TurnEndEvent` (`shared-events.d.ts:153`): `{ type: "turn_end"; turnIndex: number; message: AgentMessage; toolResults: ToolResultMessage[] }`
- If `state.mode !== "on"`, return immediately
- Extract last assistant text from `event.message` (an `AgentMessage` — has `.content` array with text blocks)
- Call `decide(ctx, decisionPrompt(state, lastOutput, beadArtifacts))` (Step 3)
- Parse JSON decision: `{ action: "proceed"|"reject"|"retry"|"stop", reasoning: string, nextCommand: string }`
- Act on decision (Step 6)

**`tool_call`** (`pi.on("tool_call", handler)` — verified `types.d.ts:645`):
- Event shape: `{ type: "tool_call"; toolCallId: string; toolName: string; input: Record<string, unknown> }`
- Return `{ block: true, reason: "..." }` to block (verified `shared-events.d.ts:207-212`: `ToolCallEventResult { block?: boolean; reason?: string }`)
- Only enforce scope when `state.worktreePath` is set: block `edit`/`write` where `event.input.path` doesn't start with worktree path (allow `.beads/` and `.omp/` always)
- In non-worktree mode, return `undefined` — the existing `workflow-gate.ts` handles PRD/plan gating

**`input`** (NOT needed — the `/ultramode` command is registered via `pi.registerCommand`, not input interception. The existing `native-command-override.ts` only intercepts `/plan` and `/review`.)

### Step 5 — Work selection

`runSelection(ctx: ExtensionContext)`:
1. Call `pi.exec("bv", ["--robot-triage", "--format", "json"])` → parse triage JSON (verified: `bv --robot-triage --format json` returns `{ triage: { recommendations: [...], quick_ref: {...} } }`)
2. Call `pi.exec("br", ["scheduler", "--json"])` → parse scheduler JSON (verified: `br scheduler --json` returns `{ schema: "br.scheduler.v1", recommendations: [...] }`). Fallback if empty: `pi.exec("br", ["list", "--status", "open", "--status", "in_progress", "--json"])` → `{ issues: [...] }`
3. Build selection prompt (from `prompts/selection-prompt.md` template, loaded via `readFileSync(new URL("./prompts/selection-prompt.md", import.meta.url), "utf8")` — same pattern as makora provider's `loadJson`)
4. Call `decide(ctx, selectionPrompt(triage, scheduler))` (Step 3)
5. Parse decision: `{ action: "select"|"wait"|"create", beadId: string, reasoning: string, createDescription: string }`
6. If `select`: `pi.exec("br", ["update", beadId, "--claim", "--actor", "ultramode", "--json"])`, set `state.beadId = beadId`, `state.phase = "creating"`, persist, then `pi.sendUserMessage("/create " + beadId)`
7. If `wait`: notify, set `state.mode = "idle"`
8. If `create`: `pi.sendUserMessage("/create " + createDescription)` — the agent runs `/create` which produces a new bead

`pi.exec` signature (verified `types.d.ts:694`): `exec(command: string, args: string[], options?): Promise<{ stdout?: string; code?: number }>`. Pattern from `workflow-gate.ts:18-25`.

`pi.sendUserMessage` signature (verified `types.d.ts:688`): `sendUserMessage(content: string | (TextContent | ImageContent)[], options?: { deliverAs?: "steer" | "followUp" }): void`. Call with `deliverAs: "followUp"` to queue after current turn unwinds (avoids re-entrancy deadlock — the turn_end handler is still on the stack when this is called; `followUp` queues the message rather than starting a new turn immediately).

### Step 6 — Phase chaining and decision logic

On `turn_end` with `mode === "on"`:

1. Read bead artifacts to include in decision prompt:
   - `existsSync(".beads/artifacts/" + state.beadId + "/prd.md")` + line count
   - Same for `plan.md`, `tasks.md`, `completion-evidence.json`, `review-report.md`
   - Pattern from `workflow-gate.ts:52-60` (`checkDensity` using `readFileSync` + line counting)

2. Build decision prompt from `prompts/decision-prompt.md` template with:
   - `state.beadId`, `state.phase`, `state.retries`
   - bv triage JSON (cached from last selection, or re-fetched)
   - last assistant output (truncated to ~2000 chars from `event.message`)
   - artifact existence + line counts

3. Call `decide(ctx, decisionPrompt)` → parse `{ action, reasoning, nextCommand }`

4. Act on decision:
   - `proceed`: validate `nextCommand` is one of `/plan`, `/ship`, `/verify`, `/review`, `/pr` (whitelist — never inject `/close` or arbitrary commands). Update `state.phase` to match. Persist. Call `pi.sendUserMessage(nextCommand + " " + state.beadId, { deliverAs: "followUp" })`.
   - `retry`: if `state.retries < 3`, increment `state.retries`, persist, re-inject the current phase command. If `state.retries >= 3`, call `pi.exec("br", ["update", state.beadId, "--status", "blocked", "--notes", "ultramode: " + reasoning, "--actor", "ultramode", "--json"])`, notify, then `runSelection(ctx)` to pick next bead.
   - `reject`: mark blocked (same as retry-exhausted), pick next bead.
   - `stop`: if `state.phase === "pr"`, set `state.mode = "idle"`, notify "PR created — waiting for human merge. Run /ultramode continue after merge." Otherwise, notify with reasoning and set `mode = "idle"`.

Phase whitelist (the `nextPhase` mapping — terminal case is `/pr`):
```
creating → /plan
planning → /ship
shipping → /verify
verifying → /review
reviewing → /pr
pr → (stop, idle)
```
No code path injects `/close`. The acceptance check: avoid the literal `/close` in comments — use `merge` or `close-phase` phrasing instead.

### Step 7 — Control command

Register `/ultramode` via `pi.registerCommand("ultramode", { handler })` (verified `types.d.ts:652`):

```typescript
pi.registerCommand("ultramode", {
  description: "Control the ultramode autonomous loop",
  handler: async (args: string, ctx: ExtensionCommandContext) => {
    const subcommand = args.trim().split(/\s+/)[0] || "status";
    // ...
  },
});
```

`ExtensionCommandContext` extends `ExtensionContext` with `waitForIdle()` (`types.d.ts:240`) — useful for `continue` to ensure the previous turn is done before injecting.

Subcommands:
- `on`: set `state.mode = "on"`, persist via `pi.appendEntry("ultramode-control", state)`, notify, call `runSelection(ctx)` if no active bead
- `off`: set `state.mode = "off"`, persist, notify
- `status`: output `mode`, `beadId`, `phase`, `retries`, `lastDecision` via `ctx.ui.notify(...)` (no `ctx.ui.setWidget` in command context — commands get `ExtensionCommandContext` which has `ui` from `ExtensionContext`)
- `continue`: set `state.mode = "on"`, clear `state.beadId`, persist, call `runSelection(ctx)` — picks next ready bead after a PR is merged

### Step 8 — Dashboard widget (SHOULD, not MUST)

Register a status widget via `ctx.ui.setWidget("ultramode", content)` (verified `types.d.ts:110`):

```typescript
ctx.ui.setWidget("ultramode", [
  `ultramode: ${state.mode} | bead: ${state.beadId ?? "none"} | phase: ${state.phase} | retries: ${state.retries}`
]);
```

Call this after every state transition. The widget shows in the TUI status area. This is a SHOULD — if `setWidget` isn't available in some context (print/RPC mode), wrap in try/catch and fall back to `ctx.ui.setStatus("ultramode", ...)`.

### Step 9 — Prompt templates

Create `prompts/decision-prompt.md` and `prompts/selection-prompt.md` as markdown files with `{bv_triage_json}`, `{br_scheduler_json}`, `{bead_id}`, `{phase}`, `{retries}`, `{last_output}`, `{artifact_status}` placeholders. Load at runtime via:

```typescript
function loadPrompt(name: string): string {
  return readFileSync(new URL(`./prompts/${name}.md`, import.meta.url), "utf8");
}
```

Same pattern as `omp-makora-provider/index.ts:68` (`loadJson`). The prompts instruct the LLM to return ONLY a JSON object on the last line, with the exact schema specified in the prompt body.

## Implementation Structure — index.ts

The extension entry point is a single `index.ts` file (~450 lines) with this structure:

### Imports

```typescript
import { existsSync, readFileSync } from "node:fs";
import { complete } from "@oh-my-pi/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionCommandContext,
} from "@oh-my-pi/pi-coding-agent";
import type {
  Model,
  Context,
  AssistantMessage,
  Message,
  TextContent,
  ImageContent,
} from "@oh-my-pi/pi-ai";
```

### State Types

```typescript
type Phase = "selecting" | "creating" | "planning" | "shipping" | "verifying" | "reviewing" | "pr";

interface UltramodeState {
  mode: "off" | "on" | "idle";
  beadId: string | null;
  phase: Phase;
  retries: number;
  lastDecision: string | null;
  worktreePath: string | null;
}
```

### Decision Types

```typescript
interface SelectionDecision {
  action: "select" | "wait" | "create";
  beadId: string | null;
  reasoning: string;
  createDescription: string | null;
}

interface PhaseDecision {
  action: "proceed" | "reject" | "retry" | "stop";
  reasoning: string;
  nextCommand: string | null;
}
```

### Phase Whitelist

The `PHASE_WHITELIST` maps each phase to its successor command. The terminal case is `pr` which has no successor — the loop stops:

```typescript
const PHASE_WHITELIST: Record<Phase, string | null> = {
  selecting: "/create",
  creating: "/plan",
  planning: "/ship",
  shipping: "/verify",
  verifying: "/review",
  reviewing: "/pr",
  pr: null, // terminal — loop stops, human merges
};
```

The `PHASE_FROM_COMMAND` reverse-maps a command to the resulting phase:

```typescript
const PHASE_FROM_COMMAND: Record<string, Phase> = {
  "/create": "creating",
  "/plan": "planning",
  "/ship": "shipping",
  "/verify": "verifying",
  "/review": "reviewing",
  "/pr": "pr",
};
```

### Helper Functions

1. **`loadPrompt(name: string): string`** — loads prompt templates from `./prompts/` via `import.meta.url`

2. **`extractText(message: AgentMessage): string`** — extracts text content from an AgentMessage's content blocks, handling both string content and TextContent arrays

3. **`parseDecision(text: string, allowedActions: string[]): { action: string; [key: string]: unknown } | null`** — extracts first `{...}` block via regex, JSON.parse, validates `action` field. Returns null on failure.

4. **`checkArtifact(beadId: string, filename: string): { exists: boolean; lines: number }`** — checks if an artifact file exists and counts its lines (pattern from workflow-gate.ts:52-60)

5. **`buildArtifactStatus(beadId: string): string`** — builds a summary string of all artifact files for the decision prompt

6. **`decide(ctx: ExtensionContext, promptText: string): Promise<string>`** — the LLM call helper using `complete()` from pi-ai

### Event Handlers

1. **`session_start` handler**: reconstructs state, runs selection if active, shows loaded notification

2. **`turn_end` handler**: the core decision loop — extracts last output, builds prompt, calls `decide()`, parses decision, acts on it

3. **`tool_call` handler**: scope enforcement — blocks edits outside worktree when active

### Command Handler

The `/ultramode` command handler dispatches to `on`, `off`, `status`, `continue` subcommands.

## Critical files & anchors

1. **`index.ts`** (NEW) — the extension entry point. ~400-500 lines. Default export factory function `(pi: ExtensionAPI) => void`. Contains: state management, `decide()` helper, `runSelection()`, event handlers, command handler, prompt loading.

2. **`~/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/dist/types/extensibility/extensions/types.d.ts`** — the authoritative API surface. `ExtensionContext` at line 202 (has `model`, `modelRegistry`, `sessionManager`, `ui`, `cwd` — NO `session`). `ExtensionAPI` at line 599 (has `sendUserMessage`, `appendEntry`, `exec`, `registerCommand`, `on`). `ExtensionHandler` at line 595 confirms `(event, ctx) => ...` signature.

3. **`~/.bun/install/global/node_modules/@oh-my-pi/pi-ai/dist/types/stream.d.ts:30`** — `complete()` function signature: `complete(model, context, options?) => Promise<AssistantMessage>`. This replaces the PRD's `runEphemeralTurn`.

4. **`~/.omp/plugin-src/pi-honcho-memory/extensions/index.ts`** — reference extension using `(_event, ctx) =>` handler signature, `ExtensionAPI` import, event registration patterns. Confirms `ctx` is the second argument.

5. **`.omp/extensions/workflow-gate.ts`** — reference for `pi.exec("br", [...])` pattern, `existsSync`/`readFileSync` for artifact checks, `tool_call` handler returning `{ block: true, reason }`.

## Wave Structure

### Wave 1: Scaffold (Steps 1-2)

Create `package.json`, `prompts/selection-prompt.md`, `prompts/decision-prompt.md`, `README.md`. These have no dependencies on each other.

Verification: `test -f package.json && test -f prompts/decision-prompt.md && test -f prompts/selection-prompt.md && test -f README.md`

### Wave 2: Core implementation (Steps 3-6)

Create `index.ts` with all helpers, event handlers, and command handler. This is a single file — no dependencies between sub-steps beyond the logical order of function definitions.

Verification: `bun build index.ts --no-bundle` (type-check without bundling)

### Wave 3: Verification (Steps 7-9)

Run all verification checks from the plan. No code changes in this wave — only verification.

## Verification

### 1. Package structure (in repo root after implementation)
```bash
test -f package.json && jq -e '.omp.extensions[0] == "./index.ts"' package.json
test -f index.ts && grep -q 'export default function' index.ts
test -f prompts/decision-prompt.md
test -f prompts/selection-prompt.md
test -f README.md
```

### 2. No `/close` injection (the RULE #6 guard)
```bash
# The only allowed "close" strings are in README usage docs, not in index.ts command injection paths
grep -n 'sendUserMessage' index.ts  # Every call must use the phase whitelist
grep -n '/close' index.ts  # Must return zero matches in injection paths
```
The `nextPhase` map in index.ts must have terminal case `pr → idle` with no `/close` entry.

### 3. LLM decision call uses `complete()`, not `runEphemeralTurn`
```bash
grep -n 'runEphemeralTurn' index.ts  # Must return zero — the method is not accessible
grep -n 'from "@oh-my-pi/pi-ai"' index.ts  # Must show: import { complete }
grep -n 'complete(' index.ts  # Must show the decide() helper calling complete()
```

### 4. Extension loads and `/ultramode status` works
Install in the ultramode repo itself (it has `.beads/` and `.omp/`):
```bash
# From the ultramode repo, run omp and check the extension loads
omp -p "echo test"
# Then interactively:
/ultramode status
# Expected output: mode=off, beadId=none, phase=none, retries=0
```

### 5. Decision agent end-to-end (the core behavior)
Create a trivial test bead, turn on the loop, and verify the LLM is called and a phase command is injected:
```bash
# Create a minimal bead with a PRD (>=600 lines for workflow-gate)
# Then:
/ultramode on
# Expected: extension calls bv + br via pi.exec, calls complete() with selection prompt,
# selects the test bead, claims it via br update --claim, injects "/create <bead-id>" via sendUserMessage
# Verify the decision was LLM-driven:
grep -n 'complete(' index.ts  # confirms the call path
# Check session log for "ultramode-control" custom entries confirming state persistence
```

### 6. Retry cap and blocked handling
```bash
# Simulate: a bead whose /ship fails. After 3 retries:
br show <bead-id> --json | jq '.status'  # Must be "blocked"
br show <bead-id> --json | jq '.notes'   # Must contain "ultramode:"
```

### 7. State persistence across restart
```bash
/ultramode on
# Kill omp (Ctrl+C)
# Restart omp in the same project
/ultramode status  # Must show mode=on (reconstructed from session journal)
```

## Risk Mitigation

### Risk 1: `complete()` API key resolution fails for some providers

**Mitigation:** The `decide()` helper tries `complete()` first. If it throws an error related to API key resolution (type mismatch), fall back to `completeSimple()` which accepts `ApiKey` (string or resolver function). The catch block in `decide()` checks the error message for "apiKey" or "Api" and retries with `completeSimple()`.

```typescript
async function decide(ctx: ExtensionContext, promptText: string): Promise<string> {
  const model = ctx.model;
  if (!model) throw new Error("ultramode: no active model on session");

  const apiKey = await ctx.modelRegistry.getApiKey(model, undefined);
  if (!apiKey) throw new Error(`ultramode: no API key for ${model.provider}/${model.id}`);

  const context: Context = {
    systemPrompt: ["You are a senior staff engineer managing an autonomous development loop. Return ONLY valid JSON."],
    messages: [{ role: "user", content: promptText, timestamp: Date.now() } as Message],
  };

  let result: AssistantMessage;
  try {
    result = await complete(model, context, { apiKey });
  } catch (err) {
    // Fallback for providers that require ApiKeyResolver instead of static string
    const { completeSimple } = await import("@oh-my-pi/pi-ai");
    result = await completeSimple(model, context, { apiKey });
  }

  const text = result.content
    .filter((b): b is TextContent => b.type === "text")
    .map(b => b.text)
    .join("");
  return text;
}
```

### Risk 2: `sendUserMessage` re-entrancy deadlock

**Mitigation:** Use `deliverAs: "followUp"` which queues the message for delivery after the current turn completes. If this still deadlocks, wrap in `queueMicrotask`:

```typescript
queueMicrotask(() => {
  pi.sendUserMessage(command, { deliverAs: "followUp" });
});
```

The autoresearch extension uses `api.sendUserMessage(content)` directly (without `followUp`) from command handlers — but command handlers run in a different context than `turn_end` handlers. For `turn_end`, `followUp` is the safe choice.

### Risk 3: `ctx.model` is undefined when decision is needed

**Mitigation:** The `turn_end` handler catches the "no active model" error from `decide()`, notifies the user, and sets `state.mode = "idle"`. The README documents that a reasoning-capable model must be configured.

### Risk 4: `br scheduler --json` returns zero recommendations

**Mitigation:** Fall back to `br list --status open --status in_progress --json`. If both are empty, the LLM decision returns `{"action": "wait"}` and the loop idles.

```typescript
async function runSelection(ctx: ExtensionContext, pi: ExtensionAPI): Promise<void> {
  const triageResult = await pi.exec("bv", ["--robot-triage", "--format", "json"]);
  const triageJson = triageResult.code === 0 ? triageResult.stdout : "{}";

  const schedResult = await pi.exec("br", ["scheduler", "--json"]);
  let schedulerJson = schedResult.code === 0 ? schedResult.stdout : "{}";

  // Fallback: if scheduler has no recommendations, use br list
  const parsed = JSON.parse(schedulerJson);
  if (!parsed.recommendations || parsed.recommendations.length === 0) {
    const listResult = await pi.exec("br", ["list", "--status", "open", "--status", "in_progress", "--json"]);
    schedulerJson = listResult.code === 0 ? listResult.stdout : "{}";
  }

  // ... build prompt and call decide()
}
```

### Risk 5: LLM returns invalid JSON

**Mitigation:** The `parseDecision()` helper extracts the first `{...}` block via regex before parsing. If extraction or parsing fails, the handler returns a "stop" decision and notifies the user:

```typescript
function parseDecision<T extends { action: string }>(
  text: string,
  allowedActions: string[]
): T | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]) as T;
    if (!allowedActions.includes(parsed.action)) return null;
    return parsed;
  } catch {
    return null;
  }
}
```

## Assumptions & contingencies

- **`complete()` with a bare `apiKey` string works for all providers.** Verified: `StreamOptions.apiKey: string` (`types.d.ts:144`). If a provider requires an `ApiKeyResolver` instead of a static string, `completeSimple()` accepts `apiKey?: ApiKey` which includes resolver functions (`types.d.ts:262`). Fallback: use `completeSimple()` instead of `complete()` — it accepts the same `Context` but uses `SimpleStreamOptions` which supports `ApiKey` (string or resolver). The `decide()` helper should try `complete()` first, and if the model's API requires a resolver, switch to `completeSimple()`.

- **`pi.sendUserMessage` with `deliverAs: "followUp"` avoids re-entrancy deadlock.** The `turn_end` handler is called while the agent is still unwinding the turn. Calling `sendUserMessage` synchronously could re-enter the agent loop. `followUp` queues the message for delivery after the current turn completes. If this still deadlocks (the PRD's Risk #2), fallback: `queueMicrotask(() => pi.sendUserMessage(cmd, { deliverAs: "followUp" }))` to break the stack frame. The honcho extension (`pi-honcho-memory/extensions/index.ts`) uses `(_event, ctx) =>` handlers without deadlock, suggesting the runtime handles this.

- **`ctx.model` is set when the extension needs to make a decision.** If `ctx.model` is undefined (no model configured), `decide()` throws "no active model on session" — the `turn_end` handler catches this, notifies the user via `ctx.ui.notify("ultramode: no model configured", "error")`, and sets `state.mode = "idle"`. The extension cannot override model selection — that's the user's responsibility (documented in README).

- **`br scheduler --json` may return zero recommendations** when no beads are ready (verified: current output shows `candidate_count: 0`). The selection handler falls back to `br list --status open --status in_progress --json` and lets the LLM decide from the full open list. If both are empty, the decision returns `{"action": "wait"}` and the loop idles.

- **The `ultramode-fpj` bead itself is currently `in_progress`** (verified via `br list`). The extension's selection logic will encounter it. Since its PRD/plan already exist, the extension should resume from the appropriate phase. The decision prompt includes artifact existence checks so the LLM can determine the current phase from what artifacts exist.

## State Machine Diagram

```
                  ┌─────────────┐
                  │   off       │ ← initial state
                  └──────┬──────┘
                         │ /ultramode on
                         ▼
                  ┌─────────────┐
                  │  selecting  │ ─── bv + br triage ──→ LLM decision
                  └──────┬──────┘
                         │ select bead
                         ▼
                  ┌─────────────┐
                  │  creating   │ ─── /create ──→ turn_end ──→ LLM decision
                  └──────┬──────┘
                         │ proceed
                         ▼
                  ┌─────────────┐
                  │  planning   │ ─── /plan ──→ turn_end ──→ LLM decision
                  └──────┬──────┘
                         │ proceed
                         ▼
                  ┌─────────────┐
                  │  shipping   │ ─── /ship ──→ turn_end ──→ LLM decision
                  └──────┬──────┘
                         │ proceed
                         ▼
                  ┌─────────────┐
                  │  verifying  │ ─── /verify ──→ turn_end ──→ LLM decision
                  └──────┬──────┘
                         │ proceed
                         ▼
                  ┌─────────────┐
                  │  reviewing  │ ─── /review ──→ turn_end ──→ LLM decision
                  └──────┬──────┘
                         │ proceed
                         ▼
                  ┌─────────────┐
                  │  pr         │ ─── /pr ──→ turn_end ──→ LLM decision: stop
                  └──────┬──────┘
                         │ stop (human merges)
                         ▼
                  ┌─────────────┐
                  │  idle       │ ─── /ultramode continue ──→ selecting
                  └─────────────┘

  At any phase: retry (re-inject current command, retries < 3)
                reject (mark blocked, go to selecting)
                error (set idle, notify)
```

## API Surface Verification Summary

All API surfaces verified against actual type definitions:

| API | Location | Verified Signature |
|-----|----------|-------------------|
| `ExtensionContext.model` | types.d.ts:218 | `model: Model \| undefined` |
| `ExtensionContext.modelRegistry` | types.d.ts:216 | `modelRegistry: ModelRegistry` |
| `ExtensionContext.sessionManager` | types.d.ts:214 | `sessionManager: ReadonlySessionManager` |
| `ExtensionContext.ui` | types.d.ts:204 | `ui: ExtensionUIContext` |
| `ExtensionContext.cwd` | types.d.ts:212 | `cwd: string` |
| `ExtensionAPI.on` | types.d.ts:609-648 | `on(event, handler)` |
| `ExtensionAPI.sendUserMessage` | types.d.ts:688 | `sendUserMessage(content, options?: { deliverAs? })` |
| `ExtensionAPI.appendEntry` | types.d.ts:692 | `appendEntry<T>(customType, data?: T): void` |
| `ExtensionAPI.exec` | types.d.ts:694 | `exec(cmd, args[], options?): Promise<ExecResult>` |
| `ExtensionAPI.registerCommand` | types.d.ts:652 | `registerCommand(name, { handler })` |
| `ModelRegistry.getApiKey` | model-registry.d.ts:158 | `getApiKey(model, sessionId?): Promise<string \| undefined>` |
| `complete()` | pi-ai/stream.d.ts:30 | `complete(model, context, options?): Promise<AssistantMessage>` |
| `completeSimple()` | pi-ai/stream.d.ts:32 | `completeSimple(model, context, options?): Promise<AssistantMessage>` |
| `SessionManager.getBranch()` | session-manager.d.ts:201 | `getBranch(fromId?): SessionEntry[]` |
| `ExtensionUIContext.notify` | types.d.ts:102 | `notify(message, type?: "info"\|"warning"\|"error"): void` |
| `ExtensionUIContext.setWidget` | types.d.ts:110 | `setWidget(key, content, options?): void` |
| `ExtensionUIContext.setStatus` | types.d.ts:106 | `setStatus(key, text \| undefined): void` |
| `TurnEndEvent` | shared-events.d.ts:153 | `{ type, turnIndex, message: AgentMessage, toolResults }` |
| `ToolCallEventResult` | shared-events.d.ts:207 | `{ block?: boolean; reason?: string }` |
| `CustomEntry` | session-entries.d.ts:77 | `{ type: "custom"; customType: string; data?: T }` |
| `ExtensionCommandContext` | types.d.ts:238 | extends ExtensionContext + `waitForIdle()` |
