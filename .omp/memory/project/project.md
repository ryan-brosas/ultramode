---
purpose: Project vision, goals, success criteria, and current phase
updated: 2026-06-18
---

# Project: Ultramode

## The Goal

A standalone OMP extension package that drives the beads workflow (`/create` → `/plan` → `/ship` → `/verify` → `/review` → `/pr`) autonomously. An LLM decision agent selects ready beads from br/bv output, decides whether each phase succeeded, and injects the next phase command via `sendUserMessage`. The loop stops at `/pr` — the human merges.

## Success Criteria

1. **Extension loads and `/ultramode status` works** — `omp install` completes, `session_start` fires, `/ultramode status` returns `mode=off, beadId=none, phase=none, retries=0`
2. **LLM-driven decisions use `complete()` from `@oh-my-pi/pi-ai`** — zero references to `runEphemeralTurn` (method not accessible to extensions)
3. **Phase chaining never injects `/close`** — `PHASE_WHITELIST` terminal case is `pr → idle`; every `sendUserMessage` call uses the whitelist
4. **State survives session restart** — `appendEntry("ultramode-control", state)` persists; `getBranch()` reconstruction on `session_start` restores mode/beadId/phase/retries
5. **Retry cap marks beads blocked** — after 3 retries, `br update --status blocked` fires and the loop picks the next bead

## Current Phase

- **Status:** active
- **Milestone:** `ultramode-air` complete — test harness added (48 tests, 5 risk paths covered), PR #1 open awaiting merge
- **Next:** Merge PR #1, then brainstorm follow-up beads — live OMP session end-to-end test, worktree enforcement

Update this section after every milestone. An agent reading this must understand, within 3 seconds, what the project is doing right now.
