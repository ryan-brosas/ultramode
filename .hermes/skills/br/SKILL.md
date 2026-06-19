---
name: br
description: Official skill for beads_rust (`br`), a local-first, dependency-aware issue tracker for AI agents. Use when creating issues, triaging backlogs, managing dependencies, finding ready work, updating status, or syncing to git via JSONL.
---

# br — Beads Rust Issue Tracker

> **Non-invasive:** br NEVER runs git commands. Sync and commit are YOUR responsibility.

## Before You Start

Verify the tools are available:

```bash
which br      # Must be installed. If missing: cargo install beads_rust or brew install br
which python3 # Used for JSON parsing in resolution. Available on all modern systems.
```

**jq note:** Some commands use `jq` for quick field extraction. If `jq` is not installed, use `python3 -c "import json,sys; ..."` instead. Both work — prefer `jq` when available for readability.

## Critical Rules for Agents

| Rule | Why |
|------|-----|
| **Binary is `br`** | NEVER `bd` (that is the old Go version) |
| **ALWAYS use `--json`** | Structured output for parsing. `--format toon` for reduced tokens. |
| **NEVER run bare `bv`** | Blocks session in interactive TUI mode. Always `bv --robot-*`. |
| **Sync is EXPLICIT** | `br sync --flush-only` exports DB to JSONL only |
| **Git is YOUR job** | br only touches `.beads/` — you must `git add .beads/ && git commit` |
| **No cycles allowed** | `br dep cycles --json` must return empty |
| **Resolve actor at runtime** | `ACTOR="${BR_ACTOR:-assistant}"` then pass `--actor "$ACTOR"` on all mutating commands |

## Resolving Short Bead IDs

Users often type short suffixes (`0ks`, `ag5`) instead of full bead IDs (`pi-feat-workflow-gate-0ks`). Resolve them:

```bash
# Step 1: Try br show first — works if it's already a full ID
FULL=$(br show "$SHORT" --json 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])" 2>/dev/null)

# Step 2: If Step 1 failed, suffix-match against all beads
if [ -z "$FULL" ]; then
  FULL=$(br list --status open --status in_progress --status closed --json 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
issues = d if isinstance(d, list) else d.get('issues',[])
matches=[i['id'] for i in issues if i.get('id','').endswith('$SHORT')]
if len(matches)==1: print(matches[0])
elif len(matches)>1: print('AMBIGUOUS:'+','.join(matches))
")
fi

# If FULL is empty or starts with AMBIGUOUS, ask the user for the full ID
```

**Never guess.** If resolution is ambiguous, list the candidates and ask the user.

## Quick Workflow

```bash
ACTOR="${BR_ACTOR:-assistant}"

# 1. Find work
br scheduler --json          # Evidence-ranked ready work (recommended)
br ready --json              # Fallback: unblocked, undeferred work
br show <id> --json          # Full context

# 2. Claim it
br update --actor "$ACTOR" <id> --status in_progress --claim

# 3. Do the work...

# 4. Close with evidence
br close --actor "$ACTOR" <id> --reason "Implemented X in commit abc123"

# 5. Check queue impact
br ready --json && br blocked --json

# 6. Sync to git (EXPLICIT!)
br sync --flush-only
git add .beads/ && git commit -m "feat: X (<id>)"
git push
```

## Issue Lifecycle

```bash
ACTOR="${BR_ACTOR:-assistant}"

br init                                              # Initialize .beads/ workspace
br create --actor "$ACTOR" "Title" -p 1 -t task      # Create issue (priority 0-4)
br q --actor "$ACTOR" "Quick note"                   # Quick capture (outputs ID only)
br show <id> --json                                  # Issue details with dependencies
br update --actor "$ACTOR" <id> --status in_progress # Update status
br update --actor "$ACTOR" <id> --priority 0         # Change priority
br close --actor "$ACTOR" <id> --reason "Done"       # Close with reason
br close --actor "$ACTOR" <id1> <id2> --reason "..." # Close multiple at once
br reopen --actor "$ACTOR" <id>                      # Reopen closed issue
```

## Create Options

```bash
br create --actor "$ACTOR" "Title" \
  --priority 1 \             # 0-4 scale (0=critical, 4=backlog)
  --type feature \           # task, bug, feature, epic, question, docs
  --assignee "user@..." \    # Optional assignee
  --labels backend,auth \    # Comma-separated labels
  --description "..."        # Detailed description
```

## Update Options

```bash
br update --actor "$ACTOR" <id> \
  --title "New title" \
  --priority 0 \
  --status in_progress \     # open, in_progress, closed
  --assignee "new@..." \
  --add-label reliability \
  --parent <parent-id> \
  --claim                    # Shorthand: --status in_progress + self-assign
```

