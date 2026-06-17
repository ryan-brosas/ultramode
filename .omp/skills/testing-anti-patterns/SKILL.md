---
name: testing-anti-patterns
description: Use when writing or changing tests, adding mocks, or adding test-only methods — prevents testing mock behavior, production pollution, and mocking without understanding dependencies. Pairs with test-driven-development.
---

# Testing Anti-Patterns

Tests must verify real behavior, not mock behavior. Mocks are a means to isolate, not the thing being tested.

**Core principle:** Test what the code does, not what the mocks do.

**Following strict TDD prevents these anti-patterns.**

## The Iron Laws

```
1. NEVER test mock behavior
2. NEVER add test-only methods to production classes
3. NEVER mock without understanding dependencies
4. NEVER create incomplete mocks
```

## Anti-Pattern 1: Testing Mock Behavior

**The violation:**

```typescript
// ❌ BAD: Testing that the mock exists
test('renders sidebar', () => {
  render(<Page />);
  expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument();
});
```

**Why wrong:** You're verifying the mock works, not that the component works. Test passes when mock is present, fails when it's not. Tells you nothing about real behavior.

**Gate:** Before asserting on any mock element, ask: "Am I testing real component behavior or just mock existence?" If mock existence → STOP. Delete the assertion or unmock the component.

**The fix:**

```typescript
// ✅ GOOD: Test real component or don't mock it
test('renders sidebar', () => {
  render(<Page />);  // Don't mock sidebar
  expect(screen.getByRole('navigation')).toBeInTheDocument();
});
```

## Anti-Pattern 2: Test-Only Methods in Production

**The violation:**

```typescript
// ❌ BAD: destroy() only used in tests
class Session {
  async destroy() {
    // Looks like production API!
    await this._workspaceManager?.destroyWorkspace(this.id);
  }
}

// In tests
afterEach(() => session.destroy());
```

**Why wrong:** Production class polluted with test-only code. Dangerous if accidentally called in production. Violates YAGNI and separation of concerns.

**Gate:** Before adding any method to a production class, ask: "Is this only used by tests?" If yes → STOP. Put it in test utilities instead.

**The fix:**

```typescript
// ✅ GOOD: Test utilities handle test cleanup
// In test-utils/
export async function cleanupSession(session: Session) {
  const workspace = session.getWorkspaceInfo();
  if (workspace) {
    await workspaceManager.destroyWorkspace(workspace.id);
  }
}

// In tests
afterEach(() => cleanupSession(session));
```

## Anti-Pattern 3: Mocking Without Understanding

**The violation:**

```typescript
// ❌ BAD: Mock breaks test logic
test("detects duplicate server", () => {
  // Mock prevents config write that test depends on!
  vi.mock("ToolCatalog", () => ({
    discoverAndCacheTools: vi.fn().mockResolvedValue(undefined),
  }));

  await addServer(config);
  await addServer(config); // Should throw — but won't!
});
```

**Why wrong:** Mocked method had a side effect the test depended on (writing config). Over-mocking "to be safe" breaks actual behavior.

**Gate:** Before mocking any method:
1. "What side effects does the real method have?"
2. "Does this test depend on any of those side effects?"
3. "Do I fully understand what this test needs?"

If depends on side effects → mock at a lower level (the actual slow/external operation), not the high-level method. If unsure → run test with real implementation FIRST, observe what actually needs to happen, THEN add minimal mocking.

**Red flags:** "I'll mock this to be safe," "This might be slow, better mock it," mocking without understanding the dependency chain.

**The fix:**

```typescript
// ✅ GOOD: Mock at correct level
test("detects duplicate server", () => {
  vi.mock("MCPServerManager"); // Just mock slow server startup

  await addServer(config); // Config written
  await addServer(config); // Duplicate detected ✓
});
```

## Anti-Pattern 4: Incomplete Mocks

**The violation:**

```typescript
// ❌ BAD: Partial mock — only fields you think you need
const mockResponse = {
  status: "success",
  data: { userId: "123", name: "Alice" },
  // Missing: metadata that downstream code uses
};

// Later: breaks when code accesses response.metadata.requestId
```

**Why wrong:** Partial mocks hide structural assumptions. Downstream code may depend on fields you didn't include. Tests pass but integration fails. False confidence.

**Iron Rule:** Mock the COMPLETE data structure as it exists in reality, not just fields your immediate test uses.

**The fix:**

```typescript
// ✅ GOOD: Mirror real API completeness
const mockResponse = {
  status: "success",
  data: { userId: "123", name: "Alice" },
  metadata: { requestId: "req-789", timestamp: 1234567890 },
  // All fields real API returns
};
```

## Anti-Pattern 5: Tests as Afterthought

**The violation:**

```
✅ Implementation complete
❌ No tests written
"Ready for review"
```

**Why wrong:** Testing is part of implementation, not optional follow-up. TDD would have caught this. Can't claim complete without tests.

**The fix:** TDD cycle — write failing test → implement to pass → refactor → THEN claim complete.

## When Mocks Become Too Complex

**Warning signs:**
- Mock setup longer than test logic
- Mocking everything to make test pass
- Mocks missing methods real components have
- Test breaks when mock changes

**Consider:** Integration tests with real components are often simpler than complex mocks.

## TDD Prevents These Anti-Patterns

1. **Write test first** → Forces you to think about what you're actually testing
2. **Watch it fail** → Confirms test tests real behavior, not mocks
3. **Minimal implementation** → No test-only methods creep in
4. **Real dependencies** → You see what the test actually needs before mocking

If you're testing mock behavior, you violated TDD — you added mocks without watching the test fail against real code first.

## Quick Reference

| Anti-Pattern | Fix |
|-------------|------|
| Assert on mock elements | Test real component or unmock it |
| Test-only methods in production | Move to test utilities |
| Mock without understanding | Understand dependencies first, mock minimally |
| Incomplete mocks | Mirror real API completely |
| Tests as afterthought | TDD — tests first |
| Over-complex mocks | Consider integration tests |

## Red Flags

- Assertion checks for `*-mock` test IDs
- Methods only called in test files
- Mock setup is >50% of test
- Test fails when you remove mock
- Can't explain why mock is needed
- Mocking "just to be safe"

**Mocks are tools to isolate, not things to test.** If TDD reveals you're testing mock behavior, you've gone wrong. Fix: test real behavior or question why you're mocking at all.
