// ultramode — autonomous senior-engineer loop extension for OMP
//
// Drives the beads workflow (/create → /plan → /ship → /verify → /review → /pr)
// via LLM decisions and sendUserMessage phase chaining. Stops at /pr — the
// human merges. Never runs the merge-phase command.

import { existsSync, readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { complete } from "@oh-my-pi/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionCommandContext,
  ExecResult,
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
  | "brainstorming"
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
  /** The last command ultramode injected via sendUserMessage. Used to filter
   * turn_end: only chain after turns that ultramode itself triggered, not
   * after the user's own messages. */
  lastInjectedCommand: string | null;
  /** Feedback from the last retry decision. The LLM's reasoning for why
   * the phase failed. This gets injected into the next attempt so the
   * agent knows what to fix — "PRD is missing Out of Scope section" —
   * instead of blindly re-running the phase. */
  retryFeedback: string | null;
  /** PR URL extracted from /pr output. When set and mode=idle+phase=pr,
   * the merge watcher polls GitHub for merge status and auto-continues
   * when the PR is merged. */
  prUrl: string | null;
  /** Timestamp (Date.now()) of the last decide() call. Used to rate-limit
   * decision calls — if handleTurnEnd fires within DECISION_COOLDOWN_MS of
   * the last decision, skip it. Prevents rapid-fire LLM calls when the
   * agent produces multiple completed turns in quick succession. */
  lastDecisionTime: number | null;
}

export interface SelectionDecision {
  action: "select" | "wait" | "brainstorm";
  beadId: string | null;
  reasoning: string;
  createDescription: string | null;
}

export interface PhaseDecision {
  action: "proceed" | "reject" | "retry" | "stop";
  reasoning: string;
  nextCommand: string | null;
}

/** Structural types for session branch entries. The OMP session journal
 * stores entries with type: "message" containing a message object with
 * role and content — we type only the fields we actually read. */
interface BranchEntry {
  type: string;
  message?: unknown;
}

interface BranchMessageEntry {
  type: "message";
  message: {
    role: string;
    content: string | Array<{ type: string; text?: string }>;
  };
}

// ─── Phase Whitelist ─────────────────────────────────────────────────────────

// Maps each phase to the command that transitions out of it.
export const PHASE_WHITELIST: Record<Phase, string | null> = {
  selecting: "/brainstorm",
  brainstorming: "/create",
  creating: "/plan",
  planning: "/ship",
  shipping: "/verify",
  verifying: "/review",
  reviewing: "/pr",
  pr: null,
};

// Reverse map: command → resulting phase.
export const PHASE_FROM_COMMAND: Record<string, Phase> = {
  "/brainstorm": "brainstorming",
  "/create": "creating",
  "/plan": "planning",
  "/ship": "shipping",
  "/verify": "verifying",
  "/review": "reviewing",
  "/pr": "pr",
};

export const ALLOWED_PHASE_COMMANDS = new Set([
  "/brainstorm",
  "/create",
  "/plan",
  "/ship",
  "/verify",
  "/review",
  "/pr",
]);
export const VALID_PHASES = new Set<Phase>([
  "selecting",
  "brainstorming",
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
  brainstorming: "/brainstorm",
  creating: "/create",
  planning: "/plan",
  shipping: "/ship",
  verifying: "/verify",
  reviewing: "/review",
  pr: "/pr",
};

export const MAX_RETRIES = 3;
export const DECISION_TIMEOUT_MS = 300_000; // 5 minutes — reasoning models like GLM-5.2 need time to think
export const DECISION_COOLDOWN_MS = 60_000; // 1 minute between decide() calls — prevents rapid-fire LLM calls

// Bounded subprocess timeouts. Every pi.exec call must carry a timeout —
// without one, a hung subprocess (corrupt .beads DB, huge repo, network
// stall) leaves the promise pending forever. The fire-and-forget wrappers
// around turn_end/session_start mean a hung exec does not block the agent
// loop, but it holds a process slot, never clears the re-entrancy guards
// (turnEndInProgress/selectionInProgress), and over time accumulates dead
// promises that exhaust the VPS. All timeouts well above observed p99s.
export const EXEC_TIMEOUT_FAST_MS = 10_000; // 10s — bv/br/git status (fast, local)
export const EXEC_TIMEOUT_MED_MS = 30_000; // 30s — git diff, worktree ops, gh pr view
export const EXEC_TIMEOUT_BUILD_MS = 60_000; // 60s — bun test / bun build

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
    lastInjectedCommand: null,
    retryFeedback: null,
    prUrl: null,
    lastDecisionTime: null,
  };
}

// Per-session in-memory state. Keyed by session ID so multiple sessions
// don't collide.
const sessionStates = new Map<string, UltramodeState>();

/** Tracks sessions where runSelection is in progress. Prevents re-entrancy
 * — if session_start's fire-and-forget runSelection is still running when
 * /ultramode on fires, the second call skips. */
const selectionInProgress = new Set<string>();
/** Tracks sessions where handleTurnEnd is in progress. Prevents re-entrancy
 * — if decide() is still awaiting the LLM (up to 5 min), a second turn_end
 * must not start a parallel evidence-gathering + LLM call. */
const turnEndInProgress = new Set<string>();

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
  try {
    pi.appendEntry(CONTROL_TYPE, { ...state });
  } catch (err) {
    // Journal write failure — in-memory state is still correct, but the
    // journal is now stale. Surface this so the user knows persistence
    // failed and a session restart may lose recent state changes.
    const msg = err instanceof Error ? err.message : String(err);
    try {
      ctx.ui.notify(
        `ultramode: state persistence failed — ${msg}. In-memory state is correct but may not survive a session restart.`,
        "warning"
      );
    } catch {
      // ui.notify unavailable — nothing we can do
    }
  }
}

