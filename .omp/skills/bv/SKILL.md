---
name: bv
description: Graph-aware triage engine for Beads projects. Use --robot-* flags for deterministic, dependency-aware outputs with precomputed metrics. bv handles WHAT to work on — triage, priority, planning.
---

# bv — Beads Viewer (Robot Mode)

> **CRITICAL: NEVER run bare `bv`.** It launches an interactive TUI that blocks your session. Always use `--robot-*` flags.

## Scope Boundary

bv handles **what to work on** (triage, priority, planning). For agent-to-agent coordination, use br's file reservation and bead claiming.

## Output Conventions

| Channel | Content |
|---------|---------|
| stdout | JSON/TOON data only |
| stderr | Diagnostics |
| exit 0 | Success |

**All robot JSON includes:**
- `data_hash` — Fingerprint of source beads.jsonl (verify consistency across calls; results cached by this hash)
- `status` — Per-metric state: `computed|approx|timeout|skipped` + elapsed ms
- `as_of` / `as_of_commit` — Present when using `--as-of`; contains ref and resolved SHA

## Performance & Two-Phase Analysis

bv runs two analysis phases:

- **Phase 1 (instant):** degree, topological sort, density — always available immediately
- **Phase 2 (async, 500ms timeout):** PageRank, betweenness, HITS (hubs/authorities), eigenvector, cycles, k-core, articulation points, slack — check `status` flags

**For large graphs (>500 nodes):** Some metrics may be approximated or skipped. Always check `status` — a metric marked `timeout` or `skipped` is not trustworthy.

**Performance tips:**
- Prefer `--robot-plan` over `--robot-insights` when speed matters (plan is faster).
- Prefer `--robot-triage` as the single entry point (one call, everything you need).
- Results are cached by `data_hash` — re-running the same query is instant.

## Liveness (#166)

The git-history prologue of `--robot-triage` is bounded (default 10s):

```bash
bv --robot-triage --robot-history-timeout-ms 5000   # 5-second timeout
export BV_ROBOT_HISTORY_TIMEOUT_MS=0                # Disable timeout (unbounded)
```

On timeout, the in-flight git subprocess is killed and triage proceeds without history. `meta.history_status` reports `ok`, `error`, or `timeout` (omitted when history was not attempted).

## Primary Entry Points

### `--robot-triage` — The Mega-Command

**This is your single entry point.** One call returns everything you need:

```bash
bv --robot-triage --format json
```

Returns:
- **`quick_ref`**: at-a-glance counts + top 3 picks
- **`recommendations`**: ranked actionable items, each with `score`, `reason`, `unblock_info`
- **`quick_wins`**: low-effort high-impact items
- **`blockers_to_clear`**: items that unblock the most downstream work
- **`project_health`**: status/type/priority distributions, graph metrics
- **`commands`**: copy-paste shell commands for next steps (claim, show, etc.)

### `--robot-next` — Minimal: Just the Top Pick

```bash
bv --robot-next --format json
```

Returns a single top pick + copy-paste claim command. Use when you just need "what should I do now?"

### `--robot-plan` — Parallel Execution Tracks

```bash
bv --robot-plan --format json
```

Returns:
- **`plan.summary`**: `highest_impact` (best unblock target), `total_work_items`, `parallel_tracks`
- **`plan.tracks[]`**: each track has `items[]`, `unblocks` (what this track enables), `estimated_effort`

**Use `unblocks` to structure plan waves** — items in the same track can run in parallel.

## Count Semantics (strict since #165)

| Field | Meaning |
|-------|---------|
| `quick_ref.open_count` | Status exactly `open` |
| `quick_ref.blocked_count` | Status exactly `blocked` |
| `quick_ref.in_progress_count` | Status exactly `in_progress` |
| `counts.closed` | Closed-like: `closed` + `tombstone` |
| `quick_ref.not_closed_count` | Every non-closed issue: `open` + `in_progress` + `blocked` + `deferred` |
| `quick_ref.actionable_count` | Non-closed with no open blocking dependencies (ready to work now) |
| `quick_ref.not_actionable_count` | Non-closed blocked by open dependencies regardless of status |

**Partition invariant:** `not_closed == actionable + not_actionable` — every non-closed issue is exactly one of the two.

Before claiming, verify the current bead state with `br show <id> --json`. `recommendations` can include graph-important blocked or assigned work; only `quick_ref.top_picks` and items with non-empty `claim_command` fields represent claimable work.

## Recipes

Pre-filter before analysis:

```bash
bv --recipe actionable --robot-triage --format json     # Only ready-to-work items
bv --recipe high-impact --robot-triage --format json    # Top PageRank scores
bv --recipe actionable --robot-plan --format json       # Plan from actionable only
```

## Scoping & Filtering

```bash
bv --robot-plan --label backend                         # Scope to a label's subgraph
bv --robot-insights --as-of HEAD~30                     # Historical point-in-time analysis
bv --robot-triage --robot-triage-by-track               # Group by parallel work streams
bv --robot-triage --robot-triage-by-label               # Group by domain
bv --robot-graph --graph-root <ID> --graph-depth 3      # Focused subgraph extraction
```

