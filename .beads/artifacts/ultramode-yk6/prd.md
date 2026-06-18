<!-- DENSITY: Minimum 600 lines. No upper bound — be thorough. <600 = incomplete (missing sections, hand-wavy, no real technical context). This is an AI handoff: another agent must be able to pick this up and implement correctly without guessing. Every section must have concrete evidence: file paths, API signatures, existing patterns, constraints. -->
# PRD: Add GitHub Actions CI workflow + fix package.json scripts

**Bead:** ultramode-yk6 | **Type:** chore | **Priority:** P2
**Created:** 2026-06-18 | **Estimate:** 45

## Problem

WHEN a developer pushes a commit or opens a pull request to the `ultramode` repository, THEN no automated checks run — no tests, no build verification, no type checking — BECAUSE there is no `.github/workflows/` directory and `package.json` scripts are no-op echo stubs (`"build": "echo 'nothing to build'"`, `"check": "echo 'nothing to check'"`, `"clean": "echo 'nothing to clean'"`).

The repository has 57 passing unit tests across 5 test files (verified: `bun test test/` → 57 pass, 0 fail, 179 expect() calls, 0.32s wall time). These tests cover the extension's core logic — phase maps, retry logic, error paths, parse decisions, state reconstruction. But they only run when a developer manually invokes `bun test test/`. Every push to `main` and every PR is completely unverified. A regression could merge silently — the 57 tests exist precisely to catch this, but not running them automatically defeats their purpose.

This was flagged as a deferred risk in two prior beads:
- `ultramode-aqr` PRD (line 36): "CI workflow (separate bead)"
- `ultramode-eqa` PRD (line 80): "CI workflow (separate bead)"

The project's AGENTS.md (`@memory/project/project.md`) lists "README + install docs" under Next, and the broader context includes CI as a standing gap.

The `package.json` scripts compound the problem. A developer who runs `npm run build` or `npm run check` (or `bun run build` / `bun run check`) sees `nothing to build` / `nothing to check` — the commands succeed (exit 0) but do nothing. This is worse than having no scripts at all, because it creates a false signal that verification happened. The scripts should either run real verification or not exist.

If we don't fix this: every future PR to the `ultramode` repository ships without automated verification. The test suite grows over time (it was 48 tests at ultramode-aqr, now 57), making manual runs increasingly tedious. The echo stubs continue to mislead anyone who runs them. The extension's core value — autonomous phase chaining with LLM decisions — has no regression safety net.

## Scope

### In Scope
- New `.github/workflows/ci.yml` file that runs `bun test test/` and `bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent` on push and pull_request events
- Fix `package.json` scripts: replace `"build"` echo stub with `bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent`, replace `"check"` echo stub with `bun test test/`, remove `"clean"` echo stub (no clean target exists or is needed — YAGNI)
- The CI workflow must use `oven-sh/setup-bun@v2` to install Bun
- The CI workflow must fail on test failure or build error (non-zero exit code propagation)
- The CI workflow must run on both `push` and `pull_request` triggers
- The CI workflow must target the `main` branch

### Out of Scope
- Worktree enforcement (separate bead — `state.worktreePath` is never set; `tool_call` handler at index.ts:849-885 is dead code)
- README content updates or architecture documentation (separate docs bead — the README architecture section is stale post-timeout, but docs are not verification)
- markBlocked live verification test (separate verification bead — unit tests cover the path)
- Code changes to `index.ts` — this bead adds CI and fixes scripts only
- Changes to test files — the 57 existing tests are the verification target, not something to modify
- Linting or formatting CI steps (YAGNI — no linter is configured, no formatter is set up; adding one is a separate concern with its own config decisions)
- Type checking via `tsc --noEmit` as a CI step (requires `@types/node` and `@oh-my-pi/*` type packages to be resolvable; these are OMP global packages not in local `node_modules`; also has 2 pre-existing type errors unrelated to this work — see Technical Context)
- Dependency caching in CI (YAGNI — the project has zero npm dependencies in `package.json`; `bun test` resolves only Bun builtins and `mock.module` intercepts; `bun build --target bun --external` resolves externals; no `node_modules` to cache)
- Security scanning, code coverage reporting, or artifact upload (YAGNI — not requested, no coverage tooling exists)
- Matrix testing across multiple Bun versions or OSes (YAGNI — single Bun version is sufficient; OMP itself targets a specific Bun version)
- Changes to the `omp` field in `package.json` (extension registration is unchanged)
- `.gitignore` changes (verified: `bun build` with `--target bun` and no `--outfile` writes to stdout, not to a file — no `dist/` directory is created; see Technical Context Finding 7)

## Requirements

