---
name: code-simplification
description: Use when reducing code complexity, eliminating dead code, or refactoring for clarity — enforces measure-before-cutting discipline. Complements YAGNI and KISS rules.
---

# Code Simplification

Code simplification is the discipline of making code easier to understand and maintain WITHOUT changing behavior. Undisciplined simplification introduces bugs.

**Core principle:** Measure complexity, simplify the worst offender, verify nothing broke, repeat.

## When to Use

- Code is harder to understand than it needs to be
- Functions are too long, files are too large
- Dead code, unused imports, or unnecessary abstractions exist
- Complexity is making bugs harder to fix

## When NOT to Use

- The code works, is readable, and isn't blocking anything — leave it alone
- You're implementing a new feature (focus on the feature)
- The "simplification" is actually a rewrite with different behavior

## The Process

```
1. MEASURE  — Identify what's actually complex (not just what feels complex)
2. ISOLATE  — Pick ONE simplification target
3. VERIFY   — Ensure tests exist for current behavior
4. SIMPLIFY — Apply the smallest change that reduces complexity
5. CONFIRM  — Run verification to prove behavior is unchanged
6. REPEAT   — Pick the next target
```

## Complexity Signals

| Signal | Threshold | Action |
|--------|-----------|--------|
| Function length | >50 lines | Extract helper functions |
| File length | >500 lines | Split into modules |
| Nesting depth | >3 levels | Flatten with early returns or extract |
| Parameter count | >4 params | Use an options object |
| Dead code | Any | Remove after verifying with find-references |
| Unused imports | Any | Remove (linter usually catches these) |
| Duplicate code | 3+ copies | Extract shared function |

## Simplification Patterns

### Extract Function

```typescript
// BEFORE: Long function with embedded logic
function processOrder(order: Order) {
  // 20 lines of validation
  // 15 lines of pricing
  // 10 lines of notification
}

// AFTER: Named steps
function processOrder(order: Order) {
  validateOrder(order);
  const total = calculateTotal(order);
  notifyCustomer(order, total);
}
```

### Early Return (Flatten Nesting)

```typescript
// BEFORE: Deep nesting
function getUser(id: string) {
  if (id) {
    const user = db.find(id);
    if (user) {
      if (user.active) {
        return user;
      }
    }
  }
  return null;
}

// AFTER: Guard clauses
function getUser(id: string) {
  if (!id) return null;
  const user = db.find(id);
  if (!user) return null;
  if (!user.active) return null;
  return user;
}
```

### Remove Dead Code

```
1. Search: find-references for the symbol
2. Verify: No callers exist (check tests too)
3. Remove: Delete the code
4. Confirm: All tests still pass
```

**NEVER assume code is dead without searching.** Check direct calls, dynamic references, test-only usage, and configuration references.

### Inline Unnecessary Abstraction

```typescript
// BEFORE: Wrapper that adds nothing
function getUserName(user: User): string {
  return user.name;
}

// AFTER: Just use the property directly
user.name;
```

Only inline if the abstraction doesn't serve a testing, boundary, or extension purpose.

## What NOT to Simplify

- **Working error handling** — even if verbose, it's there for a reason
- **Compatibility shims** — they exist because something needs them
- **Performance-critical paths** — "simpler" may mean "slower"
- **Code with extensive test coverage** — the tests document WHY it's complex
- **Other people's current work** — don't simplify files with active changes

## Red Flags — STOP

If you catch yourself:

- Changing behavior while "simplifying"
- Removing code without checking references first
- Simplifying more than one thing per commit
- "Cleaning up" files you weren't asked to touch
- Making code "more elegant" without a clear readability improvement

**STOP.** Revert and pick a smaller target.

## Common Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "This code is ugly, let me rewrite it" | Ugly but working > beautiful but broken. Simplify incrementally. |
| "Nobody uses this, I'll delete it" | Verify with find-references FIRST. |
| "I'll simplify it while I'm in here" | Mixing feature work with refactoring makes both harder to review. |
| "This abstraction isn't needed" | Check if it serves a testing, boundary, or extension purpose. |
| "The tests will catch any issues" | Tests cover known behavior. Simplification can change behavior tests don't cover. |

## Verification

Before each simplification: run tests for the affected file.
After each simplification: run typecheck + lint + tests.

**If ANY test fails, the simplification changed behavior.** Either the simplification is wrong (revert), or the test tests implementation details (fix test, document why).

## Anti-Patterns

| Anti-Pattern | Instead |
|-------------|---------|
| Simplifying to the point of obscurity | Clarity > brevity; readable 10-liner beats clever 2-liner |
| Removing error handling as "unnecessary" | Simplify happy path, keep error boundaries |
| Merging unrelated functions because they're short | Keep separate concerns separate |
| Refactoring without tests in place | Add tests first, then simplify |
| Eliminating all abstractions | Remove indirection that doesn't add clarity, keep the ones that do |
| "Simplifying" by adding a framework | Simpler code ≠ more dependencies |
