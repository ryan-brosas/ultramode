<!-- DENSITY: Minimum 600 lines. No upper bound. <600 = too thin (waves undefined, tasks lack code outlines, verification hand-wavy). Task outlines should show the shape of every file change — not full implementation, but enough that a different agent can execute without reading the PRD again. -->
# Plan: ultramode-aqr

**Goal:** Run the ultramode extension in real OMP sessions and verify all 12 PRD requirements with observed evidence — proving the autonomous loop actually fires end-to-end or surfacing live bugs.

## Graph Context

- **Blast radius:** 0 source files (verification-only bead — no code changes to index.ts, test/, or prompts/)
- **Unblocks:** None — this bead verifies existing behavior; no downstream work depends on it
- **Blocked by:** None — standalone node in the bead graph
- **Critical path:** No — does not block other work
- **Forecast:** 52 minutes (confidence 0.3 — low because historical velocity has only 2 samples, both closed quickly)
- **Hotspots touched:** None — no source files modified; session journals at `~/.omp/agent/sessions/-repos-ultramode/` are read-only evidence

## Observable Truths

1. `omp -p --mode json -e ./index.ts "/ultramode status"` exits 0 and output contains `mode: off`, `bead: none`, `phase: selecting`, `retries: 0/3`
2. `omp -p -e ./index.ts "echo test"` exits 0 with no "Cannot find module" or "TypeError" in output
3. After running `/ultramode on` in a session, the session journal contains at least one entry with `"customType": "ultramode-control"` and `"data": {"mode": "on", ...}`
4. After running `/ultramode on`, session output or journal shows `pi.exec("bv", ["--robot-triage", ...])` was called (bv triage JSON appears in exec results or tool output)
5. After running `/ultramode on`, session output or journal shows `pi.exec("br", ["scheduler", "--json"])` was called
6. After `/ultramode on` selects a bead, session journal contains a user message entry with content starting with `/create`
7. After `--continue` resumes a session where `/ultramode on` was run, `/ultramode status` shows `mode: on` (reconstructed from journal)
8. Scanning all session journals from this bead's test sessions for `/close` in message content returns 0 matches
9. After running `/ultramode off`, `/ultramode status` shows `mode: off`
10. `completion-evidence.json` exists with each requirement marked passed/failed and observed output recorded

## Required Artifacts

| Artifact | Provides | Path | Status |
|----------|----------|------|--------|
| `completion-evidence.json` | Verification evidence: commands run, observed output, pass/fail per requirement | `.beads/artifacts/ultramode-aqr/completion-evidence.json` | Need |

## Wave Structure

| Wave | Tasks | Parallel? | Preconditions | Verification Gate |
|------|-------|-----------|---------------|-------------------|
| 1 | 1.1 (smoke test: load + status) | No | PRD exists, omp installed, extension loads | `omp -p -e ./index.ts "/ultramode status"` exits 0 with correct initial state |
| 2 | 2.1 (activation + work selection) | No | Wave 1 passes; at least one open bead exists | Session journal contains `ultramode-control` entry with `mode: "on"`; bv/br exec calls visible |
| 3 | 3.1 (state persistence) | No | Wave 2 passes; `ultramode-control` entry in journal | After `--continue`, `/ultramode status` shows `mode: on` |
| 4 | 4.1 (turn_end decision loop) | No | Wave 2 passes; a phase was executed (agent produced output) | Session shows `decide()` was called after phase completion; decision acted on |
| 5 | 5.1 (re-entrancy guard) | No | Wave 2 passes; followUp message was injected | No duplicate phase commands in journal |
| 6 | 6.1 (retry cap), 6.2 (no /close), 6.3 (off), 6.4 (continue) | Yes | Wave 2 passes | Each sub-task independently verifiable |
| 7 | 7.1 (evidence recording) | No | All waves complete | `completion-evidence.json` exists with all 12 requirements recorded |

## Tasks

### Wave 1: Smoke Test — Extension Load + Status

**Task 1.1: Verify extension loads and `/ultramode status` returns correct initial state**

