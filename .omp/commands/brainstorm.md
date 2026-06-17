---
description: "Ideation. Explore the codebase for pain, gaps, bloat, and inefficiencies — not just existing beads. Generate ideas from what you find."
argument-hint: "<topic or problem to brainstorm>"
---

## Prerequisites

None. This is the entry point.

You are brainstorming work. Ideation means exploration, not just triage. Use every available signal — bead graph, source code, file structure, git history, build output — to find what needs attention. Load the br and bv skills.

## Phase 1: Existing Work

Understand what's already in flight before proposing new work.

```bash
bv --robot-triage --format json              # Quick ref, recommendations, blockers, health
bv --robot-suggest --format json             # Hygiene: duplicates, missing deps, cycles
bv --robot-priority --format json            # Priority misalignment
br list --status open --status in_progress --json  # Active beads
```

Extract:
- Blockers to clear — unblocking enables downstream work
- Mispriorized items — graph importance vs assigned priority
- Stale items — neglected work that might still matter
- Duplicates — consolidate don't multiply

**If this is a new project** (no beads, no graph): note it and skip to Phase 3. Greenfield needs different thinking than brownfield.

## Phase 2: Dedup

```bash
br search "$ARGUMENTS" --status open --status in_progress --json
```

If matching work exists, surface it. Don't brainstorm duplicates. But also: ask whether the existing approach is still the right one. Old beads can rot.

## Phase 3: Codebase Exploration

This is the core of ideation. Read the codebase, not just the bead graph.

### 3a. Structure Scan

Map the project: what directories exist, what patterns repeat, what looks out of place.

Use the `read` tool on the project root to see directory structure. Use the `find` tool to locate heavy files:

```
read .                           # Top-level structure
find . -name '*.ts' -o -name '*.py' -o -name '*.rs' -o -name '*.go' --limit 50   # Bloat candidates
```

Look for:
- **Bloat**: files >500 lines, deeply nested directories, duplicated patterns
- **Orphans**: files with no imports/references, dead code
- **Inconsistency**: multiple ways of doing the same thing (two loggers, two config patterns)
- **Missing structure**: no tests/, no docs/, no clear module boundaries

### 3b. Hotspot Analysis

```bash
bv --robot-file-hotspots --format json       # Files with most bead activity
```

Hot files are pain attractors — they keep needing fixes. Ask: why? Is the design wrong? Is the abstraction leaky?

### 3c. Git History

```bash
git log --oneline -30                         # Recent activity
git log --oneline --all --grep="fix" -20      # Bug frequency
git log --oneline --all --grep="refactor" -10 # Refactor frequency
```

Extract:
- **Churn**: files that change in every other commit — unstable design
- **Bug density**: files mentioned in fix commits — fragile code
- **Refactor frequency**: code that keeps getting rewritten — wrong abstraction

### 3d. Read Key Files

Don't just scan — read. Pick 3-5 central files (entry points, core modules, config) and read them. Look for:
- What patterns are used? Are they consistent?
- What's over-engineered? What's under-engineered?
- Are there TODO/FIXME/HACK comments?
- Is error handling consistent?
- Are there obvious missing features?

## Phase 4: Pain Point Discovery

From exploration, identify concrete pain:

| Pain Type | Signal | Example |
|-----------|--------|---------|
| **Bloat** | Files >500 lines, deep nesting | "auth.ts is 1,200 lines — split into modules" |
| **Duplication** | Same pattern in 3+ places | "Three error-handling patterns across 4 files" |
| **Fragility** | File in 5+ fix commits | "config.ts breaks every other change" |
| **Complexity** | Deep nesting, many conditionals | "pipeline.ts has 7-level nested if/switch" |
| **Missing** | No tests, no types, no docs | "No test coverage for the cron module" |
| **Inconsistency** | Multiple conventions | "Uses both class-based and functional patterns" |
| **Dead code** | Unused exports, unreachable paths | "legacyAuth() exported but never called" |
| **Performance** | O(n²) loops, sync I/O, no caching | "parseConfig() called on every request" |

For each pain point: how many files/users does it affect? What's the blast radius of fixing it?

## Phase 5: Gap Analysis

What's missing that should exist?

- **Feature gaps**: what can't the user do that they should be able to?
- **Quality gaps**: no tests, no linting, no type checking, no CI
- **DX gaps**: slow builds, confusing errors, missing docs, no hot reload
- **Safety gaps**: no validation, no error boundaries, no rate limiting
- **Observability gaps**: no logging, no metrics, no alerts

Compare against what similar projects have. A web framework without error handling, a CLI without --help, a library without types — these are gaps.

## Phase 6: Ideas

Generate 3-5 concrete ideas. Each one must come from a signal found in Phases 3-5. Not from intuition — from evidence.

For each idea:
- **Signal**: what exploration finding triggered this (cite file, commit, metric)
- **What changes**: files, patterns, behaviors
- **Pain addressed**: which pain point or gap it solves
- **Impact**: how many files/users/features benefit
- **Effort**: small (1 file, <30 min) / medium (3-5 files, <2 hrs) / large (architecture, >session)
- **Risk**: what could break, what depends on the changed code
- **Alternatives considered**: could we solve this differently? cheaper? not at all?

Categories to think across:
- **Simplify**: remove code, reduce complexity, delete dead paths
- **Repair**: fix bugs, harden error handling, add validation
- **Complete**: add missing features, tests, docs, types
- **Improve**: refactor for clarity, extract reusable patterns, optimize hot paths
- **Innovate**: new capabilities, new patterns, new architecture

## Phase 7: Decision

Pick one. Weight the signals:

| Signal | Weight | Meaning |
|--------|--------|---------|
| Pain severity | 3x | How much does this hurt right now? |
| Impact breadth | 2x | How many files/users/features benefit? |
| Effort | 1x | Can we ship it in one session? |
| Risk | -1x | What breaks if we're wrong? |
| Graph alignment | 1x | Does it unblock existing work? (Phase 1) |

Highest weighted score wins. If it's close, prefer the cheaper option.

## Phase 8: Output

```
## Decision

**What**: <one-line description>
**Why**: <signal that triggered this — cite file, commit, or metric>
**Pain addressed**: <concrete pain point or gap>
**Impact**: <what changes for whom>
**Effort**: <small|medium|large — estimated minutes>

## Alternatives Considered

1. <Alternative A> — <why not chosen>
2. <Alternative B> — <why not chosen>

## Scope

**In**: <what we'll build>
**Out**: <explicit boundaries — what we won't touch>

## Risks

- <risk 1> — <mitigation>
- <risk 2> — <mitigation>

## Next

/create "<scoped description>"
```