| # | Requirement | Priority | Acceptance Criteria |
|---|------------|----------|---------------------|
| 1 | `.github/workflows/ci.yml` exists and is valid YAML | MUST | `ls .github/workflows/ci.yml` succeeds; the file parses as valid YAML with `name`, `on`, `jobs` keys |
| 2 | CI triggers on push to main and pull_request to main | MUST | The `on:` key contains both `push` (with `branches: [main]`) and `pull_request` (with `branches: [main]`) |
| 3 | CI installs Bun via `oven-sh/setup-bun@v2` | MUST | A step uses `uses: oven-sh/setup-bun@v2`; the job runs on `ubuntu-latest` |
| 4 | CI runs `bun test test/` | MUST | A step runs `run: bun test test/`; the step name is descriptive (e.g., "Run tests") |
| 5 | CI runs `bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent` | MUST | A step runs the build command with both `--external` flags; the step name is descriptive (e.g., "Verify build") |
| 6 | CI fails on non-zero exit from any step | MUST | If `bun test test/` or the build command exits non-zero, the CI job fails (GitHub Actions default behavior — no `continue-on-error` or `|| true` to mask failures) |
| 7 | `package.json` `"build"` script runs `bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent` | MUST | `bun run build` executes the build command and exits 0 (verified locally before merge) |
| 8 | `package.json` `"check"` script runs `bun test test/` | MUST | `bun run check` executes `bun test test/` and exits 0 with 57 passing tests |
| 9 | `package.json` `"clean"` echo stub is removed | MUST | `grep -c '"clean"' package.json` returns 0; the `scripts` object contains only `build` and `check` |
| 10 | CI workflow uses `actions/checkout@v4` before Bun setup | SHOULD | A step uses `uses: actions/checkout@v4` before the `oven-sh/setup-bun@v2` step; this is standard GitHub Actions practice and ensures the repo is checked out |
| 11 | CI job name is descriptive | SHOULD | The job has a `name:` key (e.g., "ci" or "verify") rather than relying on the default |
| 12 | CI workflow file is committed to the repo | MUST | `git status` shows `.github/workflows/ci.yml` as a tracked file after commit |

## Technical Context

**Key files:**
- `.github/workflows/ci.yml` — NEW (~25-35 lines, GitHub Actions YAML)
- `package.json` — EDIT (lines 7-11: replace `scripts` object, 3 lines → 2 lines)

**No other files modified.** The test suite, `index.ts`, prompts, `.gitignore`, and all other files are untouched. This was verified during investigation — no `.gitignore` change is needed (see Finding 7).

**APIs / systems touched:**
- GitHub Actions workflow syntax (YAML)
- Bun CLI: `bun test`, `bun build`
- `package.json` `scripts` field (npm/bun script runner)

**Existing code to NOT modify:**
- `index.ts` — the extension source (954 lines); no code changes in this bead
- `test/*.ts` and `test/mocks.ts` — the test suite (5 test files + mocks); no changes
- `prompts/*.md` — LLM prompt templates (`decision-prompt.md`, `selection-prompt.md`); no changes
- `README.md` — documentation; no changes in this bead
- `.omp/` — OMP configuration, skills, commands, templates; no changes
- `.beads/` — bead workspace; no changes beyond artifact creation
- `.gitignore` — no changes needed (build output goes to stdout, not a file)

### Investigation Findings (Critical Technical Constraints)

These findings were verified through direct command execution during the `/create` investigation phase. They define the solution space and were checked in both the local development environment and a simulated clean CI environment.

#### Finding 1: `bun build index.ts --no-bundle` FAILS

```
$ bun build index.ts --no-bundle
8 | import { complete, completeSimple } from "@oh-my-pi/pi-ai";
                                             ^
error: Could not resolve: "@oh-my-pi/pi-ai". Maybe you need to "bun install"?
    at /home/ryan/repos/ultramode/index.ts:8:42
```

**Why:** `index.ts` line 8 imports `complete` and `completeSimple` from `@oh-my-pi/pi-ai`. This package is installed globally by OMP at `~/.bun/install/global/node_modules/@oh-my-pi/pi-ai`, not in a local `node_modules`. The `--no-bundle` flag tells Bun to transpile without resolving imports, but Bun still needs to find the module to process it. Since there's no local `node_modules`, resolution fails.

**Implication:** The `build` script cannot use `--no-bundle`. The brainstorm's original proposal (`bun build index.ts --no-bundle`) is invalid. This was caught during investigation before the PRD was written.

#### Finding 2: `bun build index.ts --target bun` works locally but resolves global packages

```
$ bun build index.ts --target bun
# Produces a ~7.7MB bundle at dist/index.js
# Exit code: 0
```

**Why:** `--target bun` tells Bun to bundle for the Bun runtime. Bun resolves `@oh-my-pi/pi-ai` and its transitive dependencies from the global packages at `~/.bun/install/global/node_modules/@oh-my-pi/*` and bundles them into a single output file. The 7.7MB size comes from bundling the entire `pi-ai` package (including all LLM provider implementations, auth broker, etc.) and its dependencies (`zod`, etc.).

**Implication:** This works locally but would fail in a clean CI environment (installed via `oven-sh/setup-bun@v2`) because the OMP global packages would not be present. Bun resolves global packages from a path relative to the Bun binary installation, not from environment variables.

#### Finding 3: `bun build --target bun --external` works in a clean CI environment

This is the critical finding that makes the build step feasible in CI.

**Test setup:** Created `/tmp/ci-test` with copies of `index.ts`, `test/`, `prompts/`, `package.json`. Removed any `node_modules` or symlinks. Ran with `env -u BUN_INSTALL HOME=/tmp/fakehome` to simulate a clean CI environment without access to OMP global packages.