Run a minimal OMP session with the extension loaded via `-e ./index.ts`. Verify the extension loads without errors (no module resolution failures, no TypeErrors). Then run `/ultramode status` and verify it returns the default state: mode=off, beadId=none, phase=selecting, retries=0/3.

This is the gate — if the extension doesn't load, all subsequent waves are blocked.

```
# Session 1 commands:
omp -p --mode json -e ./index.ts "/ultramode status"

# Expected: exit 0
# Expected output: JSON containing notification text with "mode: off", "bead: none", "phase: selecting", "retries: 0/3"
# Verify session journal exists at ~/.omp/agent/sessions/-repos-ultramode/ with a session entry

# Also verify clean load (no extension-specific errors):
omp -p -e ./index.ts "echo hello"
# Expected: exit 0, output "hello", no error messages
```

**Verification:** Command exits 0; output contains the expected status fields; no error messages in output.

### Wave 2: Activation + Work Selection

**Task 2.1: Verify `/ultramode on` triggers work selection**

Prerequisite: create a disposable test bead so `runSelection` has work to select. Then run `/ultramode on` in a session with the extension loaded. Verify: (a) `bv --robot-triage --format json` exec call fires, (b) `br scheduler --json` exec call fires, (c) `decide()` is called (evidenced by a selection/idle/error notification), (d) state is persisted to the journal as an `ultramode-control` custom entry with `mode: "on"`.

Challenge: in non-interactive mode (`-p`), the async `runSelection` may not complete before the session exits. If the journal doesn't show the full selection flow, fall back to interactive mode with `timeout 60 omp -e ./index.ts`.

```
# Prerequisite: create disposable test bead
ACTOR="${BR_ACTOR:-assistant}"
br create --actor "$ACTOR" "Disposable test bead for ultramode-aqr e2e" --type task --priority 3 --json

# Session 2 command (non-interactive):
omp -p --mode json -e ./index.ts "/ultramode on"

# If non-interactive doesn't capture enough, use interactive:
timeout 60 omp -e ./index.ts
# Then type: /ultramode on
# Wait for selection notification or idle notification
# Then type: /ultramode status
# Then Ctrl+C to exit

# Post-session verification:
# 1. Find the session journal:
JOURNAL=$(find ~/.omp/agent/sessions/-repos-ultramode/ -name "*.jsonl" -mmin -5 | head -1)
# 2. Check for ultramode-control entries:
python3 -c "
import json
for line in open('$JOURNAL'):
    e = json.loads(line)
    if e.get('customType') == 'ultramode-control':
        print(json.dumps(e, indent=2))
"
# Expected: at least one entry with data.mode == "on"
# 3. Check for bv/br exec calls in the journal:
python3 -c "
import json
for line in open('$JOURNAL'):
    e = json.loads(line)
    s = json.dumps(e)
    if 'robot-triage' in s or 'scheduler' in s:
        print(s[:200])
"
# Expected: at least one line showing bv triage or br scheduler was called
```

**Verification:** Session journal contains `ultramode-control` entry with `mode: "on"`; bv/br exec calls visible in journal or session output.

### Wave 3: State Persistence

**Task 3.1: Verify state survives session restart via journal reconstruction**

Run `/ultramode on` in a session (from Wave 2). Terminate the session. Resume with `omp --continue`. Run `/ultramode status`. Verify it shows `mode: on` — reconstructed from the session journal via `getBranch()` → `reconstructState()`.

This tests the `reconstructState()` function (index.ts:152-184) against the real session journal format. If the journal format differs from what the function expects, reconstruction will silently fall back to default state (`mode: off`) — that's a live bug.

```
# Session 3a: activate the loop
omp -p --mode json -e ./index.ts "/ultramode on"
# (or use interactive mode from Wave 2)

# Session 3b: resume and check status
omp --continue --mode json -e ./index.ts "/ultramode status"

# Expected: output contains "mode: on" (reconstructed from journal)
# If output shows "mode: off", reconstruction failed — that's a finding

# Verify journal has ultramode-control entries:
JOURNAL=$(find ~/.omp/agent/sessions/-repos-ultramode/ -name "*.jsonl" -mmin -10 | head -1)
python3 -c "
import json
for line in open('$JOURNAL'):
    e = json.loads(line)
    if e.get('customType') == 'ultramode-control':
        print(json.dumps(e.get('data', {}), indent=2))
"
# Expected: data.mode == "on" in at least one entry
```

