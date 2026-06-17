---
name: backbone
description: The br + bv workflow backbone reference card. Load first when working in this template.
---

# backbone

## Backbone concept

**br owns state.** It tracks bead status, ownership, and artifact location. Every phase starts with `br show <id>` or `br list` to know what's active.

**bv informs decisions.** It provides graph context (hotspots, impact, related work, blockers) before you act. Every phase starts with a focused `bv --robot-*` query.

**OMP executes.** It provides the tools (read, edit, write, bash, task, todo, lsp) and surfaces (skills, agents, hooks, commands) that do the work.

Together they form the backbone: **bv → br → OMP → repeat.**

## Phase routing table

| Phase | Command | Key tools | Artifacts | Pre-flight checks |
|-------|---------|-----------|-----------|-------------------|
| **brainstorm** | `/brainstorm` | bv (triage, hotspots), read, search | none | bv context loaded; repo state understood |
| **create** | `/create` | br (list, show, create/update) | `prd.md` | bead id confirmed; no duplicate work |
| **plan** | `/plan` | bv (plan, impact, forecast), read | `plan.md` | prd.md exists; blast radius known |
| **ship** | `/ship` | OMP tools (edit, write, bash, task) | changed source files | prd.md + plan.md exist; bv context fresh |
| **verify** | `/verify` | bash, read, search, lsp | `completion-evidence.json` | plan verification section read; checks scoped |
| **review** | `/review` | bv (related, suggest), read, diff | `review-report.md` | evidence recorded; diff inspected |
| **pr** | `/pr` | gh, br, read | PR body | review-report.md exists; branch clean |
| **close** | `/close` | br (close), git | none | all artifacts present; evidence complete |

## Artifact layout

```
.beads/artifacts/<bead-id>/
├── prd.md                   # Problem, outcome, acceptance criteria
├── prd.json                 # Machine-readable requirements mirror
├── plan.md                  # Scope, blast radius, steps, risks, verification
├── tasks.md                 # Ordered task list with dependencies
├── decisions.md             # Architecture and design decisions
├── context-capsule.md       # Handoff for the next agent
├── progress.txt             # Phase checklist
├── completion-evidence.json # Verification commands and results
└── review-report.md         # Diff summary and risk assessment
```

## Tool decision rules

| When you need... | Use... | Not... |
|-----------------|--------|--------|
| Bead state, ownership, or status | `br` skill + br CLI | guessing from filenames |
| Graph context, hotspots, impact | `bv` skill + bv CLI | ad-hoc file scanning |
| Code intelligence (defs, refs, symbols) | `lsp` | grep or manual search |
| File reading or URI resolution | `read` tool | cat, head, tail |
| File searching | `find` or `search` | shell find/grep |
| Edits or new files | `edit` or `write` | sed or shell redirects |
| Builds, tests, git | `bash` | - |
| Parallel reconnaissance | `task` with `explore` | sequential one-by-one reads |
| Phase routing decisions | `orchestrator` skill | guessing the next phase |

## Related skills

- **`br`** — Bead state, ownership, and artifact location. Load before mutating bead state.
- **`bv`** — Graph-informed triage, impact, and review context. Load before every phase.
- **`orchestrator`** — Active phase routing agent. Load when the user's intent is unclear or the workflow stalls.
- **`verification-before-completion`** — Evidence discipline. Load before review, PR, or close.

## Minimum checks (pre-flight for any phase)

1. **Read br state**: `br list --status open --status in_progress` or `br show <id>`.
2. **Load bv context**: smallest `bv --robot-*` query for the current decision.
3. **Confirm artifacts**: for ship, `prd.md` + `plan.md` must exist; for verify, `plan.md` verification section must be read.
4. **Check scope**: the action matches the active bead; no unrelated changes.
5. **Record evidence**: after verification, update `completion-evidence.json`; after review, write `review-report.md`.
