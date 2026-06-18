# Plan: ultramode-yk6

**Goal:** Add a GitHub Actions CI workflow that runs `bun test test/` and `bun build` on every push/PR to main, and replace the three echo-stub scripts in `package.json` with real commands (or remove them).

## Graph Context

- **Blast radius:** 2 files (1 new, 1 edit, 0 deletes)
  - `.github/workflows/ci.yml` — NEW file (does not exist; verified: `find . -name ".github" -type d` returns nothing)
  - `package.json` — EDIT (lines 7-11, the `scripts` object; remove `clean`, replace `build` and `check`)
- **Unblocks:** None — this bead has 0 out-degree in the dependency graph. It is a terminal chore.
- **Blocked by:** None — 0 in-degree, no parent in dep tree, orphan node.
- **Critical path:** No — does not block other work. Track-A is the only execution track, and this is the only item in it.
- **Forecast:** 52 minutes (confidence 0.4, velocity 20 min/day, 1 agent). Factors: type chore×0.8, depth 1×1.10, estimate median 60m.
- **Hotspots touched:** None — the hotspots from `bv --robot-file-hotspots` are `.omp/memory/project/*.md` files (3, 2, 2, 1 bead links respectively). This bead touches neither those memory files nor any file with >3 bead history. The two files it does touch (`package.json`, `.github/workflows/ci.yml`) have 0 prior bead links.

### Graph Metrics (from `bv --robot-insights`)

| Metric | Value | Interpretation |
|--------|-------|----------------|
| OutDegree | 0 | No downstream dependencies — this bead unblocks nothing |
| InDegree | 0 | No upstream dependencies — this bead is blocked by nothing |
| Orphan | Yes | No graph connections at all — standalone work |
| Cycles | null | No cycles in the graph (verified: `br dep cycles --json` returns `[]`) |
| Bottlenecks | [] | This bead is not a bottleneck for any other work |
| Slack | 0 | No scheduling slack — but irrelevant since there's nothing to schedule against |
| Velocity | 10 closed last 7 days | Team velocity is high; this bead should close quickly |
| Topological order position | 1st | `ultramode-yk6` is first in the topological sort (ready to execute immediately) |

### Execution Track

```
Track track-A: "Single actionable item"
  └── ultramode-yk6 (P2, open) — unblocks: None
```

This is the only actionable bead in the entire graph. No parallelization across beads is possible or needed. The parallelization happens WITHIN the bead — the two file changes (ci.yml, package.json) are independent and can be done in parallel.

## Observable Truths

These are concrete, falsifiable statements. After implementation, each one can be verified by a command and will return either true or false — no ambiguity.

1. **`.github/workflows/ci.yml` exists as a file** — `test -f .github/workflows/ci.yml && echo exists` outputs `exists`
2. **ci.yml is valid YAML** — `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` exits 0
3. **ci.yml has a `name` key** — `python3 -c "import yaml; assert 'name' in yaml.safe_load(open('.github/workflows/ci.yml'))"` exits 0
4. **ci.yml triggers on push to main** — `python3 -c "import yaml; y=yaml.safe_load(open('.github/workflows/ci.yml')); assert 'push' in y['on'] and 'main' in y['on']['push']['branches']"` exits 0
5. **ci.yml triggers on pull_request to main** — `python3 -c "import yaml; y=yaml.safe_load(open('.github/workflows/ci.yml')); assert 'pull_request' in y['on'] and 'main' in y['on']['pull_request']['branches']"` exits 0
6. **ci.yml uses `actions/checkout@v4`** — `grep -q 'actions/checkout@v4' .github/workflows/ci.yml` exits 0
7. **ci.yml uses `oven-sh/setup-bun@v2`** — `grep -q 'oven-sh/setup-bun@v2' .github/workflows/ci.yml` exits 0
8. **ci.yml runs `bun test test/`** — `grep -q 'bun test test/' .github/workflows/ci.yml` exits 0
9. **ci.yml runs the build command with both --external flags** — `grep -q '\-\-external @oh-my-pi/pi-ai' .github/workflows/ci.yml && grep -q '\-\-external @oh-my-pi/pi-coding-agent' .github/workflows/ci.yml` exits 0
10. **ci.yml has no `continue-on-error`** — `grep -c 'continue-on-error' .github/workflows/ci.yml` outputs `0`
11. **ci.yml has no `|| true` error masking** — `grep -c '|| true' .github/workflows/ci.yml` outputs `0`
12. **package.json has no `clean` script** — `python3 -c "import json; assert 'clean' not in json.load(open('package.json'))['scripts']"` exits 0
13. **package.json `build` script is the real build command** — `python3 -c "import json; assert json.load(open('package.json'))['scripts']['build'] == 'bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent'"` exits 0
14. **package.json `check` script is `bun test test/`** — `python3 -c "import json; assert json.load(open('package.json'))['scripts']['check'] == 'bun test test/'"` exits 0
15. **`bun run check` passes 57 tests** — `bun run check 2>&1 | tail -5` shows `57 pass` and `0 fail`
16. **`bun run build` exits 0** — `bun run build > /dev/null 2>&1; echo $?` outputs `0`
17. **No `dist/` directory is created by the build** — `bun run build > /dev/null 2>&1; ls dist/ 2>&1` outputs `No such file or directory` (or equivalent error)
18. **Both files are tracked in git** — `git status --short` shows `.github/workflows/ci.yml` and `package.json` as modified/added
19. **ci.yml runs on `ubuntu-latest`** — `grep -q 'runs-on: ubuntu-latest' .github/workflows/ci.yml` exits 0
20. **Checkout step appears before Bun setup step** — `grep -n 'actions/checkout@v4' .github/workflows/ci.yml` returns a lower line number than `grep -n 'oven-sh/setup-bun@v2' .github/workflows/ci.yml`