**Verification:** After `--continue`, `/ultramode status` shows `mode: on`; journal contains `ultramode-control` entries with `mode: "on"`.

### Wave 4: turn_end Decision Loop

**Task 4.1: Verify `turn_end` fires the decision loop after a phase completes**

This is the hardest test. It requires: (1) `/ultramode on` selects a bead and injects `/create <bead-id>`, (2) the agent processes `/create` and produces output, (3) `turn_end` fires, (4) `handleTurnEnd` calls `decide()`, (5) the decision is acted on.

In non-interactive mode, `turn_end` fires after the agent processes the prompt. But `/ultramode on` is processed as a command, not as a regular prompt — the `runSelection` async call injects a followUp message (`/create <bead-id>`), which the agent may or may not process before the session exits.

Approach: use interactive mode (`omp -e ./index.ts` without `-p`). Run `/ultramode on`, wait for the selection to fire and `/create` to be injected, let the agent process `/create`, then observe whether `turn_end` fires the decision loop (notification "ultramode: proceeding" or "ultramode: decision failed").

```
# Interactive session:
timeout 120 omp -e ./index.ts
# Type: /ultramode on
# Wait for: "ultramode: selected bead <id>" or "ultramode: no ready work"
# If selected, wait for: /create to be injected and agent to process it
# Observe: "ultramode: proceeding — <reasoning>" (proceed) or "ultramode: retry" or "ultramode: stopping"
# Type: /ultramode status
# Ctrl+C to exit

# Post-session verification:
JOURNAL=$(find ~/.omp/agent/sessions/-repos-ultramode/ -name "*.jsonl" -mmin -10 | head -1)
# Check for decision-related notifications or state transitions:
python3 -c "
import json
for line in open('$JOURNAL'):
    e = json.loads(line)
    s = json.dumps(e)
    if 'ultramode' in s.lower() and ('proceed' in s or 'retry' in s or 'reject' in s or 'stop' in s or 'decision' in s or 'proceeding' in s):
        print(s[:300])
"
# Expected: at least one entry showing a decision was made (proceed/retry/reject/stop)
```

**Verification:** Session journal or output shows `decide()` was called after a phase completed and a decision was acted on (next command injected or mode=idle).

### Wave 5: Re-entrancy Guard

**Task 5.1: Verify `hasPendingMessages` guard prevents duplicate phase commands**

After `/ultramode on` injects a followUp (`/create <bead-id>`), the next `turn_end` should NOT call `handleTurnEnd` if the followUp is still pending. Verify by checking the session journal for duplicate phase commands — only one `/create` injection should appear.

If `hasPendingMessages()` is not available on this OMP version, the guard is a no-op (the code checks `typeof ctx.hasPendingMessages === "function"`). Document this as a finding — re-entrancy protection relies on `deliverAs: "followUp"` timing alone.

```
# Use the session journal from Wave 2 or Wave 4:
JOURNAL=$(find ~/.omp/agent/sessions/-repos-ultramode/ -name "*.jsonl" -mmin -30 | head -1)
# Count occurrences of /create in user message content:
python3 -c "
import json
count = 0
for line in open('$JOURNAL'):
    e = json.loads(line)
    if e.get('type') == 'message':
        msg = e.get('message', {})
        if msg.get('role') == 'user':
            content = msg.get('content', '')
            if isinstance(content, str) and '/create' in content:
                count += 1
                print(f'Found /create injection: {content[:100]}')
            elif isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get('type') == 'text' and '/create' in block.get('text', ''):
                        count += 1
                        print(f'Found /create injection: {block[\"text\"][:100]}')
print(f'Total /create injections: {count}')
"
# Expected: exactly 1 (or 0 if no bead was selected)
# If >1, the re-entrancy guard failed — duplicate phase commands were injected
```

**Verification:** Journal shows exactly 1 `/create` injection (not 2+). If `hasPendingMessages` unavailable, document as a finding.