/**
 * Bounded subprocess execution. Wraps pi.exec with a mandatory timeout.
 *
 * Every shell command ultramode spawns MUST go through this helper — a bare
 * `pi.exec(cmd, args)` with no timeout can hang forever if the subprocess
 * stalls (corrupt .beads DB, huge git repo, gh rate-limit stall, dead lock).
 * Because handleTurnEnd and runSelection are fire-and-forget, a hung exec
 * does not crash the agent loop, but it holds a process slot and — worse —
 * never reaches the `finally` that clears the re-entrancy guards
 * (turnEndInProgress / selectionInProgress). One hung exec permanently
 * dead-locks that session's loop and, repeated over a 24/7 run, exhausts
 * the VPS. The timeout is the load-bearing defense against that.
 *
 * On timeout (or any rejection), returns a safe empty result with `code: -1`
 * and `killed: true` rather than throwing — so callers that already wrap in
 * try/catch keep working unchanged, and callers that don't (the bare
 * `await pi.exec(...)` sites below) cannot leak an unhandled rejection into
 * the fire-and-forget turn_end/session_start wrappers.
 */
export async function execBounded(
  pi: ExtensionAPI,
  command: string,
  args: string[],
  timeoutMs: number = EXEC_TIMEOUT_FAST_MS,
  options?: { cwd?: string }
): Promise<ExecResult> {
  try {
    return await pi.exec(command, args, {
      timeout: timeoutMs,
      ...options,
    });
  } catch {
    // Timeout, spawn failure, or any other rejection. Return a result
    // shaped like a failed subprocess so callers' `code === 0` checks
    // fail closed. Never throw — a thrown timeout would bypass the
    // re-entrancy `finally` blocks if a caller forgets try/catch.
    return { stdout: "", stderr: "", code: -1, killed: true };
  }
}

function stripFrontmatter(content: string): string {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/.exec(content);
  return (match ? match[1] : content).trimStart();
}

function substituteArgs(template: string, args: string): string {
  return template.replace(/\$\{?ARGUMENTS\}?/g, args);
}

function expandPhaseCommand(command: string): string {
  if (!command.startsWith("/")) return command;

  const firstLineEnd = command.indexOf("\n");
  const commandLine = firstLineEnd === -1 ? command : command.slice(0, firstLineEnd);
  const suffix = firstLineEnd === -1 ? "" : command.slice(firstLineEnd);
  const spaceIndex = commandLine.indexOf(" ");
  const commandName =
    spaceIndex === -1 ? commandLine.slice(1) : commandLine.slice(1, spaceIndex);
  const args = spaceIndex === -1 ? "" : commandLine.slice(spaceIndex + 1).trim();
  const path = resolvePath(process.cwd(), ".omp", "commands", `${commandName}.md`);

  if (!existsSync(path)) return command;

  const body = stripFrontmatter(readFileSync(path, "utf8"));
  return `${substituteArgs(body, args)}${suffix}`;
}

/**
 * Inject a command via sendUserMessage and record it as lastInjectedCommand.
 * This is the single chokepoint for all command injection — turn_end uses
 * lastInjectedCommand to filter: only chain after turns ultramode triggered,
 * not after the user's own messages.
 *
 * Delivery controls where the expanded command body is queued:
 *  - "followUp" (default): used from turn_end, after assistant output. It
 *    waits for the current phase turn to finish before running the next phase.
 *  - "steer": used from runSelection command/session_start paths. Direct
 *    prompts can throw AgentBusyError while the slash-command turn is still
 *    processing, and followUp-only may not auto-drain without an
 *    assistant/tool tail. Steer queues safely and auto-drains from any tail.
 */
function injectCommand(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: UltramodeState,
  command: string,
  delivery: "followUp" | "steer" = "followUp"
): void {
  const message = expandPhaseCommand(command);
  state.lastInjectedCommand = message;
  persistState(pi, ctx, state);
  pi.sendUserMessage(message, { deliverAs: delivery });
}

// Reconstruct state from the session journal by scanning for the last
// ultramode-control custom entry. Same pattern as autoresearch's
// reconstructControlState (autoresearch/state.ts:220).
export function reconstructState(ctx: ExtensionContext): UltramodeState {
  try {
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
        lastInjectedCommand:
          typeof candidate.lastInjectedCommand === "string"
            ? candidate.lastInjectedCommand
            : null,
        retryFeedback:
          typeof candidate.retryFeedback === "string"
            ? candidate.retryFeedback
            : null,
        prUrl:
          typeof candidate.prUrl === "string"
            ? candidate.prUrl
            : null,
        // Reset cooldown on session restart — a stale timestamp from a
        // previous session shouldn't block the first decision.
        lastDecisionTime: null,
      };
    }
    return reconstructed;
  } catch {
    // Corrupt journal or getBranch() failure — return clean state
    // rather than crashing session_start and preventing extension load.
    return createState();
  }
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

/**
 * Detect whether the agent finished its turn or is still calling tools.
 *
 * OMP fires `turn_end` after EVERY LLM call, including intermediate turns
 * where the assistant emitted `toolCall` blocks and will continue working.
 * Running the decision loop on those turns means:
 *   - spawning `bun test` + `bun build` + `bv` + an LLM call per tool call
 *   - blocking the event loop with synchronous readFileSync in evidence gathering
 *   - burning the server and freezing the terminal
 *
 * An assistant turn is "complete" (the agent is done, ready for our decision)
 * when its content has NO `toolCall` blocks — only text/thinking. If any
 * `toolCall` block is present, the agent is mid-work and will emit another
 * turn after the tool results come back.
 */