```
$ cd /tmp/ci-test
$ env -u BUN_INSTALL HOME=/tmp/fakehome bun build index.ts \
    --target bun \
    --external @oh-my-pi/pi-ai \
    --external @oh-my-pi/pi-coding-agent
# Exit code: 0
# Output: 19,623 bytes of bundled JavaScript to stdout
# No files created on disk
```

**Why it works:** The `--external` flags tell Bun to treat `@oh-my-pi/pi-ai` and `@oh-my-pi/pi-coding-agent` as external modules — Bun emits `import ... from "@oh-my-pi/pi-ai"` in the output without trying to resolve or bundle them. This is correct because these packages are provided at runtime by OMP; they're truly external to the extension. The build verifies that:
1. `index.ts` is syntactically valid TypeScript
2. All non-OMP imports resolve (e.g., `node:fs`)
3. The module structure is valid (exports, imports, no circular dependency errors)

**What it doesn't verify:** Type correctness (it's transpiled, not type-checked). But type checking requires OMP global packages and has pre-existing errors (Finding 6), so this is an acceptable tradeoff.

**Output behavior:** With `--target bun` and no `--outfile` flag, `bun build` writes the bundle to stdout (19,623 bytes), not to a file. Verified: `ls dist/ *.js` finds no files. This means no `dist/` directory is created, so no `.gitignore` change is needed.

#### Finding 4: Tests pass without global packages

```
$ cd /tmp/ci-test
$ env -u BUN_INSTALL HOME=/tmp/fakehome bun test test/

  57 pass
  0 fail
  179 expect() calls
  Ran 57 tests across 5 files. [260ms]
```

**Why:** The test files use `mock.module("@oh-my-pi/pi-ai", ...)` (in `test/mocks.ts:148`) to intercept the `@oh-my-pi/pi-ai` import before resolution. The `import type` from `@oh-my-pi/pi-coding-agent` in `test/mocks.ts:6` is type-only and erased at runtime — Bun never resolves it. The `import { complete, completeSimple } from "@oh-my-pi/pi-ai"` in `index.ts:8` is intercepted by the mock when tests load `index.ts` via the cache-busting `importIndex()` function (`test/mocks.ts:158-161`).

The `importIndex()` function uses dynamic import with a cache-busting query string:
```typescript
export async function importIndex(label: string): Promise<typeof IndexModule> {
  return await import(`../index.ts?${label}-${Date.now()}`);
}
```

This ensures the mock is registered (via `mock.module()`) before `index.ts` is imported. Without cache-busting, Bun might cache the module from a previous import without the mock applied. The comment at line 159 explains: "Test exception: cache-busted dynamic import is required so Bun applies the module mock before index.ts loads."

**Implication:** `bun test test/` works in CI without any OMP packages installed. This is the primary verification step and has zero external dependencies.

#### Finding 5: No npm dependencies in package.json

```json
{
  "name": "ultramode",
  "version": "0.1.0",
  ...
  "scripts": { ... },
  "files": ["index.ts", "prompts/decision-prompt.md", "prompts/selection-prompt.md", "README.md"],
  "omp": { "extensions": ["./index.ts"] }
}
```

No `dependencies`, no `devDependencies`. The project relies entirely on:
- Bun builtins (`bun:test`, `bun:sqlite` — though `bun:sqlite` is only used inside `@oh-my-pi/pi-ai` which is mocked in tests)
- Node builtins (`node:fs`)
- OMP global packages (`@oh-my-pi/pi-ai`, `@oh-my-pi/pi-coding-agent` — provided at runtime by OMP, mocked in tests)

**Implication:** No `bun install` step needed in CI. The workflow can go straight from checkout to `bun test` and `bun build`. No dependency caching needed. This keeps the CI workflow minimal.

#### Finding 6: `tsc --noEmit` type checking is NOT feasible in CI

```
$ cd /tmp/tsc-test  # with symlinks to global @types/node and @oh-my-pi packages
$ bunx tsc --noEmit --moduleResolution bundler --module esnext --target esnext \
    --strict --skipLibCheck --types node index.ts

index.ts(8,42): error TS2307: Cannot find module '@oh-my-pi/pi-ai'
index.ts(13,8): error TS2307: Cannot find module '@oh-my-pi/pi-coding-agent'
index.ts(376,29): error TS2345: Argument of type 'Model<Api> | undefined' is not assignable to parameter of type 'Model<Api>'.
index.ts(379,35): error TS2345: Argument of type 'Model<Api> | undefined' is not assignable to parameter of type 'Model<Api>'.
```

**Why:** `tsc` needs type definitions for `@oh-my-pi/pi-ai` and `@oh-my-pi/pi-coding-agent`, which are OMP global packages. Even with symlinks to global packages (verified in `/tmp/tsc-test` with `node_modules/@oh-my-pi` symlinks), there are 2 pre-existing type errors at index.ts:376 and index.ts:379 (`Model<Api> | undefined` not assignable to `Model<Api>`). These errors are in `decide()` — the function that calls `complete()` — and were introduced or exposed by `ultramode-eqa`'s timeout implementation (the `DECISION_TIMEOUT_MS` constant and `Promise.race` pattern).

