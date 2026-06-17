---
description: "Formalize work into a br bead + quality PRD. Investigates the codebase before writing — no speculative PRDs."
argument-hint: "[--worktree] <description of work>"
---

## Prerequisites (CHECK FIRST)

Before doing ANYTHING, verify:
1. User provided input ($ARGUMENTS) describing what to build.

If no input: STOP. Ask the user: "What are we building? Provide a description or run /brainstorm first."
Do NOT proceed. Do NOT "helpfully" skip ahead.

You are formalizing work into a tracked br bead. The bead is the backbone. **A low-quality PRD collapses the entire workflow** — plan, ship, verify, and review all depend on it. Invest in this phase.

## Flag Parsing

```bash
# Extract --worktree flag and description
WORKTREE=false
DESCRIPTION="$ARGUMENTS"

if echo "$ARGUMENTS" | grep -q '\-\-worktree'; then
  WORKTREE=true
  DESCRIPTION=$(echo "$ARGUMENTS" | sed 's/--worktree//g' | xargs)
fi
```

If `--worktree` is set, a git worktree will be created at `<repo>/.worktrees/<bead-id>/` after artifacts are written. This isolates the bead's work into its own directory — no branch switching, no conflicts with other beads. Without `--worktree`, work happens in the current directory normally.

## Phase 1: Graph Context

```bash
bv --robot-triage --format json              # Project state
bv --robot-suggest --format json             # Duplicates, missing deps, label suggestions
bv --robot-plan --format json                # Execution tracks — where does new work fit?
br search "$ARGUMENTS" --status open --status in_progress --json  # Exact dedup
```

If a matching bead exists, surface it. Ask: work on existing or create new?

## Phase 2: Classify

| Signal | Type | Slug prefix |
|--------|------|-------------|
| add/build/create/new | feature | `feat-` |
| fix/crash/error/broken | bug | `fix-` |
| refactor/migrate/cleanup | task | `task-` |
| multi-phase/complex | epic | `epic-` |
| test/docs/ci/config | chore | `chore-` |

Priority: P0=critical | P1=high | P2=default | P3=low | P4=backlog

Check `bv --robot-priority --format json` — if this unblocks mispriorized work, adjust priority accordingly.

## Phase 3: Investigate

**Do not write the PRD yet.** First, understand the problem deeply. A PRD written without investigation is speculative — it will produce a bad plan, bad implementation, and wasted work.

### 3a. Read the Affected Code

Identify the files this work will touch. Don't guess — search:

```bash
# Find relevant files by keyword, import, or pattern
grep -rl "<keyword>" --include="*.ts" --include="*.py" --include="*.rs" .
```

