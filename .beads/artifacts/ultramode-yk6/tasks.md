<!-- DENSITY: Minimum 600 lines. No upper bound. <600 = too thin — tasks lack detail, verification steps are vague, dependencies undefined. Every task needs a yaml block, concrete verification steps, and enough detail for parallel execution without reading the PRD or plan. -->
# Tasks: ultramode-yk6

## Overview

This bead adds a GitHub Actions CI workflow and fixes `package.json` scripts. The implementation is small (2 files, ~15 lines of content) but the verification is thorough (20 observable truths, 3 verification layers).

The work is organized into 4 phases:
1. **Implementation** — Write ci.yml and edit package.json (parallel, independent files)
2. **Verification** — Run local checks and integration simulation
3. **Commit** — Stage and commit both files
4. **Evidence** — Record completion evidence

### Task Dependency Graph

```
1.1 (write ci.yml) ─────────┐
                             ├──> 2.1 (local verify) ──> 2.2 (integration sim) ──> 3.1 (commit) ──> 4.1 (evidence)
1.2 (edit package.json) ────┘
```

- 1.1 and 1.2 are parallel (different files, no dependencies)
- 2.1 depends on both 1.1 and 1.2
- 2.2 depends on 2.1
- 3.1 depends on 2.2
- 4.1 depends on 3.1

## 1. Implementation

### 1.1 Write `.github/workflows/ci.yml`

```yaml
depends_on: []
parallel: true
conflicts_with: ["1.2"]
files: [".github/workflows/ci.yml"]
estimated_minutes: 5
```

This task creates the GitHub Actions CI workflow file. The `.github/workflows/` directory does not exist yet — create it first. The workflow runs on `ubuntu-latest`, checks out the code, sets up Bun, runs the test suite, and verifies the build compiles.