**Implication:** Type checking is out of scope. It requires OMP global packages (not available in clean CI) AND has pre-existing errors that would need fixing first. Adding type checking to CI would require either installing OMP in CI (heavyweight, couples CI to OMP internals) or maintaining CI-specific symlinks (fragile, undocumented). Neither is justified for a CI bead. The `bun build --target bun --external` approach provides syntax verification without type checking.

If type checking becomes valuable later, it's a separate bead that would first need to fix the pre-existing type errors at index.ts:376,379 and then set up type resolution in CI.

#### Finding 7: `bun build` with `--target bun` writes to stdout, not a file

```
$ cd /tmp/ci-test
$ env -u BUN_INSTALL HOME=/tmp/fakehome bun build index.ts \
    --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent \
    2>/dev/null | wc -c
19623

$ ls dist/ *.js 2>&1
ls: cannot access 'dist/': No such file or directory
ls: cannot access '*.js': No such file or directory
```

**Why:** When `bun build` is called without an `--outfile` or `--outdir` flag, it writes the bundled output to stdout. This is Bun's default behavior for builds without an explicit output path.

**Implication:** No `dist/` directory is created by the build step. No `.gitignore` change is needed. This was initially assumed to require a `.gitignore` entry for `dist/`, but investigation proved otherwise. The scope is correctly limited to two files: `.github/workflows/ci.yml` (new) and `package.json` (edited).

#### Finding 8: Git remote is GitHub

```
$ git remote -v
origin  https://github.com/ryan-brosas/ultramode.git (fetch)
origin  https://github.com/ryan-brosas/ultramode.git (push)
```

**Implication:** GitHub Actions is the correct CI platform. The workflow file goes in `.github/workflows/`.

### Current package.json Scripts (to be replaced)

```json
"scripts": {
  "clean": "echo 'nothing to clean'",
  "build": "echo 'nothing to build'",
  "check": "echo 'nothing to check'"
}
```

All three are no-ops that exit 0. They provide false verification signals. `bun run build` prints `nothing to build` and exits 0 — a developer might interpret this as "the build succeeded" when in fact nothing was built.

### Test Suite Structure

```
test/
├── mocks.ts                   (5.2KB) — mock factories: createSpy, mockExtensionAPI,
│                                         mockExtensionContext, mockSessionManager,
│                                         installPiAiMock, importIndex
├── error-paths.test.ts        (14.7KB) — decide() error paths, hasPendingMessages guard
├── parse-decision.test.ts     (3.6KB) — parseDecision() backward brace-balanced scan
├── phase-maps.test.ts          (2.6KB) — PHASE_WHITELIST, PHASE_FROM_COMMAND,
│                                         COMMAND_FROM_PHASE, ALLOWED_PHASE_COMMANDS,
│                                         VALID_PHASES
├── reconstruct-state.test.ts  (3.6KB) — reconstructState() journal scanning
├── retry-logic.test.ts         (10.3KB) — retry cap, markBlocked,
│                                         COMMAND_FROM_PHASE re-injection
└── run.sh                      (77B) — `bun test test/`
```

57 tests, 179 expect() calls, 0.32s wall time. All use `bun:test` built-in (no npm test dependency). The `installPiAiMock()` function (`test/mocks.ts:147-156`) uses `mock.module("@oh-my-pi/pi-ai", ...)` to intercept the import before resolution, which is why tests work without OMP packages installed.

### index.ts Import Structure (relevant to build command)

```typescript
// index.ts:7-8
import { existsSync, readFileSync } from "node:fs";
import { complete, completeSimple } from "@oh-my-pi/pi-ai";

// index.ts:10-13
import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@oh-my-pi/pi-coding-agent";

// index.ts:18-20
import type {
  CompleteOptions,
  CompleteResult,
} from "@oh-my-pi/pi-ai";
```

- `node:fs` — Node builtin, always available
- `@oh-my-pi/pi-ai` (value import) — OMP global package, must be `--external` in build
- `@oh-my-pi/pi-coding-agent` (type-only import) — erased at runtime, but including it in `--external` is harmless and documents the intent

### CI Workflow Reference Pattern

Standard GitHub Actions workflow for a Bun project with no dependencies:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun test test/
      - run: bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent
