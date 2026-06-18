# Context Capsule: ultramode-yk6

## Objective

Add a GitHub Actions CI workflow (`.github/workflows/ci.yml`) that runs `bun test test/` (57 tests) and `bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent` on every push and pull_request to `main`. Replace the three echo-stub scripts in `package.json` (`clean`, `build`, `check`) with real commands — remove `clean` entirely (the build writes to stdout, nothing to clean), set `build` to the real build command, and set `check` to `bun test test/`. This automates the regression safety net for all future PRs and fixes misleading npm scripts that currently echo "nothing to build/check" when there is something to build and check.

## Key Patterns

- **Bun test with mocked imports** — `test/mocks.ts:148` uses `mock.module("@oh-my-pi/pi-ai", ...)` to intercept the `@oh-my-pi/pi-ai` import before Bun tries to resolve it. This is why tests work in CI without OMP packages installed. Reference: `test/mocks.ts` for the mock setup pattern. The `importIndex(label)` function at `test/mocks.ts:159` uses cache-busted dynamic import (`import(\`../index.ts?${label}-${Date.now()}\`)`) to ensure the mock is registered before `index.ts` loads.

- **Bun build with `--target bun --external`** — The correct build command is `bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent`. The `--external` flags are critical: `index.ts` imports from OMP global packages (`@oh-my-pi/pi-ai`, `@oh-my-pi/pi-coding-agent`) that aren't available in CI. The `--external` flag tells Bun to treat them as runtime-provided imports. `--no-bundle` fails because it still tries to resolve imports. Plain `--target bun` (without `--external`) works locally but produces a 7.7MB bundle and fails in CI. Reference: PRD `decisions.md` Decision #1 for the full rationale.

- **Type-only imports erased at runtime** — `index.ts` has `import type { ... } from "@oh-my-pi/pi-coding-agent"` which is erased at runtime by Bun. This import doesn't need the package to be installed for `bun build` or `bun test` — only `tsc` would need it. Reference: `index.ts` line 1-5 for the import statements.

- **stdout build output** — `bun build --target bun` without `--outfile` writes compiled JavaScript to stdout, not to a file. No `dist/` directory is created. This is why no `clean` script and no `.gitignore` change is needed. Reference: PRD Finding #7 for verification.

- **package.json scripts convention** — The `scripts` object in `package.json` (lines 7-11) defines `bun run` commands. Scripts are executed by Bun's built-in script runner — no `npm` or `package.json` scripts dependency needed. The convention is 2-space JSON indentation. Reference: `package.json` lines 7-11 for the current (stub) scripts.

- **GitHub Actions workflow structure** — The standard structure is `name → on → jobs → steps`. Steps run sequentially; job fails if any step fails (unless `continue-on-error: true`). The `oven-sh/setup-bun@v2` action is the official Bun GitHub Action. `actions/checkout@v4` must run before setup-bun (needs the repo). Reference: `.omp/templates/` for no prior workflow patterns (this is the first CI workflow in the repo).

- **Conventional commit format** — Commit messages use `type: description` format. For CI/config changes, the prefix is `chore:`. Reference: `AGENTS.md` Git section for the commit convention.

## Constraints

