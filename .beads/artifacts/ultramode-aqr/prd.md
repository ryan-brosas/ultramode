<!-- DENSITY: Minimum 600 lines. No upper bound — be thorough. <600 = incomplete (missing sections, hand-wavy, no real technical context). This is an AI handoff: another agent must be able to pick this up and implement correctly without guessing. Every section must have concrete evidence: file paths, API signatures, existing patterns, constraints. -->
# PRD: ultramode-aqr: End-to-end live session test for ultramode extension — verify the autonomous loop fires correctly in a real OMP session

**Bead:** ultramode-aqr | **Type:** chore | **Priority:** P2
**Created:** 2026-06-18 | **Estimate:** 180 minutes

## Problem

WHEN the ultramode extension is installed in a real OMP session and `/ultramode on` is run, THEN there is no evidence that the autonomous loop actually fires — session_start may not trigger work selection, turn_end may not fire the decision loop, sendUserMessage may not inject phase commands, state may not survive restart, and the retry cap may not mark beads blocked — BECAUSE every runtime risk was explicitly marked "implemented but not verified live" in the `ultramode-fpj` completion evidence (5 unchecked risks) and the `ultramode-air` review report (residual risk: "Live OMP session behavior: out of scope per PRD").

The extension has 48 unit tests covering parseDecision, reconstructState, phase maps, retry logic, and error paths. But these tests mock the OMP runtime — they never call `pi.exec("bv", [...])` against a real bv binary, never call `complete()` against a real LLM provider, never fire `turn_end` in a real session, and never persist state through a real session journal. The unit tests verify code paths in isolation; they cannot verify integration with the OMP runtime.

This affects anyone who installs the extension: the core value proposition (autonomous phase chaining) is completely unverified in the environment it's designed for. A regression in the OMP runtime API, a change to `sendUserMessage` semantics, or a `getBranch()` format drift would break the extension silently — unit tests would still pass because they mock all of these.

## Scope

### In Scope

- Install the ultramode extension in a real OMP session via `omp install .` or `-e ./index.ts`
- Verify `session_start` event fires and the extension loads (notification "ultramode loaded" appears)
- Verify `/ultramode status` returns correct initial state: `mode=off, beadId=none, phase=selecting, retries=0`
- Verify `/ultramode on` activates the loop and triggers `runSelection` (bv triage + br scheduler exec calls fire, LLM decision is made)
- Verify `sendUserMessage` injects a phase command (e.g. `/create <bead-id>`) that the agent processes
- Verify `turn_end` fires the decision loop after a phase completes (decide() is called, proceed/reject/retry/stop decision is acted on)
- Verify state persistence: after `/ultramode on` sets mode=on, kill the session, restart with `--continue`, verify `/ultramode status` shows `mode=on` reconstructed from the session journal via `getBranch()`
- Verify the `hasPendingMessages` guard: when a followUp message is queued, `turn_end` does not re-enter `handleTurnEnd` (no duplicate phase commands injected)
- Verify retry cap: simulate a failing phase (or mock decide() to return "retry" 3 times), confirm `br update --status blocked` fires and the loop picks the next bead
- Record all evidence in `completion-evidence.json` with actual command output, session journal excerpts, and observed behavior

### Out of Scope

- Code changes to `index.ts` — this bead verifies existing behavior. If a live bug is discovered, it becomes a separate fix bead with its own PRD/plan/ship cycle
- Worktree enforcement — `state.worktreePath` is never set; the `tool_call` handler is dead code. That's a separate bead
- LLM call timeout — `decide()` has no timeout; that's a separate bead
- README.md or install documentation — separate bead
- CI pipeline setup — separate bead
- Testing with multiple simultaneous sessions — the extension's session isolation (`sessionStates` Map keyed by session ID) is a design detail, not a runtime risk
- Performance benchmarking (LLM call latency, exec overhead) — this bead verifies correctness, not performance
- Provider-specific testing (testing with Anthropic vs OpenAI vs Gemini) — the extension uses whatever model the session has configured

## Requirements

