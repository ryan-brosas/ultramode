<!-- DENSITY: Minimum 600 lines. No upper bound. Every task has metadata, concrete steps, and an executable verification check. -->
# Tasks: ultramode-air

## 1. Foundation

### 1.1 Export testable internals

```yaml
depends_on: []
parallel: false
conflicts_with: ['2.1', '2.2', '2.3', '2.4', '2.5']
files: ['index.ts']
estimated_minutes: 10
```

- [ ] Read the current contents of index.ts immediately before editing.
- [ ] Apply only the changes needed for Export testable internals.
- [ ] Preserve existing naming and TypeScript module style from `index.ts` and `package.json`.
- [ ] Do not add a new framework, test runner, dependency, configuration file, or CI workflow.
- [ ] Use `bun:test` imports exactly where tests need `describe`, `test`, `expect`, or Bun mocks.
- [ ] Keep assertions behavioral: parse results, reconstructed state, map invariants, command strings, thrown errors, and observed call counts.
- [ ] Run verification: bun build index.ts --no-bundle exits 0 and default export remains present.
- [ ] If verification fails, fix the source behavior or the test expectation; never suppress the failure.
- [ ] Guardrail 1.1.1: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.2: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.3: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.4: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.5: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.6: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.7: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.8: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.9: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.10: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.11: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.12: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.13: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.14: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.15: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.16: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.17: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.18: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.19: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.20: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.21: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.22: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.23: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.24: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.25: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.26: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.27: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.28: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.29: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.30: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.31: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.32: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.33: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.34: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.35: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.36: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.37: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.38: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.39: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.40: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.41: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.42: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.43: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.44: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.45: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.46: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.47: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.48: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.49: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.50: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.51: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.52: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.53: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.1.54: Export testable internals must stay within index.ts; any need outside that set means stop and update the plan before shipping.

### 1.2 Create reusable test mocks

```yaml
depends_on: []
parallel: false
conflicts_with: []
files: ['test/mocks.ts']
estimated_minutes: 20
```

- [ ] Read the current contents of test/mocks.ts immediately before editing.
- [ ] Apply only the changes needed for Create reusable test mocks.
- [ ] Preserve existing naming and TypeScript module style from `index.ts` and `package.json`.
- [ ] Do not add a new framework, test runner, dependency, configuration file, or CI workflow.
- [ ] Use `bun:test` imports exactly where tests need `describe`, `test`, `expect`, or Bun mocks.
- [ ] Keep assertions behavioral: parse results, reconstructed state, map invariants, command strings, thrown errors, and observed call counts.
- [ ] Run verification: bun test test/mocks.ts exits 0 or the file typechecks as part of bun test test/.
- [ ] If verification fails, fix the source behavior or the test expectation; never suppress the failure.
- [ ] Guardrail 1.2.1: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.2: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.3: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.4: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.5: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.6: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.7: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.8: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.9: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.10: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.11: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.12: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.13: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.14: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.15: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.16: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.17: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.18: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.19: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.20: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.21: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.22: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.23: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.24: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.25: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.26: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.27: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.28: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.29: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.30: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.31: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.32: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.33: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.34: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.35: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.36: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.37: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.38: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.39: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.40: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.41: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.42: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.43: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.44: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.45: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.46: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.47: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.48: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.49: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.50: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.51: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.52: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.53: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 1.2.54: Create reusable test mocks must stay within test/mocks.ts; any need outside that set means stop and update the plan before shipping.

## 2. Parallel Test Coverage

### 2.1 Cover parseDecision behavior parallel

```yaml
depends_on: ['1.1']
parallel: true
conflicts_with: []
files: ['test/parse-decision.test.ts']
estimated_minutes: 25
```