## Required Artifacts

| Artifact | Provides | Path | Status |
|----------|----------|------|--------|
| CI workflow | GitHub Actions workflow that runs tests + build on push/PR to main | `.github/workflows/ci.yml` | Need |
| package.json (edited) | Real `build` and `check` scripts; `clean` removed | `package.json` | Need |
| PRD | Problem statement, requirements, acceptance criteria | `.beads/artifacts/ultramode-yk6/prd.md` | Have |
| prd.json | Machine-readable requirements mirror | `.beads/artifacts/ultramode-yk6/prd.json` | Have |
| decisions.md | Architecture decisions and rejected alternatives | `.beads/artifacts/ultramode-yk6/decisions.md` | Have |
| plan.md | This file — execution plan with wave structure and verification | `.beads/artifacts/ultramode-yk6/plan.md` | Have (this) |
| tasks.md | Concrete task checklist with dependencies and verification | `.beads/artifacts/ultramode-yk6/tasks.md` | Need |
| context-capsule.md | Handoff context for the implementing agent | `.beads/artifacts/ultramode-yk6/context-capsule.md` | Need |

## Wave Structure

| Wave | Tasks | Parallel? | Preconditions | Verification Gate |
|------|-------|-----------|---------------|-------------------|
| 1 | 1.1 (write ci.yml), 1.2 (edit package.json) | Yes | None — both files are independent | `bun run check` passes + `bun run build` exits 0 + YAML validates |
| 2 | 2.1 (local verification) | No | Wave 1 complete | All 20 observable truths pass |
| 3 | 3.1 (commit) | No | Wave 2 complete | `git log --oneline -1` shows the commit; `git status` is clean |

### Wave Rationale

**Wave 1 is parallel** because the two file changes are completely independent:
- `.github/workflows/ci.yml` is a new file — no existing content to read or modify
- `package.json` scripts are at lines 7-11 — the edit doesn't interact with the workflow file

A single agent could do both sequentially in under 5 minutes. But if two agents were available, they could work on both files simultaneously without conflict — they touch different files, no shared state, no ordering dependency.

**Wave 2 is sequential** because verification must happen after both files are written. The verification commands (`bun run check`, `bun run build`) depend on both files being in their final state.

**Wave 3 is sequential** because the commit captures the state after verification passes. Committing before verification would risk committing broken code.

## Tasks

### Wave 1: Implementation

**Task 1.1: Write `.github/workflows/ci.yml`**

Create the GitHub Actions CI workflow file. This is a new file — the `.github/workflows/` directory does not exist yet. The workflow runs on `ubuntu-latest`, checks out the code, sets up Bun, runs the test suite, and verifies the build compiles.