### Bulk Update

```bash
br update --actor "$ACTOR" <id1> <id2> <id3> --priority 2 --add-label triage-reviewed --json
```

Use for batch triage — raising/lowering priority across a wave, adding labels in bulk.

## Querying (always use --json for agents)

```bash
br scheduler --json                           # Evidence-ranked ready work (RECOMMENDED)
br ready --json                               # Unblocked, undeferred work (fallback)
br list --json                                # All issues
br list --status open --sort priority --json  # Filter by status + sort
br list --status open --status in_progress --json  # Active work
br list --priority 0-1 --json                 # Priority range filter
br list --assignee alice --json               # Filter by assignee
br blocked --json                             # Show blocked issues
br search "keyword" --json                    # Full-text search across title/description
br show <id> --json                           # Single issue with dependencies
br stale --days 30 --json                     # Issues untouched for N days
br count --by status --json                   # Count with grouping
br stats --json                               # Project statistics
```

`br scheduler` ranks ready work with explainable scores based on priority, dependencies, staleness, fairness, and domain contention. Prefer it over `br ready` for evidence-based work selection.

## Priority Scale

| Priority | Meaning | Use numbers, not words |
|----------|---------|------------------------|
| 0 | Critical | Immediate action required |
| 1 | High | Important, do soon |
| 2 | Medium (default) | Normal priority |
| 3 | Low | When time permits |
| 4 | Backlog | Future consideration |

## Issue Types

`task`, `bug`, `feature`, `epic`, `question`, `docs`

## Output Formats

| Flag | Use case |
|------|----------|
| `--json` | **Default for agents** — full structured data |
| `--format toon` | Token-optimized alternative for context-window-sensitive agents |
| (no flag) | Human-readable terminal output with colors — do NOT use in agent context |

## Hierarchy

```bash
# Create epic
br create "OAuth Integration" --type epic --priority 1 --json
# Returns: br-a3f8

# Create children with parent
br create "Setup credentials" --parent br-a3f8 --json
br create "Implement flow" --parent br-a3f8 --json
br create "Add UI" --parent br-a3f8 --json
```

- Up to 3 levels: Epic → Task → Subtask
- Closing a parent auto-unblocks children
- Only use dependencies for actual technical blockers, not preferences

## Dependencies

```bash
br dep add <child> <parent>               # child depends on parent (child blocked until parent closes)
br dep add <id> <depends-on> --type blocks # Explicit block type
br dep remove <child> <parent>            # Remove dependency
br dep list <id> --json                   # Dependencies for an issue
br dep tree <id> --json                   # Full dependency tree
br dep cycles --json                      # Find circular deps — MUST be empty!
```

**Critical:** `br dep cycles --json` must return empty. Circular dependencies break the dependency graph and make `br ready` unreliable.

## File Path Claiming (Multi-Agent)

```bash
# Claim files before editing
br reserve <bead-id> --files "src/auth/service.ts,src/auth/types.ts"

# Check existing claims
br list --status in_progress --json | python3 -c "
import json,sys
for i in json.load(sys.stdin):
  if i.get('reserved_files'):
    print(i['id'], i['reserved_files'])
"

# Released automatically on close
```

- **2-10 agents:** Recommended for shared files
- **10+ agents:** Required — every file must be claimed before editing
- Always claim BEFORE editing, never after

## Labels

```bash
br label add <id> backend auth            # Add multiple labels
br label remove <id> urgent               # Remove a label
br label list <id>                        # List issue's labels
br label list-all                         # All labels in project
```

## Comments

```bash
ACTOR="${BR_ACTOR:-assistant}"
br comments add --actor "$ACTOR" <id> --message "Triage note" --json
br comments list <id> --json
```

## Sync (EXPLICIT — never automatic)

```bash
br sync --flush-only                 # Export DB to JSONL → do this BEFORE git commit
br sync --import-only                # Import JSONL to DB → do this AFTER git pull
br sync --status                     # Check sync status
```

Workflow after making changes:
```bash
br sync --flush-only
git add .beads/ && git commit -m "Update issues"
```

Workflow after pulling:
```bash
git pull --rebase
br sync --import-only
```

## Artifact Management

Every bead gets an artifact directory at `.beads/artifacts/<bead-id>/`:

| File | Purpose | Created |
|------|---------|---------|
| `prd.md` | Full PRD with requirements, scope, success criteria | `/create` |
| `prd.json` | Machine-readable task breakdown | `/create` |
| `plan.md` | Implementation plan with tasks and waves | `/plan` |
| `tasks.md` | Decomposed task list | `/plan` |
| `progress.txt` | Append-only progress log | On claim/progress |
| `context-capsule.md` | Agent spawn instructions | `/create` (if needed) |
| `completion-evidence.json` | Verification evidence | `/verify` |
| `review-report.md` | Review findings | `/review` |