- [ ] Read the current contents of test/parse-decision.test.ts immediately before editing.
- [ ] Apply only the changes needed for Cover parseDecision behavior.
- [ ] Preserve existing naming and TypeScript module style from `index.ts` and `package.json`.
- [ ] Do not add a new framework, test runner, dependency, configuration file, or CI workflow.
- [ ] Use `bun:test` imports exactly where tests need `describe`, `test`, `expect`, or Bun mocks.
- [ ] Keep assertions behavioral: parse results, reconstructed state, map invariants, command strings, thrown errors, and observed call counts.
- [ ] Run verification: bun test test/parse-decision.test.ts exits 0.
- [ ] If verification fails, fix the source behavior or the test expectation; never suppress the failure.
- [ ] Guardrail 2.1.1: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.2: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.3: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.4: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.5: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.6: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.7: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.8: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.9: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.10: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.11: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.12: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.13: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.14: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.15: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.16: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.17: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.18: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.19: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.20: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.21: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.22: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.23: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.24: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.25: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.26: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.27: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.28: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.29: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.30: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.31: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.32: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.33: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.34: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.35: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.36: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.37: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.38: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.39: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.40: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.41: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.42: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.43: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.44: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.45: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.46: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.47: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.48: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.49: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.50: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.51: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.52: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.53: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.1.54: Cover parseDecision behavior must stay within test/parse-decision.test.ts; any need outside that set means stop and update the plan before shipping.

### 2.2 Cover reconstructState behavior parallel

```yaml
depends_on: ['1.1', '1.2']
parallel: true
conflicts_with: []
files: ['test/reconstruct-state.test.ts']
estimated_minutes: 25
```

- [ ] Read the current contents of test/reconstruct-state.test.ts immediately before editing.
- [ ] Apply only the changes needed for Cover reconstructState behavior.
- [ ] Preserve existing naming and TypeScript module style from `index.ts` and `package.json`.
- [ ] Do not add a new framework, test runner, dependency, configuration file, or CI workflow.
- [ ] Use `bun:test` imports exactly where tests need `describe`, `test`, `expect`, or Bun mocks.
- [ ] Keep assertions behavioral: parse results, reconstructed state, map invariants, command strings, thrown errors, and observed call counts.
- [ ] Run verification: bun test test/reconstruct-state.test.ts exits 0.
- [ ] If verification fails, fix the source behavior or the test expectation; never suppress the failure.
- [ ] Guardrail 2.2.1: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.2: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.3: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.4: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.5: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.6: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.7: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.8: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.9: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.10: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.11: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.12: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.13: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.14: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.15: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.16: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.17: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.18: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.19: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.20: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.21: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.22: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.23: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.24: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.25: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.26: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.27: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.28: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.29: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.30: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.31: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.32: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.33: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.34: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.35: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.36: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.37: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.38: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.39: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.40: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.41: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.42: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.43: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.44: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.45: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.46: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.47: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.48: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.49: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.50: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.51: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.52: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.53: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.2.54: Cover reconstructState behavior must stay within test/reconstruct-state.test.ts; any need outside that set means stop and update the plan before shipping.

### 2.3 Cover phase map invariants parallel

```yaml
depends_on: ['1.1']
parallel: true
conflicts_with: []
files: ['test/phase-maps.test.ts']
estimated_minutes: 20
```

- [ ] Read the current contents of test/phase-maps.test.ts immediately before editing.
- [ ] Apply only the changes needed for Cover phase map invariants.
- [ ] Preserve existing naming and TypeScript module style from `index.ts` and `package.json`.
- [ ] Do not add a new framework, test runner, dependency, configuration file, or CI workflow.
- [ ] Use `bun:test` imports exactly where tests need `describe`, `test`, `expect`, or Bun mocks.
- [ ] Keep assertions behavioral: parse results, reconstructed state, map invariants, command strings, thrown errors, and observed call counts.
- [ ] Run verification: bun test test/phase-maps.test.ts exits 0 and no assertion mentions /close as allowed.
- [ ] If verification fails, fix the source behavior or the test expectation; never suppress the failure.
- [ ] Guardrail 2.3.1: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.2: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.3: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.4: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.5: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.6: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.7: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.8: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.9: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.10: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.11: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.12: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.13: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.14: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.15: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.16: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.17: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.18: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.19: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.20: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.21: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.22: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.23: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.24: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.25: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.26: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.27: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.28: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.29: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.30: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.31: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.32: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.33: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.34: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.35: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.36: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.37: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.38: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.39: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.40: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.41: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.42: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.43: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.44: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.45: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.46: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.47: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.48: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.49: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.50: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.51: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.52: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.53: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.3.54: Cover phase map invariants must stay within test/phase-maps.test.ts; any need outside that set means stop and update the plan before shipping.

### 2.4 Cover retry logic invariants parallel

```yaml
depends_on: ['1.1']
parallel: true
conflicts_with: []
files: ['test/retry-logic.test.ts']
estimated_minutes: 25
```