| # | Requirement | Priority | Acceptance Criteria |
|---|------------|----------|---------------------|
| 1 | Extension loads in a real OMP session without errors | MUST | `omp -p -e ./index.ts "echo test"` exits 0 with no error output; OR `omp install .` succeeds and a subsequent session loads the extension. Verify: no "Cannot find module" or "TypeError" in output |
| 2 | `session_start` event fires and extension initializes | MUST | Run a session with the extension loaded. Verify: the session journal contains a `session` entry with the correct `cwd`; the extension's `session_start` handler runs (evidenced by widget update or notification). If mode=off (default), `runSelection` does NOT fire |
| 3 | `/ultramode status` returns correct initial state | MUST | Run `omp -p --mode json -e ./index.ts "/ultramode status"` and verify the output includes: `mode: off`, `bead: none`, `phase: selecting`, `retries: 0/3` |
| 4 | `/ultramode on` activates the loop and triggers work selection | MUST | Run `/ultramode on` in a session with at least one open bead. Verify: (a) `bv --robot-triage --format json` is called (check exec calls in session output or journal); (b) `br scheduler --json` is called; (c) the LLM decision function `decide()` is called (evidenced by either a selection notification or an idle/error notification); (d) state is persisted to the journal as an `ultramode-control` custom entry with `mode: "on"` |
| 5 | `sendUserMessage` injects a phase command the agent processes | MUST | After `/ultramode on` selects a bead, verify: (a) `pi.sendUserMessage("/create <bead-id>", { deliverAs: "followUp" })` is called; (b) the agent receives and processes the `/create` command (the command body executes, not just a notification). Evidence: session journal shows a user message entry with `/create <bead-id>` content followed by agent execution |
| 6 | `turn_end` fires the decision loop after a phase completes | MUST | After `/create` completes (agent produces prd.md), verify: (a) `turn_end` handler fires; (b) `handleTurnEnd` calls `decide()` with the decision prompt; (c) the decision (proceed/reject/retry/stop) is acted on — either a next phase command is injected (proceed) or the loop idles (stop). Evidence: session journal shows the next `sendUserMessage` call or a mode change to idle |
| 7 | State survives session restart via journal reconstruction | MUST | (a) Run `/ultramode on` in session A; (b) terminate session A; (c) resume with `omp --continue` (or `--resume <session-id>`); (d) run `/ultramode status`; (e) verify `mode=on` is shown — reconstructed from the session journal via `getBranch()`. Evidence: session journal contains `ultramode-control` custom entries; resumed session's `reconstructState()` finds the last entry and restores `mode: "on"` |
| 8 | `hasPendingMessages` guard prevents re-entrancy | SHOULD | After `/ultramode on` injects a followUp command, verify: the next `turn_end` does NOT call `handleTurnEnd` while the followUp is still pending. Evidence: no duplicate phase commands in the session journal (only one `/create` injection, not two). If `hasPendingMessages` is not available on `ExtensionContext` in this OMP version, verify the guard is a no-op (graceful degradation) and document this |
| 9 | Retry cap marks bead blocked after 3 retries | SHOULD | Simulate a failing phase: either (a) create a bead whose `/create` phase fails repeatedly, or (b) temporarily mock `decide()` to return `{action: "retry"}` for the first 3 turn_end calls. Verify: after 3 retries, `br update <bead-id> --status blocked` fires; state resets to selecting; the loop picks the next bead via `runSelection()`. Evidence: session journal shows retry count incrementing (1, 2, 3) then a `br update` exec call with `--status blocked` |
| 10 | `/ultramode off` deactivates the loop | MUST | Run `/ultramode off` and verify: mode changes to "off", state is persisted, no further `turn_end` handler calls fire `handleTurnEnd`. Evidence: `/ultramode status` shows `mode: off`; subsequent turns do not trigger decision calls |
| 11 | `/ultramode continue` resets and picks next bead | SHOULD | After a bead is blocked or completed, run `/ultramode continue`. Verify: state resets (beadId=null, phase=selecting, retries=0), `runSelection()` fires, and a new bead is selected. Evidence: `/ultramode status` shows new beadId; session journal shows new `ultramode-control` entry with reset state |
| 12 | No `/close` command is ever injected | MUST | Scan the entire session journal for all `sendUserMessage` calls. Verify: no message content contains `/close` or `/merge`. Evidence: `grep -c "/close" <session-journal>` returns 0 matches in the message content |

## Technical Context

**Key files:**
- `index.ts` — the extension under test (927 lines, 48 unit tests). No changes to this file during this bead
- `.beads/artifacts/ultramode-fpj/completion-evidence.json` — lists 5 unchecked runtime risks (lines 58-64) that this bead verifies
- `.beads/artifacts/ultramode-air/review-report.md` — residual risk "Live OMP session behavior: out of scope per PRD" (line 47)
- `~/.omp/agent/sessions/-repos-ultramode/` — session journal directory where `ultramode-control` entries are persisted