```

This pattern is standard for Bun projects. The `--external` flags are specific to this project because `index.ts` imports from OMP global packages that aren't installed in CI.
### What the CI Protects — The Test Coverage Map

The 57 tests are the regression safety net CI automates. Understanding what they cover clarifies what the CI catches and what it doesn't. Each test file targets a specific module of `index.ts`:

#### `test/phase-maps.test.ts` (57 lines, covers index.ts:55-108)

Tests the 5 phase map constants that are the backbone of the phase chaining logic:
- `PHASE_WHITELIST` (index.ts:59-67) — maps each phase to its successor command. Terminal case: `pr → null`. This is the safety mechanism that prevents the loop from ever injecting `/close` or `/merge`.
- `PHASE_FROM_COMMAND` (index.ts:70-77) — reverse map: command → resulting phase. Used by `handleTurnEnd` to advance the phase when a `proceed` decision is made.
- `COMMAND_FROM_PHASE` (index.ts:100-108) — maps a phase to the command that started it. Used by the retry path to re-inject the current phase's command.
- `ALLOWED_PHASE_COMMANDS` (index.ts:79-86) — Set of valid phase commands. Used to validate `nextCommand` from LLM decisions before injecting.
- `VALID_PHASES` (index.ts:87-95) — Set of valid phase strings. Used by `reconstructState` to validate phase field from journal entries.

CI catches: accidental changes to phase transitions, broken phase mapping, removal of the `pr → null` terminal guard.

#### `test/parse-decision.test.ts` (covers index.ts parseDecision function)

Tests the LLM decision parser that extracts structured JSON from LLM responses. Uses a backward brace-balanced scan — it finds the last valid JSON object in the text by scanning backward from the end. This handles LLM responses that include prose before the JSON block.

CI catches: broken JSON parsing, failure to handle LLM response variance, removal of the backward scan logic.

#### `test/reconstruct-state.test.ts` (covers index.ts reconstructState function)

Tests state reconstruction from the session journal. `reconstructState` scans `ctx.sessionManager.getBranch()` for entries with `type: "custom"` and `customType: "ultramode-control"`, rebuilding the `UltramodeState` from the last matching entry. This is how state survives session restarts.

CI catches: broken state persistence, failure to reconstruct mode/beadId/phase/retries after restart, type validation regressions on journal entries.

#### `test/retry-logic.test.ts` (covers index.ts handleTurnEnd retry path)

Tests the retry mechanism: when `decide()` returns `retry`, `state.retries` increments, and the current phase command is re-injected via `COMMAND_FROM_PHASE[state.phase]`. Tests the cap at `MAX_RETRIES=3` (index.ts:109) and the `markBlocked` function (index.ts:529-554) that fires when retries exceed the cap.

CI catches: broken retry counting, removal of the `MAX_RETRIES` cap, broken re-injection logic, broken `markBlocked` → `br update --status blocked` call.

#### `test/error-paths.test.ts` (covers index.ts decide() and turn_end handler)

Tests error handling in the decision loop:
- `decide()` with no model → throws "no active model on session"
- `decide()` with no API key → throws "no API key for provider/id"
- `decide()` timeout via `Promise.race` + `AbortController` (ultramode-eqa)
- `complete()` throwing → `completeSimple()` fallback path
- `hasPendingMessages` re-entrancy guard in `turn_end` handler

CI catches: broken error handling, removal of the timeout mechanism, removal of the re-entrancy guard, broken fallback path.

#### Test Infrastructure: `test/mocks.ts`

The mock layer that enables tests to run without OMP installed:
- `mockExtensionAPI(overrides)` — mock `ExtensionAPI` with `on`, `sendUserMessage`, `appendEntry`, `exec`, `registerCommand` spies
- `mockExtensionContext(overrides)` — mock `ExtensionContext` with `model`, `modelRegistry`, `sessionManager`, `ui` mocks
- `mockSessionManager(entries)` — mock session journal with custom entries for state reconstruction tests
- `installPiAiMock(overrides)` — uses `mock.module("@oh-my-pi/pi-ai", ...)` to intercept the `@oh-my-pi/pi-ai` import before resolution. This is why tests work in CI without OMP packages (Finding 4).
- `importIndex(label)` — cache-busted dynamic import: `import(\`../index.ts?${label}-${Date.now()}\`)`. Ensures the mock is registered before `index.ts` loads. Without cache-busting, Bun might cache the module from a previous import without the mock applied.

### What CI Does NOT Protect

The tests are unit tests with mocked OMP runtime. They do NOT verify:
- Real `bv`/`br` binary execution (`pi.exec` is mocked)
- Real LLM provider calls (`complete`/`completeSimple` are mocked)
- Real `turn_end` event firing in an OMP session
- Real state persistence through the OMP journal (`appendEntry` is mocked)
- Real `sendUserMessage` delivery (`sendUserMessage` is mocked)

These integration-level concerns were tested in `ultramode-aqr` (live session testing). CI automates the unit test layer, which catches regressions in the extension's logic. Integration regressions (e.g., OMP API changes breaking `appendEntry` behavior) are not caught by CI and require manual verification.

### Build Step Coverage

The `bun build --target bun --external` step provides a different kind of protection:
- **Syntax errors** — a typo like `const state = {` (missing closing brace) would fail the build
- **Missing imports** — referencing a function that doesn't exist in `node:fs` would fail
- **Module structure errors** — duplicate exports, circular imports, invalid export names
- **Non-OMP import resolution** — if a new import is added that isn't `node:*` or `@oh-my-pi/*`, the build would try to resolve it and fail (since there's no `node_modules`)

The build step does NOT verify:
- Type correctness (no `tsc` type checking — Finding 6)
- Runtime behavior (no execution, just compilation)
- OMP package availability (packages are `--external`, not resolved)
### Implementation Walkthrough

This section provides the exact implementation steps for the `/ship` phase. The implementer should follow this sequence and verify after each step.

#### Step 1: Create `.github/workflows/` directory

```bash
mkdir -p .github/workflows
```

The `.github/workflows/` directory does not exist (verified: `find . -name ".github" -type d` returns no results). Create it before writing the workflow file.

#### Step 2: Write `.github/workflows/ci.yml`

