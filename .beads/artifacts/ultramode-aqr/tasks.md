<!-- DENSITY: Minimum 600 lines. No upper bound. <600 = too thin — tasks lack detail, verification steps are vague, dependencies undefined. Every task needs a yaml block, concrete verification steps, and enough detail for parallel execution without reading the PRD or plan. -->
# Tasks: ultramode-aqr

## 1. Smoke Test — Extension Load + Status

### 1.1 Verify extension loads in a real OMP session without errors

```yaml
depends_on: []
parallel: false
conflicts_with: []
files: []
estimated_minutes: 5
```

- [ ] Run `omp -p -e ./index.ts "echo test"` and verify it exits 0 with output "test" and no error messages
- [ ] Check for "Cannot find module" errors in output — none should appear
- [ ] Check for "TypeError" errors in output — none should appear
- [ ] Check for "SyntaxError" errors in output — none should appear
- [ ] Verify: `omp -p -e ./index.ts "echo test" 2>&1 | grep -i "error"` returns empty

### 1.2 Verify `/ultramode status` returns correct initial state

```yaml
depends_on: ["1.1"]
parallel: false
conflicts_with: []
files: []
estimated_minutes: 5
```

- [ ] Run `omp -p --mode json -e ./index.ts "/ultramode status"` and capture output
- [ ] Parse JSON output for notification text containing status information
- [ ] Verify output contains "mode: off" (default state — extension not yet activated)
- [ ] Verify output contains "bead: none" (no bead selected)
- [ ] Verify output contains "phase: selecting" (initial phase)
- [ ] Verify output contains "retries: 0/3" (no retries)
- [ ] Verify: `omp -p --mode json -e ./index.ts "/ultramode status" 2>&1 | grep -o "mode: off"` returns "mode: off"

### 1.3 Verify session_start event fires and extension initializes

```yaml
depends_on: ["1.1"]
parallel: false
conflicts_with: []
files: []
estimated_minutes: 5
```

- [ ] Run a session with the extension loaded
- [ ] Find the session journal at `~/.omp/agent/sessions/-repos-ultramode/`
- [ ] Verify the journal contains a `session` entry with `cwd` matching the repo path
- [ ] Verify the extension's `session_start` handler ran — check for widget update or "ultramode loaded" notification
- [ ] Verify that with mode=off (default), `runSelection` does NOT fire (no bv/br exec calls in the journal)
- [ ] Verify: `JOURNAL=$(find ~/.omp/agent/sessions/-repos-ultramode/ -name "*.jsonl" -mmin -5 | head -1) && python3 -c "import json; [print(e.get('cwd','')) for e in (json.loads(l) for l in open('$JOURNAL')) if e.get('type')=='session']"` shows correct cwd

## 2. Activation + Work Selection

### 2.1 Create disposable test bead for work selection

```yaml
depends_on: ["1.3"]
parallel: false
conflicts_with: []
files: [".beads/"]
estimated_minutes: 2
```

- [ ] Run `ACTOR="${BR_ACTOR:-assistant}" && br create --actor "$ACTOR" "Disposable test bead for ultramode-aqr e2e" --type task --priority 3 --json`
- [ ] Capture the bead ID from output — this is the test bead that `/ultramode on` should select
- [ ] Verify: `br show <test-bead-id> --json` returns the bead with status "open"
- [ ] Note: clean up after testing with `br close <test-bead-id> --reason "Disposable test bead for ultramode-aqr"`

### 2.2 Verify `/ultramode on` activates the loop

```yaml
depends_on: ["2.1"]
parallel: false
conflicts_with: []
files: []
estimated_minutes: 10
```

- [ ] Run `/ultramode on` in a session with the extension loaded
- [ ] If non-interactive mode (`omp -p`): run `omp -p --mode json -e ./index.ts "/ultramode on"`
- [ ] If non-interactive doesn't capture enough: use `timeout 60 omp -e ./index.ts` (interactive), type `/ultramode on`, wait for selection notification, Ctrl+C
- [ ] Verify: a notification appears — either "ultramode: selected bead <id>" or "ultramode: no ready work" or "ultramode: selection failed"
- [ ] Verify: session journal contains an `ultramode-control` custom entry with `data.mode: "on"`
- [ ] Verify: `JOURNAL=$(find ~/.omp/agent/sessions/-repos-ultramode/ -name "*.jsonl" -mmin -5 | head -1) && python3 -c "import json; [print(json.dumps(e.get('data',{}))) for e in (json.loads(l) for l in open('$JOURNAL')) if e.get('customType')=='ultramode-control']"` shows mode: "on"