export function isAgentTurnComplete(message: unknown): boolean {
  if (!message || typeof message !== "object") return false;
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return true;
  if (!Array.isArray(content)) return false;
  // If any block is a tool call, the agent is still working — wait.
  return !content.some(
    (block) =>
      Boolean(block) &&
      typeof block === "object" &&
      (block as { type?: unknown }).type === "toolCall"
  );
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

// ─── Deep Verification ────────────────────────────────────────────────────────

interface VerificationEvidence {
  gitDiff: string;
  gitStatus: string;
  testResult: { exitCode: number; output: string } | null;
  buildResult: { exitCode: number; output: string } | null;
  artifactStatus: string;
  /** Actual content of the phase-relevant artifact, so the LLM can read the
   * work, not just check file existence. */
  phaseArtifactContent: string;
  /** Project context: AGENTS.md, package.json, directory tree.
   * Lets the LLM evaluate whether the approach fits the project's
   * conventions and architecture — not just whether the structure is complete. */
  codebaseContext: string;
}

/**
 * Phases that need expensive subprocess calls (bun test, bun build, git diff).
 * During brainstorming/creating/planning, these checks are pure waste —
 * there's no code to test or build yet, and no committed diff to review.
 * Running them on every completed turn in those phases burns the server.
 * Only shipping→verifying transitions produce real code that needs checking.
 */
export function shouldRunHeavyChecks(phase: Phase): boolean {
  return phase === "shipping" || phase === "verifying";
}

/**
 * Gather real verification evidence for the LLM decision.
 * Instead of just checking file existence, this:
 * - Runs `git diff --stat` to see what changed
 * - Runs `git status --short` to see uncommitted state
 * - Runs `bun run check` (tests) and captures exit code + output
 * - Runs `bun run build` and captures exit code
 *
 * This gives the LLM actual evidence to reason about, not just "file exists".
 */
async function gatherVerificationEvidence(
  pi: ExtensionAPI,
  beadId: string | null,
  phase: Phase
): Promise<VerificationEvidence> {
  const evidence: VerificationEvidence = {
    gitDiff: "",
    gitStatus: "",
    testResult: null,
    buildResult: null,
    artifactStatus: buildArtifactStatus(beadId),
    phaseArtifactContent: "",
    codebaseContext: "",
  };

  // Heavy checks: git diff, git status, bun test, bun build. These spawn
  // subprocesses with up to 60s timeouts. During brainstorming/creating/
  // planning there's no code to test — skip them entirely to avoid burning
  // the server on every completed turn.
  if (shouldRunHeavyChecks(phase)) {
    // Git diff — what changed?
    try {
      const diffResult = await execBounded(pi, "git", ["diff", "--stat", "HEAD~1"], EXEC_TIMEOUT_MED_MS);
      if (diffResult.code === 0) {
        evidence.gitDiff = truncate(diffResult.stdout, 1500);
      }
    } catch {
      // no commits yet, or not a git repo — skip
    }

    // Git status — uncommitted changes
    try {
      const statusResult = await execBounded(pi, "git", ["status", "--short"], EXEC_TIMEOUT_FAST_MS);
      if (statusResult.code === 0) {
        evidence.gitStatus = truncate(statusResult.stdout, 500) || "(clean)";
      }
    } catch {
      // skip
    }

    // Tests — run bun test test/ and capture exit code + output
    try {
      const testResult = await execBounded(pi, "bun", ["test", "test/"], EXEC_TIMEOUT_BUILD_MS);
      const testOutput = truncate(testResult.stdout + "\n" + testResult.stderr, 800);
      evidence.testResult = { exitCode: testResult.code, output: testOutput };
    } catch {
      // tests not available — skip
    }

    // Build — run bun build
    try {
      const buildResult = await execBounded(pi, "bun", ["build", "index.ts", "--target", "bun", "--external", "@oh-my-pi/pi-ai", "--external", "@oh-my-pi/pi-coding-agent"], EXEC_TIMEOUT_BUILD_MS);
      evidence.buildResult = {
        exitCode: buildResult.code,
        output: truncate(buildResult.stderr, 500),
      };
    } catch {
      // build not available — skip
    }
  }

  // Read the phase-relevant artifact content so the LLM can actually
  // read the work, not just check file existence + line count.
  // - creating: read prd.md (is the PRD substantive?)
  // - planning: read plan.md + tasks.md (are they real plans?)
  // - shipping: read git diff of actual code changes (not just --stat)
  // - verifying: read completion-evidence.json (did checks pass?)
  // - reviewing: read review-report.md (what did review find?)
  const artifactMap: Partial<Record<Phase, string[]>> = {
    creating: ["prd.md"],
    planning: ["plan.md", "tasks.md"],
    verifying: ["completion-evidence.json"],
    reviewing: ["review-report.md"],
  };
  const filesToRead = artifactMap[phase] || [];
  if (beadId && filesToRead.length > 0) {
    const parts: string[] = [];
    for (const file of filesToRead) {
      const path = `.beads/artifacts/${beadId}/${file}`;
      if (!existsSync(path)) {
        parts.push(`### ${file}\n(missing)`);
        continue;
      }
      try {
        const content = readFileSync(path, "utf8");
        parts.push(`### ${file}\n${truncate(content, 2000)}`);
      } catch {
        parts.push(`### ${file}\n(read error)`);
      }
    }
    evidence.phaseArtifactContent = parts.join("\n\n");
  }

  // For shipping phase, read the actual code diff (not just --stat)
  // so the LLM can review the implementation quality.
  if (phase === "shipping" && evidence.gitDiff) {
    try {
      const fullDiff = await execBounded(pi, "git", ["diff", "HEAD~1"], EXEC_TIMEOUT_MED_MS);
      if (fullDiff.code === 0 && fullDiff.stdout) {
        evidence.phaseArtifactContent = `### Git Diff (full)\n${truncate(fullDiff.stdout, 3000)}`;
      }
    } catch {
      // skip — already have --stat from earlier
    }
  }

  // Gather codebase context so the LLM can evaluate whether the approach
  // fits the project's conventions and architecture. This is what lets it
  // say "this approach doesn't match the existing pattern in X" instead of
  // just checking structure.
  const parts: string[] = [];

  // AGENTS.md — project conventions, naming, workflow rules
  for (const path of [".omp/AGENTS.md", "AGENTS.md", ".beads/AGENTS.md"]) {
    if (existsSync(path)) {
      try {
        parts.push(`### ${path}\n${truncate(readFileSync(path, "utf8"), 1500)}`);
      } catch { /* skip */ }
      break; // only read the first one found
    }
  }

  // package.json — dependencies, scripts, project shape
  if (existsSync("package.json")) {
    try {
      const pkg = JSON.parse(readFileSync("package.json", "utf8"));
      parts.push(`### package.json (key fields)\n${JSON.stringify({
        name: pkg.name,
        scripts: pkg.scripts,
        dependencies: pkg.dependencies,
        devDependencies: pkg.devDependencies,
      }, null, 2)}`);
    } catch { /* skip */ }
  }


  evidence.codebaseContext = parts.join("\n\n");

  return evidence;
}

/**
 * Format verification evidence into a human/LLM-readable string for the prompt.
 */
function formatVerificationEvidence(e: VerificationEvidence): string {
  const lines: string[] = [];

  lines.push("## Git Diff (last commit)");
  lines.push(e.gitDiff || "(no changes or no git history)");
  lines.push("");

  lines.push("## Git Status (uncommitted)");
  lines.push(e.gitStatus || "(unknown)");
  lines.push("");

  lines.push("## Test Results");
  if (e.testResult) {
    lines.push(`Exit code: ${e.testResult.exitCode}`);
    lines.push("Output:");
    lines.push(e.testResult.output);
  } else {
    lines.push("(tests not run — bun test unavailable)");
  }
  lines.push("");

  lines.push("## Build Results");
  if (e.buildResult) {
    lines.push(`Exit code: ${e.buildResult.exitCode}`);
    if (e.buildResult.output) {
      lines.push("Output:");
      lines.push(e.buildResult.output);
    }
  } else {
    lines.push("(build not run — bun build unavailable)");
  }
  lines.push("");

  lines.push("## Artifact Status");
  lines.push(e.artifactStatus);

  if (e.phaseArtifactContent) {
    lines.push("");
    lines.push("## Phase Artifact Content (READ THIS)");
    lines.push("This is the actual content of the artifact(s) produced in this phase. Read it critically — does it contain real, substantive work?");
    lines.push(e.phaseArtifactContent);
  }

  if (e.codebaseContext) {
    lines.push("");
    lines.push("## Codebase Context");
    lines.push("This is the project's AGENTS.md and package.json. Use it to evaluate whether the work fits the project's conventions and architecture — not just whether it's structurally complete.");
    lines.push(e.codebaseContext);
  }

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
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new Error(
      `ultramode: invalid timeoutMs ${timeoutMs} — must be a positive finite number`
    );
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
    return await complete(model, context, { apiKey, signal });
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
  ctx: ExtensionContext,
  description?: string
): Promise<void> {
  const state = getState(ctx);

  // Re-entrancy guard: prevent concurrent runSelection calls from
  // claiming the same bead or injecting duplicate commands.
  if (selectionInProgress.has(ctx.sessionManager.getSessionId())) {
    return;
  }
  selectionInProgress.add(ctx.sessionManager.getSessionId());
  try {

  // Fast path: if a description was provided (/ultramode on "fix the bug in..."),
  // skip triage/scheduler/LLM and go straight to /create.
  if (description) {
    state.beadId = null;
    state.phase = "creating";
    state.retries = 0;
    state.mode = "on";
    state.lastDecision = `manual create: ${description.slice(0, 100)}`;
    persistState(pi, ctx, state);
    updateWidget(ctx, state);
    ctx.ui.notify(
      `ultramode: creating bead — ${description.slice(0, 80)}`,
      "info"
    );
    injectCommand(pi, ctx, state, `/create ${description}`, "steer");
    return;
  }

  // 1. bv triage
  let triageJson = "{}";
  try {
    const triageResult = await execBounded(pi, "bv", ["--robot-triage", "--format", "json"], EXEC_TIMEOUT_FAST_MS);
    if (triageResult.code === 0 && triageResult.stdout) {
      triageJson = triageResult.stdout;
    }
  } catch {
    // bv unavailable — proceed with empty triage
  }

  // 2. br scheduler (fallback to br list)
  let schedulerJson = "{}";
  try {
    const schedResult = await execBounded(pi, "br", ["scheduler", "--json"], EXEC_TIMEOUT_FAST_MS);
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
      const listResult = await execBounded(pi, "br", ["list", "--status", "open", "--status", "in_progress", "--json"], EXEC_TIMEOUT_FAST_MS);
      if (listResult.code === 0 && listResult.stdout) {
        schedulerJson = listResult.stdout;
      }
    }
  } catch {
    // br unavailable — proceed with empty scheduler
  }

  // 3. Build selection prompt
  let template: string;
  try {
    template = loadPrompt("selection-prompt");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.ui.notify(`ultramode: failed to load selection prompt — ${msg}`, "error");
    state.mode = "idle";
    state.lastDecision = `prompt load error: ${msg}`;
    persistState(pi, ctx, state);
    updateWidget(ctx, state);
    return;
  }
  const prompt = fillTemplate(template, {
    bv_triage_json: triageJson,
    br_scheduler_json: schedulerJson,
  });
  // 4. Call LLM — retry transient failures up to MAX_RETRIES before idling.
  let decisionText: string;
  let selectionRetries = 0;
  while (true) {
    try {
      decisionText = await decide(ctx, prompt);
      break; // success
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      selectionRetries++;
      if (selectionRetries >= MAX_RETRIES) {
        ctx.ui.notify(`ultramode: selection failed after ${MAX_RETRIES} retries — ${msg}`, "error");
        state.mode = "idle";
        state.lastDecision = `selection error (retries exhausted): ${msg}`;
        persistState(pi, ctx, state);
        updateWidget(ctx, state);
        return;
      }
      ctx.ui.notify(`ultramode: selection failed — retrying (${selectionRetries}/${MAX_RETRIES}): ${msg}`, "warning");
    }
  }

  // 5. Parse decision
  const decision = parseDecision<SelectionDecision>(decisionText, [
    "select",
    "wait",
    "brainstorm",
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
      await execBounded(pi, "br", ["update", decision.beadId, "--claim", "--actor", "ultramode", "--json"], EXEC_TIMEOUT_FAST_MS);
    } catch {
      // claim failure is non-fatal — proceed anyway
    }
    state.beadId = decision.beadId;
    state.phase = "creating";
    state.retries = 0;
    state.mode = "on";
    // Create isolated worktree for this bead
    state.worktreePath = await createWorktree(pi, ctx, decision.beadId);
    if (!state.worktreePath) {
      // Worktree creation failed — don't proceed without isolation.
      // The agent would work in the user's main tree with no scope
      // enforcement. Safer to stop and let the user intervene.
      ctx.ui.notify(
        `ultramode: worktree creation failed for ${decision.beadId} — stopping for safety. Check git worktree status.`,
        "error"
      );
      state.mode = "idle";
      state.lastDecision = `worktree creation failed for ${decision.beadId}`;
      persistState(pi, ctx, state);
      updateWidget(ctx, state);
      return;
    }
    persistState(pi, ctx, state);
    updateWidget(ctx, state);
    ctx.ui.notify(
      `ultramode: selected bead ${decision.beadId} — ${decision.reasoning}`,
      "info"
    );
    injectCommand(pi, ctx, state, `/create ${decision.beadId}`, "steer");
  } else if (decision.action === "wait") {
    state.mode = "idle";
    persistState(pi, ctx, state);
    updateWidget(ctx, state);
    ctx.ui.notify(
      `ultramode: no ready work — ${decision.reasoning}`,
      "info"
    );
  } else if (decision.action === "brainstorm" && decision.createDescription) {
    state.mode = "on";
    state.phase = "brainstorming";
    persistState(pi, ctx, state);
    updateWidget(ctx, state);
    ctx.ui.notify(
      `ultramode: brainstorming — ${decision.reasoning}`,
      "info"
    );
    // Go to /brainstorm first, not /create. Brainstorm explores the
    // codebase and produces grounded ideas, then /create formalizes them.
    injectCommand(pi, ctx, state, `/brainstorm ${decision.createDescription}`, "steer");
  } else {
    ctx.ui.notify(
      "ultramode: selection returned an unrecognized action — idling",
      "warning"
    );
    state.mode = "idle";
    persistState(pi, ctx, state);
    updateWidget(ctx, state);
  }
  } finally {
    selectionInProgress.delete(ctx.sessionManager.getSessionId());
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
    await execBounded(pi, "br", ["update", state.beadId, "--status", "blocked", "--notes", `ultramode: ${reasoning}`, "--actor", "ultramode", "--json"], EXEC_TIMEOUT_FAST_MS);
  } catch {
    // non-fatal
  }
  ctx.ui.notify(
    `ultramode: bead ${state.beadId} marked blocked — ${reasoning}`,
    "warning"
  );
  await removeWorktree(pi, ctx, state.worktreePath);
  state.worktreePath = null;
}

