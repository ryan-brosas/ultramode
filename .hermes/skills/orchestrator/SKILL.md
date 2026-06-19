---
name: orchestrator
description: Strict workflow recipe. Run each prompt in sequence. No skipping. No deciding.
---

# orchestrator

## The Core Loop

The core loop: `/create` → `/plan` → `/ship` → `/verify` → `/review` → `/pr` → `/close` → loop.

`/brainstorm` is the entry point — use it when you don't know what to build. Once you have an idea, enter the loop.

`/pr` creates the PR and `/close` marks the bead complete. The human merges the PR at their convenience — don't block on merge.

## The Sequence

| Step | Command | Produces | Gate |
|------|---------|----------|------|
| * | `/brainstorm [topic]` | Candidate work items | User confirms direction |
| 1 | `/create [--worktree] <desc>` | `prd.md`, `prd.json`, `decisions.md` | All sections filled, no placeholders |
| 2 | `/plan <bead-id>` | `plan.md`, `tasks.md`, `context-capsule.md` | Observable truths defined, verification plan exists |
| 3 | `/ship <bead-id>` | Working code, `progress.txt` | Plan verification gates pass per wave |
| 4 | `/verify <bead-id>` | `completion-evidence.json` | All checks pass |
| 5 | `/review <bead-id>` | `review-report.md` | Verdict: approved |
| 6 | `/pr <bead-id>` | PR URL | — |
| 7 | `/close <bead-id>` | Closed bead, synced JSONL | Evidence + review exist |
| → | Back to `/brainstorm` | Next idea | Loop |

`/brainstorm` is starred (*) — it's not always needed. The numbered steps (1-7) are the required sequence for every bead.

## Rules

- **Run each prompt in FULL.** Every section, every step. Do not abbreviate.
- **Do not skip phases.** Create before plan, plan before ship, ship before verify.
- **Do not "helpfully" proceed if the prompt says STOP.** If blocked, run the prerequisite prompt.
- **`/pr` creates the PR, `/close` marks the bead done.** The human merges at their convenience. Don't block on merge.
- **The human always gets the last call on merges.** The agent proposes, the human decides.
- **The workflow-gate extension enforces this.** It blocks `edit`/`write` until PRD and plan exist. Don't fight it.
- **If the user says "just do X"**, route them to the right phase. "That's a /ship step — let's /plan first."
- **If a phase fails verification**, stay in that phase. Do not advance until the gate clears.

## Routing

- Idea still fuzzy or looking for what to build → `/brainstorm`
- Work item chosen but not formalized → `/create`
- PRD exists but implementation path is unclear → `/plan`
- PRD and plan exist and code must change → `/ship`
- Code changed and behavior must be proven → `/verify`
- Verification complete and risk must be assessed → `/review`
- Review approved and change must be proposed upstream → `/pr`
- PR created and bead must be finalized → `/close`
- Bead closed, looking for next thing → `/brainstorm`

## Artifacts Per Phase

| Phase | Artifacts |
|-------|-----------|
| `/brainstorm` | Decision, rationale, scope boundaries (terminal output) |
| `/create` | `prd.md`, `prd.json`, `decisions.md`, optional `worktree.txt` |
| `/plan` | `plan.md`, `tasks.md`, `context-capsule.md` |
| `/ship` | Implementation changes, `progress.txt` |
| `/verify` | `completion-evidence.json` |
| `/review` | `review-report.md` |
| `/pr` | PR URL (terminal output) |
| `/close` | Closed bead in br, synced JSONL |

## Related Skills

- **`br`** — Bead state, ownership, and artifact location. Load before mutating bead state.
- **`bv`** — Graph-informed triage, impact, and review context. Load before every phase.
- **`verification-before-completion`** — Evidence discipline. Load before review, PR, or close.
- **`incremental-implementation`** — Slice strategy during /ship.
- **`reflection-checkpoints`** — Scope drift detection during /ship.
- **`test-driven-development`** — Write tests first during /ship.
- **`code-simplification`** — Reduce complexity during refactoring.
- **`security-and-hardening`** — Security audit during /review.

Full skills map in `.hermes/AGENTS.md`.