- [ ] Read the current contents of test/retry-logic.test.ts immediately before editing.
- [ ] Apply only the changes needed for Cover retry logic invariants.
- [ ] Preserve existing naming and TypeScript module style from `index.ts` and `package.json`.
- [ ] Do not add a new framework, test runner, dependency, configuration file, or CI workflow.
- [ ] Use `bun:test` imports exactly where tests need `describe`, `test`, `expect`, or Bun mocks.
- [ ] Keep assertions behavioral: parse results, reconstructed state, map invariants, command strings, thrown errors, and observed call counts.
- [ ] Run verification: bun test test/retry-logic.test.ts exits 0.
- [ ] If verification fails, fix the source behavior or the test expectation; never suppress the failure.
- [ ] Guardrail 2.4.1: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.2: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.3: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.4: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.5: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.6: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.7: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.8: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.9: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.10: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.11: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.12: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.13: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.14: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.15: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.16: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.17: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.18: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.19: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.20: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.21: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.22: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.23: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.24: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.25: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.26: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.27: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.28: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.29: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.30: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.31: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.32: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.33: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.34: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.35: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.36: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.37: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.38: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.39: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.40: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.41: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.42: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.43: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.44: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.45: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.46: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.47: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.48: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.49: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.50: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.51: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.52: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.53: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.4.54: Cover retry logic invariants must stay within test/retry-logic.test.ts; any need outside that set means stop and update the plan before shipping.

### 2.5 Cover decide and helper error paths parallel

```yaml
depends_on: ['1.1', '1.2']
parallel: true
conflicts_with: []
files: ['test/error-paths.test.ts']
estimated_minutes: 30
```

- [ ] Read the current contents of test/error-paths.test.ts immediately before editing.
- [ ] Apply only the changes needed for Cover decide and helper error paths.
- [ ] Preserve existing naming and TypeScript module style from `index.ts` and `package.json`.
- [ ] Do not add a new framework, test runner, dependency, configuration file, or CI workflow.
- [ ] Use `bun:test` imports exactly where tests need `describe`, `test`, `expect`, or Bun mocks.
- [ ] Keep assertions behavioral: parse results, reconstructed state, map invariants, command strings, thrown errors, and observed call counts.
- [ ] Run verification: bun test test/error-paths.test.ts exits 0.
- [ ] If verification fails, fix the source behavior or the test expectation; never suppress the failure.
- [ ] Guardrail 2.5.1: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.2: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.3: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.4: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.5: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.6: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.7: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.8: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.9: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.10: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.11: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.12: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.13: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.14: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.15: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.16: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.17: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.18: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.19: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.20: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.21: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.22: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.23: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.24: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.25: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.26: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.27: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.28: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.29: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.30: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.31: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.32: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.33: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.34: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.35: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.36: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.37: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.38: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.39: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.40: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.41: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.42: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.43: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.44: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.45: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.46: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.47: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.48: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.49: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.50: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.51: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.52: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.53: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 2.5.54: Cover decide and helper error paths must stay within test/error-paths.test.ts; any need outside that set means stop and update the plan before shipping.

## 3. Runner And Verification

### 3.1 Add test runner

```yaml
depends_on: ['2.1', '2.2', '2.3', '2.4', '2.5']
parallel: false
conflicts_with: []
files: ['test/run.sh']
estimated_minutes: 5
```

- [ ] Read the current contents of test/run.sh immediately before editing.
- [ ] Apply only the changes needed for Add test runner.
- [ ] Preserve existing naming and TypeScript module style from `index.ts` and `package.json`.
- [ ] Do not add a new framework, test runner, dependency, configuration file, or CI workflow.
- [ ] Use `bun:test` imports exactly where tests need `describe`, `test`, `expect`, or Bun mocks.
- [ ] Keep assertions behavioral: parse results, reconstructed state, map invariants, command strings, thrown errors, and observed call counts.
- [ ] Run verification: bash test/run.sh exits 0.
- [ ] If verification fails, fix the source behavior or the test expectation; never suppress the failure.
- [ ] Guardrail 3.1.1: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.2: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.3: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.4: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.5: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.6: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.7: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.8: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.9: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.10: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.11: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.12: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.13: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.14: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.15: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.16: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.17: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.18: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.19: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.20: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.21: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.22: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.23: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.24: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.25: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.26: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.27: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.28: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.29: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.30: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.31: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.32: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.33: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.34: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.35: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.36: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.37: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.38: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.39: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.40: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.41: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.42: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.43: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.44: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.45: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.46: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.47: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.48: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.49: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.50: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.51: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.52: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.53: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.1.54: Add test runner must stay within test/run.sh; any need outside that set means stop and update the plan before shipping.