The workflow file should contain exactly this structure (adjust step names as needed, but keep the command content exact):

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - name: Run tests
        run: bun test test/
      - name: Verify build
        run: bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent
```

Key points about this YAML:
- `name: CI` — the workflow name shown in the GitHub Actions UI
- `on:` — triggers on both push and pull_request, scoped to the `main` branch. This means pushes to feature branches don't trigger CI (only the PR does), avoiding duplicate runs.
- `jobs.ci` — single job named `ci`. `runs-on: ubuntu-latest` uses the standard GitHub-hosted Ubuntu runner.
- Steps run in order: checkout → setup Bun → test → build. If any step fails, subsequent steps are skipped and the job is marked failed.
- No `continue-on-error: true` on any step — failures propagate.
- `bun-version: latest` — uses the latest Bun version. Can be pinned to a specific version (e.g., `1.3.14`) if reproducibility issues arise.

#### Step 3: Edit `package.json` scripts

Replace the `scripts` object (currently at lines 7-11 in package.json):

**Before:**
```json
"scripts": {
  "clean": "echo 'nothing to clean'",
  "build": "echo 'nothing to build'",
  "check": "echo 'nothing to check'"
}
```

**After:**
```json
"scripts": {
  "build": "bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent",
  "check": "bun test test/"
}
```

Changes:
1. Remove `"clean"` line entirely — no clean target needed
2. Replace `"build"` value with the real build command
3. Replace `"check"` value with the real test command
4. Keep the same JSON formatting (2-space indent, consistent with the rest of the file)

#### Step 4: Local verification

Before committing, verify both scripts work:

```bash
# Verify check script
bun run check 2>&1 | tail -5
# Expected: "57 pass", "0 fail", exit 0

# Verify build script
bun run build > /dev/null 2>&1; echo $?
# Expected: exit code 0