## System and Diagnostics

```bash
br doctor                            # Full diagnostics
br stats --json                      # Project statistics
br config list                       # Show all configuration
br config get id.prefix              # Get specific value
br config set defaults.priority=1    # Set value
br where                             # Show workspace location
br version                           # Show version
br upgrade                           # Self-update (if enabled)
br lint --json                       # Lint issues for problems
```

## Storage Layout

```
.beads/
  beads.db        # SQLite database (primary storage)
  beads.db-shm    # SQLite shared memory (WAL mode)
  beads.db-wal    # SQLite write-ahead log
  issues.jsonl    # JSONL export (for git version control)
  config.yaml     # Project configuration
  metadata.json   # Workspace metadata
```

## Triage Decision Matrix

During triage, classify each open issue into exactly one category:

| Classification | Action |
|---------------|--------|
| `implemented` | Close with evidence: commit SHA, PR URL, file path, or observed behavior |
| `out-of-scope` | Close with explicit boundary reason — what domain is this out of scope for? |
| `needs-clarification` | Comment with specific unanswered questions. Do NOT close. |
| `actionable` | Keep open. Correct status, priority, labels, and dependencies. |

**Never invent evidence for closure.** If you cannot point to a commit, file, or test that proves completion, comment instead.

**During large triage efforts, checkpoint every few updates:**
```bash
br ready --json    # Confirm the queue is still coherent
br blocked --json  # Confirm no new blockers emerged
```

## Agent Mail Coordination

Use bead ID as the coordination anchor for multi-agent work:

| Concept | Value |
|---------|-------|
| Mail `thread_id` | `<bead-id>` |
| Mail subject | `[<bead-id>] ...` |
| File reservation `reason` | `<bead-id>` |
| Commit messages | Include `<bead-id>` for traceability |

## Compaction Survival

After context compaction, conversation history is deleted but beads state persists.

**Post-compaction recovery:**

1. `br list --status in_progress --json` — find active work
2. `br show <id> --json` for each active task — reconstruct context
3. Read notes from the bead's comments and `progress.txt`
4. Resume from the last COMPLETED/IN PROGRESS marker

**Write notes that survive:**
```
COMPLETED: User auth - JWT tokens with 1hr expiry, refresh endpoint.
IN PROGRESS: Password reset flow. Email service working.
NEXT: Add rate limiting to reset endpoint.
KEY DECISION: Using bcrypt 12 rounds per OWASP.
```

## Session Ending Pattern

Before ending any work session:

```bash
git pull --rebase
br sync --flush-only
git add .beads/ && git commit -m "Update issues"
git push
git status  # MUST show "up to date with origin"
```

## Troubleshooting

```bash
br doctor                    # Full diagnostics — run first
br dep cycles --json         # Must be empty
br config list               # Check settings
which br                     # Verify br is installed
```

**"Database locked":** Check for other `br` processes: `pgrep -f "br "`

**Worktree error** (`'main' is already checked out`):
```bash
git branch beads-sync main
br config set sync.branch beads-sync
```

**Verbose debugging:**
```bash
br -v list                   # Verbose
br -vv list                  # Debug
RUST_LOG=debug br list       # Detailed trace logs
```

## Quick Reference

```
SESSION START:
  br scheduler --json → br show <id> → br update <id> --claim → begin work

DURING WORK:
  br create for discovered work (>2 min)
  br update <id> --notes "COMPLETED: ... NEXT: ..."

SESSION END:
  br close <id> --reason "..." → br sync --flush-only
  → git add .beads/ && git commit → git push

QUALITY GATES:
  br lint             — check for missing acceptance criteria
  br dep cycles --json — must be empty

MAINTENANCE:
  br doctor           — weekly health check
  br cleanup --days 7 — remove old closed issues
```

## Anti-Patterns

- Running `br sync` without `--flush-only` or `--import-only`
- Forgetting sync before git commit
- Creating circular dependencies
- Running bare `bv` (blocks session)
- Assuming auto-commit behavior (br NEVER auto-commits)
- **Inventing evidence for closure** — if unsure, comment instead
- Modifying unrelated issues during triage
- Adding speculative dependencies without confirmed blocking relationship
- Claiming files after editing in multi-agent work
- Vague notes that don't survive compaction

## Minimum Checks

- Confirm the bead id with `br show <id> --json`
- Confirm current status — is it `open`, `in_progress`, or `closed`?
- Confirm the artifact directory matches the bead id
- Confirm `prd.md` exists before planning
- Confirm `plan.md` exists before implementation
- Confirm `br dep cycles --json` returns empty
- Confirm `br sync --status` shows clean state before committing
