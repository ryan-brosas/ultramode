---
name: incremental-implementation
description: Use when implementing features or fixes — enforces thin vertical slices with verify-after-each, commit checkpoints, and scope discipline. Prevents big-bang implementations.
---

# Incremental Implementation

Large implementations fail because errors compound. When you write 500 lines before running anything, each line can introduce a bug that interacts with bugs from other lines. Thin vertical slices keep the error surface small.

**Core principle:** Working code at every step. Never be more than one slice away from a green build.

## When to Use

- Implementing any feature that touches more than 2 files
- Working from a plan with multiple tasks
- Building something where partial progress should be demonstrable

## When NOT to Use

- One-line fixes or trivial changes
- Pure refactors with no behavior change (use code-simplification instead)
- Exploratory prototyping where you need to experiment freely

## The Cycle

```
FOR each slice:
  1. IMPLEMENT — Write the minimal code for this slice (1-3 files max)
  2. VERIFY — Run typecheck + lint + relevant tests
  3. COMMIT — Create a checkpoint with descriptive message
  4. NEXT — Move to the next slice

IF verify fails:
  Fix within the current slice before moving on
  Do NOT proceed to the next slice with broken code
```

## Slicing Strategies

### Vertical Slice (Preferred)

Each slice delivers one thin path through the full stack:

```
Slice 1: API endpoint returns hardcoded data → test passes
Slice 2: API endpoint reads from database → test passes
Slice 3: UI calls API and renders data → test passes
Slice 4: Add validation and error handling → test passes
```

### Contract-First

Define interfaces first, then implement behind them:

```
Slice 1: Define types/interfaces → compiles
Slice 2: Implement with stubs → tests pass
Slice 3: Replace stubs with real implementation → tests pass
```

### Risk-First

Implement the hardest or most uncertain part first:

```
Slice 1: The tricky algorithm or integration → tests pass
Slice 2: The straightforward plumbing → tests pass
Slice 3: The UI/presentation layer → tests pass
```

## Implementation Rules

### 1. Simplicity First

Default to the simplest viable solution.

```
❌ "Let me add a factory pattern for extensibility"
✅ "Direct function call works. Refactor ONLY if a second use case appears"
```

### 2. Scope Discipline

Each slice does ONE thing. If you notice something else that needs fixing:

```
NOTICED BUT NOT TOUCHING: [description of unrelated improvement]
```

Log it and continue. Do not "fix while you're in here."

### 3. Keep the Build Green

Never leave the codebase in a state where typecheck fails between slices.

```
❌ Add 5 function signatures, then implement all 5
✅ Add and implement function 1, verify, then function 2
```

### 4. Keep Tests Green

If existing tests break from your change, fix them in the same slice — not in a "fix tests" slice later.

### 5. Feature Flags for Incomplete Features

If a slice can't be hidden behind existing abstractions:

```typescript
// Temporary gate — remove when feature is complete
if (process.env.ENABLE_NEW_FEATURE) {
  // new code path
} else {
  // existing behavior
}
```

### 6. Rollback-Friendly

Each committed slice should be independently revertable without breaking the build.

## Slice Size Guide

| Slice Size | Signal |
|-----------|--------|
| 1-30 lines | Ideal — easy to review and verify |
| 30-100 lines | Acceptable — still isolatable |
| 100-200 lines | Too large — find a split point |
| 200+ lines | Stop. You're doing big-bang implementation |

## Red Flags — STOP

If you catch yourself:

- Writing more than 100 lines without running verification
- Saying "I'll test this after I finish the next part"
- Having 3+ files with uncommitted changes
- Building a complex abstraction before the simple version works
- Skipping verification because "this slice is trivial"

**STOP.** Verify what you have. Commit if it passes. Then continue.

## Verification Per Slice

After each slice (minimum):

- Typecheck
- Lint
- Related tests

After all slices (full):

- Full typecheck + lint + test suite

## Common Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "I'll build everything first and test at the end" | 500 lines → failures impossible to isolate |
| "This feature can't be split into slices" | Every feature can be sliced — you're confusing "UI needs all parts" with "code must be written all at once" |
| "Committing partial work creates noise" | Partial working commits are rollback points. One giant commit is a rollback cliff |
| "It's faster to write it all at once" | It feels faster until the first bug takes 2 hours to locate in a 400-line diff |
| "The slices are too small to be meaningful" | If a slice compiles, passes tests, and moves toward the goal, it's meaningful |

## Integration with Other Skills

- **test-driven-development** — Write the test for each slice FIRST (RED), then implement (GREEN)
- **verification-before-completion** — Run full gates after the final slice
- **code-simplification** — Refactor AFTER all slices pass, not during implementation
- **root-cause-tracing** — If a slice fails verification, debug systematically

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Instead |
|-------------|-------------|--------|
| Implementing all slices before testing any | One bug cascades, hard to isolate | Test after each slice |
| Giant slices that touch 5+ files | Defeats the purpose of incremental | Split into smaller vertical slices |
| Refactoring mid-slice | Mixes behavior change with structure change | Refactor after slice passes |
| "I'll verify at the end" | Errors compound silently | Verify after each slice |