### Wave 6: Parallel Verification (Retry, No-/close, Off, Continue)

**Task 6.1: Verify retry cap marks bead blocked after 3 retries**

Simulate a failing phase. Approach: create a bead with a description that causes `/create` to fail or produce incomplete output. The decision loop should detect the failure and retry. After 3 retries, `markBlocked` fires (`br update <bead-id> --status blocked`).

If controlling a failure live is impractical, verify the retry path indirectly: check that `state.retries` increments in the journal and `COMMAND_FROM_PHASE` (not `PHASE_WHITELIST`) is used for retry commands.

```
# Create a bead with an impossible description:
ACTOR="${BR_ACTOR:-assistant}"
br create --actor "$ACTOR" "Impossible bead: implement a perpetual motion machine in TypeScript" --type task --priority 4 --json

# Run interactive session:
timeout 180 omp -e ./index.ts
# Type: /ultramode on
# Wait for the impossible bead to be selected
# Let /create fail repeatedly
# Observe: "ultramode: retry 1/3", "ultramode: retry 2/3", "ultramode: retry 3/3"
# Then: "ultramode: bead marked blocked"
# Then: loop picks next bead or idles

# Post-session verification:
JOURNAL=$(find ~/.omp/agent/sessions/-repos-ultramode/ -name "*.jsonl" -mmin -30 | head -1)
# Check for retry count increments and blocked status:
python3 -c "
import json
for line in open('$JOURNAL'):
    e = json.loads(line)
    if e.get('customType') == 'ultramode-control':
        d = e.get('data', {})
        if d.get('retries', 0) > 0:
            print(f'retries={d[\"retries\"]} mode={d[\"mode\"]} beadId={d.get(\"beadId\")}')
    s = json.dumps(e)
    if 'blocked' in s and 'br' in s:
        print(f'Blocked call: {s[:200]}')
"
# Expected: retries incrementing 1, 2, 3, then a br update --status blocked call
```

**Verification:** Journal shows retries incrementing and a `br update --status blocked` call. If impractical to trigger live, document the indirect evidence.

**Task 6.2: Verify no `/close` command is ever injected (parallel with 6.1)**

Scan ALL session journals from this bead's test sessions for `/close` or `/merge` in message content. This is a negative test — it passes if the string is absent.

```
# Scan all recent session journals:
for JOURNAL in $(find ~/.omp/agent/sessions/-repos-ultramode/ -name "*.jsonl" -mmin -120); do
    echo "=== $JOURNAL ==="
    python3 -c "
import json, sys
count = 0
for line in open(sys.argv[1]):
    e = json.loads(line)
    if e.get('type') == 'message':
        msg = e.get('message', {})
        if msg.get('role') == 'user':
            content = msg.get('content', '')
            if isinstance(content, str) and ('/close' in content or '/merge' in content):
                count += 1
                print(f'FOUND: {content[:100]}')
            elif isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get('type') == 'text':
                        t = block.get('text', '')
                        if '/close' in t or '/merge' in t:
                            count += 1
                            print(f'FOUND: {t[:100]}')
print(f'/close or /merge injections: {count}')
" "$JOURNAL"
done
# Expected: 0 across all journals
```

**Verification:** 0 matches for `/close` or `/merge` in any session journal.

**Task 6.3: Verify `/ultramode off` deactivates the loop (parallel with 6.1)**

Run `/ultramode off` and verify mode changes to "off", state is persisted, and no further decision calls fire.

```
# Run in a session:
omp -p --mode json -e ./index.ts "/ultramode off"
# Then check status:
omp -p --mode json -e ./index.ts "/ultramode status"
# Expected: "mode: off"

# Or use --continue from a session where mode was "on":
omp --continue --mode json -e ./index.ts "/ultramode off"
# Then:
omp --continue --mode json -e ./index.ts "/ultramode status"
# Expected: "mode: off"
```

**Verification:** `/ultramode status` shows `mode: off` after running `/ultramode off`.

**Task 6.4: Verify `/ultramode continue` resets and picks next bead (parallel with 6.1)**