# Verify no dist/ created
ls dist/ 2>&1
# Expected: "No such file or directory"
```

#### Step 5: Commit

```bash
git add .github/workflows/ci.yml package.json
git commit -m "chore: add CI workflow + fix package.json scripts"
```

The commit includes both the new workflow file and the updated package.json. These are the only two files that should appear in `git status` as modified/added.

### Verification Protocol

After implementation, verify each acceptance criterion:

1. **Workflow file exists and is valid YAML:**
   ```bash
   ls .github/workflows/ci.yml
   # Parse YAML — use python3 since bun doesn't have a YAML parser builtin
   python3 -c "import yaml; y=yaml.safe_load(open('.github/workflows/ci.yml')); assert 'name' in y; assert 'on' in y; assert 'jobs' in y; print('YAML valid')"
   ```

2. **Triggers correct:**
   ```bash
   python3 -c "
   import yaml
   y = yaml.safe_load(open('.github/workflows/ci.yml'))
   triggers = y['on']
   assert 'push' in triggers and 'main' in triggers['push']['branches'], 'missing push trigger'
   assert 'pull_request' in triggers and 'main' in triggers['pull_request']['branches'], 'missing pull_request trigger'
   print('Triggers correct')
   "
   ```

3. **Bun setup step:**
   ```bash
   grep -q 'oven-sh/setup-bun@v2' .github/workflows/ci.yml && echo "setup-bun present"
   ```

4. **Checkout step:**
   ```bash
   grep -q 'actions/checkout@v4' .github/workflows/ci.yml && echo "checkout present"
   ```

5. **Test step:**
   ```bash
   grep -q 'bun test test/' .github/workflows/ci.yml && echo "test step present"
   ```

6. **Build step:**
   ```bash
   grep -q 'bun build index.ts --target bun' .github/workflows/ci.yml && echo "build step present"
   grep -q '\-\-external @oh-my-pi/pi-ai' .github/workflows/ci.yml && echo "pi-ai external present"
   grep -q '\-\-external @oh-my-pi/pi-coding-agent' .github/workflows/ci.yml && echo "pi-coding-agent external present"
   ```

7. **No error masking:**
   ```bash
   grep -c 'continue-on-error' .github/workflows/ci.yml
   # Expected: 0
   ```

8. **package.json scripts:**
   ```bash
   python3 -c "
   import json
   s = json.load(open('package.json'))['scripts']
   assert 'clean' not in s, 'clean script still present'
   assert s['build'] == 'bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent', f\"build script wrong: {s['build']}\"
   assert s['check'] == 'bun test test/', f\"check script wrong: {s['check']}\"
   print('package.json scripts correct')
   "
   ```

9. **Scripts run successfully:**
   ```bash
   bun run check 2>&1 | tail -5
   # Expected: 57 pass, 0 fail, exit 0

   bun run build > /dev/null 2>&1; echo $?
   # Expected: 0
   ```

10. **Files tracked:**
    ```bash
    git status --short
    # Expected: .github/workflows/ci.yml (new), package.json (modified)
    ```

## Approach

The implementation is two files: one new (`.github/workflows/ci.yml`), one edited (`package.json`). No code logic, no algorithms, no complex data flow. The complexity is in the investigation (already done) and the constraint handling (already verified).

### CI Workflow (`.github/workflows/ci.yml`)

The workflow defines a single job that runs on `ubuntu-latest` with four steps:

1. **Checkout** — `actions/checkout@v4`. Standard. Gets the repo code into the runner.

2. **Setup Bun** — `oven-sh/setup-bun@v2` with `bun-version: latest`. Installs Bun on the runner. Using `latest` because OMP itself doesn't pin a specific Bun version, and Bun 1.x is backward compatible. If reproducibility becomes a concern later, pin to a specific version (separate bead).

3. **Run tests** — `bun test test/`. This is the primary verification. 57 tests cover the extension's core logic: phase maps (7 constants), retry logic (cap + markBlocked + re-injection), error paths (decide() failures, hasPendingMessages guard), parse decisions (backward brace-balanced scan), state reconstruction (journal scanning). Tests pass without global packages (Finding 4) because `mock.module` intercepts `@oh-my-pi/pi-ai` before resolution.

4. **Verify build** — `bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent`. This confirms the source is syntactically valid TypeScript and all non-OMP imports resolve. The `--external` flags tell Bun to treat `@oh-my-pi/pi-ai` and `@oh-my-pi/pi-coding-agent` as external modules (which they are — OMP provides them at runtime). Without these flags, `bun build` would try to resolve them and fail (Finding 1). The build output goes to stdout (19,623 bytes) and is discarded — it's verification, not a production artifact (Finding 7).

If step 3 fails, step 4 doesn't run (GitHub Actions default: a step failure stops the job). If step 4 fails, the job is marked failed. Both produce a non-green check on the PR/push.

No `continue-on-error`, no `|| true`, no error masking. The CI is honest — if tests or build fail, it shows red.

### package.json Scripts

Replace the three echo stubs:

**Before (package.json lines 7-11):**
```json
"scripts": {
  "clean": "echo 'nothing to clean'",
  "build": "echo 'nothing to build'",
  "check": "echo 'nothing to check'"
}
```

**After:**
```json
"scripts": {
  "build": "bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent",
  "check": "bun test test/"
}
```

- `"build"` — Runs the same build command as CI. Produces a bundle on stdout (discarded). The primary value is verifying the source compiles and imports resolve. If a developer introduces a syntax error or a bad import, `bun run build` catches it locally before pushing. Exits 0 on success, non-zero on error.

- `"check"` — Runs the full test suite. This is the primary verification command. `bun run check` is the local equivalent of the CI test step. Exits 0 if all 57 tests pass, non-zero if any fail.

- `"clean"` removed — There was no clean target and no build artifacts to clean. The build step writes to stdout, not a file (Finding 7), so there's nothing to clean. Adding a clean script would be speculative (YAGNI). If a future bead adds file output to the build, it can add a clean script then.

**Why `"build"` and `"check"` are separate:** They serve different purposes. `build` verifies syntax/import resolution (fast, ~0.5s). `check` verifies behavior (57 tests, ~0.3s). A developer might run `bun run build` for a quick syntax check before running the full test suite. In CI, both run to catch different classes of problems.

### Why Not Type Checking?

Type checking via `tsc --noEmit` was considered and rejected (Finding 6). Reasons:

1. **Requires OMP global packages** — `@oh-my-pi/pi-ai` and `@oh-my-pi/pi-coding-agent` type definitions are in `~/.bun/install/global/node_modules/@oh-my-pi/`, not available in CI
2. **Pre-existing type errors** — 2 errors at index.ts:376,379 (`Model<Api> | undefined` not assignable to `Model<Api>`) in `decide()`, introduced/exposed by `ultramode-eqa`'s timeout implementation
3. **Heavyweight to set up** — Would require either installing OMP in CI (couples CI to OMP internals) or maintaining CI-specific symlinks to global packages (fragile, undocumented, breaks if package paths change)
4. **Redundant with build verification** — `bun build --target bun --external` catches syntax errors and missing imports, which are the most common type of regression. Type errors caught by `tsc` are a subset of what the 57 behavioral tests catch
5. **YAGNI** — The test suite (57 tests, 179 assertions) provides behavioral verification, which is stronger than type checking for catching regressions. Type checking is a nice-to-have, not a need-to-have

If type checking becomes valuable later, it's a separate bead that would first need to fix the pre-existing type errors at index.ts:376,379 (the `Model<Api> | undefined` issue in `decide()`) and then set up type resolution in CI.

### Why Not Linting?

No linter is configured. No `.eslintrc`, no `biome.json`, no `deno.json`. Adding linting requires:
1. Choosing a linter (eslint, biome, deno lint)
2. Configuring rules
3. Fixing any existing violations
4. Adding to CI

This is a separate concern with its own decisions. YAGNI — the test suite catches behavioral regressions. Linting catches style issues, which are cosmetic. If the team wants linting later, it's a separate bead.

### Why Not Dependency Caching?

The project has zero npm dependencies (Finding 5). No `dependencies`, no `devDependencies` in `package.json`. There's no `node_modules` to cache. `bun test` resolves only Bun builtins and `mock.module` intercepts. `bun build --target bun --external` resolves externals without needing packages installed. Adding a caching step would be pure overhead with zero benefit.

### Why `bun-version: latest`?

OMP itself doesn't pin a specific Bun version (the `package.json` has no `engines` field). Bun 1.x is backward compatible — code written for Bun 1.0 works on Bun 1.3. Using `latest` ensures CI runs on the same Bun version the developer is likely using locally. If reproducibility becomes a concern (e.g., a test passes locally but fails in CI due to a Bun version difference), pin to a specific version like `bun-version: 1.3.14`. But that's premature optimization — YAGNI.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `bun build --target bun --external` flags don't work as expected in CI | Low | Medium | Verified locally in a simulated clean CI environment (`/tmp/ci-test` with `env -u BUN_INSTALL HOME=/tmp/fakehome`) — exit 0, 19,623 bytes output. The `--external` flag is a standard, documented Bun build feature. If CI fails on the build step, the test step still runs first and provides primary verification. Build step can be removed if it's flaky — it's secondary to tests. |
| `oven-sh/setup-bun@v2` action changes or breaks | Low | High | This is the standard Bun GitHub Action, maintained by the Bun team. Pinning to `@v2` (major version) follows semver. If it breaks, the CI fails loudly — no silent regression. Alternative: install Bun via shell command (`curl -fsSL https://bun.sh/install \| bash`), but that's more fragile and less maintainable. |
| CI is slow, discouraging developers from running it | Low | Low | The test suite runs in 0.32s. The build step adds ~0.5s. Checkout + Bun setup adds ~10-15s. Total CI time: under 30s. This is fast enough to not be a friction point. |
| Tests fail in CI due to environment differences (OS, Bun version) | Low | Medium | Tests were verified in a clean environment (`/tmp/ci-test` with `env -u BUN_INSTALL HOME=/tmp/fakehome`) and passed with identical output (57 pass, 0 fail, 179 expect() calls, 260ms). CI runs on `ubuntu-latest` which is Linux, matching the local development environment (Linux 6.8.0-124-generic). If Bun version differences cause failures, pin `bun-version` in setup-bun. |
| GitHub Actions YAML syntax error | Low | High | The workflow is ~25-35 lines of standard YAML. Verified pattern (checkout → setup-bun → test → build). If YAML is invalid, GitHub Actions reports a parse error on the workflow file — loud failure, easy to fix. |
| Build step produces unexpected output in CI | Low | Low | Build output goes to stdout (19,623 bytes) and is discarded by the CI runner. No files are created on disk (verified — Finding 7). CI runners are ephemeral. No artifact upload configured. |
| `--external` flag behavior changes in future Bun versions | Low | Low | The flag is documented and stable in Bun 1.x. If it changes, CI fails loudly on the build step. The build step is secondary — tests are the primary verification. Can remove the build step if it becomes a maintenance burden. |
| CI doesn't catch type errors that `tsc` would | Medium | Low | Type checking is intentionally out of scope (Finding 6). The 57 behavioral tests provide stronger verification than type checking for catching regressions. Type errors that cause runtime failures would be caught by tests. The pre-existing type errors at index.ts:376,379 don't cause runtime failures (the code works — verified by 57 passing tests and the live session testing in ultramode-aqr). |