**APIs / systems touched:**
- `omp` CLI (v16.0.4 at `/home/ryan/.local/share/mise/installs/github-can1357-oh-my-pi/latest/omp`):
  - `omp -p --mode json -e ./index.ts "<command>"` — non-interactive session with extension loaded, JSON output
  - `omp --continue` / `--resume <session-id>` — resume a previous session (for state persistence test)
  - `omp install .` — install the plugin (alternative to `-e` flag)
  - `omp plugin list` — verify plugin is installed
- `pi.on("session_start", handler)` — fires on session load; handler receives `ctx` with `sessionManager`
- `pi.on("turn_end", handler)` — fires at end of agent turn; handler receives `event` with `message` and `ctx`
- `pi.on("tool_call", handler)` — fires before tool execution; can block with `{block: true, reason: "..."}`
- `pi.sendUserMessage(content, { deliverAs: "followUp" })` — injects a user message processed after the current turn
- `pi.appendEntry("ultramode-control", state)` — persists state to session journal as custom entry
- `pi.exec(cmd, args[])` — executes shell commands (br, bv)
- `ctx.sessionManager.getBranch()` — returns session journal entries for state reconstruction
- `ctx.sessionManager.getSessionId()` — unique session ID for state isolation
- `ctx.model` — the session's configured LLM model
- `ctx.modelRegistry.getApiKey(model)` — resolves API key for the model
- `ctx.ui.notify(message, type)` — shows notification in TUI
- `ctx.ui.setWidget(key, content)` — registers a status widget
- `ctx.hasPendingMessages()` — checks if followUp messages are queued (may not exist on all OMP versions)

**Session journal format (verified from `~/.omp/agent/sessions/-repos-ultramode/`):**
- JSONL files named `<timestamp>_<session-id>.jsonl`
- Entry types: `session` (metadata), `message` (user/assistant/tool), `custom` (extension-persisted state)
- Custom entries have `type: "custom"`, `customType: "ultramode-control"`, `data: {mode, beadId, phase, retries, ...}`
- `getBranch()` returns these entries; `reconstructState()` scans for the last `ultramode-control` entry

**Verification approach (from investigation):**
- Non-interactive mode (`omp -p --mode json`) captures session output as JSON, including notifications and tool calls
- The session journal at `~/.omp/agent/sessions/-repos-ultramode/` is the source of truth for state persistence
- `omp --continue` resumes the most recent session; `--resume <id>` resumes a specific session
- Extension loading via `-e ./index.ts` is equivalent to `omp install .` for testing purposes (confirmed via `omp install . --dry-run --json` which shows the manifest resolves correctly)

**Existing code to NOT modify:**
- `index.ts` — the extension under test. No changes during this bead
- `test/` — the unit test harness. No changes during this bead
- `prompts/*.md` — the LLM prompt templates. No changes during this bead
- `package.json` — the plugin manifest. No changes during this bead
- `.omp/` — the harness configuration, commands, skills, templates. No changes during this bead

**Prior art:**
- `ultramode-fpj` (closed) — implemented the extension. Completion evidence lists 5 unchecked runtime risks
- `ultramode-air` (closed) — added unit test harness. Review residual risk: "Live OMP session behavior: out of scope per PRD"
- No prior attempts at live session testing exist in git history or bead graph

**Constraints:**
- The extension uses `complete()` from `@oh-my-pi/pi-ai` — requires a configured model with an API key. If no model is configured, `decide()` throws and the loop idles. This is expected behavior, not a bug
- The extension calls `pi.exec("bv", [...])` and `pi.exec("br", [...])` — requires br and bv installed and a `.beads/` workspace initialized. Both are available in this repo
- Non-interactive mode (`omp -p`) may not fire `turn_end` the same way as interactive mode — the agent processes the prompt and exits. For the `turn_end` test, may need an interactive or `--continue` session that actually completes a phase
- `ctx.hasPendingMessages()` may not exist on all OMP versions — the code guards with `typeof ctx.hasPendingMessages === "function"`. If unavailable, the guard is a no-op and re-entrancy protection relies on `deliverAs: "followUp"` timing alone
- LLM calls cost money — use the cheapest available model. The extension uses whatever model the session has configured via `--model`
- Session journals can be large — filter for `ultramode-control` entries when inspecting

## Approach

### Verification Strategy: Incremental Live Sessions