Run `/ultramode continue` after a bead is blocked or completed. Verify state resets (beadId=null, phase=selecting, retries=0) and `runSelection()` fires.

```
# Run after a bead is blocked (from Task 6.1) or after /ultramode off:
omp --continue --mode json -e ./index.ts "/ultramode continue"
# Then check status:
omp --continue --mode json -e ./index.ts "/ultramode status"
# Expected: new beadId (if work available) or mode=idle (if no work)
# Expected: phase=selecting, retries=0

# Verify journal shows reset:
JOURNAL=$(find ~/.omp/agent/sessions/-repos-ultramode/ -name "*.jsonl" -mmin -10 | head -1)
python3 -c "
import json
entries = []
for line in open('$JOURNAL'):
    e = json.loads(line)
    if e.get('customType') == 'ultramode-control':
        entries.append(e.get('data', {}))
if entries:
    last = entries[-1]
    print(f'Last state: mode={last.get(\"mode\")} beadId={last.get(\"beadId\")} phase={last.get(\"phase\")} retries={last.get(\"retries\")}')
"
# Expected: phase=selecting, retries=0
```

**Verification:** `/ultramode status` shows phase=selecting, retries=0 after `/ultramode continue`.

### Wave 7: Evidence Recording

**Task 7.1: Record all findings in `completion-evidence.json`**

After all verification sessions are complete, write `completion-evidence.json` with each requirement marked as passed/failed, the exact commands run, observed output, and any findings (live bugs, unexpected behavior, limitations discovered).

```
# Write completion-evidence.json with:
# - beadId: ultramode-aqr
# - status: verified (if all MUST requirements pass) or issues-found (if any fail)
# - passedChecks: array of {command, expected, result} for each passing check
# - failedChecks: array of {command, expected, result, finding} for each failing check
# - uncheckedRisks: any requirements that couldn't be verified and why
# - findings: any live bugs discovered, with file/line references
```

**Verification:** `completion-evidence.json` exists at `.beads/artifacts/ultramode-aqr/completion-evidence.json` with all 12 requirements recorded.

## Full Verification

```bash
# 1. Extension loads without errors
omp -p -e ./index.ts "echo test"
# Expected: exit 0, output "hello", no errors

# 2. /ultramode status returns correct initial state
omp -p --mode json -e ./index.ts "/ultramode status"
# Expected: output contains "mode: off", "bead: none", "phase: selecting", "retries: 0/3"

# 3. /ultramode on triggers work selection (requires open bead + interactive mode)
timeout 60 omp -e ./index.ts
# Type: /ultramode on
# Expected: notification "ultramode: selected bead <id>" or "ultramode: no ready work"

# 4. State persisted to journal
JOURNAL=$(find ~/.omp/agent/sessions/-repos-ultramode/ -name "*.jsonl" -mmin -10 | head -1)
python3 -c "
import json
for line in open('$JOURNAL'):
    e = json.loads(line)
    if e.get('customType') == 'ultramode-control':
        print(json.dumps(e.get('data'), indent=2))
"
# Expected: at least one entry with mode: "on"

# 5. State survives restart
omp --continue --mode json -e ./index.ts "/ultramode status"
# Expected: "mode: on" (reconstructed from journal)

# 6. No /close injected
for J in $(find ~/.omp/agent/sessions/-repos-ultramode/ -name "*.jsonl" -mmin -120); do
    python3 -c "
import json, sys
for line in open(sys.argv[1]):
    e = json.loads(line)
    if e.get('type') == 'message' and e.get('message',{}).get('role') == 'user':
        c = e['message'].get('content', '')
        if isinstance(c, str) and ('/close' in c or '/merge' in c):
            print(f'FAIL: found /close or /merge in {sys.argv[1]}')
" "$J"
done
# Expected: no output (no /close or /merge found)

# 7. /ultramode off works
omp -p --mode json -e ./index.ts "/ultramode off"
# Then:
omp -p --mode json -e ./index.ts "/ultramode status"
# Expected: "mode: off"

# 8. completion-evidence.json exists
ls -la .beads/artifacts/ultramode-aqr/completion-evidence.json
# Expected: file exists with content
```