Key design decisions (from PRD decisions.md):
- `--target bun --external` for the build step (not `--no-bundle`, which fails on OMP global packages)
- `bun-version: latest` (not pinned — premature optimization, OMP doesn't pin)
- Single job, not separate test/build jobs (both run in <1s, splitting adds overhead)
- No dependency caching (zero npm dependencies, nothing to cache)
- No type checking (requires OMP packages, has pre-existing errors — separate bead)

```yaml
# .github/workflows/ci.yml
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

The `--external` flags are critical: `index.ts` imports from `@oh-my-pi/pi-ai` and `@oh-my-pi/pi-coding-agent`, which are OMP global packages not available in the CI environment. The `--external` flag tells Bun to treat these as external imports (not bundled), which mirrors how the extension loads in production (OMP provides these at runtime).

The test step (`bun test test/`) works without OMP packages because `test/mocks.ts` uses `mock.module("@oh-my-pi/pi-ai", ...)` to intercept the import before Bun tries to resolve it. This was verified in a clean environment simulation (`/tmp/ci-test` with `env -u BUN_INSTALL HOME=/tmp/fakehome`).

**Verification:** `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('valid')"` outputs `valid`

---

**Task 1.2: Edit `package.json` scripts** {parallel}

Replace the echo stub scripts with real commands. The `scripts` object is at lines 7-11 in `package.json`. This task is parallel with Task 1.1 — it touches a different file and has no dependency on the workflow file.

Current state (lines 7-11):
```json
"scripts": {
  "clean": "echo 'nothing to clean'",
  "build": "echo 'nothing to build'",
  "check": "echo 'nothing to check'"
}
```

Target state:
```json
"scripts": {
  "build": "bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent",
  "check": "bun test test/"
}
```

Changes:
1. Remove `"clean": "echo 'nothing to clean'",` — the build writes to stdout, no files to clean
2. Replace `"build"` value with `bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent`
3. Replace `"check"` value with `bun test test/`
4. Keep 2-space indentation consistent with the rest of the file

The `build` script mirrors the CI build step exactly — same command, same flags. This ensures `bun run build` (local) and the CI build step produce identical results. A developer running `bun run build` locally gets the same verification CI provides.

The `check` script mirrors the CI test step — `bun test test/`. This is the existing convention (referenced in `test/run.sh`, prior bead PRDs, and AGENTS.md). Running `bun run check` locally runs the same 57 tests CI runs.

No `clean` script: the build step writes to stdout (verified — `bun build --target bun` without `--outfile` writes to stdout, not a file). No `dist/` directory is created. Adding a clean script for nonexistent output would be speculative (YAGNI).

**Verification:** `python3 -c "import json; s=json.load(open('package.json'))['scripts']; assert 'clean' not in s; assert 'build' in s; assert 'check' in s; print('scripts correct')"`

### Wave 2: Local Verification

**Task 2.1: Run full local verification**

After both files are written, verify the implementation works end-to-end. This is the gate before committing — if any check fails, fix the issue before committing.

The verification covers three categories:
1. **YAML structure** — the workflow file is valid YAML with the right structure
2. **Script correctness** — package.json scripts are correct
3. **Runtime behavior** — both scripts actually work when executed

```
# 1. YAML validation
python3 -c "import yaml; y=yaml.safe_load(open('.github/workflows/ci.yml')); assert 'name' in y; assert 'on' in y; assert 'jobs' in y; print('YAML valid')"

# 2. Trigger validation
python3 -c "
import yaml
y = yaml.safe_load(open('.github/workflows/ci.yml'))
triggers = y['on']
assert 'push' in triggers and 'main' in triggers['push']['branches']
assert 'pull_request' in triggers and 'main' in triggers['pull_request']['branches']
print('Triggers correct')
"

# 3. Step validation
grep -q 'actions/checkout@v4' .github/workflows/ci.yml
grep -q 'oven-sh/setup-bun@v2' .github/workflows/ci.yml
grep -q 'bun test test/' .github/workflows/ci.yml
grep -q '\-\-external @oh-my-pi/pi-ai' .github/workflows/ci.yml
grep -q '\-\-external @oh-my-pi/pi-coding-agent' .github/workflows/ci.yml
grep -c 'continue-on-error' .github/workflows/ci.yml  # Expected: 0

# 4. Script validation
python3 -c "
import json
s = json.load(open('package.json'))['scripts']
assert 'clean' not in s
assert s['build'] == 'bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent'
assert s['check'] == 'bun test test/'
print('Scripts correct')
"

# 5. Runtime — tests pass
bun run check 2>&1 | tail -5
# Expected: 57 pass, 0 fail

# 6. Runtime — build passes
bun run build > /dev/null 2>&1; echo $?
# Expected: 0

# 7. No dist/ created
bun run build > /dev/null 2>&1; ls dist/ 2>&1
# Expected: "No such file or directory"
```

**Verification:** All commands exit 0 and produce expected output

### Wave 3: Commit

**Task 3.1: Commit changes**

Stage both files and commit. The commit message follows conventional commit format (`chore:` prefix for CI/config changes).

```bash
git add .github/workflows/ci.yml package.json
git commit -m "chore: add CI workflow + fix package.json scripts"
```

The commit should include exactly two files: `.github/workflows/ci.yml` (new) and `package.json` (modified). No other files should appear in `git status --short` unless they were pre-existing changes (which there shouldn't be — the PRD is the only other change, already committed in the create phase).

**Verification:** `git log --oneline -1` shows the commit; `git status --short` shows no uncommitted changes (clean working tree)

## Full Verification

```bash
# === File existence ===
test -f .github/workflows/ci.yml && echo "ci.yml exists"
# Expected: ci.yml exists

# === YAML validity ===
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML valid')"
# Expected: YAML valid

# === Triggers ===
python3 -c "
import yaml
y = yaml.safe_load(open('.github/workflows/ci.yml'))
assert 'push' in y['on'] and 'main' in y['on']['push']['branches']
assert 'pull_request' in y['on'] and 'main' in y['on']['pull_request']['branches']
print('Triggers correct')
"
# Expected: Triggers correct

# === Steps present and ordered ===
grep -q 'actions/checkout@v4' .github/workflows/ci.yml && echo "checkout present"
# Expected: checkout present

grep -q 'oven-sh/setup-bun@v2' .github/workflows/ci.yml && echo "setup-bun present"
# Expected: setup-bun present

grep -q 'bun test test/' .github/workflows/ci.yml && echo "test step present"
# Expected: test step present

grep -q 'bun build index.ts --target bun' .github/workflows/ci.yml && echo "build step present"
# Expected: build step present

grep -q '\-\-external @oh-my-pi/pi-ai' .github/workflows/ci.yml && echo "pi-ai external present"
# Expected: pi-ai external present

grep -q '\-\-external @oh-my-pi/pi-coding-agent' .github/workflows/ci.yml && echo "pi-coding-agent external present"
# Expected: pi-coding-agent external present

# === No error masking ===
grep -c 'continue-on-error' .github/workflows/ci.yml
# Expected: 0

grep -c '|| true' .github/workflows/ci.yml
# Expected: 0

# === Step ordering (checkout before setup-bun) ===
CHECKOUT_LINE=$(grep -n 'actions/checkout@v4' .github/workflows/ci.yml | cut -d: -f1)
SETUP_LINE=$(grep -n 'oven-sh/setup-bun@v2' .github/workflows/ci.yml | cut -d: -f1)
[ "$CHECKOUT_LINE" -lt "$SETUP_LINE" ] && echo "ordering correct"
# Expected: ordering correct

# === package.json scripts ===
python3 -c "
import json
s = json.load(open('package.json'))['scripts']
assert 'clean' not in s, 'clean still present'
assert s['build'] == 'bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent', f\"build wrong: {s['build']}\"
assert s['check'] == 'bun test test/', f\"check wrong: {s['check']}\"
print('Scripts correct')
"
# Expected: Scripts correct

# === Runtime: tests pass ===
bun run check 2>&1 | tail -5
# Expected: (57 pass, 0 fail, exit 0)

# === Runtime: build passes ===
bun run build > /dev/null 2>&1; echo $?
# Expected: 0

# === No dist/ created ===
ls dist/ 2>&1
# Expected: "No such file or directory" or "cannot access"

# === Git state ===
git status --short
# Expected: clean (after commit) or showing ci.yml + package.json (before commit)
```

## Risk Mitigations (from PRD)

| Risk | Likelihood | Impact | Mitigation | Verification |
|------|-----------|--------|------------|--------------|
| `bun build` fails in CI with "Could not resolve" | Low | High | `--external` flags verified in clean env simulation | `bun run build` exits 0 locally |
| `mock.module` doesn't work in GitHub Actions | Low | High | Verified in clean env simulation (`/tmp/ci-test`) | `bun run check` passes 57 tests locally |
| `oven-sh/setup-bun@v2` is unavailable | Low | Medium | Fall back to `curl -fsSL https://bun.sh/install \| bash` | N/A (only if CI fails) |
| `bun-version: latest` introduces breaking change | Low | Medium | Pin to specific version if CI breaks | Monitor CI runs after merge |
| `actions/checkout@v4` is deprecated | Low | Low | Update to latest major version | N/A (GitHub maintains backward compat) |
| Pre-existing type errors block CI | Eliminated | N/A | No `tsc` in CI — build step doesn't type-check | N/A |
| Build creates dist/ directory | Eliminated | N/A | `--target bun` without `--outfile` writes to stdout | `ls dist/` fails |
| CI triggers on wrong branches | Low | Medium | Explicit `branches: [main]` in both triggers | YAML validation check |

## Files Not Touched

The following files are explicitly out of scope and MUST NOT be modified:

- `index.ts` — the extension code; CI runs tests against it but doesn't modify it
- `test/*.ts` — the test files; CI runs them but doesn't modify them
- `test/mocks.ts` — the mock infrastructure; works as-is
- `.gitignore` — no `dist/` is created, nothing to ignore
- `README.md` — no documentation changes needed for CI
- `.omp/` — no OMP config changes
- `.beads/` — no bead state changes (except normal sync)
- `prompts/` — no prompt template changes
- `AGENTS.md` — no convention changes

## Dependencies on Prior Beads

None. This bead has 0 in-degree in the dependency graph. It does not depend on any prior bead's work. The investigation (build command resolution, test verification) was done during the `/create` phase and is captured in the PRD.

## Dependencies on Future Beads

None. This bead has 0 out-degree. It does not unblock any future bead. However, it does provide infrastructure (CI) that benefits all future PRs — but that's a project-level benefit, not a graph dependency.

## Implementation Notes

### Why `--target bun --external` and not `--no-bundle`?

`bun build index.ts --no-bundle` fails with:
```
error: Could not resolve: "@oh-my-pi/pi-ai". Maybe you need to "bun install"?
```

This is because `--no-bundle` still needs to resolve imports. `@oh-my-pi/pi-ai` is an OMP global package at `~/.bun/install/global/node_modules/@oh-my-pi/`, not in local `node_modules`. In CI, there's no `~/.bun/install/global/` — only a fresh Bun install with no global packages.

`bun build index.ts --target bun` (without `--external`) works locally (resolves from the global package) but produces a 7.7MB bundle that includes all of pi-ai and its dependencies. This is unnecessary — we only need syntax/import verification.

`bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent` works in both environments. The `--external` flags tell Bun to treat these imports as external (provided at runtime by OMP), so Bun doesn't try to resolve or bundle them. This was verified in a clean CI environment simulation:

```bash
mkdir -p /tmp/ci-test
cp index.ts /tmp/ci-test/
cd /tmp/ci-test
env -u BUN_INSTALL HOME=/tmp/fakehome bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent
# Exit code: 0
# Output: 19,623 bytes to stdout
# No files created (ls shows no dist/)
```

### Why `mock.module` works in CI

`test/mocks.ts:148` uses `mock.module("@oh-my-pi/pi-ai", ...)` to intercept the import before Bun tries to resolve it. This is a `bun:test` built-in that works at the module resolution layer — it doesn't need the actual package to be installed. The mock provides a fake `complete` function that returns predetermined decisions.

The `import type` statement from `@oh-my-pi/pi-coding-agent` is erased at runtime — TypeScript type-only imports don't need the package to be present at runtime.

This was verified in the same clean environment simulation as the build command: `env -u BUN_INSTALL HOME=/tmp/fakehome bun test test/` passed all 57 tests.

### Why no `tsc --noEmit`

Type checking requires the OMP global packages for type definitions. Even with symlinks or CI-specific package installation, there are 2 pre-existing type errors at `index.ts:376,379`:

```typescript
// Line 376: Model<Api> | undefined not assignable to Model<Api>
const model: Model<Api> = ctx.model ?? undefined;
// Line 379: same issue
```

These errors are in the `decide()` function and were introduced in `ultramode-eqa` (the LLM timeout bead). Fixing them is a separate concern — this bead is about CI, not type errors. Adding `tsc` to CI would block all PRs until those errors are fixed, which is out of scope.

The `bun build --external` step provides syntax/import verification (catches syntax errors, missing imports, module structure errors) without full type checking. This is sufficient for CI purposes.

### Why no dependency caching

The project has zero npm dependencies — `package.json` has no `dependencies` or `devDependencies` keys. There's no `node_modules` to cache. `bun test` uses only Bun builtins (`bun:test`) and `mock.module` intercepts. `bun build --target bun --external` doesn't need packages installed. Adding a caching step would be pure overhead with no benefit.

### Why no `clean` script

The build step (`bun build --target bun` without `--outfile`) writes to stdout, not to a file. No `dist/` directory is created. This was verified during investigation:

```bash
bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent > /dev/null
ls dist/  # No such file or directory
```

There's nothing to clean. Adding a `clean` script would be speculative (YAGNI). If a future bead adds file output to the build, it can add a clean script then.

### Why single job, not multiple

The test suite runs in ~260ms and the build in ~500ms. Splitting into separate jobs would add ~15s of runner setup overhead per job (checkout + setup-bun) for no benefit. A single job with sequential steps is faster and simpler. If test or build times grow significantly (seconds to minutes), splitting becomes worthwhile — but that's a future optimization.

### Why `bun-version: latest`

OMP itself doesn't pin a Bun version (no `engines` field in `package.json`). Bun 1.x is backward compatible. Using `latest` ensures CI runs on a recent Bun version. Pinning to a specific version (e.g., `1.3.14`) is premature optimization — if reproducibility issues arise, pin then.

The risk of `latest` introducing a breaking change is low — Bun 1.x has been stable. If it happens, the mitigation is immediate: pin to the last known-good version.

### CI Workflow YAML Structure Walkthrough

The workflow file has 4 main sections:

1. **`name: CI`** — The workflow name shown in the GitHub Actions UI. Appears as the workflow name in the Actions tab. Using "CI" is concise and conventional.

2. **`on:`** — Triggers. Two trigger types:
   - `push: branches: [main]` — runs when commits are pushed directly to main
   - `pull_request: branches: [main]` — runs when a PR targets main
   Both are scoped to `main` to avoid duplicate runs on feature branches (the PR already triggers CI). This is the standard pattern for small projects.

3. **`jobs.ci:`** — Single job named `ci`. `runs-on: ubuntu-latest` uses the standard GitHub-hosted Ubuntu runner (free for public repos).

4. **`steps:`** — Four steps in order:
   - **Checkout** (`actions/checkout@v4`) — clones the repo into the runner. Must come first — the other steps need the code.
   - **Setup Bun** (`oven-sh/setup-bun@v2`) — installs Bun on the runner. Must come after checkout (needs the repo for any `.bunfig.toml` or `bun.lock` files, though this project has none). Uses `bun-version: latest`.
   - **Run tests** (`bun test test/`) — runs the 57-test suite. Must come after Bun setup (needs `bun` on PATH). If any test fails, this step fails and subsequent steps are skipped.
   - **Verify build** (`bun build ... --external ...`) — verifies the extension compiles. Must come after Bun setup. If the build fails, this step fails. This step is secondary to tests — it catches syntax errors and missing imports that tests might not exercise.

   No `continue-on-error: true` on any step — failures propagate to the job status. This ensures CI is red when tests fail or the build breaks.

### package.json Edit Walkthrough

The `scripts` object is at lines 7-11 in `package.json`. The edit replaces 3 lines with 2 lines (net -1 line). The rest of the file (keywords, license, files, omp config) is untouched.

**Before (lines 7-11):**
```json
  "scripts": {
    "clean": "echo 'nothing to clean'",
    "build": "echo 'nothing to build'",
    "check": "echo 'nothing to check'"
  },
```

**After:**
```json
  "scripts": {
    "build": "bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent",
    "check": "bun test test/"
  },
```

The edit is a 1:1 replacement of the scripts object content. The surrounding braces and indentation (2-space) remain identical. The `"scripts"` key stays at the same position in the JSON structure.

After the edit, `package.json` will have these scripts:
- `bun run build` → runs `bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent` (exit 0, stdout output, no files created)
- `bun run check` → runs `bun test test/` (57 pass, 0 fail, exit 0)
- `bun run clean` → **command not found** (script removed; `bun run clean` will error with "Script not found")

The `files` array in `package.json` (lines 23-28) lists `index.ts`, `prompts/*.md`, and `README.md`. This determines what's included when the package is published to npm. The CI workflow file is NOT in this list because it's not part of the published package — it's only needed in the repo. GitHub Actions reads `.github/workflows/` from the repo directly, not from the npm package.

### Verification Strategy

The verification strategy has three layers:

1. **Static verification** (no execution):
   - YAML structure validation with `python3 -c "import yaml; ..."`
   - JSON structure validation with `python3 -c "import json; ..."`
   - Content checks with `grep`
   - These are fast (<1s) and catch structural issues

2. **Runtime verification** (actual execution):
   - `bun run check` — runs the full 57-test suite
   - `bun run build` — runs the actual build command
   - These are slower (~1s) but catch behavioral issues

3. **Integration verification** (environment simulation):
   - The clean environment simulation (`/tmp/ci-test` with `env -u BUN_INSTALL HOME=/tmp/fakehome`) was done during `/create` and is captured in the PRD
   - This simulates the CI environment (no OMP global packages)
   - It's not re-run during `/ship` because it's already verified and the commands haven't changed

The static + runtime layers are sufficient for `/ship`. The integration layer was the investigation phase (`/create`) that determined the correct commands. If the commands change (e.g., new `--external` flag needed), the integration simulation should be re-run.

### What This CI Does NOT Do

Being explicit about what CI doesn't do prevents false confidence:

1. **No type checking** — `tsc --noEmit` is not run. Pre-existing type errors at `index.ts:376,379` would block CI. Type checking is a separate bead after fixing those errors.

2. **No linting** — No linter is configured. Adding linting requires choosing a linter, configuring rules, and fixing violations — a separate concern.

3. **No integration tests** — CI runs unit tests with mocked OMP runtime. It does not test real `bv`/`br` execution, real LLM calls, or real OMP session behavior. These were tested manually in `ultramode-aqr`.

4. **No coverage reporting** — `bun test` doesn't report coverage by default. Adding coverage requires configuration and a coverage tool — YAGNI for now.

5. **No matrix testing** — CI runs on a single OS (ubuntu-latest) with a single Bun version (latest). If OS-specific or version-specific issues arise, add matrix testing.

6. **No deployment** — CI only verifies, doesn't deploy. The extension is published to npm manually (or via a separate release workflow).

7. **No caching** — No dependency caching (zero deps) and no build caching (build takes <1s).

8. **No secrets** — No API keys or tokens needed. Tests are fully mocked. The build doesn't make network requests.

### Commit Strategy

The commit should include exactly two files:
- `.github/workflows/ci.yml` (new file)
- `package.json` (modified)

No other files should be in the commit. The PRD artifacts (`.beads/artifacts/ultramode-yk6/`) were already committed during `/create` (commit `346c10e`). The plan artifacts (`.beads/artifacts/ultramode-yk6/plan.md`, `tasks.md`, `context-capsule.md`) are committed during `/plan` (a separate commit).

The commit message follows conventional commit format:
```
chore: add CI workflow + fix package.json scripts
```

- `chore` prefix — this is a CI/config change, not a feature or fix
- Brief description — matches the bead title

### Post-Merge Expectations

After this PR is merged to main:

1. **First CI run** — CI will trigger on the merge commit (push to main). It should pass — the same commands were verified locally. If it fails, the failure will be visible in the GitHub Actions UI.

2. **Subsequent PRs** — Every PR to main will trigger CI. PRs that break tests or the build will show red CI status and cannot be merged (if branch protection is enabled).

3. **Direct pushes to main** — Pushes to main will also trigger CI. This catches hotfixes that bypass PR review.

4. **Feature branch pushes** — Pushes to feature branches do NOT trigger CI (only the PR does). This avoids duplicate runs when a PR is open and the branch is pushed to.

5. **Workflow file changes** — Changes to `.github/workflows/ci.yml` itself will be tested by CI (the new workflow runs on the PR that modifies it). This is self-testing.

### Branch Protection (Future Consideration)

This bead does not configure branch protection rules. Branch protection (requiring CI to pass before merge) is a GitHub repo setting, not a workflow file change. It should be configured manually in the repo settings:

1. Go to Settings → Branches → Branch protection rules
2. Add a rule for `main`
3. Enable "Require status checks to pass before merging"
4. Select the `CI` workflow as a required status check
5. Enable "Require branches to be up to date before merging"

This is out of scope for this bead but is the natural follow-up. The CI workflow is the prerequisite — branch protection is the enforcement mechanism.

### Monitoring CI Health

After merge, monitor the first few CI runs:

1. **First run on merge** — Should pass. If it fails, check the GitHub Actions logs for the specific step that failed.

2. **First PR after merge** — Should pass. If it fails, the PR's changes broke something.

3. **Periodic checks** — CI runs on every push/PR. No need for scheduled runs — the project is small and changes are infrequent.

If CI starts failing intermittently (flaky), investigate:
- Is `bun-version: latest` pulling a breaking change? Pin to a specific version.
- Is `oven-sh/setup-bun@v2` having issues? Check the action's GitHub repo.
- Are tests flaky? Check for timing issues or environment dependencies.

### Relationship to Prior Beads

| Bead | Relationship | Detail |
|------|-------------|--------|
| `ultramode-fpj` | None | Initial extension creation. CI doesn't touch its work. |
| `ultramode-eqa` | Test coverage | CI runs the tests that `ultramode-eqa`'s timeout mechanism added. The pre-existing type errors at `index.ts:376,379` are from this bead. |
| `ultramode-aqr` | None | Live session testing. CI doesn't test integration behavior. |
| `ultramode-air` | Test coverage | CI runs the retry-logic tests that `ultramode-air` added. |
| `ultramode-c95` | None | Unrelated to CI. |
| `ultramode-b09` | None | Unrelated to CI. |
| `ultramode-tp1` | None | Unrelated to CI. |
| `ultramode-os5` | None | Unrelated to CI. |
| `ultramode-yvq` | None | Unrelated to CI. |
| `ultramode-v1p` | None | Unrelated to CI. |

None of the prior beads created CI infrastructure. This is the first bead to add automated testing in CI. All prior beads relied on manual verification during `/verify`.

### Test Count Breakdown

The 57 tests that CI runs come from 5 test files:

| Test File | Tests | What It Covers |
|-----------|-------|----------------|
| `test/phase-maps.test.ts` | ~8 | Phase transition constants (`PHASE_WHITELIST`, `PHASE_FROM_COMMAND`, `COMMAND_FROM_PHASE`, `ALLOWED_PHASE_COMMANDS`, `VALID_PHASES`) |
| `test/parse-decision.test.ts` | ~5 | LLM decision JSON parser (backward brace-balanced scan) |
| `test/reconstruct-state.test.ts` | ~8 | State reconstruction from session journal |
| `test/retry-logic.test.ts` | ~15 | Retry mechanism, `MAX_RETRIES` cap, `markBlocked` |
| `test/error-paths.test.ts` | ~21 | Error handling in `decide()`, timeout, re-entrancy guard |
| **Total** | **57** | |

CI runs all of these on every push/PR. If any test fails, CI is red.

### Build Output Analysis

The build step produces ~19,623 bytes of compiled JavaScript to stdout. This output is discarded (redirected to `/dev/null` in CI). The purpose is verification, not artifact production.

The output is a Bun-compiled bundle of `index.ts` with `@oh-my-pi/pi-ai` and `@oh-my-pi/pi-coding-agent` marked as external. It's a valid JavaScript module that could be executed by Bun (though we don't execute it in CI).

If the build step is later needed to produce an actual artifact (e.g., for npm publishing), the command would change to include `--outfile dist/index.js`. But for CI verification purposes, stdout output is sufficient.

### Error Scenarios and CI Response

| Scenario | CI Step | Result |
|----------|---------|--------|
| Syntax error in `index.ts` (e.g., missing closing brace) | Verify build | Build fails → CI red |
| Missing import in `index.ts` (e.g., `import { foo } from "./nonexistent"`) | Verify build | Build fails → CI red |
| Test failure (e.g., a regression in phase map logic) | Run tests | Test step fails → CI red |
| `mock.module` doesn't intercept in CI env | Run tests | Tests fail with "Cannot find module" → CI red |
| `oven-sh/setup-bun@v2` is unavailable | Setup Bun | Setup fails → CI red (all subsequent steps skipped) |
| `actions/checkout@v4` is unavailable | Checkout | Checkout fails → CI red (all subsequent steps skipped) |
| `package.json` is malformed JSON | (N/A) | Bun can't read scripts → both `bun run` commands fail |
| `ci.yml` is malformed YAML | (N/A) | GitHub Actions won't load the workflow → no CI runs |
| Network issue downloading Bun | Setup Bun | Setup fails → CI red |
| Runner out of disk | Any step | Step fails → CI red |

In all failure cases, CI is red and the PR cannot be merged (if branch protection is enabled). The failure reason is visible in the GitHub Actions logs.