## Acceptance Criteria

- [ ] `.github/workflows/ci.yml` exists and contains valid YAML
    - Verify: `ls .github/workflows/ci.yml` and parse the YAML structure — has `name`, `on`, `jobs` keys
- [ ] CI workflow triggers on push to main and pull_request to main
    - Verify: The `on:` key in ci.yml contains `push: branches: [main]` and `pull_request: branches: [main]`
- [ ] CI workflow installs Bun via `oven-sh/setup-bun@v2`
    - Verify: A step in ci.yml uses `uses: oven-sh/setup-bun@v2`
- [ ] CI workflow uses `actions/checkout@v4` before Bun setup
    - Verify: A step in ci.yml uses `uses: actions/checkout@v4` and appears before the `oven-sh/setup-bun@v2` step
- [ ] CI workflow runs `bun test test/`
    - Verify: A step in ci.yml runs `run: bun test test/`
- [ ] CI workflow runs `bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent`
    - Verify: A step in ci.yml runs the build command with both `--external` flags
- [ ] CI workflow has no `continue-on-error` or error masking
    - Verify: `grep -c 'continue-on-error' .github/workflows/ci.yml` returns 0; no step has `|| true`
- [ ] `package.json` `"build"` script is `bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent`
    - Verify: `python3 -c "import json; print(json.load(open('package.json'))['scripts']['build'])"` outputs the build command
- [ ] `package.json` `"check"` script is `bun test test/`
    - Verify: `python3 -c "import json; print(json.load(open('package.json'))['scripts']['check'])"` outputs `bun test test/`
- [ ] `package.json` `"clean"` script is removed
    - Verify: `python3 -c "import json; print('clean' in json.load(open('package.json'))['scripts'])"` outputs `False`
- [ ] `bun run check` runs 57 tests and exits 0
    - Verify: `bun run check 2>&1 | tail -5` shows "57 pass" and exit code 0
- [ ] `bun run build` succeeds and exits 0
    - Verify: `bun run build > /dev/null 2>&1; echo $?` outputs `0`
- [ ] CI workflow file is committed to the repo
    - Verify: `git status` shows `.github/workflows/ci.yml` as tracked (staged/committed)