### 2.3 Verify work selection fires bv + br exec calls

```yaml
depends_on: ["2.2"]
parallel: false
conflicts_with: []
files: []
estimated_minutes: 5
```

- [ ] Inspect the session journal from Task 2.2
- [ ] Verify: journal contains evidence of `pi.exec("bv", ["--robot-triage", ...])` being called — look for bv triage JSON in tool results or exec output
- [ ] Verify: journal contains evidence of `pi.exec("br", ["scheduler", "--json"])` being called — look for scheduler JSON in tool results or exec output
- [ ] Verify: `JOURNAL=$(find ~/.omp/agent/sessions/-repos-ultramode/ -name "*.jsonl" -mmin -10 | head -1) && python3 -c "import json; [print('bv' if 'robot-triage' in json.dumps(e) else '', 'br' if 'scheduler' in json.dumps(e) else '') for e in (json.loads(l) for l in open('$JOURNAL'))]" | grep -v '^$'` shows both bv and br calls

### 2.4 Verify `sendUserMessage` injects a phase command

```yaml
depends_on: ["2.3"]
parallel: false
conflicts_with: []
files: []
estimated_minutes: 5
```

- [ ] If a bead was selected in Task 2.2: inspect the session journal for a user message entry with content starting with `/create`
- [ ] Verify: journal contains a message entry with `role: "user"` and content containing `/create <bead-id>`
- [ ] Verify: the agent processed the `/create` command (not just a notification) — look for agent output following the injection
- [ ] If no bead was selected (mode=idle): document this as expected behavior (no open beads or LLM decided to wait)
- [ ] Verify: `JOURNAL=$(find ~/.omp/agent/sessions/-repos-ultramode/ -name "*.jsonl" -mmin -10 | head -1) && python3 -c "import json; [print(json.dumps(e)[:200]) for e in (json.loads(l) for l in open('$JOURNAL')) if e.get('type')=='message' and e.get('message',{}).get('role')=='user' and '/create' in json.dumps(e.get('message',{}).get('content',''))]"` shows the injection

## 3. State Persistence

### 3.1 Verify state survives session restart via journal reconstruction

```yaml
depends_on: ["2.2"]
parallel: false
conflicts_with: []
files: []
estimated_minutes: 10
```

- [ ] Note the session ID from Task 2.2 (where `/ultramode on` was run)
- [ ] Resume the session: `omp --continue --mode json -e ./index.ts "/ultramode status"`
- [ ] Verify: output contains "mode: on" (reconstructed from journal via `getBranch()` → `reconstructState()`)
- [ ] If output shows "mode: off": reconstruction failed — this is a finding (live bug)
- [ ] Inspect the session journal for `ultramode-control` entries
- [ ] Verify: at least one entry has `data.mode: "on"`
- [ ] Verify: `omp --continue --mode json -e ./index.ts "/ultramode status" 2>&1 | grep "mode: on"` returns "mode: on"

## 4. turn_end Decision Loop

### 4.1 Verify turn_end fires the decision loop after a phase completes

```yaml
depends_on: ["2.4"]
parallel: false
conflicts_with: []
files: []
estimated_minutes: 20
```

