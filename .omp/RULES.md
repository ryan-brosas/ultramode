# Rules

## RULE #1

Do not implement without a plan. No edits, no writes, no code changes during brainstorm or explore phases. Implementation happens during `/ship` — after PRD and plan exist.

## RULE #2

Always use `br --json`. Never run `br` without `--json` — you will get colored terminal output that cannot be parsed. Always resolve actor: `ACTOR="${BR_ACTOR:-assistant}"` and pass `--actor "$ACTOR"` on all mutating commands.

## RULE #3

Never run bare `bv`. Always use `bv --robot-*` flags. Bare `bv` launches an interactive TUI that blocks the session. The primary entry points are `bv --robot-triage --format json` for triage and `bv --robot-plan --format json` for planning.

## RULE #4

Sync is explicit. br never runs git commands. After bead state changes, you must: `br sync --flush-only` → `git add .beads/ && git commit`. Before ending a session: `git pull --rebase` → `br sync --flush-only` → `git add .beads/ && git commit -m "Update issues"` → `git push` → `git status`.

## RULE #5

YAGNI — You Ain't Gonna Need It. Never add abstractions, retries, validation, telemetry, caching, configuration options, or future-proofing "while you're at it." Build only what the PRD requires. Every line of code you don't write is a line you don't maintain, test, debug, or read six months from now. If the PRD doesn't ask for it, it doesn't exist.

KISS — Keep It Simple, Stupid. Prefer the simplest approach that satisfies the requirements. One file over three. A plain function over a class. An if-statement over a strategy pattern. Complexity is a liability — you pay for it every time someone reads, tests, or changes the code. Add complexity only when the PRD explicitly demands it or when the simple approach provably doesn't work.

## RULE #6

Follow the workflow as-is. The core loop is: `/create` → `/plan` → `/ship` → `/verify` → `/review` → `/pr` → `/close` → loop. `/brainstorm` is the entry point when you don't know what to build. `/pr` creates the PR and `/close` marks the bead complete — the human merges the PR at their convenience. Never skip a phase. Never merge phases. Never "helpfully" proceed when a prerequisite check says STOP. The human always gets the last call on merges — the agent proposes, the human decides.