**Key design decisions:**
- `--target bun --external` for the build step (not `--no-bundle`, which fails on OMP global packages)
- `bun-version: latest` (not pinned — premature optimization, OMP doesn't pin)
- Single job, not separate test/build jobs (both run in <1s, splitting adds overhead)
- No dependency caching (zero npm dependencies, nothing to cache)
- No type checking (requires OMP packages, has pre-existing errors — separate bead)
- Triggers on both push and pull_request, scoped to main

- [ ] Create the `.github/workflows/` directory: `mkdir -p .github/workflows`
- [ ] Write `.github/workflows/ci.yml` with this exact content:

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

- [ ] Verify: `test -f .github/workflows/ci.yml && echo "exists"` outputs `exists`
- [ ] Verify: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('valid')"` outputs `valid`
- [ ] Verify: `grep -q 'actions/checkout@v4' .github/workflows/ci.yml && echo "checkout present"` outputs `checkout present`
- [ ] Verify: `grep -q 'oven-sh/setup-bun@v2' .github/workflows/ci.yml && echo "setup-bun present"` outputs `setup-bun present`
- [ ] Verify: `grep -q 'bun test test/' .github/workflows/ci.yml && echo "test step present"` outputs `test step present`
- [ ] Verify: `grep -q '\-\-external @oh-my-pi/pi-ai' .github/workflows/ci.yml && echo "pi-ai external present"` outputs `pi-ai external present`
- [ ] Verify: `grep -q '\-\-external @oh-my-pi/pi-coding-agent' .github/workflows/ci.yml && echo "pi-coding-agent external present"` outputs `pi-coding-agent external present`
- [ ] Verify: `grep -c 'continue-on-error' .github/workflows/ci.yml` outputs `0`
- [ ] Verify: `grep -c '|| true' .github/workflows/ci.yml` outputs `0`
- [ ] Verify: `grep -q 'runs-on: ubuntu-latest' .github/workflows/ci.yml && echo "runner present"` outputs `runner present`

**Detailed verification for Task 1.1:**

Each verification step checks one observable truth from the plan. Here's what each checks and why:

1. **File exists** — Confirms the file was written to the correct path. The `.github/workflows/` directory must be created first (it doesn't exist in the repo).

2. **YAML valid** — Confirms the file is syntactically correct YAML. Python's `yaml` module is used because Bun doesn't have a built-in YAML parser. If the YAML is malformed, GitHub Actions won't load the workflow and CI won't run at all.

3. **Checkout step present** — `actions/checkout@v4` is the standard GitHub checkout action. It must be present to clone the repo into the runner. Without it, subsequent steps have no code to test or build.

4. **Setup Bun step present** — `oven-sh/setup-bun@v2` is the official Bun setup action. It installs Bun on the runner. Without it, `bun test` and `bun build` commands would fail with "command not found".

5. **Test step present** — `bun test test/` runs the 57-test suite. This is the primary verification — if tests fail, CI is red.

6. **pi-ai external flag present** — The `--external @oh-my-pi/pi-ai` flag tells Bun to treat `@oh-my-pi/pi-ai` as an external import (provided at runtime by OMP). Without this flag, the build fails with "Could not resolve: @oh-my-pi/pi-ai" in CI.

7. **pi-coding-agent external flag present** — Same as above, for `@oh-my-pi/pi-coding-agent`. Both external flags are required.

8. **No continue-on-error** — `continue-on-error: true` would mask step failures. If present, CI would show green even when tests fail. This defeats the purpose of CI.

9. **No `|| true` error masking** — `|| true` at the end of a command makes it always exit 0, masking failures. Same issue as `continue-on-error`.

10. **Runner present** — `runs-on: ubuntu-latest` specifies the GitHub-hosted Ubuntu runner. Without it, the job has no runner to execute on.

### 1.2 Edit `package.json` scripts {parallel}

```yaml
depends_on: []
parallel: true
conflicts_with: ["1.1"]
files: ["package.json"]
estimated_minutes: 3
```

This task replaces the echo stub scripts in `package.json` with real commands. The `scripts` object is at lines 7-11. This task is parallel with Task 1.1 — it touches a different file and has no dependency on the workflow file.

**Current state (package.json lines 7-11):**
```json
  "scripts": {
    "clean": "echo 'nothing to clean'",
    "build": "echo 'nothing to build'",
    "check": "echo 'nothing to check'"
  },
```

**Target state:**
```json
  "scripts": {
    "build": "bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent",
    "check": "bun test test/"
  },
```

**Changes:**
1. Remove `"clean": "echo 'nothing to clean'",` — the build writes to stdout, no files to clean
2. Replace `"build"` value with `bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent`
3. Replace `"check"` value with `bun test test/`
4. Keep 2-space indentation consistent with the rest of the file

- [ ] Read `package.json` to confirm current state of lines 7-11
- [ ] Replace the `scripts` object (lines 7-11) with the new scripts:
  - Remove the `clean` script entirely
  - Set `build` to `bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent`
  - Set `check` to `bun test test/`
- [ ] Verify: `python3 -c "import json; s=json.load(open('package.json'))['scripts']; assert 'clean' not in s; print('clean removed')"` outputs `clean removed`
- [ ] Verify: `python3 -c "import json; s=json.load(open('package.json'))['scripts']; assert s['build'] == 'bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent'; print('build correct')"` outputs `build correct`
- [ ] Verify: `python3 -c "import json; s=json.load(open('package.json'))['scripts']; assert s['check'] == 'bun test test/'; print('check correct')"` outputs `check correct`
- [ ] Verify: `python3 -c "import json; assert len(json.load(open('package.json'))['scripts']) == 2; print('script count correct')"` outputs `script count correct`
- [ ] Verify: `python3 -c "import json; json.load(open('package.json')); print('JSON valid')"` outputs `JSON valid`

**Detailed verification for Task 1.2:**

1. **clean removed** — The `clean` script was an echo stub. It's removed because the build writes to stdout (no files to clean). If `clean` is still present, `bun run clean` would echo "nothing to clean" which is misleading.

2. **build correct** — The `build` script must be the exact build command with both `--external` flags. This mirrors the CI build step exactly. A developer running `bun run build` locally gets the same verification CI provides. The command must match character-for-character — any difference (e.g., missing flag, different order) would cause inconsistency between local and CI builds.

3. **check correct** — The `check` script must be `bun test test/`. This mirrors the CI test step. Running `bun run check` locally runs the same 57 tests CI runs.

4. **Script count correct** — After removing `clean`, there should be exactly 2 scripts: `build` and `check`. If there are 3, the `clean` wasn't removed. If there's 1, a script was accidentally deleted.

5. **JSON valid** — The edit must produce valid JSON. A trailing comma, missing comma, or unescaped quote would break JSON parsing. Bun reads `package.json` to resolve `bun run` commands — if the JSON is invalid, no scripts work.

**Edit approach:**

The `scripts` object is at lines 7-11. The edit replaces lines 7-11 with new content. Use the `edit` tool (not `write`) to preserve the rest of `package.json`:

- Original lines 7-11:
  ```
  "scripts": {
    "clean": "echo 'nothing to clean'",
    "build": "echo 'nothing to build'",
    "check": "echo 'nothing to check'"
  },
  ```

- Replacement lines 7-10:
  ```
  "scripts": {
    "build": "bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent",
    "check": "bun test test/"
  },
  ```

The replacement has 4 lines (down from 5 — the `clean` line is removed, and the `build` value is longer). The surrounding lines (1-6 and 12-34) are not touched.

**Indentation:** Use 2-space indentation, matching the existing `package.json` style. The `"scripts"` key is at 2-space indent (inside the root object). The script entries (`"build"`, `"check"`) are at 4-space indent (inside the `scripts` object).

## 2. Verification

### 2.1 Run local verification

```yaml
depends_on: ["1.1", "1.2"]
parallel: false
conflicts_with: []
files: []
estimated_minutes: 3
```

After both files are written, verify the implementation works end-to-end. This is the gate before committing — if any check fails, fix the issue before committing.

The verification covers three categories:
1. **YAML structure** — the workflow file is valid YAML with the right structure
2. **Script correctness** — package.json scripts are correct
3. **Runtime behavior** — both scripts actually work when executed

- [ ] Verify YAML structure: `python3 -c "import yaml; y=yaml.safe_load(open('.github/workflows/ci.yml')); assert 'name' in y; assert 'on' in y; assert 'jobs' in y; print('YAML valid')"` outputs `YAML valid`
- [ ] Verify triggers: `python3 -c "import yaml; y=yaml.safe_load(open('.github/workflows/ci.yml')); assert 'push' in y['on'] and 'main' in y['on']['push']['branches']; assert 'pull_request' in y['on'] and 'main' in y['on']['pull_request']['branches']; print('Triggers correct')"` outputs `Triggers correct`
- [ ] Verify step ordering: Checkout line number < Setup Bun line number
  ```bash
  CHECKOUT_LINE=$(grep -n 'actions/checkout@v4' .github/workflows/ci.yml | cut -d: -f1)
  SETUP_LINE=$(grep -n 'oven-sh/setup-bun@v2' .github/workflows/ci.yml | cut -d: -f1)
  [ "$CHECKOUT_LINE" -lt "$SETUP_LINE" ] && echo "ordering correct"
  ```
  outputs `ordering correct`
- [ ] Verify no error masking: `grep -c 'continue-on-error' .github/workflows/ci.yml` outputs `0` AND `grep -c '|| true' .github/workflows/ci.yml` outputs `0`
- [ ] Verify package.json scripts: `python3 -c "import json; s=json.load(open('package.json'))['scripts']; assert 'clean' not in s; assert s['build'] == 'bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent'; assert s['check'] == 'bun test test/'; print('Scripts correct')"` outputs `Scripts correct`
- [ ] Verify tests pass: `bun run check 2>&1 | tail -5` shows `57 pass` and `0 fail` with exit code 0
- [ ] Verify build passes: `bun run build > /dev/null 2>&1; echo $?` outputs `0`
- [ ] Verify no dist/ created: `bun run build > /dev/null 2>&1; ls dist/ 2>&1` outputs error (No such file or directory)
- [ ] Verify: All 20 observable truths from plan.md pass

**Detailed verification steps:**

1. **YAML structure** — Validates the top-level keys (`name`, `on`, `jobs`). If any is missing, GitHub Actions won't recognize the workflow.

2. **Triggers** — Validates both `push` and `pull_request` triggers are present and scoped to `main`. Without `push`, direct commits to main won't trigger CI. Without `pull_request`, PRs won't trigger CI.

3. **Step ordering** — Checkout must come before setup-bun. The `grep -n` command returns line numbers; the checkout line number must be lower. If setup-bun comes first, it might not find repo-specific Bun configuration (though this project has none, it's still best practice).

4. **No error masking** — `continue-on-error` and `|| true` both mask failures. Their absence ensures failures propagate to the job status.

5. **package.json scripts** — Validates all three changes: `clean` removed, `build` is the real command, `check` is `bun test test/`. A single Python assertion checks all three.

6. **Tests pass** — The most important verification. `bun run check` runs all 57 tests. If any test fails, the check fails. The `tail -5` shows the summary (pass/fail counts). Expected: `57 pass`, `0 fail`, exit 0.

7. **Build passes** — `bun run build` runs the build command. Expected exit code: 0. If the build fails, there's a syntax error or missing import in `index.ts`. The build output goes to stdout (then `/dev/null`).

8. **No dist/ created** — Confirms the build writes to stdout, not to a file. If a `dist/` directory appears, the build command might have an `--outfile` flag (it shouldn't) or Bun's behavior changed.

9. **All 20 observable truths** — The plan.md lists 20 observable truths. Each is a falsifiable statement with a verification command. All must pass before proceeding to commit.

### 2.2 Integration simulation (optional, already verified in /create)

```yaml
depends_on: ["2.1"]
parallel: false
conflicts_with: []
files: []
estimated_minutes: 2
```

This step re-verifies that the build and test commands work in a clean environment simulating CI (no OMP global packages). This was already done during `/create` and captured in the PRD. Re-running is optional but provides additional confidence.

The simulation uses `env -u BUN_INSTALL HOME=/tmp/fakehome` to remove Bun's global package directory from the resolution path, simulating a fresh CI runner.

- [ ] (Optional) Copy `index.ts` to a temp directory: `mkdir -p /tmp/yk6-ci-verify && cp index.ts /tmp/yk6-ci-verify/`
- [ ] (Optional) Run build in clean env: `cd /tmp/yk6-ci-verify && env -u BUN_INSTALL HOME=/tmp/fakehome bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent > /dev/null 2>&1; echo $?` outputs `0`
- [ ] (Optional) Clean up: `rm -rf /tmp/yk6-ci-verify`

**Why this step is optional:**

The integration simulation was done during `/create` to determine the correct build command. The result (exit 0, 19,623 bytes, no files created) is captured in the PRD. Re-running provides no new information unless the build command changed — and it hasn't.

If the build command in `package.json` or `ci.yml` differs from what was verified in `/create`, this step becomes mandatory. But since the plan uses the exact same command verified during investigation, it's optional.

## 3. Commit

### 3.1 Commit changes

```yaml
depends_on: ["2.1"]
parallel: false
conflicts_with: []
files: []
estimated_minutes: 2
```

Stage both files and commit. The commit message follows conventional commit format (`chore:` prefix for CI/config changes). The commit should include exactly two files: `.github/workflows/ci.yml` (new) and `package.json` (modified).

- [ ] Verify git status shows only the expected changes: `git status --short` shows `.github/workflows/ci.yml` (new, `??`) and `package.json` (modified, `M`)
- [ ] Stage both files: `git add .github/workflows/ci.yml package.json`
- [ ] Verify staging: `git status --short` shows both files as staged (`A` for ci.yml, `M` for package.json)
- [ ] Commit: `git commit -m "chore: add CI workflow + fix package.json scripts"`
- [ ] Verify commit: `git log --oneline -1` shows the commit with message `chore: add CI workflow + fix package.json scripts`
- [ ] Verify clean working tree: `git status --short` shows no uncommitted changes

**Detailed verification for Task 3.1:**

1. **Git status before staging** — Should show exactly two changed files. If more files appear, there are pre-existing changes that shouldn't be in this commit. The PRD artifacts were committed during `/create` (commit `346c10e`), and the plan artifacts during `/plan`. The working tree should be clean except for the two implementation files.

2. **Staging** — `git add` both files explicitly. Don't use `git add .` — it might stage unexpected files. Staging both files explicitly ensures only the intended changes are in the commit.

3. **Staging verification** — After `git add`, both files should appear as staged. `ci.yml` should show as `A` (added — new file), `package.json` as `M` (modified — existing file changed).

4. **Commit** — The commit message uses conventional commit format. `chore:` is the prefix for CI/config changes. The description matches the bead title.

5. **Commit verification** — `git log --oneline -1` shows the latest commit. It should be the `chore: add CI workflow + fix package.json scripts` commit. If a different commit appears, something went wrong.

6. **Clean working tree** — After commit, `git status --short` should show nothing. If files still appear, they weren't committed (maybe staging failed) or new changes were made after commit.

**Commit message format:**

```
chore: add CI workflow + fix package.json scripts
```

- `chore` — conventional commit type for CI/config changes
- `add CI workflow` — the new file
- `+ fix package.json scripts` — the edited file
- The message is under 72 characters (fits in a single line in git log)

## 4. Evidence

### 4.1 Record completion evidence

```yaml
depends_on: ["3.1"]
parallel: false
conflicts_with: []
files: [".beads/artifacts/ultramode-yk6/completion-evidence.json"]
estimated_minutes: 3
```

Record the verification results in `completion-evidence.json`. This file is required before `/review` and `/pr`. It captures the commands run and their outputs during verification.

- [ ] Read the template: `read .omp/templates/completion-evidence.json`
- [ ] Write `.beads/artifacts/ultramode-yk6/completion-evidence.json` with:
  - Each requirement from `prd.json` mapped to a verification command and result
  - The test output (`57 pass, 0 fail`)
  - The build output (exit 0)
  - The git commit hash
  - The date

**Completion evidence structure:**

The `completion-evidence.json` file should map each requirement from `prd.json` to a verification result. For each requirement:
- `requirement_id` — matches the `id` from `prd.json`
- `requirement_text` — matches the `text` from `prd.json`
- `verification_command` — the exact command run
- `verification_output` — the actual output
- `result` — `pass` or `fail`
- `evidence_type` — `static` (file content check), `runtime` (execution), or `integration` (env simulation)

**Requirements to verify:**

| Req ID | Requirement | Verification Command | Expected Result |
|--------|------------|---------------------|-----------------|
| 1 | ci.yml exists and is valid YAML | `test -f .github/workflows/ci.yml && python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` | pass |
| 2 | CI triggers on push and pull_request to main | `python3 -c "import yaml; y=yaml.safe_load(open('.github/workflows/ci.yml')); assert 'push' in y['on'] and 'main' in y['on']['push']['branches']; assert 'pull_request' in y['on'] and 'main' in y['on']['pull_request']['branches']"` | pass |
| 3 | CI installs Bun via oven-sh/setup-bun@v2 | `grep -q 'oven-sh/setup-bun@v2' .github/workflows/ci.yml` | pass |
| 4 | CI runs bun test test/ | `grep -q 'bun test test/' .github/workflows/ci.yml` | pass |
| 5 | CI runs build command with --external flags | `grep -q '\-\-external @oh-my-pi/pi-ai' .github/workflows/ci.yml && grep -q '\-\-external @oh-my-pi/pi-coding-agent' .github/workflows/ci.yml` | pass |
| 6 | CI fails on non-zero exit | `grep -c 'continue-on-error' .github/workflows/ci.yml` returns 0 | pass |
| 7 | package.json build script is the real command | `python3 -c "import json; assert json.load(open('package.json'))['scripts']['build'] == 'bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent'"` | pass |
| 8 | package.json check script is bun test test/ | `python3 -c "import json; assert json.load(open('package.json'))['scripts']['check'] == 'bun test test/'"` | pass |
| 9 | package.json clean script is removed | `python3 -c "import json; assert 'clean' not in json.load(open('package.json'))['scripts']"` | pass |
| 10 | CI uses actions/checkout@v4 before Bun setup | Line number check | pass |
| 11 | CI job name is descriptive | `grep -q 'name: CI' .github/workflows/ci.yml` | pass |
| 12 | CI workflow file is committed | `git log --oneline -1 -- .github/workflows/ci.yml` shows a commit | pass |

## Task Summary

| Task | Files | Dependencies | Parallel | Estimated |
|------|-------|-------------|----------|-----------|
| 1.1 Write ci.yml | `.github/workflows/ci.yml` | None | Yes (with 1.2) | 5 min |
| 1.2 Edit package.json | `package.json` | None | Yes (with 1.1) | 3 min |
| 2.1 Local verification | (none) | 1.1, 1.2 | No | 3 min |
| 2.2 Integration simulation | (temp) | 2.1 | No | 2 min (optional) |
| 3.1 Commit | (none) | 2.1 | No | 2 min |
| 4.1 Completion evidence | `.beads/artifacts/ultramode-yk6/completion-evidence.json` | 3.1 | No | 3 min |
| **Total** | **2 source + 1 artifact** | | | **~18 min** |

## Parallel Execution Strategy

### Single Agent (Recommended)

For a single agent, execute tasks sequentially:
1. Task 1.1 → Task 1.2 → Task 2.1 → Task 2.2 (optional) → Task 3.1 → Task 4.1

Total time: ~18 minutes

### Two Agents (Parallel Wave 1)

If two agents are available, Wave 1 can be parallelized:
- Agent A: Task 1.1 (write ci.yml) — ~5 min
- Agent B: Task 1.2 (edit package.json) — ~3 min
- Both complete → Task 2.1 → Task 3.1 → Task 4.1

Total time: ~13 minutes (saves ~3 min)

### Parallelization Analysis

The parallelization benefit is minimal because:
1. The tasks are very short (5 min and 3 min)
2. Wave 2 (verification) depends on both and can't be parallelized
3. The overhead of coordinating two agents likely exceeds the 3-minute savings

**Recommendation:** Use a single agent. The tasks are short enough that sequential execution is simpler and faster when accounting for coordination overhead.

## Verification Commands Quick Reference

```bash
# === Task 1.1: ci.yml ===
test -f .github/workflows/ci.yml && echo "exists"
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('valid')"
grep -q 'actions/checkout@v4' .github/workflows/ci.yml && echo "checkout present"
grep -q 'oven-sh/setup-bun@v2' .github/workflows/ci.yml && echo "setup-bun present"
grep -q 'bun test test/' .github/workflows/ci.yml && echo "test step present"
grep -q '\-\-external @oh-my-pi/pi-ai' .github/workflows/ci.yml && echo "pi-ai external present"
grep -q '\-\-external @oh-my-pi/pi-coding-agent' .github/workflows/ci.yml && echo "pi-coding-agent external present"
grep -c 'continue-on-error' .github/workflows/ci.yml  # Expected: 0
grep -c '|| true' .github/workflows/ci.yml  # Expected: 0
grep -q 'runs-on: ubuntu-latest' .github/workflows/ci.yml && echo "runner present"

# === Task 1.2: package.json ===
python3 -c "import json; s=json.load(open('package.json'))['scripts']; assert 'clean' not in s; print('clean removed')"
python3 -c "import json; s=json.load(open('package.json'))['scripts']; assert s['build'] == 'bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent'; print('build correct')"
python3 -c "import json; s=json.load(open('package.json'))['scripts']; assert s['check'] == 'bun test test/'; print('check correct')"
python3 -c "import json; assert len(json.load(open('package.json'))['scripts']) == 2; print('script count correct')"
python3 -c "import json; json.load(open('package.json')); print('JSON valid')"

# === Task 2.1: Local verification ===
python3 -c "import yaml; y=yaml.safe_load(open('.github/workflows/ci.yml')); assert 'name' in y; assert 'on' in y; assert 'jobs' in y; print('YAML valid')"
python3 -c "import yaml; y=yaml.safe_load(open('.github/workflows/ci.yml')); assert 'push' in y['on'] and 'main' in y['on']['push']['branches']; assert 'pull_request' in y['on'] and 'main' in y['on']['pull_request']['branches']; print('Triggers correct')"
CHECKOUT_LINE=$(grep -n 'actions/checkout@v4' .github/workflows/ci.yml | cut -d: -f1)
SETUP_LINE=$(grep -n 'oven-sh/setup-bun@v2' .github/workflows/ci.yml | cut -d: -f1)
[ "$CHECKOUT_LINE" -lt "$SETUP_LINE" ] && echo "ordering correct"
grep -c 'continue-on-error' .github/workflows/ci.yml  # Expected: 0
grep -c '|| true' .github/workflows/ci.yml  # Expected: 0
python3 -c "import json; s=json.load(open('package.json'))['scripts']; assert 'clean' not in s; assert s['build'] == 'bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent'; assert s['check'] == 'bun test test/'; print('Scripts correct')"
bun run check 2>&1 | tail -5  # Expected: 57 pass, 0 fail
bun run build > /dev/null 2>&1; echo $?  # Expected: 0
bun run build > /dev/null 2>&1; ls dist/ 2>&1  # Expected: No such file or directory

# === Task 2.2: Integration simulation (optional) ===
mkdir -p /tmp/yk6-ci-verify && cp index.ts /tmp/yk6-ci-verify/
cd /tmp/yk6-ci-verify && env -u BUN_INSTALL HOME=/tmp/fakehome bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent > /dev/null 2>&1; echo $?  # Expected: 0
rm -rf /tmp/yk6-ci-verify

# === Task 3.1: Commit ===
git status --short  # Expected: ci.yml (??) and package.json (M)
git add .github/workflows/ci.yml package.json
git status --short  # Expected: ci.yml (A) and package.json (M)
git commit -m "chore: add CI workflow + fix package.json scripts"
git log --oneline -1  # Expected: the commit
git status --short  # Expected: clean

# === Task 4.1: Evidence ===
ls .beads/artifacts/ultramode-yk6/completion-evidence.json  # Expected: exists
```

## Risk Checklist

Before each task, verify these risks are mitigated:

- [ ] **Build fails in CI** — Mitigated by `--external` flags. Verified locally with `bun run build`.
- [ ] **Tests fail in CI** — Mitigated by `mock.module` interception. Verified locally with `bun run check`.
- [ ] **YAML malformed** — Mitigated by Python YAML validation. Verified with `python3 -c "import yaml; ..."`.
- [ ] **JSON malformed** — Mitigated by Python JSON validation. Verified with `python3 -c "import json; ..."`.
- [ ] **Error masking** — Mitigated by grep checks for `continue-on-error` and `|| true`.
- [ ] **Step ordering wrong** — Mitigated by line number comparison.
- [ ] **Commit includes extra files** — Mitigated by explicit `git add` of only two files.
- [ ] **Pre-existing type errors block CI** — Eliminated by not including `tsc` in CI.
- [ ] **`oven-sh/setup-bun@v2` unavailable** — Low likelihood; mitigation is shell-based Bun install.
- [ ] **`actions/checkout@v4` deprecated** — Low likelihood; mitigation is updating to latest version.

## Out of Scope

The following are explicitly NOT part of this bead:

- **Type checking (`tsc --noEmit`)** — Pre-existing type errors at `index.ts:376,379`. Separate bead.
- **Linting** — No linter configured. Separate concern.
- **Coverage reporting** — `bun test` doesn't report coverage. YAGNI.
- **Matrix testing** — Single OS, single Bun version. YAGNI.
- **Dependency caching** — Zero deps. Nothing to cache.
- **Branch protection rules** — GitHub repo setting, not a workflow file change.
- **Release/deploy workflow** — CI only verifies, doesn't deploy.
- **Modifying `index.ts`** — Extension code is out of scope.
- **Modifying test files** — Test code is out of scope.
- **Modifying `.gitignore`** — No `dist/` created, nothing to ignore.
- **Modifying `README.md`** — No documentation changes needed.
- **Adding `engines` field to package.json** — OMP doesn't pin Bun version.
- **Adding `devDependencies`** — No deps needed.
- **Adding `pretest`/`prebuild` hooks** — YAGNI.

## File Change Summary

| File | Change | Lines Added | Lines Removed | Net |
|------|--------|-------------|---------------|-----|
| `.github/workflows/ci.yml` | New file | ~20 | 0 | +20 |
| `package.json` | Edit (lines 7-11) | 2 | 3 | -1 |
| `.beads/artifacts/ultramode-yk6/completion-evidence.json` | New file | ~50 | 0 | +50 |
| **Total** | 2 source + 1 artifact | ~72 | ~3 | ~+69 |

## Acceptance Criteria Mapping

| Acceptance Criterion (from PRD) | Task | Verification |
|--------------------------------|------|--------------|
| ci.yml exists and is valid YAML | 1.1 | `test -f` + `python3 -c "import yaml"` |
| CI triggers on push and pull_request to main | 1.1 | `python3 -c "import yaml; ..."` |
| CI installs Bun via oven-sh/setup-bun@v2 | 1.1 | `grep -q 'oven-sh/setup-bun@v2'` |
| CI runs bun test test/ | 1.1 | `grep -q 'bun test test/'` |
| CI runs build command with --external flags | 1.1 | `grep -q '\-\-external @oh-my-pi/pi-ai'` |
| CI fails on non-zero exit | 1.1 | `grep -c 'continue-on-error'` returns 0 |
| package.json build script is the real command | 1.2 | `python3 -c "import json; ..."` |
| package.json check script is bun test test/ | 1.2 | `python3 -c "import json; ..."` |
| package.json clean script is removed | 1.2 | `python3 -c "import json; ..."` |
| CI uses actions/checkout@v4 before Bun setup | 1.1 | Line number comparison |
| CI job name is descriptive | 1.1 | `grep -q 'name: CI'` |
| CI workflow file is committed to repo | 3.1 | `git log --oneline -1 -- .github/workflows/ci.yml` |
| `bun run check` passes 57 tests | 2.1 | `bun run check 2>&1 \| tail -5` |
| `bun run build` exits 0 | 2.1 | `bun run build > /dev/null 2>&1; echo $?` |
| No `dist/` directory created | 2.1 | `ls dist/ 2>&1` |

## Post-Implementation Checklist

After all tasks are complete, run through this final checklist to ensure nothing was missed:

### File Existence
- [ ] `.github/workflows/ci.yml` exists (`test -f .github/workflows/ci.yml`)
- [ ] `package.json` exists and is valid JSON (`python3 -c "import json; json.load(open('package.json'))"`)
- [ ] `.beads/artifacts/ultramode-yk6/completion-evidence.json` exists

### Content Correctness
- [ ] ci.yml has `name: CI`
- [ ] ci.yml triggers on `push` to `main`
- [ ] ci.yml triggers on `pull_request` to `main`
- [ ] ci.yml uses `actions/checkout@v4`
- [ ] ci.yml uses `oven-sh/setup-bun@v2`
- [ ] ci.yml runs `bun test test/`
- [ ] ci.yml runs `bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent`
- [ ] ci.yml has no `continue-on-error`
- [ ] ci.yml has no `|| true`
- [ ] ci.yml runs on `ubuntu-latest`
- [ ] checkout step appears before setup-bun step
- [ ] package.json has no `clean` script
- [ ] package.json `build` script is the real build command
- [ ] package.json `check` script is `bun test test/`
- [ ] package.json has exactly 2 scripts (`build` and `check`)

### Runtime Verification
- [ ] `bun run check` passes 57 tests with 0 failures
- [ ] `bun run build` exits 0
- [ ] No `dist/` directory created by build

### Git State
- [ ] Both files are committed (`git log --oneline -1 -- .github/workflows/ci.yml package.json`)
- [ ] Working tree is clean (`git status --short` shows nothing)
- [ ] Commit message is `chore: add CI workflow + fix package.json scripts`

### Artifact State
- [ ] `completion-evidence.json` is written and valid JSON
- [ ] All 12 requirements from `prd.json` are mapped to verification results
- [ ] All verification results are `pass`

## Rollback Procedure

If the implementation fails or needs to be reverted:

### Before Commit (Task 2.1 fails)

If verification fails before committing:
1. Delete the workflow file: `rm .github/workflows/ci.yml`
2. Restore package.json: `git checkout -- package.json`
3. Re-run verification: `bun run check` (should pass — tests are independent of the changes)
4. Re-investigate the failure and re-implement

### After Commit (CI fails on GitHub)

If CI fails after the commit is pushed:
1. Check the GitHub Actions logs for the specific failing step
2. If tests fail: investigate which test broke. The tests are independent of CI — a test failure means a regression in `index.ts`, not in the CI workflow.
3. If build fails: check if the `--external` flags are correct. Re-run the integration simulation (Task 2.2).
4. If setup-bun fails: check if `oven-sh/setup-bun@v2` is available. Consider pinning `bun-version`.
5. If checkout fails: check if `actions/checkout@v4` is available. Consider updating.
6. Fix the issue, commit, and push again.

### Full Rollback (revert the commit)

If the entire change needs to be reverted:
```bash
# Find the commit hash
git log --oneline -1
# Revert it
git revert <commit-hash>
# Push the revert
git push
```

This creates a new commit that undoes the changes. The original commit stays in history (safer than force-pushing).

## CI Monitoring Guide

After the PR is merged, monitor the first CI runs:

### First CI Run (on merge commit)

1. Go to the GitHub repo → Actions tab
2. Find the "CI" workflow run triggered by the merge push
3. All 4 steps should pass: Checkout → Setup Bun → Run tests → Verify build
4. If any step fails, check the logs and fix

### Subsequent PRs

1. Every PR to main will show CI status in the PR UI
2. Green checkmark = CI passed
3. Red X = CI failed (click to see logs)
4. If branch protection is enabled, PRs can't be merged with red CI

### Common CI Failure Modes

| Failure | Step | Cause | Fix |
|---------|------|-------|-----|
| "command not found: bun" | Setup Bun | `oven-sh/setup-bun@v2` failed | Check action availability; pin bun-version |
| "Could not resolve: @oh-my-pi/pi-ai" | Verify build | Missing `--external` flag | Ensure `--external @oh-my-pi/pi-ai` in build command |
| Test failure | Run tests | Regression in `index.ts` | Fix the test; CI is correctly catching a bug |
| "Cannot find module" | Run tests | `mock.module` not intercepting | Check `test/mocks.ts` setup |
| YAML parse error | (workflow load) | ci.yml is malformed | Validate YAML locally with `python3 -c "import yaml"` |
| Checkout timeout | Checkout | Network issue or large repo | Retry; rarely persistent |

## Test File Details

### test/mocks.ts (Mock Infrastructure)

This file is NOT modified by this bead but is critical for CI to work. It provides:

- `createSpy()` — Creates a spy function that records calls
- `mockExtensionAPI(overrides)` — Mock `ExtensionAPI` with `on`, `sendUserMessage`, `appendEntry`, `exec`, `registerCommand` spies
- `mockExtensionContext(overrides)` — Mock `ExtensionContext` with `model`, `modelRegistry`, `sessionManager`, `ui` mocks
- `mockSessionManager(entries)` — Mock session journal for state reconstruction tests
- `installPiAiMock(overrides)` — Uses `mock.module("@oh-my-pi/pi-ai", ...)` to intercept the import. This is the key reason tests work in CI without OMP packages.
- `importIndex(label)` — Cache-busted dynamic import to ensure mock is registered first

The mock layer intercepts at the module resolution layer. When `index.ts` tries to import `@oh-my-pi/pi-ai`, Bun's `mock.module` returns the mock instead of trying to resolve the real package. This means:
- No `node_modules` needed
- No OMP packages needed
- No network requests during tests
- Tests are deterministic (mocks return fixed values)

### Test Count Breakdown

| Test File | Tests | Module Covered | Key Tests |
|-----------|-------|---------------|-----------|
| `test/phase-maps.test.ts` | ~8 | Phase constants | PHASE_WHITELIST transitions, pr→null terminal, PHASE_FROM_COMMAND reverse map |
| `test/parse-decision.test.ts` | ~5 | Decision parser | Backward brace-balanced scan, JSON extraction from prose |
| `test/reconstruct-state.test.ts` | ~8 | State reconstruction | Journal entry parsing, type validation, missing fields |
| `test/retry-logic.test.ts` | ~15 | Retry mechanism | Retry counting, MAX_RETRIES cap, markBlocked call |
| `test/error-paths.test.ts` | ~21 | Error handling | No model, no API key, timeout, fallback path, re-entrancy guard |
| **Total** | **57** | | |

## Build Command Deep Dive

### Why `--target bun` and not `--target browser` or `--target node`

The extension runs in the Bun runtime (loaded by OMP which is a Bun application). `--target bun` tells Bun's bundler to:
- Output Bun-compatible JavaScript (uses Bun-specific APIs where available)
- Not transpile for browser or Node environments
- Preserve Bun-optimized module format

`--target browser` would add browser polyfills and shims that aren't needed.
`--target node` would use Node's module system, which is different from Bun's.

### Why `--external` and not `--no-bundle`

`--no-bundle` tells Bun to skip bundling entirely but still resolve imports. Since `@oh-my-pi/pi-ai` isn't in `node_modules` (it's a global package), `--no-bundle` fails.

`--external` tells Bun to treat the import as external — don't try to resolve or bundle it. The import is preserved in the output, to be resolved at runtime by OMP. This is correct because:
1. OMP provides `@oh-my-pi/pi-ai` at runtime (it's an OMP global package)
2. OMP provides `@oh-my-pi/pi-coding-agent` at runtime
3. The extension is loaded by OMP, which has these packages available

### Build Output

The build produces ~19,623 bytes of compiled JavaScript. This output:
- Is a valid Bun module (can be executed by `bun run`)
- Has `@oh-my-pi/pi-ai` and `@oh-my-pi/pi-coding-agent` as external imports
- Is NOT written to a file (goes to stdout when `--outfile` is not specified)
- Is discarded in CI (redirected to `/dev/null`)

The build step is verification, not artifact production. Its purpose is to catch:
- Syntax errors (e.g., missing closing brace)
- Missing imports (e.g., `import { foo } from "./nonexistent"`)
- Module structure errors (e.g., duplicate exports)
- Non-OMP import resolution failures (any import not `node:*` or `@oh-my-pi/*` would fail)

## GitHub Actions YAML Reference

### Workflow File Location

GitHub Actions looks for workflow files in `.github/workflows/*.yml` or `.github/workflows/*.yaml`. Both extensions work; `.yml` is more common.

### Trigger Types

| Trigger | When | Use Case |
|---------|------|----------|
| `push` | Commits pushed to the specified branches | Catch direct commits to main |
| `pull_request` | PR opened/synchronized to the specified branches | Verify PRs before merge |
| `schedule` | Cron schedule | Periodic checks (not used here) |
| `workflow_dispatch` | Manual trigger | Debugging (not used here) |
| `release` | Release published | Release workflows (not used here) |

This bead uses `push` and `pull_request`, both scoped to `main`. This is the standard pattern for small projects:
- `push` catches hotfixes committed directly to main
- `pull_request` catches PRs before they're merged
- Scoping to `main` avoids duplicate runs on feature branches (the PR already triggers)

### Action Versions

| Action | Version | Why |
|--------|---------|-----|
| `actions/checkout@v4` | v4 (latest major) | Standard checkout action |
| `oven-sh/setup-bun@v2` | v2 (latest major) | Official Bun setup action |

Using major version tags (`@v4`, `@v2`) gets the latest minor/patch version within that major. This is safer than `@main` (which could break) and more current than pinning to a specific version (e.g., `@v4.1.0`).

### Runner Selection

`runs-on: ubuntu-latest` uses GitHub-hosted Ubuntu runners. These are:
- Free for public repos (unlimited minutes)
- Free for private repos (2,000 minutes/month for free accounts)
- Consistent environment (same OS, same tools)
- Managed by GitHub (no maintenance)

Alternative runners:
- `ubuntu-latest` — Linux (used here)
- `macos-latest` — macOS (for macOS-specific testing)
- `windows-latest` — Windows (for Windows-specific testing)

This project is Linux-only (no OS-specific code), so `ubuntu-latest` is sufficient.

### Step Execution Model

Steps in a job run sequentially on the same runner. If a step fails:
- Subsequent steps are skipped (unless `if: always()` is set)
- The job is marked as failed
- The workflow is marked as failed
- GitHub shows a red X on the commit/PR

This is the desired behavior for CI — failures should be visible and block merging.

`continue-on-error: true` on a step would allow subsequent steps to run even if that step fails, and the job would still pass. This is NOT used because it would mask failures.

### Job vs Workflow

- **Workflow** — The `.github/workflows/ci.yml` file. Contains trigger config and one or more jobs.
- **Job** — A unit of work that runs on a single runner. This workflow has one job (`ci`).
- **Step** — A single action within a job. This job has 4 steps.

Multiple jobs would run in parallel on separate runners. This workflow uses a single job because the tasks are sequential and fast (<1s total execution time).

## package.json Scripts Deep Dive

### The `scripts` Object

The `scripts` object in `package.json` defines commands that can be run with `bun run <script-name>`. Bun's script runner:
- Reads `package.json` to find the script
- Executes the command in a shell
- Passes through stdin/stdout/stderr
- Uses the exit code of the command

### Script: `build`

```json
"build": "bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent"
```

This script:
1. Runs `bun build` (Bun's bundler)
2. Input: `index.ts` (the extension entry point)
3. Target: `bun` (Bun runtime)
4. External imports: `@oh-my-pi/pi-ai`, `@oh-my-pi/pi-coding-agent`
5. Output: stdout (no `--outfile` specified, so compiled JS goes to stdout)

**Local usage:** `bun run build` — verifies the extension compiles
**CI usage:** Same command in the CI workflow's "Verify build" step

**Exit code:** 0 on success, non-zero on failure
**Output:** ~19,623 bytes of compiled JavaScript (discarded in CI)

### Script: `check`

```json
"check": "bun test test/"
```

This script:
1. Runs `bun test` (Bun's test runner)
2. Input: `test/` directory (all `.test.ts` files)
3. Uses `bun:test` built-in (no external test framework needed)
4. Mocks are set up in `test/mocks.ts` (loaded by each test file)

**Local usage:** `bun run check` — runs all 57 tests
**CI usage:** Same command in the CI workflow's "Run tests" step

**Exit code:** 0 on success (all tests pass), non-zero on failure (any test fails)
**Output:** Test results (pass/fail counts, expect() call count, timing)

### Removed Script: `clean`

The `clean` script was `"echo 'nothing to clean'"`. It was a stub that did nothing. It's removed because:
1. The build writes to stdout, not to a file
2. No `dist/` directory is created
3. There's nothing to clean
4. An echo stub is misleading — it implies there's a clean operation when there isn't

If a future bead adds file output to the build (e.g., `--outfile dist/index.js`), a `clean` script can be added then: `"clean": "rm -rf dist/"`.

### The `files` Array

The `files` array in `package.json` (lines 23-28) lists files included in the npm package:
```json
"files": [
  "index.ts",
  "prompts/decision-prompt.md",
  "prompts/selection-prompt.md",
  "README.md"
]
```

This is NOT modified by this bead. The CI workflow file (`.github/workflows/ci.yml`) is NOT in this list because:
- It's not part of the published npm package
- GitHub Actions reads it from the repo, not from the npm package
- Adding it would bloat the npm package unnecessarily

### The `omp` Object

The `omp` object (lines 29-33) configures the OMP extension:
```json
"omp": {
  "extensions": [
    "./index.ts"
  ]
}
```

This is NOT modified by this bead. It tells OMP where to find the extension entry point.

## Verification Philosophy

### Why So Many Verification Steps?

The plan has 20 observable truths and the tasks have ~30 verification checkboxes. This seems excessive for a 2-file change. But the verification is cheap (most checks run in <1s) and the cost of a broken CI workflow is high:

- A broken CI workflow that passes (false green) lets regressions slip through
- A broken CI workflow that fails (false red) blocks all PRs
- A malformed YAML file means no CI at all
- A missing `--external` flag means build always fails in CI

Thorough verification catches these issues locally, before they affect the team.

### Verification Layers

1. **Static** (no execution) — Fast, catches structural issues
   - YAML validation
   - JSON validation
   - grep checks

2. **Runtime** (execution) — Slower, catches behavioral issues
   - `bun run check` (test suite)
   - `bun run build` (build command)

3. **Integration** (environment simulation) — Slowest, catches environment issues
   - Clean env simulation (already done in /create)
   - Not re-run in /ship unless commands change

### Falsifiability

Each observable truth is falsifiable — it can be proven true or false by a command. There's no ambiguity. For example:
- "ci.yml is valid YAML" → `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` → exit 0 = true, non-zero = false
- "package.json has no clean script" → `python3 -c "import json; assert 'clean' not in json.load(open('package.json'))['scripts']"` → exit 0 = true, assertion error = false

This is in contrast to vague criteria like "the CI workflow is good" which can't be verified by a command.

## Summary

This bead is a small but important piece of infrastructure. It adds automated testing (CI) to the ultramode project, ensuring every PR is verified before merge. The implementation is straightforward (2 files, ~15 lines of content) but the investigation (done in /create) and verification (done in /ship) are thorough.

Key takeaways:
1. The build command uses `--target bun --external` because OMP packages are runtime-provided, not local
2. Tests work in CI because `mock.module` intercepts imports before resolution
3. No type checking in CI because of pre-existing errors (separate bead)
4. No dependency caching because there are zero npm dependencies
5. Single job because tests and build are both <1s
6. The CI workflow is self-testing — changes to ci.yml are tested by CI itself