Read 3-5 of the most relevant files. Understand:
- What patterns exist (follow them, don't invent new ones)
- What constraints exist (APIs, types, interfaces, conventions)
- What's the current behavior and why
- What's coupled to the code you'll change

### 3b. Check File History

```bash
bv --robot-file-beads <file> --format json   # What beads touched this file?
bv --robot-file-relations <file> --format json # What co-changes with this file?
```

Hot files (>3 beads) are fragile — touch carefully. Co-changing files are blast radius — include them in scope.

### 3c. Understand the Problem Root Cause

Answer these before writing the PRD:
- **WHEN** does the problem occur? (trigger, scenario, user action)
- **THEN** what happens? (symptom, observable behavior)
- **BECAUSE** what's the root cause? (why does it happen — not just "X is missing," but why is X missing? what constraint or decision led to this?)

If you can't answer all three, you don't understand the problem yet. Read more code.

### 3d. Identify Constraints

List everything that constrains the solution:
- **API contracts**: what interfaces must be preserved?
- **Existing patterns**: what conventions must be followed?
- **Dependencies**: what other code depends on the changed files?
- **Performance**: any latency/throughput requirements?
- **Tooling**: what tools/scripts/CI depends on the current behavior?

### 3e. Check for Prior Art

```bash
br search "<keyword>" --json                  # Has this been attempted before?
git log --all --oneline --grep="<keyword>" -10 # Any reverted commits on this topic?
```

If this was attempted and abandoned, understand why before repeating the same mistake.

## Phase 4: Design

Before writing artifacts, deliberate on the approach.

### 4a. Generate Alternatives

List 2-3 ways to solve the problem. For each:
- What changes (files, APIs, behaviors)
- What stays the same
- Why it works
- Why it might fail

### 4b. Pick an Approach

Choose the simplest approach that addresses the root cause. Criteria:
- **Minimal change**: fewest files, least new code
- **Follows existing patterns**: no new conventions
- **Reversible**: easy to undo if wrong
- **Testable**: can verify with concrete checks

### 4c. Define Boundaries

What is explicitly OUT of scope? List files, subsystems, or behaviors you will NOT touch. This is as important as what's in scope — it prevents scope creep during /ship.

### 4d. Identify Risks

For each risk, state:
- What could go wrong
- How likely (Low/Medium/High)
- What's the impact if it does
- How you'll mitigate it (design choice, verification step, rollback plan)

## Phase 5: Create the Bead

```bash
ACTOR="${BR_ACTOR:-assistant}"
br create --actor "$ACTOR" "$DESCRIPTION" \
  --type <type> \
  --priority <0-4> \
  --json
```

Capture the bead ID from output. This is `BEAD_ID` for all steps below.

## Phase 6: Write Artifacts

Create `.beads/artifacts/$BEAD_ID/`. Write from investigation, not from memory.

**For each artifact below, follow this exact process:**
1. **Read the template**: `read .omp/templates/<name>`
2. **Fill in every `{placeholder}`** with concrete evidence from Phases 3-4. Delete no sections. Add no new top-level sections. Replace every `{placeholder}` — no `{placeholder}` left unfilled.
3. **Write the filled file** to `.beads/artifacts/$BEAD_ID/<name>`

### prd.md

Template: `.omp/templates/prd.md`

Fill from investigation (Phase 3) and design (Phase 4):
- **Problem**: WHEN/THEN/BECAUSE from 3c. Who is affected, why now.
- **Scope**: In Scope from design. Out of Scope from 4c — explicit boundaries.
- **Requirements**: From 4b. Every requirement MUST have a falsifiable acceptance criterion — a command to run, a behavior to observe.
- **Technical Context**: Exact file paths from 3a. Existing patterns from 3a. Constraints from 3d. Prior art from 3e.
- **Approach**: Chosen alternative from 4b. Why others were rejected.
- **Risks**: From 4d. Likelihood, Impact, Mitigation.
- **Success Criteria**: Falsifiable outcomes. Each checkable with a command.

### prd.json

Template: `.omp/templates/prd.json`

Machine-readable mirror of the PRD. Must stay in sync — every requirement in prd.md must appear in prd.json with matching IDs.

### decisions.md

Template: `.omp/templates/decisions.md`

- **Decision Log**: Every design choice from Phase 4 with rationale and confidence.
- **Rejected Alternatives**: From 4a — what you considered, why rejected, risk if re-introduced.
- **Assumptions**: From 3d — what you assume true, how validated, what changes if wrong.

## Phase 6b: Worktree (if --worktree)

If `WORKTREE=true`, create an isolated git worktree for this bead:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
SLUG="<kebab-slug-from-description>"       # e.g. "short-bead-id-resolution"
BRANCH="${BEAD_ID}-${SLUG}"
WORKTREE_PATH="${REPO_ROOT}/.worktrees/${BEAD_ID}"

# Safety check — don't overwrite existing
if [ -d "$WORKTREE_PATH" ]; then
  echo "Worktree already exists at $WORKTREE_PATH" >&2
  exit 1
fi

# Create worktree
mkdir -p "${REPO_ROOT}/.worktrees"
git worktree add "$WORKTREE_PATH" -b "$BRANCH" HEAD

# Mirror artifacts into worktree
mkdir -p "$WORKTREE_PATH/.beads/artifacts/$BEAD_ID"
cp .beads/issues.jsonl "$WORKTREE_PATH/.beads/issues.jsonl"
cp -R ".beads/artifacts/$BEAD_ID/." "$WORKTREE_PATH/.beads/artifacts/$BEAD_ID/"

# Record worktree path for later cleanup
echo "$WORKTREE_PATH" > ".beads/artifacts/$BEAD_ID/worktree.txt"
```

**What gets copied:** artifacts (prd.md, prd.json, decisions.md), issues.jsonl (for bv).
**What NEVER gets copied:** `.beads/beads.db`, `.env*`, credentials, node_modules.

If `WORKTREE=false`, skip this phase entirely. Work happens in the current directory.
## Phase 7: Verify

```bash
br show "$BEAD_ID" --json                    # Confirm creation
br dep cycles --json                         # Must be empty
ls .beads/artifacts/"$BEAD_ID"/              # Confirm all 3 artifacts exist
[ "$WORKTREE" = "true" ] && ls "$WORKTREE_PATH/.beads/artifacts/$BEAD_ID/"  # Confirm mirror
[ "$WORKTREE" = "true" ] && git worktree list | grep "$WORKTREE_PATH"       # Confirm worktree registered
```

### PRD Quality Self-Check

Before reporting success, verify the PRD passes these checks:

- [ ] Problem section has WHEN/THEN/BECAUSE — not just "we need X"
- [ ] Scope has explicit Out of Scope — not just In Scope
- [ ] Every requirement has a falsifiable acceptance criterion
- [ ] Technical Context references actual file paths — not "various files"
- [ ] Risks table has Likelihood + Impact + Mitigation — not just "might break"
- [ ] Success Criteria are observable behaviors — not "it should work"
- [ ] Decisions.md has rejected alternatives — not just decisions
- [ ] Assumptions have invalidation impact — not just "assume X is true"
- [ ] PRD is ≥600 lines (`wc -l prd.md`) — <600 = incomplete, needs more investigation
If any box is unchecked, go back to Phase 3 or 4 and fix it. Do not ship a low-quality PRD.

```bash
br sync --flush-only
```

## Phase 7b: Auto-Commit

Create a scoped commit for the `/create` output before reporting success. This preserves the PRD baseline that `/plan`, `/ship`, and `/review` depend on.

```bash
br sync --flush-only
git status --short
git add .beads/
git add .beads/artifacts/"$BEAD_ID"/prd.md \
        .beads/artifacts/"$BEAD_ID"/prd.json \
        .beads/artifacts/"$BEAD_ID"/decisions.md
git commit -m "docs: create PRD for $BEAD_ID"
```

Stage only `/create` artifacts and bead sync state. Do not stage unrelated user changes. If there is nothing to commit, record that observed status in the report instead of fabricating a commit.


## Phase 8: Report

```
Bead: $BEAD_ID | Type: <type> | Priority: P<n>
Graph fit: <where this sits in execution tracks>
Impact: <what this unblocks per robot-plan>
Files investigated: <N files read>
Alternatives considered: <N>
Risks identified: <N>
Artifacts: .beads/artifacts/$BEAD_ID/ (prd.md, prd.json, decisions.md)
Worktree: <$WORKTREE_PATH if --worktree, "none" otherwise>
PRD quality: <N/8 self-checks passed>
Next: /plan $BEAD_ID
```

**If a worktree was created:** tell the user to `cd $WORKTREE_PATH` and open `omp` there. All subsequent commands (/plan, /ship, etc.) should be run inside the worktree.