/**
 * Create a git worktree for bead isolation. The agent works in the worktree
 * instead of the main working tree, so its changes don't interfere with the
 * user's work. The tool_call handler enforces scope: edits outside the
 * worktree (except .beads/ and .omp/) are blocked.
 */
async function createWorktree(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  beadId: string
): Promise<string | null> {
  const branchName = `ultramode/${beadId}`;
  const worktreePath = `.worktrees/${beadId}`;

  // Clean up stale worktree directory and branch from prior runs.
  // If a previous run created the worktree + branch but was interrupted
  // (crash, session restart, /ultramode off mid-flight), the branch
  // survives even after the worktree directory is removed. A stale branch
  // makes `git worktree add -b` fail with "a branch named X already
  // exists" — so delete both before creating fresh.
  try {
    await execBounded(pi, "git", ["worktree", "remove", "--force", worktreePath], EXEC_TIMEOUT_MED_MS);
  } catch {
    // worktree doesn't exist — fine
  }
  try {
    await execBounded(pi, "git", ["branch", "-D", branchName], EXEC_TIMEOUT_FAST_MS);
  } catch {
    // branch doesn't exist — fine
  }

  try {
    // Create worktree with a new branch from HEAD
    const result = await execBounded(pi, "git", ["worktree", "add", "-b", branchName, worktreePath, "HEAD"], EXEC_TIMEOUT_MED_MS);
    if (result.code === 0) {
      ctx.ui.notify(
        `ultramode: created worktree at ${worktreePath} (branch: ${branchName})`,
        "info"
      );
      return worktreePath;
    }
    ctx.ui.notify(
      `ultramode: worktree creation failed — ${result.stderr}`,
      "warning"
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.ui.notify(`ultramode: worktree creation error — ${msg}`, "warning");
  }
  return null;
}

/**
 * Remove a git worktree and its branch after the bead is done.
 */
async function removeWorktree(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  worktreePath: string | null
): Promise<void> {
  if (!worktreePath) return;
  try {
    await execBounded(pi, "git", ["worktree", "remove", "--force", worktreePath], EXEC_TIMEOUT_MED_MS);
    ctx.ui.notify(
      `ultramode: removed worktree ${worktreePath}`,
      "info"
    );
  } catch {
    // non-fatal — might already be removed
  }
}

// ─── Merge Watcher ─────────────────────────────────────────────────────────────

/** Active merge watcher timers, keyed by session ID. Prevents duplicate
 * watchers when session_start fires on a restart. */
const mergeWatchers = new Map<string, ReturnType<typeof setInterval>>();

/** Consecutive failure count per watcher. After MAX_MERGE_FAILURES the
 * watcher stops and notifies the user instead of polling forever. */
const mergeWatcherFailures = new Map<string, number>();
/** Tracks sessions where a merge watcher poll is in progress. Prevents
 * overlapping polls — setInterval does not await its callback, so a slow
 * gh call (up to 30s) or a long removeWorktree+runSelection chain (up to
 * 5min for decide()) would overlap with the next 60s tick, accumulating
 * unbounded promises and freezing the terminal. */
const mergeWatcherBusy = new Set<string>();

/** Poll interval for merge detection — 60 seconds. Trades latency for API
 * rate limit friendliness. GitHub merges are human-paced (minutes to hours),
 * so 60s is more than fast enough. */
const MERGE_POLL_MS = 60_000;

/** After this many consecutive failures, stop the merge watcher and notify.
 * At 60s intervals, 120 failures = 2 hours of continuous failure. */
const MAX_MERGE_FAILURES = 120;

/** Extract a GitHub PR URL from agent output text. */
function extractPrUrl(text: string): string | null {
  const match = text.match(/https:\/\/github\.com\/[^\s)]+\/pull\/\d+/);
  return match ? match[0] : null;
}

