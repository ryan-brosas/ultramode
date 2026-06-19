---
purpose: How we build — naming, code style, workflow, agent conventions, memory system
updated: 2026-06-19
---

# Conventions: Hermes Beads Template

## Naming

- **Files:** `kebab-case.md`, `kebab-case.json`, `kebab-case.ts`
- **Functions:** `camelCase` (TypeScript), `snake_case` (Python), `camelCase` (Go)
- **Classes/Components:** `PascalCase`
- **Constants:** `UPPER_SNAKE_CASE`
- **Bead slugs:** `kebab-case` (e.g. `feat-auth-login`, `fix-null-check`)

## Git

- **Branch:** `<type>/<bead-id>-<slug>` (e.g. `feat/a1b2-add-login`)
- **Commit:** conventional commits — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- **PR title:** `<bead-id>: <one-line summary>`

## Workflow

8-phase flow: brainstorm → create → plan → ship → verify → review → pr → close. See AGENTS.md for the full command reference table.

## Agent Conventions

- Evidence before claims — no assertion without observed output
- Read before edit — never guess file content
- One bead per session — stay focused
- Never implement without a bead and plan
- Always `--json` with br/bv commands
- Resolve actor: `ACTOR="${BR_ACTOR:-assistant}"` on all br mutations

## Memory File Maintenance

Update memory files on every milestone and `/close`. Stale memory teaches wrong patterns.
