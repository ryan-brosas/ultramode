---
name: test-driven-development
description: Use when implementing any feature or bugfix before writing code — write the test first, watch it fail, write minimal code to pass. Ensures tests verify real behavior, not implementation coincidence.
---

# Test-Driven Development (TDD)

Write the test first. Watch it fail. Write minimal code to pass.

**Core principle:** If you didn't watch the test fail, you don't know if it tests the right thing.

**Violating the letter of the rules is violating the spirit of the rules.**

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Write code before the test? Delete it. Start over.

**No exceptions.** Don't keep it as "reference." Don't "adapt" it while writing tests. Don't look at it. Delete means delete. Implement fresh from tests. Period.

## When to Use

- Implementing new features or behavior changes
- Fixing bugs that should be reproducible via a failing test first
- Any time you're about to write implementation code

## When NOT to Use

- Throwaway prototypes or generated code
- Pure configuration edits with no executable behavior
- Mechanical refactors with existing coverage

## Task Reframing

Before writing code, rewrite the imperative request as a declarative test-first goal.

| User says (imperative) | Execute (declarative, test-first) |
|-----------------------|-----------------------------------|
| "Add input validation" | Write tests for invalid inputs that fail, then make them pass |
| "Fix the bug" | Write a test that reproduces the bug, then make it pass |
| "Refactor X" | Confirm tests pass before; refactor; confirm tests still pass after |
| "Add feature Y" | Write a test asserting Y's observable behavior, then make it pass |
| "Handle edge case Z" | Write a test exercising Z that fails, then make it pass |

If you can't reframe the request as a failing test, the requirement is too vague — clarify before coding.

## Red-Green-Refactor

### RED — Write Failing Test

Write one minimal test showing what should happen.

<Good>
```typescript
test('retries failed operations 3 times', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };

  const result = await retryOperation(operation);

  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
```
Clear name, tests real behavior, one thing.
</Good>

<Bad>
```typescript
test('retry works', async () => {
  const mock = jest.fn()
    .mockRejectedValueOnce(new Error())
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce('success');
  await retryOperation(mock);
  expect(mock).toHaveBeenCalledTimes(3);
});
```
Vague name, tests mock not code.
</Bad>

**Requirements:**
- One behavior per test
- Clear, descriptive name
- Real code (no mocks unless unavoidable)

### Verify RED — Watch It Fail

**MANDATORY. Never skip.**

Run the test. Confirm:
- Test fails (not errors)
- Failure message is expected
- Fails because feature missing (not typos)

**Test passes?** You're testing existing behavior. Fix the test.
**Test errors?** Fix the error, re-run until it fails correctly.

### GREEN — Minimal Code

Write simplest code to pass the test.

<Good>
```typescript
async function retryOperation<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === 2) throw e;
    }
  }
  throw new Error('unreachable');
}
```
Just enough to pass.
</Good>

<Bad>
```typescript
async function retryOperation<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    backoff?: 'linear' | 'exponential';
    onRetry?: (attempt: number) => void;
  }
): Promise<T> {
  // YAGNI
}
```
Over-engineered. Options object not requested.
</Bad>

Don't add features, refactor other code, or "improve" beyond the test.

### Verify GREEN — Watch It Pass

**MANDATORY.**

Run the test. Confirm:
- Test passes
- Other tests still pass
- Output pristine (no errors, warnings)

**Test fails?** Fix code, not test.
**Other tests fail?** Fix now.

### REFACTOR — Clean Up

After green only:
- Remove duplication
- Improve names
- Extract helpers
- Keep tests green throughout

## Tracer Bullet Slices

Prefer one tracer bullet at a time: one behavior test through the public interface, one minimal implementation, one verification pass, then the next behavior. A tracer bullet should cross the real seam that users or callers depend on, not a private helper chosen for convenience.

Reject horizontal all-tests-first plans for feature work. They create broad red suites without feedback. Write one behavior test, watch it fail for the expected reason, make it green, refactor, repeat.

## Slice-Level Patterns in Plans

| Pattern | Use When | Plan Structure |
|---------|----------|----------------|
| **API-First** | Backend feature | RED: test endpoint → GREEN: route handler → REFACTOR: extract service |
| **Component-First** | UI feature | RED: render test → GREEN: component → REFACTOR: extract hooks |
| **Contract-First** | Shared interface | RED: type test → GREEN: stub impl → REFACTOR: real impl |
| **Regression-First** | Bug fix | RED: repro test → GREEN: fix → REFACTOR: none |

## TDD Checklist

- [ ] Write a minimal failing test for one behavior
- [ ] Run tests and confirm the new test fails for the expected reason
- [ ] Write the minimal code to pass the test
- [ ] Re-run tests and confirm all pass
- [ ] Refactor only after green and keep tests passing

## When TDD Does Not Apply

Document with one line: `TDD does not apply: [reason]`

Valid reasons: pure config, documentation, no executable behavior, mechanical refactor with existing coverage.

## Anti-Patterns

| Anti-Pattern | Why It Fails | Instead |
|-------------|-------------|--------|
| Writing implementation before tests | No proof the code is needed or correct | Delete implementation, write test first |
| Skipping Verify RED step | Test might pass coincidentally or test wrong thing | Always watch it fail first |
| Adding features not asked for in test | YAGNI violation, scope creep | Only code needed to pass the test |
| Writing tests that pass without implementation | Test is too weak or tests existing behavior | Tighten assertions, test new behavior only |
| Refactoring before green | Can't know if refactor broke something | Refactor only after all tests pass |
| Testing implementation details | Tests break on refactor, create false confidence | Test behavior through public interface |

## What to Test

| Test | Priority |
|------|----------|
| Behavior through public API | Always |
| Error handling and edge cases | Always |
| Integration with real dependencies | Preferred |
| Internal implementation details | Never |
| Third-party library behavior | Never (their tests cover it) |
