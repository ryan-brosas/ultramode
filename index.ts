// ultramode — autonomous senior-engineer loop extension for OMP
//
// Drives the beads workflow (/create → /plan → /ship → /verify → /review → /pr)
// via LLM decisions and sendUserMessage phase chaining. Stops at /pr — the
// human merges. Never runs the merge-phase command.

import { existsSync, readFileSync } from "node:fs";
import { complete, completeSimple } from "@oh-my-pi/pi-ai";
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
} from "@oh-my-pi/pi-ai";

// ─── Types ──────────────────────────────────────────────────────────────────

export type Phase =
  | "selecting"
  | "creating"
  | "planning"
  | "shipping"
  | "verifying"
  | "reviewing"
  | "pr";

export interface UltramodeState {
  mode: "off" | "on" | "idle";
  beadId: string | null;
  phase: Phase;
  retries: number;
  lastDecision: string | null;
  worktreePath: string | null;
}

export interface SelectionDecision {
  action: "select" | "wait" | "create";
  beadId: string | null;
  reasoning: string;
  createDescription: string | null;
}

export interface PhaseDecision {
  action: "proceed" | "reject" | "retry" | "stop";
  reasoning: string;
  nextCommand: string | null;
}

// ─── Phase Whitelist ─────────────────────────────────────────────────────────

// Maps each phase to the command that transitions out of it.
// Terminal case is `pr` → null (loop stops, human merges).
export const PHASE_WHITELIST: Record<Phase, string | null> = {
  selecting: "/create",
  creating: "/plan",
  planning: "/ship",
  shipping: "/verify",
  verifying: "/review",
  reviewing: "/pr",
  pr: null,
};

// Reverse map: command → resulting phase.
export const PHASE_FROM_COMMAND: Record<string, Phase> = {
  "/create": "creating",
  "/plan": "planning",
  "/ship": "shipping",
  "/verify": "verifying",
  "/review": "reviewing",
  "/pr": "pr",
};

export const ALLOWED_PHASE_COMMANDS = new Set([
  "/create",
  "/plan",
  "/ship",
  "/verify",
  "/review",
  "/pr",
]);
export const VALID_PHASES = new Set<Phase>([
  "selecting",
  "creating",
  "planning",
  "shipping",
  "verifying",
  "reviewing",
  "pr",
]);

// Reverse of PHASE_FROM_COMMAND: maps a phase to the command that started it.
// Used by the retry path to re-inject the current phase's command.
// (PHASE_WHITELIST maps phase → next command, which is the wrong direction for retries.)
export const COMMAND_FROM_PHASE: Record<Phase, string | null> = {
  selecting: null,
  creating: "/create",
  planning: "/plan",
  shipping: "/ship",
  verifying: "/verify",
  reviewing: "/review",
  pr: "/pr",
};

export const MAX_RETRIES = 3;
export const DECISION_TIMEOUT_MS = 120_000; // 2 minutes — hung LLM recovery

// ─── State Helpers ───────────────────────────────────────────────────────────

export const CONTROL_TYPE = "ultramode-control";

export function createState(): UltramodeState {
  return {
    mode: "off",
    beadId: null,
    phase: "selecting",
    retries: 0,
    lastDecision: null,
    worktreePath: null,
  };
}

// Per-session in-memory state. Keyed by session ID so multiple sessions
// don't collide.
const sessionStates = new Map<string, UltramodeState>();

export function getState(ctx: ExtensionContext): UltramodeState {
  const key = ctx.sessionManager.getSessionId();
  let state = sessionStates.get(key);
  if (!state) {
    state = createState();
    sessionStates.set(key, state);
  }
  return state;
}

function persistState(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: UltramodeState
): void {
  pi.appendEntry(CONTROL_TYPE, { ...state });
}

