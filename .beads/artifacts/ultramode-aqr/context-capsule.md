# Context Capsule: ultramode-aqr

## Objective

This bead verifies the ultramode extension works correctly in a real OMP session. The extension has 48 unit tests (ultramode-air) that mock the OMP runtime, but has never been run live. The `ultramode-fpj` completion evidence lists 5 unchecked runtime risks (complete() API key resolution, sendUserMessage re-entrancy, ctx.model undefined, br scheduler empty, LLM invalid JSON). This bead runs a series of real `omp` sessions with the extension loaded via `-e ./index.ts`, verifies each PRD requirement with observed evidence from session journals and JSON output, and records findings in `completion-evidence.json`. No code changes to `index.ts` — this is a verification-only bead. If live bugs are discovered, they become separate fix beads.

## Key Patterns

- **Extension loading via `-e` flag** — `omp -p --mode json -e ./index.ts "<command>"` loads the extension for a single non-interactive session. This is equivalent to `omp install .` but scoped to one invocation (no global plugin state pollution). Verified: `omp -p -e ./index.ts "echo test"` exits 0 with no errors.
- **Session journal as evidence source** — The session journal at `~/.omp/agent/sessions/-repos-ultramode/<timestamp>_<session-id>.jsonl` is the ground truth for state persistence (`ultramode-control` custom entries) and message injection (user message entries with `/create` content). JSONL format, parseable with `python3 -c "import json..."`. Reference: `index.ts:152-184` for `reconstructState()` which reads these entries.
- **Non-interactive vs interactive mode** — `omp -p` (non-interactive) processes a single prompt and exits. Good for smoke tests (`/ultramode status`) but may not capture async `runSelection` or `turn_end` behavior. `omp` (interactive) runs until Ctrl+C — use `timeout 60 omp -e ./index.ts` to bound duration. Use interactive mode for Requirements 4-6 (work selection, sendUserMessage, turn_end).
- **State persistence pattern** — `pi.appendEntry("ultramode-control", state)` writes a custom entry to the session journal. `reconstructState()` (index.ts:152-184) scans `getBranch()` for the last `ultramode-control` entry and restores state. Test this by running `/ultramode on`, killing the session, resuming with `--continue`, and checking `/ultramode status` shows `mode: on`.
- **Decision loop pattern** — `handleTurnEnd()` (index.ts:557-775) is the core decision loop. After a phase completes, it calls `decide()` with a decision prompt, parses the LLM response, and acts on the decision (proceed/reject/retry/stop). Evidence: notification "ultramode: proceeding — <reasoning>" or state transition in journal.

## Constraints

1. **Do NOT modify `index.ts`** — the extension is under test. Any code changes invalidate the test results. If a bug is found, file a separate fix bead.
2. **Do NOT modify `test/`** — the unit test harness is not part of this bead. It belongs to `ultramode-air` (closed).
3. **Do NOT modify `prompts/*.md`** — the LLM prompt templates are not part of this bead.
4. **Do NOT modify `package.json`** — the plugin manifest is not part of this bead.
5. **Do NOT modify `.omp/`** — the harness configuration, commands, skills, templates are not part of this bead.
6. **Do NOT use `omp install .`** — this modifies global plugin state (extension loads in ALL future sessions). Use `-e ./index.ts` for scoped testing.
7. **Do NOT run `/close` or `/merge`** — the extension stops at `/pr`. The human merges. This is RULE #6.
8. **Use disposable test beads** — live sessions may claim beads or mark them blocked. Create dummy beads with `br create` before testing. Clean up with `br close` after.
9. **Use `timeout` with interactive mode** — interactive `omp` sessions can hang indefinitely. Always use `timeout 60 omp ...` or `timeout 120 omp ...` to bound.
10. **Use the cheapest available model** — LLM calls cost money. The extension uses whatever model the session has configured. Use `--model <cheapest>` if available.

## File Ownership

| Task | Allowed | Forbidden |
|------|---------|-----------|
| 1.1-1.3 (smoke test) | None (read-only verification) | All source files |
| 2.1 (create test bead) | `.beads/` (br create) | All source files |
| 2.2-2.4 (activation + selection) | None (read-only verification) | All source files |
| 3.1 (state persistence) | None (read-only verification) | All source files |
| 4.1 (turn_end decision loop) | None (read-only verification) | All source files |
| 5.1 (re-entrancy guard) | None (read-only verification) | All source files |
| 6.1 (retry cap) | `.beads/` (br create, br close) | All source files |
| 6.2 (no /close) | None (read-only verification) | All source files |
| 6.3 (/ultramode off) | None (read-only verification) | All source files |
| 6.4 (/ultramode continue) | None (read-only verification) | All source files |
| 7.1 (evidence recording) | `.beads/artifacts/ultramode-aqr/completion-evidence.json` | All source files |
| 8.1 (cleanup) | `.beads/` (br close, br sync) | All source files |