The approach is to run a series of real OMP sessions with the extension loaded, each verifying a specific requirement. Each session is reproducible via `omp -p --mode json -e ./index.ts "<command>"`, and evidence is captured from the JSON output and the session journal.

**Session 1: Load + Status (Requirements 1, 2, 3)**

Run: `omp -p --mode json -e ./index.ts "/ultramode status"`

Verify:
- Extension loads without errors (no "Cannot find module", no "TypeError")
- `/ultramode status` returns initial state: `mode: off, bead: none, phase: selecting, retries: 0/3`
- Session journal contains a `session` entry with the correct `cwd`

This is the smoke test. If the extension doesn't load, everything else is blocked.

**Session 2: Activation + Work Selection (Requirements 4, 5)**

Prerequisite: at least one open bead exists in the `.beads/` workspace. If none exist, create a dummy bead with `br create`.

Run: `omp -p --mode json -e ./index.ts "/ultramode on"`

Verify:
- `bv --robot-triage --format json` exec call fires (check JSON output for tool calls or exec results)
- `br scheduler --json` exec call fires
- `decide()` is called — evidenced by either a selection notification or an idle/error notification
- State is persisted: session journal contains an `ultramode-control` custom entry with `mode: "on"`
- If a bead is selected: `sendUserMessage("/create <bead-id>", { deliverAs: "followUp" })` fires — check for a user message entry in the journal

Challenge: in non-interactive mode (`-p`), the agent processes the `/ultramode on` command and exits. The `runSelection` function is async and may not complete before the session ends. May need to use `--mode rpc` or interactive mode to observe the full selection flow.

Fallback: if non-interactive mode doesn't give enough visibility, use `omp install .` to install the extension, then run an interactive session and capture the TUI output.

**Session 3: turn_end Decision Loop (Requirement 6)**

This requires the agent to complete a phase so `turn_end` fires with real output. Approach:
1. Run `/ultramode on` to select a bead and inject `/create`
2. The agent processes `/create` and produces a PRD
3. `turn_end` fires after the `/create` phase completes
4. `handleTurnEnd` calls `decide()` with the decision prompt
5. The decision (proceed/reject/retry/stop) is acted on

This is the hardest test because it requires a full phase execution cycle. May need an interactive session where the agent actually runs `/create` to completion.

**Session 4: State Persistence (Requirement 7)**

1. Run `/ultramode on` in session A — state is persisted to journal
2. Terminate session A
3. Resume: `omp --continue --mode json -e ./index.ts "/ultramode status"`
4. Verify: `/ultramode status` shows `mode: on` — reconstructed from journal via `getBranch()`
5. Inspect session journal: confirm `ultramode-control` custom entries exist

**Session 5: hasPendingMessages Guard (Requirement 8)**

After `/ultramode on` injects a followUp (`/create <bead-id>`), the next `turn_end` should NOT call `handleTurnEnd` if the followUp is still pending. Verify by checking the session journal for duplicate phase commands — if the guard works, only one `/create` injection appears, not two.

If `hasPendingMessages` is not available (older OMP version), verify the guard is a no-op and document that re-entrancy protection relies on `deliverAs: "followUp"` timing alone.

**Session 6: Retry Cap (Requirement 9)**

Simulate a failing phase. Two approaches:
- (a) Create a bead whose `/create` phase fails (e.g. a bead with an impossible description)
- (b) Temporarily inject a mock that makes `decide()` return `{action: "retry"}` for the first 3 `turn_end` calls

Approach (a) is more realistic but harder to control. Approach (b) is more deterministic but requires code modification (out of scope).

Preferred approach: (a). Create a bead with a description that will cause `/create` to fail or produce an incomplete PRD. The decision loop should detect the failure and retry. After 3 retries, `markBlocked` fires.

If approach (a) is impractical (the agent may succeed at `/create` regardless), document this and verify the retry path indirectly by checking that the `state.retries` field increments in the journal and that `COMMAND_FROM_PHASE` is used (not `PHASE_WHITELIST`) on retry.

**Session 7: No /close Injection (Requirement 12)**

Scan the session journal from any of the above sessions for all `sendUserMessage` calls. Verify no message content contains `/close` or `/merge`. This is a negative test — it passes if the string is absent.

### Evidence Capture

For each session:
1. Capture the `omp -p --mode json` output (JSON lines with session events, tool calls, notifications)
2. Capture the session journal file path and filter for `ultramode-control` entries
3. Record the exact commands run and their exit codes
4. Record observed behavior: notifications, state transitions, injected commands
5. Note any failures or unexpected behavior — these become findings