// Reconstruct state from the session journal by scanning for the last
// ultramode-control custom entry. Same pattern as autoresearch's
// reconstructControlState (autoresearch/state.ts:220).
export function reconstructState(ctx: ExtensionContext): UltramodeState {
  const entries = ctx.sessionManager.getBranch();
  let reconstructed = createState();
  for (const entry of entries) {
    if (entry.type !== "custom" || entry.customType !== CONTROL_TYPE) continue;
    const data = entry.data as Record<string, unknown> | undefined;
    if (!data || typeof data !== "object") continue;
    const candidate = data as Partial<UltramodeState>;
    if (
      candidate.mode !== "off" &&
      candidate.mode !== "on" &&
      candidate.mode !== "idle"
    )
      continue;
    reconstructed = {
      mode: candidate.mode,
      beadId: typeof candidate.beadId === "string" ? candidate.beadId : null,
      phase: VALID_PHASES.has(candidate.phase as Phase)
        ? (candidate.phase as Phase)
        : "selecting",
      retries: typeof candidate.retries === "number" ? candidate.retries : 0,
      lastDecision:
        typeof candidate.lastDecision === "string"
          ? candidate.lastDecision
          : null,
      worktreePath:
        typeof candidate.worktreePath === "string"
          ? candidate.worktreePath
          : null,
    };
  }
  return reconstructed;
}

// ─── Prompt Loading ──────────────────────────────────────────────────────────

function loadPrompt(name: string): string {
  return readFileSync(
    new URL(`./prompts/${name}.md`, import.meta.url),
    "utf8"
  );
}

function fillTemplate(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

// ─── Text Extraction ─────────────────────────────────────────────────────────

// Extract text from an AgentMessage's content blocks.
// AgentMessage.content can be a string or an array of content blocks.
export function extractText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (block): block is { type: "text"; text: string } =>
          Boolean(block) &&
          typeof block === "object" &&
          (block as { type?: unknown }).type === "text" &&
          typeof (block as { text?: unknown }).text === "string"
      )
      .map((block) => block.text)
      .join("");
  }
  return "";
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "\n... [truncated]";
}

// ─── Decision Parsing ────────────────────────────────────────────────────────