/** Parse owner/repo/number from a GitHub PR URL. */
function parsePrUrl(url: string): { repo: string; number: number } | null {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return { repo: match[1], number: parseInt(match[2], 10) };
}

/** Increment the failure counter. After MAX_MERGE_FAILURES, stop and notify. */
function bumpWatcherFailure(
  ctx: ExtensionContext,
  sessionId: string,
  prNumber: number,
  reason: string
): void {
  const count = (mergeWatcherFailures.get(sessionId) ?? 0) + 1;
  mergeWatcherFailures.set(sessionId, count);
  if (count >= MAX_MERGE_FAILURES) {
    stopMergeWatcher(sessionId);
    ctx.ui.notify(
      `ultramode: merge watcher for PR #${prNumber} failed ${count} times (${reason}) — stopping. Run /ultramode continue to retry.`,
      "warning"
    );
  }
}

/**
 * Start polling GitHub for PR merge status. When the PR is merged,
 * auto-continue: clean up worktree, select next bead.
 */
function startMergeWatcher(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: UltramodeState
): void {
  const sessionId = ctx.sessionManager.getSessionId?.() ?? "default";
  if (mergeWatchers.has(sessionId)) return;

  const prUrl = state.prUrl;
  if (!prUrl) return;

  const parsed = parsePrUrl(prUrl);
  if (!parsed) return;

  ctx.ui.notify(
    `ultramode: watching PR #${parsed.number} for merge — will auto-continue`,
    "info"
  );
  mergeWatcherFailures.set(sessionId, 0);

  const timer = setInterval(async () => {
    // Overlap guard: if the previous poll is still running (slow gh,
    // removeWorktree, or runSelection with a long decide() call), skip
    // this tick. setInterval does not await its callback — without this
    // guard, each 60s tick spawns a new async chain regardless of whether
    // the previous one finished, accumulating unbounded promises.
    if (mergeWatcherBusy.has(sessionId)) return;
    mergeWatcherBusy.add(sessionId);
    try {
      const current = getState(ctx);
      if (current.mode === "off") {
        stopMergeWatcher(sessionId);
        return;
      }

      try {
        const result = await execBounded(pi, "gh", ["pr", "view", String(parsed.number), "--repo", parsed.repo, "--json", "state,mergedAt"], EXEC_TIMEOUT_MED_MS);

        if (result.code !== 0 || !result.stdout) {
          bumpWatcherFailure(ctx, sessionId, parsed.number,
            `gh exited with code ${result.code}`);
          return;
        }

        let pr: { state: string; mergedAt: string | null };
        try {
          pr = JSON.parse(result.stdout) as { state: string; mergedAt: string | null };
        } catch {
          bumpWatcherFailure(ctx, sessionId, parsed.number,
            "gh returned non-JSON output");
          return;
        }

        // PR closed without merge — stop watching, notify user
        if (pr.state === "CLOSED" && !pr.mergedAt) {
          stopMergeWatcher(sessionId);
          ctx.ui.notify(
            `ultramode: PR #${parsed.number} closed without merging — watcher stopped. Run /ultramode continue to select new work.`,
            "warning"
          );
          return;
        }

        if (pr.state === "MERGED" || pr.mergedAt) {
          const latest = getState(ctx);
          if (latest.mode === "off") {
            stopMergeWatcher(sessionId);
            return;
          }
          stopMergeWatcher(sessionId);
          ctx.ui.notify(
            `ultramode: PR #${parsed.number} merged — continuing automatically`,
            "info"
          );
          await removeWorktree(pi, ctx, latest.worktreePath);
          latest.worktreePath = null;
          latest.prUrl = null;
          latest.mode = "on";
          latest.beadId = null;
          latest.phase = "selecting";
          latest.retries = 0;
          latest.lastDecision = null;
          latest.lastInjectedCommand = null;
          latest.lastDecisionTime = null;
          persistState(pi, ctx, latest);
          updateWidget(ctx, latest);
          await runSelection(pi, ctx);
        } else {
          // PR open but not merged — gh is working, reset failure counter
          mergeWatcherFailures.set(sessionId, 0);
        }
      } catch (err) {
        bumpWatcherFailure(ctx, sessionId, parsed.number,
          err instanceof Error ? err.message : String(err));
      }
    } finally {
      mergeWatcherBusy.delete(sessionId);
    }
  }, MERGE_POLL_MS);

  mergeWatchers.set(sessionId, timer);
}