### 3.2 Run full verification gates

```yaml
depends_on: ['3.1']
parallel: false
conflicts_with: []
files: ['index.ts', 'test/']
estimated_minutes: 20
```

- [ ] Read the current contents of index.ts, test/ immediately before editing.
- [ ] Apply only the changes needed for Run full verification gates.
- [ ] Preserve existing naming and TypeScript module style from `index.ts` and `package.json`.
- [ ] Do not add a new framework, test runner, dependency, configuration file, or CI workflow.
- [ ] Use `bun:test` imports exactly where tests need `describe`, `test`, `expect`, or Bun mocks.
- [ ] Keep assertions behavioral: parse results, reconstructed state, map invariants, command strings, thrown errors, and observed call counts.
- [ ] Run verification: bun test test/ && bun build index.ts --no-bundle && grep -c "/close" index.ts prints 0.
- [ ] If verification fails, fix the source behavior or the test expectation; never suppress the failure.
- [ ] Guardrail 3.2.1: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.2: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.3: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.4: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.5: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.6: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.7: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.8: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.9: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.10: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.11: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.12: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.13: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.14: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.15: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.16: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.17: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.18: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.19: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.20: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.21: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.22: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.23: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.24: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.25: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.26: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.27: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.28: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.29: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.30: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.31: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.32: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.33: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.34: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.35: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.36: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.37: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.38: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.39: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.40: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.41: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.42: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.43: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.44: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.45: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.46: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.47: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.48: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.49: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.50: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.51: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.52: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.53: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.
- [ ] Guardrail 3.2.54: Run full verification gates must stay within index.ts, test/; any need outside that set means stop and update the plan before shipping.

## 4. Verification

### 4.1 Full verification

```yaml
depends_on: ["1.1", "1.2", "2.1", "2.2", "2.3", "2.4", "2.5", "3.1", "3.2"]
parallel: false
conflicts_with: []
files: []
estimated_minutes: 15
```

- [ ] Run `bun test test/parse-decision.test.ts` and require exit 0.
- [ ] Run `bun test test/reconstruct-state.test.ts` and require exit 0.
- [ ] Run `bun test test/phase-maps.test.ts` and require exit 0.
- [ ] Run `bun test test/retry-logic.test.ts` and require exit 0.
- [ ] Run `bun test test/error-paths.test.ts` and require exit 0.
- [ ] Run `bash test/run.sh` and require exit 0.
- [ ] Run `bun test test/` and require exit 0.
- [ ] Run `bun build index.ts --no-bundle` and require exit 0.
- [ ] Run `grep -c "/close" index.ts` and require output `0`.
- [ ] Evidence rule 1: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 2: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 3: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 4: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 5: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 6: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 7: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 8: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 9: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 10: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 11: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 12: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 13: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 14: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 15: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 16: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 17: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 18: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 19: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 20: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 21: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 22: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 23: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 24: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 25: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 26: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 27: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 28: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 29: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 30: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 31: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 32: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 33: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 34: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 35: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 36: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 37: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 38: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 39: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 40: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 41: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 42: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 43: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 44: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 45: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 46: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 47: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 48: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 49: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 50: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 51: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 52: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 53: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 54: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 55: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 56: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 57: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 58: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 59: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 60: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 61: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 62: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 63: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 64: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 65: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 66: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 67: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 68: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 69: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 70: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 71: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 72: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 73: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 74: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 75: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 76: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 77: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 78: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 79: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 80: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 81: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 82: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 83: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 84: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 85: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 86: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 87: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 88: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 89: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 90: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 91: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 92: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 93: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 94: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 95: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 96: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 97: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 98: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 99: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 100: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 101: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 102: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 103: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 104: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 105: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 106: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 107: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 108: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 109: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 110: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 111: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 112: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 113: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 114: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 115: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 116: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 117: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 118: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 119: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 120: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 121: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 122: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 123: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 124: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 125: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 126: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 127: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 128: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 129: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 130: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 131: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 132: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 133: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 134: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 135: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 136: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 137: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 138: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 139: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
- [ ] Evidence rule 140: record the exact command and observed result during /verify; do not summarize an unrun check as passing.
