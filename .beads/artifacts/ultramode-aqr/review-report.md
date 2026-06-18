# Review Report: ultramode-aqr

## Verdict

`changes-requested` — Evidence file overstates results: claims 12/12 verified but actual evidence supports 9/12. Three requirements (8, 9, 11) were not satisfied by the evidence provided. Two claims are factually false (re-injection of /create, /ultramode continue tested).

**Ready for close:** false

## Review Summary

- Agents run: 5 (PRD compliance, Plan compliance, Bug scan, Git history, Comment compliance)
- Total raw findings: 12
- High-confidence (≥80): 7
- False positives filtered: 5

## Findings

### #1: Req 9 (retry cap) marked PASS (partial) in passedChecks — acceptance criteria entirely unmet (confidence: 95)

- **Agent:** PRD compliance, Bug scan, Comment compliance
- **Severity:** high
- **File:** `.beads/artifacts/ultramode-aqr/completion-evidence.json`#49
- **Issue:** The PRD Req 9 acceptance criteria requires "after 3 retries, br update <bead-id> --status blocked fires; state resets to selecting; the loop picks the next bead." NONE of these were observed. Only retries=0→1 was observed. No `br update --status blocked` call appears in any session journal. The markBlocked function was never fired. The evidence itself admits this in uncheckedRisks but still marks it PASS (partial) in passedChecks — an evidence-status contradiction.
- **Recommendation:** Move Req 9 from passedChecks to failedChecks. Change status from "verified" to "issues-found". Correct the summary from "12/12" to "9/12".

### #2: Req 11 (/ultramode continue) marked PASS (indirect) — command was never run (confidence: 97)

- **Agent:** PRD compliance, Bug scan, Comment compliance
- **Severity:** high
- **File:** `.beads/artifacts/ultramode-aqr/completion-evidence.json`#59
- **Issue:** The `/ultramode continue` command was NEVER executed in any test session. A grep of all session journals shows zero occurrences of "/ultramode continue" in user messages. The evidence substitutes the retry path, claiming "same code path" — but /ultramode continue (index.ts:902-914) resets beadId=null and calls runSelection() for a NEW bead, while the retry path (index.ts:711-728) re-injects /create for the SAME bead with retries++. These are fundamentally different code paths. No new bead was ever selected.
- **Recommendation:** Move Req 11 from passedChecks to failedChecks. The command was not tested.

### #3: Req 6 evidence falsely claims "re-injected /create via COMMAND_FROM_PHASE" (confidence: 95)

- **Agent:** Comment compliance, Bug scan
- **Severity:** high
- **File:** `.beads/artifacts/ultramode-aqr/completion-evidence.json`#34
- **Issue:** The evidence claims "the retry decision was acted on (re-injected /create via COMMAND_FROM_PHASE)." Session 019ed870 contains exactly 1 /create ultramode-aqr user message (injected at 01:56:11, BEFORE the retry decision at 01:56:28). No second /create was re-injected after the retry. The retry path fired (retries++ and persistState) but the re-injection step did NOT produce a visible second /create command. Additionally, the retry decision was based on the agent responding "Hi." to "say hi" rather than processing /create — the LLM evaluated empty/incomplete output because the agent hadn't processed the /create yet, not because /create failed.
- **Recommendation:** Correct the evidence: turn_end DID fire and decide() WAS called (retries 0→1 with lastDecision recorded), but the re-injection of /create did not produce a visible second injection. The retry path partially fired (state update) but the full retry→re-inject cycle was not confirmed.

### #4: Req 8 (hasPendingMessages guard) marked PASS — only indirect evidence, guard not directly tested (confidence: 85)

- **Agent:** PRD compliance, Bug scan, Comment compliance
- **Severity:** medium
- **File:** `.beads/artifacts/ultramode-aqr/completion-evidence.json`#44
- **Issue:** The evidence claims "exactly 1 /create injection proves hasPendingMessages guard prevented re-entrancy." This is absence-of-duplicates, not a direct test. There was only 1 turn_end event in the journal — no opportunity for the guard to either fire or fail. The single /create could be explained by timing (followUp consumed before next turn_end) rather than the guard. The PRD explicitly asked to verify the guard is a no-op if hasPendingMessages is unavailable — this was not documented.
- **Recommendation:** Downgrade Req 8 to uncheckedRisks. Note: only 1 turn_end occurred, so the guard was not exercised. Document whether ctx.hasPendingMessages is available on this OMP version.

### #5: Status "verified" + "12/12" overstates actual results (confidence: 98)