/** Stop the merge watcher for a session. */
function stopMergeWatcher(sessionId: string): void {
  const timer = mergeWatchers.get(sessionId);
  if (timer) {
    clearInterval(timer);
    mergeWatchers.delete(sessionId);
    mergeWatcherFailures.delete(sessionId);
    mergeWatcherBusy.delete(sessionId);
  }
}

export async function handleTurnEnd(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  message: unknown
): Promise<void> {
  const state = getState(ctx);
  if (state.mode !== "on") return;

  // CRITICAL: Only run the decision loop when the agent has actually finished
  // its turn — i.e., produced a final text response with no pending tool calls.
  // OMP fires turn_end after every LLM call, including intermediate turns
  // where the assistant emitted toolCall blocks and will continue working.
  // Running evidence-gathering (bun test + bun build + readFileSync) + an LLM
  // call on every intermediate turn burns the server and freezes the terminal.
  if (!isAgentTurnComplete(message)) return;

  // Re-entrancy guard: prevent overlapping handleTurnEnd calls. If the LLM
  // decision is still in flight (decide() can take up to 5 minutes), a
  // second turn_end must not start a parallel evidence-gathering + LLM call.
  const sessionId = ctx.sessionManager.getSessionId();
  if (turnEndInProgress.has(sessionId)) return;
  // Cooldown: if the last decide() call was less than DECISION_COOLDOWN_MS
  // ago, skip this turn. Prevents rapid-fire LLM calls when the agent
  // produces multiple completed turns in quick succession. The
  // turnEndInProgress guard handles in-flight dedup; this handles the
  // window between one decision completing and the next turn arriving.
  if (
    state.lastDecisionTime !== null &&
    Date.now() - state.lastDecisionTime < DECISION_COOLDOWN_MS
  ) {
    return;
  }
  turnEndInProgress.add(sessionId);
  try {

  // Extract last assistant output
  const lastOutput = truncate(extractText(message), 2000);

  // Gather deep verification evidence: git diff, git status, test results,
  // build results, artifact status. This replaces the old shallow "file
  // exists + line count" check with actual runtime evidence.
  const evidence = await gatherVerificationEvidence(pi, state.beadId, state.phase);

  // Fetch bv triage for context (cached-ish — re-fetch each decision)
  let triageJson = "{}";
  try {
    const triageResult = await execBounded(pi, "bv", ["--robot-triage", "--format", "json"], EXEC_TIMEOUT_FAST_MS);
    if (triageResult.code === 0 && triageResult.stdout) {
      triageJson = truncate(triageResult.stdout, 2000);
    }
  } catch {
    // non-fatal
  }

  // Build decision prompt with deep evidence
  const template = loadPrompt("decision-prompt");
  const prompt = fillTemplate(template, {
    bead_id: state.beadId ?? "none",
    phase: state.phase,
    retries: String(state.retries),
    bv_triage_json: triageJson,
    last_output: lastOutput,
    artifact_status: formatVerificationEvidence(evidence),
  });

  // Call LLM — retry transient failures up to MAX_RETRIES before idling.
  // A single network blip or rate limit should not permanently stop the loop.
  let decisionText: string;
  try {
    state.lastDecisionTime = Date.now();
    decisionText = await decide(ctx, prompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (state.retries < MAX_RETRIES) {
      state.retries++;
      state.lastDecision = `decision error (retry ${state.retries}/${MAX_RETRIES}): ${msg}`;
      ctx.ui.notify(`ultramode: decision failed — retrying (${state.retries}/${MAX_RETRIES}): ${msg}`, "warning");
      // Re-inject the current phase command for another attempt
      const retryCmd = COMMAND_FROM_PHASE[state.phase];
      if (retryCmd && state.beadId) {
        persistState(pi, ctx, state);
        updateWidget(ctx, state);
        injectCommand(pi, ctx, state, `${retryCmd} ${state.beadId}`);
      } else {
        // Can't re-inject — reset to selection
        state.beadId = null;
        state.phase = "selecting";
        state.retries = 0;
        persistState(pi, ctx, state);
        updateWidget(ctx, state);
        await runSelection(pi, ctx);
      }
    } else {
      ctx.ui.notify(`ultramode: decision failed after ${MAX_RETRIES} retries — idling: ${msg}`, "error");
      state.mode = "idle";
      state.lastDecision = `decision error (retries exhausted): ${msg}`;
      persistState(pi, ctx, state);
      updateWidget(ctx, state);
    }
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
    state.retryFeedback = null;
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
    injectCommand(pi, ctx, state, fullCommand);
  } else if (decision.action === "retry") {
    if (state.retries < MAX_RETRIES) {
      state.retries++;
      state.retryFeedback = decision.reasoning;
      updateWidget(ctx, state);
      ctx.ui.notify(
        `ultramode: retry ${state.retries}/${MAX_RETRIES} — ${decision.reasoning}`,
        "info"
      );
      const currentCmd = COMMAND_FROM_PHASE[state.phase];
      if (currentCmd && state.beadId) {
        // Inject the command with feedback appended so the agent knows
        // what went wrong and what to fix.
        injectCommand(
          pi,
          ctx,
          state,
          `${currentCmd} ${state.beadId}\n\nFeedback from previous attempt: ${decision.reasoning}`
        );
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
        state.retryFeedback = null;
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
    state.retryFeedback = null;
    persistState(pi, ctx, state);
    updateWidget(ctx, state);
    await runSelection(pi, ctx);
  } else if (decision.action === "stop") {
    // Set mode=idle BEFORE any async work to prevent re-entrancy.
    // During await removeWorktree, another turn_end must not re-enter.
    state.mode = "idle";
    state.retryFeedback = null;
    if (state.phase === "pr") {
      const prUrl = extractPrUrl(lastOutput);
      if (prUrl) {
        state.prUrl = prUrl;
        ctx.ui.notify(
          `ultramode: PR created — ${prUrl}. Auto-continuing on merge.`,
          "info"
        );
      } else {
        ctx.ui.notify(
          "ultramode: PR created — worktree preserved for merge. Run /ultramode continue after merge.",
          "info"
        );
      }
    } else {
      ctx.ui.notify(
        `ultramode: stopping — ${decision.reasoning}`,
        "info"
      );
      await removeWorktree(pi, ctx, state.worktreePath);
      state.worktreePath = null;
    }
    persistState(pi, ctx, state);
    updateWidget(ctx, state);
    if (state.prUrl) {
      startMergeWatcher(pi, ctx, state);
    }
  }
  } finally {
    turnEndInProgress.delete(sessionId);
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

    // Restart merge watcher if we were waiting for a PR merge when the
    // session was restarted. The watcher is in-memory only (setInterval),
    // so it doesn't survive restarts — we need to manually re-arm it.
    if (state.mode === "idle" && state.phase === "pr" && state.prUrl) {
      startMergeWatcher(pi, ctx, state);
      ctx.ui.notify(
        "ultramode: resumed merge watcher for PR — will auto-continue on merge",
        "info"
      );
    }

    if (state.mode === "on" && state.phase === "selecting" && !state.beadId) {
      // Fire-and-forget — don't block session start. But catch errors so
      // a rejected sendUserMessage or persistState doesn't become an
      // unhandled rejection that crashes the extension.
      void runSelection(pi, ctx).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`ultramode: session_start selection failed — ${msg}`, "error");
        const errState = getState(ctx);
        errState.mode = "idle";
        errState.lastDecision = `session_start error: ${msg}`;
        persistState(pi, ctx, errState);
        updateWidget(ctx, errState);
      });
    }
  });

  // turn_end: the core decision loop
  pi.on(
    "turn_end",
    async (event: { message?: unknown }, ctx: ExtensionContext) => {
      // Only act if mode is on
      const state = getState(ctx);
      if (state.mode !== "on") return;

      // Turn filter: only chain after turns that ultramode itself triggered.
      // This prevents the extension from firing on the user's own messages.
      // We check if the last user message in the conversation matches our
      // lastInjectedCommand. If not, this turn was user-initiated — skip.
      if (state.lastInjectedCommand) {
        // Session entries use type: "message" with message.role === "user"
        // (not type: "user"). Find the last user message in the branch.
        const branch = ctx.sessionManager.getBranch();
        const lastUserEntry = [...branch]
          .reverse()
          .find(
            (e): e is BranchMessageEntry =>
              e.type === "message" &&
              typeof (e as BranchEntry).message === "object" &&
              (e as BranchMessageEntry).message?.role === "user"
          );
        if (lastUserEntry) {
          const msg = lastUserEntry.message;
          // Extract text from content blocks (array of {type:"text", text})
          // or plain string content
          let userText = "";
          if (typeof msg.content === "string") {
            userText = msg.content;
          } else if (Array.isArray(msg.content)) {
            userText = msg.content
              .filter(
                (b): b is { type: "text"; text: string } =>
                  typeof b === "object" &&
                  b !== null &&
                  b.type === "text" &&
                  typeof b.text === "string"
              )
              .map((b) => b.text)
              .join("\n");
          }
          // Extract just the command (first line, before any newline)
          const injectedCmd = state.lastInjectedCommand.split("\n")[0].trim();
          if (!userText.includes(injectedCmd)) {
            return; // User's own turn, not ours
          }
        }
      }

      // Skip if there are pending messages (e.g. a queued followUp)
      // to avoid racing with our own injected commands
      if (typeof ctx.hasPendingMessages === "function" && ctx.hasPendingMessages()) {
        return;
      }

      // Fire-and-forget: OMP awaits turn_end handlers, and handleTurnEnd can
      // take 90+ seconds (bun test + bun build + LLM decision). Awaiting it
      // blocks the agent loop — the terminal freezes and can't render or
      // process input. The turnEndInProgress guard prevents overlap, and
      // injectCommand uses followUp delivery which queues correctly.
      void handleTurnEnd(pi, ctx, event.message).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`ultramode: turn_end error — ${msg}`, "error");
        const errState = getState(ctx);
        errState.mode = "idle";
        errState.lastDecision = `turn_end error: ${msg}`;
        persistState(pi, ctx, errState);
        updateWidget(ctx, errState);
      });
    }
  );

  // tool_call: scope enforcement — block edits outside worktree when active
  pi.on(
    "tool_call",
    (event: { toolName?: string; input?: { path?: string } }, ctx: ExtensionContext) => {
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

      // Block paths outside the worktree. Use resolvePath to normalize
      // the path — prevents path traversal attacks like
      // .worktrees/test/../../../etc/passwd from bypassing the check.
      // resolvePath resolves relative paths and collapses .. segments.
      const resolved = resolvePath(path);
      const worktreeResolved = resolvePath(state.worktreePath);
      if (!resolved.startsWith(worktreeResolved + "/") && resolved !== worktreeResolved) {
        return {
          block: true,
          reason: `ultramode: scope violation — path "${path}" resolves to "${resolved}" which is outside the active worktree "${state.worktreePath}"`,
        };
      }

      return undefined;
    }
  );

  // /ultramode control command
  pi.registerCommand("ultramode", {
    description: "Control the ultramode autonomous loop (on|off|status|continue)",
    async handler(args: string, ctx: ExtensionCommandContext): Promise<void> {
      const state = getState(ctx);
      const subcommand = args.trim().split(/\s+/)[0] || "status";
      const restArgs = args.trim().slice(subcommand.length).trim();
      switch (subcommand) {
        case "on": {
          state.mode = "on";
          // Validate state consistency: if beadId is set but worktreePath
          // is null, the prior run failed mid-create. Reset to selecting
          // so runSelection picks a fresh bead with proper isolation.
          if (state.beadId && !state.worktreePath) {
            state.beadId = null;
            state.phase = "selecting";
            state.retries = 0;
          }
          if (!state.beadId) {
            state.phase = "selecting";
            state.retries = 0;
          }
          persistState(pi, ctx, state);
          updateWidget(ctx, state);
          ctx.ui.notify("ultramode: autonomous loop activated", "info");
          if (!state.beadId) {
            void runSelection(pi, ctx, restArgs || undefined);
          }
          break;
        }
        case "off": {
          state.mode = "off";
          stopMergeWatcher(
            ctx.sessionManager.getSessionId?.() ?? "default"
          );
          // Clean up worktree — same as /continue. Without this,
          // off leaks the worktree directory and branch on disk, and
          // the stale prUrl causes the watcher to auto-resume on restart.
          await removeWorktree(pi, ctx, state.worktreePath);
          state.worktreePath = null;
          state.prUrl = null;
          state.beadId = null;
          state.lastInjectedCommand = null;
          state.retryFeedback = null;
          state.lastDecisionTime = null;
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
            `  worktree: ${state.worktreePath ?? "none"}`,
            `  pr: ${state.prUrl ?? "none"}`,
            `  retries: ${state.retries}/${MAX_RETRIES}`,
            `  last decision: ${state.lastDecision ?? "none"}`,
          ];
          ctx.ui.notify(lines.join("\n"), "info");
          break;
        }
        case "continue": {
          // Clean up the previous bead's worktree — the user ran this
          // because they merged the PR, so the branch is now merged.
          stopMergeWatcher(
            ctx.sessionManager.getSessionId?.() ?? "default"
          );
          await removeWorktree(pi, ctx, state.worktreePath);
          state.worktreePath = null;
          state.prUrl = null;
          state.mode = "on";
          state.beadId = null;
          state.phase = "selecting";
          state.retries = 0;
          state.lastDecision = null;
          state.retryFeedback = null;
          state.lastDecisionTime = null;
          persistState(pi, ctx, state);
          updateWidget(ctx, state);
          ctx.ui.notify(
            "ultramode: continuing — selecting next bead",
            "info"
          );
          void runSelection(pi, ctx);
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