// Extract the last balanced {...} block, JSON.parse, validate the action
// field is in the allowed set. Returns null on failure.
export function parseDecision<T extends { action: string }>(
  text: string,
  allowedActions: string[]
): T | null {
  // Scan backward from the last `}` to find a balanced JSON object.
  // This handles LLM output that contains braces in prose or multiple
  // JSON objects — the greedy regex /\{[\s\S]*\}/ would capture from the
  // first `{` to the last `}`, producing invalid JSON.
  let depth = 0;
  let end = -1;
  let start = -1;
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === "}") {
      if (depth === 0) end = i;
      depth++;
    } else if (text[i] === "{") {
      depth--;
      if (depth === 0 && end !== -1) {
        start = i;
        break;
      }
    }
  }
  if (start === -1 || end === -1) return null;
  const candidate = text.slice(start, end + 1);
  try {
    const parsed = JSON.parse(candidate) as T;
    if (!allowedActions.includes(parsed.action)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ─── Artifact Checking ───────────────────────────────────────────────────────

interface ArtifactInfo {
  exists: boolean;
  lines: number;
}

function checkArtifact(beadId: string, filename: string): ArtifactInfo {
  const path = `.beads/artifacts/${beadId}/${filename}`;
  if (!existsSync(path)) return { exists: false, lines: 0 };
  try {
    const content = readFileSync(path, "utf8");
    return { exists: true, lines: content.split("\n").length };
  } catch {
    return { exists: false, lines: 0 };
  }
}

function buildArtifactStatus(beadId: string | null): string {
  if (!beadId) return "No active bead";
  const artifacts = [
    { file: "prd.md", label: "PRD" },
    { file: "plan.md", label: "Plan" },
    { file: "tasks.md", label: "Tasks" },
    { file: "completion-evidence.json", label: "Evidence" },
    { file: "review-report.md", label: "Review" },
  ];
  const lines = artifacts.map(({ file, label }) => {
    const info = checkArtifact(beadId, file);
    return `- ${label} (${file}): ${info.exists ? `${info.lines} lines` : "missing"}`;
  });
  return lines.join("\n");
}

// ─── Widget ──────────────────────────────────────────────────────────────────

function updateWidget(ctx: ExtensionContext, state: UltramodeState): void {
  const line = `ultramode: ${state.mode} | bead: ${state.beadId ?? "none"} | phase: ${state.phase} | retries: ${state.retries}`;
  try {
    ctx.ui.setWidget("ultramode", [line]);
  } catch {
    // setWidget may not be available in print/RPC mode — fall back silently
    try {
      ctx.ui.setStatus("ultramode", line);
    } catch {
      // no-op
    }
  }
}

// ─── LLM Decision Call ───────────────────────────────────────────────────────

// The load-bearing function: calls complete() from @oh-my-pi/pi-ai.
// This replaces the PRD's inaccessible session method (which does not exist on
// ExtensionContext or ExtensionAPI).
export async function decide(
  ctx: ExtensionContext,
  promptText: string,
  timeoutMs: number = DECISION_TIMEOUT_MS
): Promise<string> {
  const model = ctx.model;
  if (!model) throw new Error("ultramode: no active model on session");

  const apiKey = await ctx.modelRegistry.getApiKey(model, undefined);
  if (!apiKey)
    throw new Error(
      `ultramode: no API key for ${model.provider}/${model.id}`
    );

  const context: Context = {
    systemPrompt: [
      "You are a senior staff engineer managing an autonomous development loop. Return ONLY valid JSON.",
    ],
    messages: [
      {
        role: "user",
        content: promptText,
        timestamp: Date.now(),
      } as Message,
    ],
  };

  const controller = new AbortController();
  const signal = controller.signal;

  // Race the LLM call against an explicit timeout. The abort signal cancels
  // the underlying HTTP request in production (defense-in-depth), but we can't
  // rely on the provider honoring it — Promise.race guarantees decide()
  // returns even if the mock or a misbehaving provider ignores the signal.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`ultramode: LLM decision timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  async function callLLM(): Promise<AssistantMessage> {
    try {
      return await complete(model, context, { apiKey, signal });
    } catch (err) {
      if (signal.aborted) throw err; // timeout already fired — don't retry
      return await completeSimple(model, context, { apiKey, signal });
    }
  }

  try {
    const result = await Promise.race([callLLM(), timeout]);
    const text = result.content
      .filter((b): b is TextContent => b.type === "text")
      .map((b) => b.text)
      .join("");
    return text;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ─── Work Selection ───────────────────────────────────────────────────────────

export async function runSelection(
  pi: ExtensionAPI,
  ctx: ExtensionContext
): Promise<void> {
  const state = getState(ctx);

  // 1. bv triage
  let triageJson = "{}";
  try {
    const triageResult = await pi.exec("bv", [
      "--robot-triage",
      "--format",
      "json",
    ]);
    if (triageResult.code === 0 && triageResult.stdout) {
      triageJson = triageResult.stdout;
    }
  } catch {
    // bv unavailable — proceed with empty triage
  }

  // 2. br scheduler (fallback to br list)
  let schedulerJson = "{}";
  try {
    const schedResult = await pi.exec("br", ["scheduler", "--json"]);
    if (schedResult.code === 0 && schedResult.stdout) {
      schedulerJson = schedResult.stdout;
    }
    // Fallback: if scheduler has no recommendations, use br list
    let hasRecommendations = false;
    try {
      const parsed = JSON.parse(schedulerJson) as {
        recommendations?: unknown[];
      };
      hasRecommendations =
        Array.isArray(parsed.recommendations) &&
        parsed.recommendations.length > 0;
    } catch {
      // parse error — treat as empty
    }
    if (!hasRecommendations) {
      const listResult = await pi.exec("br", [
        "list",
        "--status",
        "open",
        "--status",
        "in_progress",
        "--json",
      ]);
      if (listResult.code === 0 && listResult.stdout) {
        schedulerJson = listResult.stdout;
      }
    }
  } catch {
    // br unavailable — proceed with empty scheduler
  }

  // 3. Build selection prompt
  const template = loadPrompt("selection-prompt");
  const prompt = fillTemplate(template, {
    bv_triage_json: triageJson,
    br_scheduler_json: schedulerJson,
  });

  // 4. Call LLM
  let decisionText: string;
  try {
    decisionText = await decide(ctx, prompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.ui.notify(`ultramode: selection failed — ${msg}`, "error");
    state.mode = "idle";
    state.lastDecision = `selection error: ${msg}`;
    persistState(pi, ctx, state);
    updateWidget(ctx, state);
    return;
  }

  // 5. Parse decision
  const decision = parseDecision<SelectionDecision>(decisionText, [
    "select",
    "wait",
    "create",
  ]);

  if (!decision) {
    ctx.ui.notify(
      "ultramode: selection decision could not be parsed — idling",
      "warning"
    );
    state.mode = "idle";
    state.lastDecision = "selection parse failure";
    persistState(pi, ctx, state);
    updateWidget(ctx, state);
    return;
  }

  state.lastDecision = decision.reasoning;

  // 6. Act on decision
  if (decision.action === "select" && decision.beadId) {
    // Claim the bead
    try {
      await pi.exec("br", [
        "update",
        decision.beadId,
        "--claim",
        "--actor",
        "ultramode",
        "--json",
      ]);
    } catch {
      // claim failure is non-fatal — proceed anyway
    }
    state.beadId = decision.beadId;
    state.phase = "creating";
    state.retries = 0;
    state.mode = "on";
    persistState(pi, ctx, state);
    updateWidget(ctx, state);
    ctx.ui.notify(
      `ultramode: selected bead ${decision.beadId} — ${decision.reasoning}`,
      "info"
    );
    pi.sendUserMessage(`/create ${decision.beadId}`, {
      deliverAs: "followUp",
    });
  } else if (decision.action === "wait") {
    state.mode = "idle";
    persistState(pi, ctx, state);
    updateWidget(ctx, state);
    ctx.ui.notify(
      `ultramode: no ready work — ${decision.reasoning}`,
      "info"
    );
  } else if (decision.action === "create" && decision.createDescription) {
    state.mode = "on";
    persistState(pi, ctx, state);
    updateWidget(ctx, state);
    ctx.ui.notify(
      `ultramode: creating new bead — ${decision.reasoning}`,
      "info"
    );
    pi.sendUserMessage(`/create ${decision.createDescription}`, {
      deliverAs: "followUp",
    });
  } else {
    ctx.ui.notify(
      "ultramode: selection returned an unrecognized action — idling",
      "warning"
    );
    state.mode = "idle";
    persistState(pi, ctx, state);
    updateWidget(ctx, state);
  }
}

// ─── Phase Chaining ──────────────────────────────────────────────────────────

async function markBlocked(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: UltramodeState,
  reasoning: string
): Promise<void> {
  if (!state.beadId) return;
  try {
    await pi.exec("br", [
      "update",
      state.beadId,
      "--status",
      "blocked",
      "--notes",
      `ultramode: ${reasoning}`,
      "--actor",
      "ultramode",
      "--json",
    ]);
  } catch {
    // non-fatal
  }
  ctx.ui.notify(
    `ultramode: bead ${state.beadId} marked blocked — ${reasoning}`,
    "warning"
  );
}

export async function handleTurnEnd(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  message: any
): Promise<void> {
  const state = getState(ctx);
  if (state.mode !== "on") return;

  // Extract last assistant output
  const lastOutput = truncate(extractText(message), 2000);

  // Build artifact status
  const artifactStatus = buildArtifactStatus(state.beadId);

  // Fetch bv triage for context (cached-ish — re-fetch each decision)
  let triageJson = "{}";
  try {
    const triageResult = await pi.exec("bv", [
      "--robot-triage",
      "--format",
      "json",
    ]);
    if (triageResult.code === 0 && triageResult.stdout) {
      triageJson = triageResult.stdout;
    }
  } catch {
    // non-fatal
  }

  // Build decision prompt
  const template = loadPrompt("decision-prompt");
  const prompt = fillTemplate(template, {
    bead_id: state.beadId ?? "none",
    phase: state.phase,
    retries: String(state.retries),
    bv_triage_json: triageJson,
    last_output: lastOutput,
    artifact_status: artifactStatus,
  });

  // Call LLM
  let decisionText: string;
  try {
    decisionText = await decide(ctx, prompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.ui.notify(`ultramode: decision failed — ${msg}`, "error");
    state.mode = "idle";
    state.lastDecision = `decision error: ${msg}`;
    persistState(pi, ctx, state);
    updateWidget(ctx, state);
    return;
  }

  // Parse decision
  const decision = parseDecision<PhaseDecision>(decisionText, [
    "proceed",
    "reject",
    "retry",
    "stop",
  ]);

  if (!decision) {
    ctx.ui.notify(
      "ultramode: decision could not be parsed — idling",
      "warning"
    );
    state.mode = "idle";
    state.lastDecision = "decision parse failure";
    persistState(pi, ctx, state);
    updateWidget(ctx, state);
    return;
  }

  state.lastDecision = decision.reasoning;

  // Act on decision
  if (decision.action === "proceed") {
    if (
      !decision.nextCommand ||
      typeof decision.nextCommand !== "string"
    ) {
      ctx.ui.notify(
        "ultramode: proceed without nextCommand — idling",
        "warning"
      );
      state.mode = "idle";
      persistState(pi, ctx, state);
      updateWidget(ctx, state);
      return;
    }

    // Extract the command prefix (e.g. "/plan" from "/plan bead-id")
    const cmdParts = decision.nextCommand.trim().split(/\s+/);
    const cmdPrefix = cmdParts[0];

    if (!cmdPrefix || !ALLOWED_PHASE_COMMANDS.has(cmdPrefix)) {
      ctx.ui.notify(
        `ultramode: nextCommand "${cmdPrefix}" not in whitelist — idling`,
        "warning"
      );
      state.mode = "idle";
      persistState(pi, ctx, state);
      updateWidget(ctx, state);
      return;
    }

    // Enforce sequential phase progression — reject out-of-sequence commands.
    // The LLM is instructed on correct sequencing in the prompt; this is the
    // hard enforcement so a single confused decision can't skip phases.
    const expectedCmd = PHASE_WHITELIST[state.phase];
    if (expectedCmd === null) {
      ctx.ui.notify(
        `ultramode: already at terminal phase (pr) — cannot proceed further. Idling.`,
        "warning"
      );
      state.mode = "idle";
      persistState(pi, ctx, state);
      updateWidget(ctx, state);
      return;
    }
    if (cmdPrefix !== expectedCmd) {
      ctx.ui.notify(
        `ultramode: nextCommand "${cmdPrefix}" does not match expected "${expectedCmd}" for phase "${state.phase}" — idling`,
        "warning"
      );
      state.mode = "idle";
      persistState(pi, ctx, state);
      updateWidget(ctx, state);
      return;
    }

    // Update phase based on the command being injected
    const newPhase = PHASE_FROM_COMMAND[cmdPrefix];
    if (newPhase) {
      state.phase = newPhase;
    }
    state.retries = 0;
    persistState(pi, ctx, state);
    updateWidget(ctx, state);

    // Use the beadId from state if the command doesn't include one,
    // otherwise pass through the full nextCommand
    const fullCommand =
      cmdParts.length > 1
        ? decision.nextCommand
        : `${cmdPrefix} ${state.beadId ?? ""}`.trim();

    ctx.ui.notify(
      `ultramode: proceeding — ${decision.reasoning}`,
      "info"
    );
    pi.sendUserMessage(fullCommand, { deliverAs: "followUp" });
  } else if (decision.action === "retry") {
    if (state.retries < MAX_RETRIES) {
      state.retries++;
      persistState(pi, ctx, state);
      updateWidget(ctx, state);
      ctx.ui.notify(
        `ultramode: retry ${state.retries}/${MAX_RETRIES} — ${decision.reasoning}`,
        "info"
      );
      // PHASE_WHITELIST maps phase → next command (wrong direction for retry).
      // COMMAND_FROM_PHASE maps phase → the command that started it.
      const currentCmd = COMMAND_FROM_PHASE[state.phase];
      if (currentCmd && state.beadId) {
        pi.sendUserMessage(`${currentCmd} ${state.beadId}`, {
          deliverAs: "followUp",
        });
      } else {
        // Can't re-inject (no command for this phase, or no beadId).
        // Reset to selection rather than getting stuck with mode=on but no turn.
        ctx.ui.notify(
          "ultramode: cannot retry current phase — resetting to selection",
          "warning"
        );
        state.beadId = null;
        state.phase = "selecting";
        state.retries = 0;
        persistState(pi, ctx, state);
        updateWidget(ctx, state);
        await runSelection(pi, ctx);
      }
    } else {
      // Retries exhausted — mark blocked, pick next
      await markBlocked(pi, ctx, state, decision.reasoning);
      state.beadId = null;
      state.phase = "selecting";
      state.retries = 0;
      persistState(pi, ctx, state);
      updateWidget(ctx, state);
      await runSelection(pi, ctx);
    }
  } else if (decision.action === "reject") {
    await markBlocked(pi, ctx, state, decision.reasoning);
    state.beadId = null;
    state.phase = "selecting";
    state.retries = 0;
    persistState(pi, ctx, state);
    updateWidget(ctx, state);
    await runSelection(pi, ctx);
  } else if (decision.action === "stop") {
    if (state.phase === "pr") {
      ctx.ui.notify(
        "ultramode: PR created — waiting for human merge. Run /ultramode continue after merge.",
        "info"
      );
    } else {
      ctx.ui.notify(
        `ultramode: stopping — ${decision.reasoning}`,
        "info"
      );
    }
    state.mode = "idle";
    persistState(pi, ctx, state);
    updateWidget(ctx, state);
  }
}

// ─── Extension Factory ────────────────────────────────────────────────────────

export default function ultramode(pi: ExtensionAPI): void {
  // session_start: reconstruct state, run selection if active
  pi.on("session_start", (_event, ctx) => {
    const state = reconstructState(ctx);
    sessionStates.set(ctx.sessionManager.getSessionId(), state);
    updateWidget(ctx, state);
    ctx.ui.notify("ultramode loaded", "info");

    if (state.mode === "on") {
      // Fire-and-forget — don't block session start
      void runSelection(pi, ctx);
    }
  });

  // turn_end: the core decision loop
  pi.on(
    "turn_end",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (event: any, ctx: ExtensionContext) => {
      // Only act if mode is on
      const state = getState(ctx);
      if (state.mode !== "on") return;

      // Skip if there are pending messages (e.g. a queued followUp)
      // to avoid racing with our own injected commands
      if (typeof ctx.hasPendingMessages === "function" && ctx.hasPendingMessages()) {
        return;
      }

      try {
        await handleTurnEnd(pi, ctx, event.message);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`ultramode: turn_end error — ${msg}`, "error");
        state.mode = "idle";
        state.lastDecision = `turn_end error: ${msg}`;
        persistState(pi, ctx, state);
        updateWidget(ctx, state);
      }
    }
  );

  // tool_call: scope enforcement — block edits outside worktree when active
  pi.on(
    "tool_call",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any, ctx: ExtensionContext) => {
      const state = getState(ctx);

      // Only enforce when worktreePath is set
      if (!state.worktreePath) return;

      const toolName = event.toolName;
      if (toolName !== "edit" && toolName !== "write") return;

      const path =
        typeof event.input?.path === "string" ? event.input.path : null;
      if (!path) return;

      // Always allow .beads/ and .omp/
      if (
        path === ".omp" ||
        path === ".beads" ||
        path.startsWith(".omp/") ||
        path.startsWith(".beads/")
      ) {
        return;
      }

      // Block paths outside the worktree
      if (!path.startsWith(state.worktreePath)) {
        return {
          block: true,
          reason: `ultramode: scope violation — path "${path}" is outside the active worktree "${state.worktreePath}"`,
        };
      }

      return undefined;
    }
  );

  // /ultramode control command
  pi.registerCommand("ultramode", {
    description: "Control the ultramode autonomous loop (on|off|status|continue)",
    async handler(args: string, ctx: ExtensionCommandContext): Promise<void> {
      const subcommand = args.trim().split(/\s+/)[0] || "status";
      const state = getState(ctx);

      switch (subcommand) {
        case "on": {
          state.mode = "on";
          if (!state.beadId) {
            state.phase = "selecting";
            state.retries = 0;
          }
          persistState(pi, ctx, state);
          updateWidget(ctx, state);
          ctx.ui.notify("ultramode: autonomous loop activated", "info");
          if (!state.beadId) {
            await runSelection(pi, ctx);
          }
          break;
        }
        case "off": {
          state.mode = "off";
          persistState(pi, ctx, state);
          updateWidget(ctx, state);
          ctx.ui.notify("ultramode: autonomous loop deactivated", "info");
          break;
        }
        case "status": {
          const lines = [
            `ultramode status:`,
            `  mode: ${state.mode}`,
            `  bead: ${state.beadId ?? "none"}`,
            `  phase: ${state.phase}`,
            `  retries: ${state.retries}/${MAX_RETRIES}`,
            `  last decision: ${state.lastDecision ?? "none"}`,
            `  worktree: ${state.worktreePath ?? "none"}`,
          ];
          ctx.ui.notify(lines.join("\n"), "info");
          break;
        }
        case "continue": {
          state.mode = "on";
          state.beadId = null;
          state.phase = "selecting";
          state.retries = 0;
          state.lastDecision = null;
          persistState(pi, ctx, state);
          updateWidget(ctx, state);
          ctx.ui.notify(
            "ultramode: continuing — selecting next bead",
            "info"
          );
          await runSelection(pi, ctx);
          break;
        }
        default: {
          ctx.ui.notify(
            `ultramode: unknown subcommand "${subcommand}". Use: on, off, status, continue`,
            "warning"
          );
        }
      }
    },
  });
}