### Dealing with Non-Interactive Mode Limitations

Non-interactive mode (`omp -p`) processes a single prompt and exits. This means:
- `session_start` fires (good — verifies Req 2)
- `/ultramode status` works (good — verifies Req 3)
- `/ultramode on` fires `runSelection` but the async call may not complete before exit (problematic for Req 4/5)
- `turn_end` fires after the agent processes the prompt, but there may not be a "phase completion" to evaluate (problematic for Req 6)

Mitigations:
- Use `omp -p` with a prompt that triggers `/ultramode on` and then observe whether `runSelection` fires within the timeout
- If `runSelection` doesn't complete in non-interactive mode, switch to interactive mode (`omp` without `-p`) and capture output via `--mode json` or TUI screenshots
- For `turn_end`, use `--continue` to resume a session where `/ultramode on` was run, then send a message that triggers a phase execution, then observe `turn_end` behavior
- If interactive mode is needed, use `timeout 60 omp -e ./index.ts` to bound the session duration

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Non-interactive mode (`omp -p`) doesn't fire `turn_end` with enough context for the decision loop | Medium | High | Fall back to interactive mode with `timeout`. Use `--continue` to resume sessions for multi-turn tests |
| `runSelection` async call doesn't complete before non-interactive session exits | Medium | Medium | Use interactive mode or increase timeout. Check session journal for partial state (even if `decide()` didn't complete, the `bv`/`br` exec calls may be visible) |
| No model configured — `decide()` throws "no active model on session" | Low | Medium | This is expected behavior (the extension handles it by idling). Verify the error handling path fires correctly: mode=idle, notification shows. Use `--model <cheapest-available>` to avoid this |
| `hasPendingMessages` not available on this OMP version | Low | Low | The code guards with `typeof === "function"`. If unavailable, the guard is a no-op. Document this as a finding, not a failure |
| LLM returns unexpected JSON — `parseDecision` fails | Low | Medium | This is expected behavior (the extension idles on parse failure). Verify the error handling path fires. Use a model that follows JSON instructions well |
| Session journal format differs from what `reconstructState` expects | Low | High | This is exactly what we're testing. If reconstruction fails, that's a finding — document the format mismatch and file a fix bead |
| Live session modifies bead state (claims beads, marks blocked) | Medium | Low | Use a disposable test bead. Create a dummy bead with `br create` before testing. Clean up after: `br close` or `br update --status open` to reset |
| Retry cap test requires a controllable failing phase | Medium | Medium | If approach (a) is impractical, verify the retry path indirectly: check that `state.retries` increments in the journal and `COMMAND_FROM_PHASE` (not `PHASE_WHITELIST`) is used for retry commands. This is weaker evidence but still meaningful |
| Interactive mode hangs indefinitely | Low | Medium | Use `timeout 60 omp ...` to bound. If it hangs, that's a finding (possible deadlock in the event loop) |

## Acceptance Criteria

- [ ] Extension loads in a real OMP session without errors
    - Verify: `omp -p --mode json -e ./index.ts "/ultramode status"` exits 0 and returns status JSON
- [ ] `/ultramode status` returns correct initial state
    - Verify: output contains `mode: off`, `bead: none`, `phase: selecting`, `retries: 0/3`
- [ ] `/ultramode on` triggers work selection (bv + br exec calls fire)
    - Verify: session output or journal shows `pi.exec("bv", ["--robot-triage", ...])` and `pi.exec("br", ["scheduler", ...])` calls
- [ ] State is persisted to the session journal
    - Verify: session journal contains entries with `customType: "ultramode-control"` and `data.mode: "on"`
- [ ] `sendUserMessage` injects a phase command
    - Verify: session journal shows a user message entry with `/create <bead-id>` content (if a bead was selected)
- [ ] `turn_end` fires the decision loop
    - Verify: after a phase completes, session shows `decide()` was called (notification or state transition) and a decision was acted on (next command injected or mode=idle)
- [ ] State survives session restart
    - Verify: after `--continue`, `/ultramode status` shows `mode: on` reconstructed from journal
- [ ] No `/close` command is ever injected
    - Verify: `grep -c "/close" <session-journal>` returns 0 in message content
- [ ] `/ultramode off` deactivates the loop
    - Verify: `/ultramode status` shows `mode: off`; subsequent turns don't trigger decision calls
- [ ] All findings documented in `completion-evidence.json`
    - Verify: evidence file exists with each check recorded as passed/failed with observed output
