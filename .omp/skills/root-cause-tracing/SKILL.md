---
name: root-cause-tracing
description: Use when errors occur deep in execution — traces bugs backward through the call stack to find the original trigger of invalid data or behavior. Never fix just the symptom.
---

# Root Cause Tracing

Bugs often manifest deep in the call stack. Your instinct is to fix where the error appears, but that's treating a symptom.

**Core principle:** Trace backward through the call chain until you find the original trigger, then fix at the source.

## When to Use

- Errors occur deep in a call stack and the immediate failure is just a symptom
- You need to trace where invalid data or state originated
- A "fix" at the error site seems too easy or masks a deeper problem

## When NOT to Use

- The error is at the entry point and the root cause is obvious
- You're doing feature work with no failures to trace

## The Tracing Process

### 1. Observe the Symptom

What is the actual error? Get the full stack trace, error message, and exit code.

### 2. Find the Immediate Cause

What code directly causes this? Read the file at the top of the stack trace.

### 3. Trace One Level Up

What called this code? What value was passed? Follow the call chain backward.

### 4. Keep Tracing Up

Repeat: who called that? What value did THEY pass? Continue until you find the original trigger — the point where bad data entered the system.

### 5. Fix at the Source

Fix where the bad data originates, not where it crashes. Then add validation at each layer so this class of bug is impossible in the future.

## Guiding Questions

At each level of the call stack, ask:

- What value was passed here?
- Where did that value come from?
- Could it have been invalid before it reached this point?
- What should have caught it earlier?

## Defense-in-Depth

After fixing the root cause, add validation at each layer so the bug can never return via another path:

```
Layer 1: Validate input at the entry point
Layer 2: Validate assumptions in the middle layer
Layer 3: Add a guard just before the dangerous operation
```

The goal is not just to fix one bug — it's to make that entire class of bug impossible.

## Example

**Symptom:** `git init` runs in the source code directory instead of a temp directory.

**Trace chain:**
1. `git init` called with empty `cwd` → resolves to `process.cwd()` (source dir)
2. `createWorktree()` called with empty `projectDir`
3. `Session.create()` passed empty string
4. Test accessed `context.tempDir` before `beforeEach` ran
5. `setupTest()` returns `{ tempDir: '' }` before initialization

**Root cause:** Top-level variable accessed before test setup.

**Fix:** Made `tempDir` a getter that throws if accessed before initialization.

**Defense layers added:**
- Layer 1: `createWorktree()` validates directory is non-empty
- Layer 2: `Session.create()` validates path is inside a temp directory
- Layer 3: `git init` wrapper refuses to run outside safe paths

## Instrumentation

When you can't trace manually, add instrumentation at boundaries:

```typescript
// Before the problematic operation
async function riskyOperation(directory: string) {
  console.error("DEBUG riskyOperation:", {
    directory,
    cwd: process.cwd(),
    stack: new Error().stack,
  });
  await dangerousCall(directory);
}
```

Use `console.error()` — it's always visible, unlike loggers that may be suppressed in tests.

## Anti-Patterns

| Anti-Pattern | Why It Fails | Instead |
|-------------|-------------|--------|
| Fixing symptoms where error appears | Hides origin; bug returns via other paths | Trace backward until original trigger found |
| Skipping stack trace analysis | Misses real caller and bad input source | Read full stack, file paths, and line numbers |
| Adding instrumentation without hypothesis | Produces noisy logs, slows investigation | Instrument one boundary at a time to answer a specific question |
| Guessing the cause without evidence | Leads to random fixes and regressions | Form evidence-backed hypothesis, then test |

## Key Principle

```
Found immediate cause
    ↓
Can trace one level up?
    ├── YES → Trace backward → Is this the source?
    │           ├── NO → Keep tracing
    │           └── YES → Fix at source → Add validation at each layer
    └── NO → NEVER fix just the symptom
```

**NEVER fix just where the error appears.** Trace back to find the original trigger.
