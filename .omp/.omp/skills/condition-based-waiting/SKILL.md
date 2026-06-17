---
name: condition-based-waiting
description: Use when tests have race conditions or timing dependencies — replaces arbitrary timeouts with condition polling to wait for actual state changes. Eliminates flaky tests.
---

# Condition-Based Waiting

Flaky tests often guess at timing with arbitrary delays. This creates race conditions where tests pass on fast machines but fail under load or in CI.

**Core principle:** Wait for the actual condition you care about, not a guess about how long it takes.

## When to Use

- Tests are flaky due to arbitrary delays or timing guesses
- You need to wait for async state changes (events, file writes, state transitions)

## When NOT to Use

- You are explicitly testing timing behavior (debounce, throttle, intervals)
- A fixed, documented timeout is part of the requirement

## Core Pattern

```typescript
// ❌ Guessing at timing
await new Promise((r) => setTimeout(r, 50));
const result = getResult();
expect(result).toBeDefined();

// ✅ Waiting for condition
await waitFor(() => getResult() !== undefined);
const result = getResult();
expect(result).toBeDefined();
```

## Quick Patterns

| Scenario | Pattern |
|----------|---------|
| Wait for event | `waitFor(() => events.find(e => e.type === 'DONE'))` |
| Wait for state | `waitFor(() => machine.state === 'ready')` |
| Wait for count | `waitFor(() => items.length >= 5)` |
| Wait for file | `waitFor(() => fs.existsSync(path))` |
| Complex condition | `waitFor(() => obj.ready && obj.value > 10)` |

## Implementation

Generic polling function:

```typescript
async function waitFor<T>(
  condition: () => T | undefined | null | false,
  description: string,
  timeoutMs = 5000,
): Promise<T> {
  const startTime = Date.now();

  while (true) {
    const result = condition();
    if (result) return result;

    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Timeout waiting for ${description} after ${timeoutMs}ms`);
    }

    await new Promise((r) => setTimeout(r, 10)); // Poll every 10ms
  }
}
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Polling too fast: `setTimeout(check, 1)` | Poll every 10ms |
| No timeout: loops forever | Always include timeout with clear error message |
| Stale data: cache state before loop | Call getter inside loop for fresh data |

## When Arbitrary Timeout IS Correct

```typescript
// Tool ticks every 100ms — need 2 ticks to verify partial output
await waitForEvent(manager, "TOOL_STARTED"); // First: wait for condition
await new Promise((r) => setTimeout(r, 200)); // Then: wait for timed behavior
// 200ms = 2 ticks at 100ms intervals — documented and justified
```

Requirements for justified timeouts:
1. First wait for triggering condition
2. Based on known timing (not guessing)
3. Comment explaining WHY the specific duration

## Verification

- Run the previously flaky test 5+ times — should pass consistently
- No hardcoded sleep/delay values remain in the test file
- Test execution time should decrease (no wasted wait time)

## Common Rationalizations

| Rationalization | Rebuttal |
|----------------|----------|
| "50ms is plenty of time" | It's plenty on YOUR machine. CI runners under load disagree. |
| "The sleep worked in local testing" | Local = fast SSD, idle CPU. CI = shared resources, variable latency. |
| "Adding a waitFor is more complex than sleep" | A 5-line waitFor is simpler than debugging a flaky test 10 times. |
| "I'll increase the timeout if it flakes" | Increasing timeouts slows the entire suite and masks the real problem. |
| "It only fails sometimes" | "Sometimes" = race condition. Condition-based waiting eliminates it entirely. |