## Full Robot Command Reference

### Triage & Planning

| Command | Returns |
|---------|---------|
| `bv --robot-triage --format json` | THE mega-command: quick_ref, recommendations, quick_wins, blockers, health, commands |
| `bv --robot-triage --format toon` | Token-optimized version |
| `bv --robot-next --format json` | Single top pick + claim command |
| `bv --robot-plan --format json` | Parallel execution tracks with `unblocks` lists |
| `bv --robot-priority --format json` | Priority misalignment detection with confidence scores |

### Graph Analysis

| Command | Returns |
|---------|---------|
| `bv --robot-insights --format json` | Full metrics: PageRank, betweenness, HITS (hubs/authorities), eigenvector, critical path, cycles, k-core, articulation points, slack |
| `bv --robot-alerts --format json` | Stale issues, blocking cascades, priority mismatches |
| `bv --robot-suggest --format json` | Hygiene: duplicates, missing deps, label suggestions, cycle breaks |
| `bv --robot-forecast <id\|all> --format json` | ETA predictions with dependency-aware scheduling |

### Labels

| Command | Returns |
|---------|---------|
| `bv --robot-label-health --format json` | Per-label health: `health_level` (healthy\|warning\|critical), `velocity_score`, `staleness`, `blocked_count` |
| `bv --robot-label-flow --format json` | Cross-label dependency: `flow_matrix`, `dependencies`, `bottleneck_labels` |
| `bv --robot-label-attention [--attention-limit=N] --format json` | Attention-ranked labels by: (pagerank × staleness × block_impact) / velocity |

### History & Change Tracking

| Command | Returns |
|---------|---------|
| `bv --robot-history --format json` | Bead-to-commit correlations: `stats`, `histories` (per-bead events/commits/milestones), `commit_index` |
| `bv --robot-diff --diff-since <ref> --format json` | Changes since ref: new/closed/modified issues, cycles introduced/resolved |

### Sprint & Files

| Command | Returns |
|---------|---------|
| `bv --robot-burndown <sprint> --format json` | Sprint burndown, scope changes, at-risk items |
| `bv --robot-file-hotspots --format json` | Files with most bead activity |
| `bv --robot-file-beads <path> --format json` | Beads touching a specific file |
| `bv --robot-file-relations --format json` | File co-change patterns |

### Graph Export

| Command | Returns |
|---------|---------|
| `bv --robot-graph --format json` | Full dependency graph as JSON |
| `bv --robot-graph --graph-format dot` | Graphviz DOT format (render with Graphviz) |
| `bv --robot-graph --graph-format mermaid` | Mermaid diagram (embed in markdown) |
| `bv --robot-graph --graph-root <ID> --graph-depth 3` | Focused subgraph around a bead |
| `bv --export-graph <file.html>` | Self-contained interactive HTML visualization |

## jq Quick Reference

```bash
# Quick look
bv --robot-triage | jq '.quick_ref'                              # At-a-glance summary
bv --robot-triage | jq '.recommendations[0]'                     # Top recommendation
bv --robot-triage | jq '.blockers_to_clear[0]'                   # Best unblock target

# Planning
bv --robot-plan | jq '.plan.summary.highest_impact'              # Best unblock target for planning
bv --robot-plan | jq '.plan.tracks[] | {items, unblocks}'        # Parallel tracks

# Graph health
bv --robot-insights | jq '.status'                               # Check metric readiness
bv --robot-insights | jq '.Cycles'                               # Circular deps — must be empty!

# Labels
bv --robot-label-health | jq '.results.labels[] | select(.health_level == "critical")'
```

## Token Optimization

```bash
bv --robot-triage --format toon          # Per-command
export BV_OUTPUT_FORMAT=toon             # Session-wide
```

TOON format collapses verbose JSON keys into short abbreviations for lower context window usage.

## Process

1. **Start each phase with the smallest bv query** that answers the decision in front of you.
   - `/brainstorm` → `bv --robot-triage --format json`
   - `/plan` → `bv --robot-plan --format json`
   - `/review` → `bv --robot-file-hotspots --format json` + `bv --robot-file-beads <paths> --format json`
2. **Capture the concrete result** that changes the plan: files, risks, dependencies, or missing work.
3. **Use that result to scope edits, checks, or review.**
4. **Re-run bv when the phase changes or the blast radius grows.**
5. **Check `status` flags** before acting on metrics. A `timeout` or `skipped` metric is not actionable.

## Anti-Patterns

- Running bare `bv` — blocks the session.
- Running the whole robot suite every time — pick the smallest query that answers your question.
- Treating bv output as proof without checking the underlying files.
- Using bv as a substitute for verification after implementation.
- Ignoring `status` flags — a metric marked `timeout` or `skipped` is not trustworthy.
- Trusting `recommendations` for claimable work without verifying via `br show <id> --json` — recommendations can include blocked items that are graph-important.