- [ ] Use interactive mode: `timeout 120 omp -e ./index.ts`
- [ ] Type `/ultramode on` and wait for bead selection
- [ ] If a bead is selected: wait for `/create` to be injected and the agent to process it
- [ ] After the agent completes `/create` (produces output), observe: turn_end should fire
- [ ] Verify: a notification appears — "ultramode: proceeding — <reasoning>" or "ultramode: retry" or "ultramode: stopping" or "ultramode: decision failed"
- [ ] If "proceeding": verify a next phase command (`/plan <bead-id>`) is injected
- [ ] If "stopping": verify mode changes to "idle"
- [ ] Inspect the session journal for decision-related state transitions
- [ ] Verify: journal shows `decide()` was called (state transition or notification)
- [ ] If turn_end doesn't fire in interactive mode: document as a finding (possible issue with event delivery)
- [ ] Verify: `JOURNAL=$(find ~/.omp/agent/sessions/-repos-ultramode/ -name "*.jsonl" -mmin -30 | head -1) && python3 -c "import json; [print(json.dumps(e)[:300]) for e in (json.loads(l) for l in open('$JOURNAL')) if 'ultramode' in json.dumps(e).lower() and any(k in json.dumps(e).lower() for k in ['proceed','retry','reject','stop','decision'])]"` shows a decision was made

## 5. Re-entrancy Guard

### 5.1 Verify hasPendingMessages guard prevents duplicate phase commands

```yaml
depends_on: ["2.4"]
parallel: false
conflicts_with: []
files: []
estimated_minutes: 5
```

- [ ] Use the session journal from Task 2.4 (where `/create` was injected)
- [ ] Count the number of `/create` injections in the journal
- [ ] Verify: exactly 1 `/create` injection (not 2+)
- [ ] If 2+ injections found: the re-entrancy guard failed — this is a finding
- [ ] Check if `ctx.hasPendingMessages` is available on this OMP version
- [ ] If unavailable: document that the guard is a no-op (graceful degradation) and re-entrancy relies on `deliverAs: "followUp"` timing
- [ ] Verify: `JOURNAL=$(find ~/.omp/agent/sessions/-repos-ultramode/ -name "*.jsonl" -mmin -30 | head -1) && python3 -c "import json; c=0; [exec('c+=1') for e in (json.loads(l) for l in open('$JOURNAL')) if e.get('type')=='message' and e.get('message',{}).get('role')=='user' and '/create' in json.dumps(e.get('message',{}).get('content',''))]; print(f'/create injections: {c}')"` shows count 1

## 6. Parallel Verification

### 6.1 Verify retry cap marks bead blocked after 3 retries

```yaml
depends_on: ["2.4"]
parallel: true
conflicts_with: []
files: [".beads/"]
estimated_minutes: 20
```

- [ ] Create a bead with an impossible description: `br create --actor "$ACTOR" "Implement a perpetual motion machine in TypeScript" --type task --priority 4 --json`
- [ ] Run interactive session: `timeout 180 omp -e ./index.ts`
- [ ] Type `/ultramode on` and wait for the impossible bead to be selected
- [ ] Let `/create` fail repeatedly — the decision loop should retry
- [ ] Observe: "ultramode: retry 1/3", then "retry 2/3", then "retry 3/3"
- [ ] After 3 retries: observe "ultramode: bead marked blocked" or state reset to selecting
- [ ] Verify: `br show <impossible-bead-id> --json` shows status "blocked"
- [ ] If retry cap can't be triggered live: document indirect evidence (state.retries increments in journal, COMMAND_FROM_PHASE used for retry commands)
- [ ] Verify: `br show <impossible-bead-id> --json 2>&1 | grep "blocked"` shows "blocked" status

### 6.2 Verify no /close command is ever injected

```yaml
depends_on: ["2.4"]
parallel: true
conflicts_with: []
files: []
estimated_minutes: 5
```

- [ ] Scan ALL session journals from this bead's test sessions (last 120 minutes)
- [ ] For each journal: search for `/close` or `/merge` in user message content
- [ ] Verify: 0 matches across all journals
- [ ] This is a negative test — it passes if the strings are absent
- [ ] Verify: `for J in $(find ~/.omp/agent/sessions/-repos-ultramode/ -name "*.jsonl" -mmin -120); do python3 -c "import json,sys; [print('FAIL: /close found') for e in (json.loads(l) for l in open(sys.argv[1])) if e.get('type')=='message' and e.get('message',{}).get('role')=='user' and '/close' in json.dumps(e.get('message',{}).get('content',''))]" "$J"; done` produces no output

### 6.3 Verify /ultramode off deactivates the loop

```yaml
depends_on: ["2.2"]
parallel: true
conflicts_with: []
files: []
estimated_minutes: 5
```