## Graph Context

- **Blast radius:** 0 source files (verification-only — no code changes to index.ts, test/, prompts/)
- **Related beads:** 2 (`ultramode-fpj` closed — implemented extension; `ultramode-air` closed — added unit tests)
- **File history:** `index.ts` has 2 bead history (ultramode-fpj created it, ultramode-air added test exports). This bead reads but does not modify it.
- **Hotspots touched:** None — no source files modified. Session journals at `~/.omp/agent/sessions/-repos-ultramode/` are read-only evidence.

## Session Journal Format (verified during investigation)

The session journal at `~/.omp/agent/sessions/-repos-ultramode/` contains JSONL files:
- Naming: `<timestamp>_<session-id>.jsonl` (e.g. `2026-06-18T01-04-33-450Z_019ed842-22aa-7000-854b-74881bef5b26.jsonl`)
- Entry types:
  - `{"type": "session", "id": "<uuid>", "cwd": "<path>", "title": "<auto-generated>", ...}` — session metadata
  - `{"type": "message", "id": "<hex>", "message": {"role": "user|assistant|toolResult", "content": [...]}, ...}` — conversation messages
  - `{"type": "custom", "customType": "ultramode-control", "data": {"mode": "on|off|idle", "beadId": "<id>|null", "phase": "<phase>", "retries": <n>, ...}}` — extension state
- `getBranch()` returns these entries as an array
- `reconstructState()` (index.ts:152-184) scans for the last `ultramode-control` entry and validates fields before restoring

## Verification Commands Reference

```bash
# Find the latest session journal:
JOURNAL=$(find ~/.omp/agent/sessions/-repos-ultramode/ -name "*.jsonl" -mmin -10 | head -1)

# Extract ultramode-control entries:
python3 -c "
import json
for line in open('$JOURNAL'):
    e = json.loads(line)
    if e.get('customType') == 'ultramode-control':
        print(json.dumps(e.get('data', {}), indent=2))
"

# Find /create injections:
python3 -c "
import json
for line in open('$JOURNAL'):
    e = json.loads(line)
    if e.get('type') == 'message' and e.get('message', {}).get('role') == 'user':
        content = e['message'].get('content', '')
        if isinstance(content, str) and '/create' in content:
            print(f'Found: {content[:100]}')
        elif isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get('type') == 'text' and '/create' in block.get('text', ''):
                    print(f'Found: {block[\"text\"][:100]}')
"

# Scan for /close or /merge (negative test):
for J in $(find ~/.omp/agent/sessions/-repos-ultramode/ -name "*.jsonl" -mmin -120); do
    python3 -c "
import json, sys
for line in open(sys.argv[1]):
    e = json.loads(line)
    if e.get('type') == 'message' and e.get('message', {}).get('role') == 'user':
        c = e['message'].get('content', '')
        if isinstance(c, str) and ('/close' in c or '/merge' in c):
            print(f'FAIL: found in {sys.argv[1]}')
" "$J"
done
```

## Non-Interactive Mode Limitations

`omp -p` (non-interactive) processes a single prompt and exits. This means:

- **Works well for:** `/ultramode status` (Req 3), `/ultramode off` (Req 10), extension load verification (Req 1), session_start verification (Req 2)
- **May not work for:** `/ultramode on` (Req 4) — async `runSelection` may not complete before exit; `turn_end` decision loop (Req 6) — no phase completion to evaluate; `sendUserMessage` (Req 5) — followUp may not be processed before exit
- **Fallback:** Use interactive mode (`timeout 60 omp -e ./index.ts`), type commands manually, observe notifications, Ctrl+C to exit. Then inspect the session journal for evidence.

## Live Bug Discovery Protocol

If a live bug is discovered during verification:
1. **Do NOT fix it in this bead** — file a separate fix bead
2. **Document the bug** in `completion-evidence.json` under `findings`:
   - What happened (observed behavior)
   - What was expected (PRD requirement)
   - Root cause (if identifiable from the journal/output)
   - File and line reference (if applicable)
3. **Continue verification** of other requirements — one bug doesn't block all tests
4. **Mark the affected requirement as `failed`** in the evidence file
