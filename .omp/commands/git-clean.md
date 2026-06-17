---
description: "Clean up worktrees and local branches for merged PRs. Run after /close or periodically to remove stale worktrees. Usage: /git-clean [<bead-id>]"
argument-hint: "[<bead-id>]"
allowed-tools: Bash(git worktree:*), Bash(git branch:*), Bash(git fetch:*)
disable-model-invocation: false
---

## Bead ID Resolution (optional)

`$ARGUMENTS` may be empty, a short suffix, or a full bead ID. If empty → clean ALL merged worktrees.

If provided:
1. Try `br show "$ARGUMENTS" --json` — if it returns the bead, use that ID.
2. If it fails, suffix-match: `br list --status open --status in_progress --status closed --json`, filter IDs ending with `$ARGUMENTS`.
3. If exactly one match → use it. If multiple → list them and ask the user. If none → STOP: "No bead found matching $ARGUMENTS."

Use the resolved ID as `BEAD_ID` for all steps below.

## Prerequisites

None. This is a housekeeping command — safe to run anytime.

## Phase 0: Fetch

Sync remote state so we can detect merges that happened on GitHub:

```bash
git fetch origin --prune
```

## Context

- Worktrees: !`git worktree list`
- Local branches: !`git branch | sed 's/^[* ]*//'`

## Phase 1: Determine Scope

**If `$ARGUMENTS` is provided (single bead):**

Find the local branch matching `$BEAD_ID`:

```bash
BEAD_BRANCH=$(git branch --list "*$BEAD_ID*" | head -1 | sed 's/^[* ]*//')
```

If no branch found: "No local branch matches bead $BEAD_ID — nothing to clean up."

**If no `$ARGUMENTS` (clean all):**

Iterate over every local branch except `main`.

## Phase 2: Clean

Two signals determine a branch is safe to remove:

1. **Locally merged** — `git branch --merged main` includes it
2. **Remote branch deleted** — GitHub deletes branches after merge by default; if `origin/<branch>` no longer exists, it was merged

```bash
is_safe_to_clean() {
  local BRANCH="$1"

  # Signal 1: locally merged to main
  if git branch --merged main | grep -qFx "$BRANCH"; then
    return 0
  fi

  # Signal 2: remote branch was deleted (merged on GitHub)
  if ! git ls-remote --heads origin "$BRANCH" | grep -qF "$BRANCH"; then
    return 0
  fi

  return 1
}

clean_branch() {
  local BRANCH="$1"
  local WORKTREE=".worktree/$BRANCH"

  [ "$BRANCH" = "main" ] && return

  if ! is_safe_to_clean "$BRANCH"; then
    echo "Skipping '$BRANCH' — not merged, remote branch still exists."
    return
  fi

  # Report the reason
  if git branch --merged main | grep -qFx "$BRANCH"; then
    echo "Cleaning '$BRANCH' — merged to main locally."
  else
    echo "Cleaning '$BRANCH' — remote branch deleted (merged on GitHub)."
  fi

  # Remove worktree
  if [ -d "$WORKTREE" ]; then
    git worktree remove "$WORKTREE" 2>/dev/null && echo "  Removed worktree: $WORKTREE" || echo "  Failed to remove worktree: $WORKTREE (uncommitted changes?)"
  fi

  # Delete local branch (force-delete — we already confirmed it's safe)
  git branch -D "$BRANCH" 2>/dev/null && echo "  Deleted branch: $BRANCH" || echo "  Branch '$BRANCH' already deleted."
}

# Single-bead mode
if [ -n "$BEAD_BRANCH" ]; then
  clean_branch "$BEAD_BRANCH"
else
  # Bulk mode: check all local branches except main
  for BRANCH in $(git branch | sed 's/^[* ]*//' | grep -v '^main$'); do
    clean_branch "$BRANCH"
  done
fi
```

## Phase 3: Verify

```bash
git worktree list
```

## Phase 4: Report

```
Cleaned:
- <branch> (reason: <merged locally | remote deleted>)
- ...

Skipped:
- <branch> (reason: not merged, remote still exists)

Remaining worktrees: <N>
```