- [ ] Run `omp -p --mode json -e ./index.ts "/ultramode off"` and verify exit 0
- [ ] Run `omp -p --mode json -e ./index.ts "/ultramode status"` and verify output contains "mode: off"
- [ ] Verify: mode changed from "on" (or "idle") to "off"
- [ ] Verify: subsequent turns do not trigger decision calls (no bv/br exec calls in journal when mode=off)
- [ ] Verify: `omp -p --mode json -e ./index.ts "/ultramode status" 2>&1 | grep "mode: off"` returns "mode: off"

### 6.4 Verify /ultramode continue resets and picks next bead

```yaml
depends_on: ["6.1"]
parallel: false
conflicts_with: []
files: []
estimated_minutes: 10
```

- [ ] After a bead is blocked (Task 6.1) or after `/ultramode off`, run `/ultramode continue`
- [ ] Run in interactive mode or via `--continue` from a previous session
- [ ] Verify: `/ultramode status` shows phase=selecting, retries=0
- [ ] Verify: `runSelection()` fires (bv/br exec calls visible in journal)
- [ ] If open beads exist: verify a new bead is selected (new beadId in status)
- [ ] If no open beads: verify mode=idle (expected — no work to pick)
- [ ] Verify: `JOURNAL=$(find ~/.omp/agent/sessions/-repos-ultramode/ -name "*.jsonl" -mmin -10 | head -1) && python3 -c "import json; e=[json.loads(l) for l in open('$JOURNAL') if json.loads(l).get('customType')=='ultramode-control']; last=e[-1].get('data',{}) if e else {}; print(f'phase={last.get(\"phase\")} retries={last.get(\"retries\")}')" ` shows phase=selecting, retries=0

## 7. Evidence Recording

### 7.1 Record all findings in completion-evidence.json

```yaml
depends_on: ["1.1", "1.2", "1.3", "2.1", "2.2", "2.3", "2.4", "3.1", "4.1", "5.1", "6.1", "6.2", "6.3", "6.4"]
parallel: false
files: [".beads/artifacts/ultramode-aqr/completion-evidence.json"]
estimated_minutes: 10
```

- [ ] Write `.beads/artifacts/ultramode-aqr/completion-evidence.json` with the following structure:
  - `beadId`: "ultramode-aqr"
  - `status`: "verified" (if all MUST requirements pass) or "issues-found" (if any fail)
  - `passedChecks`: array of `{command, expected, result}` for each passing check
  - `failedChecks`: array of `{command, expected, result, finding}` for each failing check
  - `uncheckedRisks`: array of requirements that couldn't be verified and why
  - `findings`: array of live bugs discovered, with file/line references
- [ ] Record the exact commands run and their exit codes
- [ ] Record observed behavior: notifications, state transitions, injected commands
- [ ] Note any failures or unexpected behavior as findings
- [ ] Clean up disposable test beads: `br close <test-bead-id> --reason "Disposable test bead for ultramode-aqr"`
- [ ] Verify: `ls -la .beads/artifacts/ultramode-aqr/completion-evidence.json` shows file exists with content
- [ ] Verify: `python3 -c "import json; d=json.load(open('.beads/artifacts/ultramode-aqr/completion-evidence.json')); print(d['status']); print(f'{len(d[\"passedChecks\"])} passed, {len(d[\"failedChecks\"])} failed')"` shows status and counts

## 8. Cleanup

### 8.1 Clean up disposable test beads and sync

```yaml
depends_on: ["7.1"]
parallel: false
files: [".beads/"]
estimated_minutes: 5
```

- [ ] Close the disposable test bead created in Task 2.1: `br close <test-bead-id> --reason "Disposable test bead for ultramode-aqr"`
- [ ] Close the impossible bead created in Task 6.1 (if created): `br close <impossible-bead-id> --reason "Disposable test bead for ultramode-aqr"`
- [ ] Run `br sync --flush-only` to export final state to JSONL
- [ ] Run `git add .beads/ && git commit -m "verify: ultramode-aqr evidence"`
- [ ] Verify: `br list --status open --json` shows no leftover disposable beads
- [ ] Verify: `br sync --status` shows clean sync state