1. **MUST use `--target bun --external` for the build step** — `--no-bundle` fails (can't resolve OMP packages), plain `--target bun` fails in CI (no OMP packages). This was verified in a clean environment simulation during `/create`.

2. **MUST NOT add `tsc --noEmit` to CI** — Requires OMP global packages for type definitions. Has 2 pre-existing type errors at `index.ts:376,379` (`Model<Api> | undefined` not assignable to `Model<Api>`) introduced by `ultramode-eqa`. Type checking is a separate bead after fixing those errors.

3. **MUST NOT add dependency caching** — The project has zero npm dependencies (no `dependencies`, no `devDependencies` in `package.json`). There's no `node_modules` to cache. Adding caching is pure overhead.

4. **MUST NOT add a `clean` script** — The build writes to stdout, no files are created. Adding a clean script for nonexistent output is speculative (YAGNI).

5. **MUST NOT modify `index.ts`, `test/*.ts`, or `test/mocks.ts`** — This bead is about CI and package.json scripts only. The extension code and tests are out of scope.

6. **MUST NOT add `continue-on-error: true` to any CI step** — Failures must propagate. CI should be red when tests fail or the build breaks.

7. **MUST NOT add linting** — No linter is configured. Adding linting requires choosing a linter, configuring rules, and fixing violations — a separate concern.

8. **MUST use 2-space indentation in both files** — `package.json` uses 2-space indentation (verified). The CI workflow YAML should also use 2-space indentation for consistency.

9. **MUST trigger on both `push` and `pull_request` scoped to `main`** — `push` catches direct commits to main; `pull_request` catches PRs before merge. Scoping to `main` avoids duplicate runs on feature branches.

10. **MUST use `actions/checkout@v4` before `oven-sh/setup-bun@v2`** — Checkout must come first; setup-bun may need repo files.

11. **SHOULD use `bun-version: latest`** — Not pinned to a specific version. OMP doesn't pin a Bun version. If reproducibility issues arise, pin then.

12. **SHOULD use a single job, not multiple** — Tests run in ~260ms, build in ~500ms. Splitting into separate jobs adds ~15s overhead per job for no benefit.

13. **MUST NOT modify `.gitignore`** — No `dist/` is created by the build. Nothing to ignore.

14. **MUST commit both files in a single commit** — The CI workflow and package.json scripts are one logical change. They should be committed together with a conventional commit message.

15. **MUST verify locally before committing** — Run `bun run check` and `bun run build` locally. Both must pass before committing. CI should never be the first place you discover a failure.

## File Ownership

| Task | Allowed | Forbidden |
|------|---------|-----------|
| 1.1 (write ci.yml) | `.github/workflows/ci.yml` | All other files |
| 1.2 (edit package.json) | `package.json` (lines 7-11 only) | All other files, and all other lines of package.json |
| 2.1 (local verification) | (none — read-only) | All files (verification only, no edits) |
| 2.2 (integration simulation) | `/tmp/yk6-ci-verify/*` (temp) | All repo files |
| 3.1 (commit) | (none — git operations only) | All files (git add/commit only, no edits) |
| 4.1 (observable truths) | (none — read-only) | All files (verification only, no edits) |
| 7.1 (completion evidence) | `.beads/artifacts/ultramode-yk6/completion-evidence.json` | All source files |

## Graph Context

- **Blast radius:** 2 files (1 new, 1 edit, 0 deletes)
  - `.github/workflows/ci.yml` — NEW file (the `.github/` directory does not exist)
  - `package.json` — EDIT (lines 7-11, the `scripts` object; 3 stub scripts → 2 real scripts)
- **Related beads:** 10 total in graph, 0 related to this bead
  - All 10 prior beads (`ultramode-air`, `ultramode-aqr`, `ultramode-b09`, `ultramode-c95`, `ultramode-eqa`, `ultramode-fpj`, `ultramode-os5`, `ultramode-tp1`, `ultramode-v1p`, `ultramode-yvq`) are closed and have 0 dependency edges to `ultramode-yk6`
  - This bead is an orphan node in the graph — no in-edges, no out-edges
  - No prior bead created CI infrastructure; this is the first
- **File history:**
  - `package.json` — 0 prior bead links (never modified by a bead; original file from repo creation)
  - `.github/workflows/ci.yml` — does not exist (new file)
  - The hotspots from `bv --robot-file-hotspots` are all `.omp/memory/project/*.md` files — this bead does not touch any hotspot
- **Hotspots touched:** None
  - `.omp/memory/project/project.md` — 3 bead links, 0 open — NOT touched
  - `.omp/memory/project/gotchas.md` — 2 bead links, 0 open — NOT touched
  - `.omp/memory/project/decisions.md` — 2 bead links, 0 open — NOT touched
  - `.omp/memory/project/conventions.md` — 1 bead link, 0 open — NOT touched

## Graph Metrics Summary

| Metric | Value | Source |
|--------|-------|--------|
| Execution tracks | 1 (track-A) | `bv --robot-plan` |
| Total actionable | 1 (this bead) | `bv --robot-plan` |
| Total blocked | 0 | `bv --robot-plan` |
| Critical path | No | `bv --robot-insights` |
| Cycles | None | `br dep cycles --json` |
| Bottlenecks | None | `bv --robot-insights` |
| Orphan node | Yes | `bv --robot-insights` |
| Out-degree | 0 | `bv --robot-insights` |
| In-degree | 0 | `bv --robot-insights` |
| Velocity (7d) | 10 closed | `bv --robot-insights` |
| ETA | 52 minutes | `bv --robot-forecast` |
| ETA confidence | 0.4 | `bv --robot-forecast` |
| File hotspots touched | 0 | `bv --robot-file-hotspots` |

## Implementation Context

### Build Command Resolution History

The correct build command was determined during `/create` through systematic investigation:

1. **`bun build index.ts --no-bundle`** → FAILED: `error: Could not resolve: "@oh-my-pi/pi-ai"`
   - Cause: `--no-bundle` still resolves imports; `@oh-my-pi/pi-ai` is at `~/.bun/install/global/node_modules/`, not local `node_modules`

2. **`bun build index.ts --target bun`** → Works locally, but:
   - Produces 7.7MB bundle (includes all of pi-ai and dependencies)
   - Would fail in CI (no OMP global packages)

3. **`bun build index.ts --target bun --external @oh-my-pi/pi-ai --external @oh-my-pi/pi-coding-agent`** → CORRECT
   - Verified in clean CI simulation: `env -u BUN_INSTALL HOME=/tmp/fakehome` → exit 0, 19,623 bytes stdout
   - `--external` tells Bun to treat these as runtime-provided imports (which they are — OMP provides them)

### Test Infrastructure

The 57 tests pass in CI without OMP packages because:

1. `test/mocks.ts:148` — `mock.module("@oh-my-pi/pi-ai", ...)` intercepts the import before resolution
2. `test/mocks.ts:159` — `importIndex(label)` uses cache-busted dynamic import to ensure mock is registered first
3. `index.ts` line 1-5 — `import type { ... } from "@oh-my-pi/pi-coding-agent"` is erased at runtime (type-only import)

This was verified in the same clean environment simulation as the build command.

### Pre-Existing Issues (Out of Scope)

- **Type errors at `index.ts:376,379`** — `Model<Api> | undefined` not assignable to `Model<Api>`. Introduced by `ultramode-eqa` (LLM timeout bead). These prevent `tsc --noEmit` from passing. Fixing them is a separate bead. This bead's CI does NOT include type checking, so these errors don't block CI.

- **No linter configured** — No `.eslintrc`, `biome.json`, or `deno.json`. Adding linting is a separate concern.

### CI Environment vs Local Environment

| Aspect | Local | CI (ubuntu-latest) |
|--------|-------|---------------------|
| OS | Linux 6.8.0-124-generic | Ubuntu latest (ubuntu-latest) |
| Bun | 1.3.14 (via OMP) | latest (via oven-sh/setup-bun@v2) |
| OMP packages | Available at `~/.bun/install/global/node_modules/@oh-my-pi/` | NOT available |
| `node_modules` | Not present (no deps) | Not present (no deps) |
| `bun test test/` | Works (mock.module intercepts) | Works (mock.module intercepts) |
| `bun build --external` | Works | Works |
| `bun build` (no --external) | Works (resolves from global) | FAILS (can't resolve) |
| `bun build --no-bundle` | FAILS (can't resolve) | FAILS (can't resolve) |
| `tsc --noEmit` | Works (with errors at 376,379) | Fails (no type defs for OMP packages) |

### Verification Approach

The implementation uses three verification layers:

1. **Static** (no execution) — YAML/JSON parsing, grep checks. Fast, catches structural issues.
2. **Runtime** (execution) — `bun run check` and `bun run build`. Slower, catches behavioral issues.
3. **Integration** (environment simulation) — Clean env test from `/create`. Already done, not re-run in `/ship`.

The `/ship` phase uses layers 1 and 2. Layer 3 was the investigation phase that determined the correct commands.

## Handoff Notes

- The bead is an orphan in the dependency graph — no coordination with other beads needed.
- The implementation is 2 files, ~15 lines of actual content (excluding comments).
- The entire implementation can be done in under 10 minutes by a single agent.
- The verification (running tests and build) takes ~1 second.
- The commit is a single conventional commit: `chore: add CI workflow + fix package.json scripts`.
- After merge, the first CI run will trigger on the merge commit to main. Monitor it.
- Branch protection (requiring CI to pass before merge) is a manual GitHub setting, not part of this bead. Configure it after merge if desired.