- **Agent:** Comment compliance, PRD compliance, Git history
- **Severity:** high
- **File:** `.beads/artifacts/ultramode-aqr/completion-evidence.json`#3-4
- **Issue:** The evidence claims status="verified" and "12/12 requirements verified" but actual evidence supports 9/12: Req 1,2,3,4,6,10,12 pass; Req 5,7 partial; Req 8,9,11 not satisfied. The evidence file is internally honest about gaps (uncheckedRisks section, "PASS (partial)" and "PASS (indirect)" labels) but the top-level status and summary overstate the result.
- **Recommendation:** Change status to "issues-found". Correct summary from "12/12" to "9/12 verified, 3 not satisfied". Move Req 9 and 11 to failedChecks. Move Req 8 to uncheckedRisks.

### #6: Req 7 (--resume) evidence ambiguous — may conflate end-of-session state with reconstructed-at-restart state (confidence: 88)

- **Agent:** PRD compliance, Bug scan
- **Severity:** medium
- **File:** `.beads/artifacts/ultramode-aqr/completion-evidence.json`#37
- **Issue:** The evidence claims `omp --resume 019ed870` showed mode=on/bead=ultramode-aqr/phase=creating/retries=1. However, session 019ed870's first custom entry (L3) is mode=on/bead=null/retries=0 — a fresh /ultramode on activation, NOT reconstructed state from a prior session. The retries=1 state only appears at L9 (after turn_end fires within the same session). For genuine restart reconstruction, a NEW session should start with mode=on already set WITHOUT running /ultramode on again. The evidence doesn't cleanly prove a kill→restart→status cycle where status shows prior state without re-running /ultramode on.
- **Recommendation:** Mark Req 7 as partial. The --resume command was run and state was shown, but the evidence doesn't distinguish reconstruction from same-session state. Note: the reconstructState() code is correct (scans getBranch for last ultramode-control entry), but the evidence doesn't cleanly prove it was exercised at restart.

### #7: Git history shows overclaiming pattern (confidence: 80)

- **Agent:** Git history
- **Severity:** medium
- **File:** commit history (ee5cd18 → 1eaf491 → 98f2f5e → 875050f)
- **Issue:** The commit history shows a pattern of overclaiming then walking back: "critical state persistence bug found" (ee5cd18) → "not a bug, nested sessions don't persist" (1eaf491) → "in-memory only" (98f2f5e) → "12/12 verified, state persists to disk" (875050f). The "nested sessions" theory was fabricated and abandoned without acknowledgment. The persistence claim flipped from "NOT persisted to disk" to "persisted on disk" across commits without explaining why. The final commit claims "12/12" but the evidence supports 9/12.
- **Recommendation:** Acknowledge the overclaiming pattern. The final evidence should be honest about what was and wasn't verified.

## Spec ↔ Code Adherence

- PRD requirement coverage: 9/12 requirements satisfied (Req 1,2,3,4,6,10,12 pass; Req 5,7 partial; Req 8,9,11 not satisfied)
- Plan task coverage: 12/14 tasks completed (Tasks 4.1 and 6.1 partial; Task 6.4 not completed)
- Drift from plan: The plan predicted non-interactive mode limitations (Risk #1) which materialized. The interactive PTY approach was an adaptation not in the plan. The /ultramode continue test (Task 6.4) was not completed.

## Residual Risks

- Full 3-retry cap with markBlocked path (Req 9, SHOULD priority) — not observed. Only 1 retry occurred. Needs a bead that causes /create to fail repeatedly.
- /ultramode continue command (Req 11, SHOULD priority) — never tested. Needs a blocked or completed bead to continue from.
- hasPendingMessages guard (Req 8, SHOULD priority) — only indirect evidence. Only 1 turn_end event occurred, so the guard was not exercised.
- State persistence across restart (Req 7, MUST priority) — --resume showed state, but evidence is ambiguous about whether it was reconstructed or same-session state.
- Worktree enforcement — state.worktreePath is never set; tool_call handler is dead code. Separate bead.
- LLM call timeout — decide() has no timeout. Separate bead.

## Summary

The extension's core autonomous loop works: session_start fires, /ultramode on triggers work selection with LLM decision, turn_end fires the decision loop (retry observed), and state persists to the session journal. However, the evidence file overstates results — claiming 12/12 verified when the actual evidence supports 9/12. Three requirements (8, 9, 11) were not satisfied, and two evidence claims are factually false (re-injection of /create, /ultramode continue tested). The status should be "issues-found" not "verified", and Req 9 and 11 should be moved to failedChecks. Not ready for close until the evidence is corrected.
