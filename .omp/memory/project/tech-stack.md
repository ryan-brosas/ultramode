---
purpose: Tech stack, versions, verification commands, and constraints
updated: 2026-06-17
---

# Tech Stack: OMP Beads Template

## Runtime

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| Language | N/A | — | Template repo — no application language |
| Runtime | N/A | — | Template repo — no application runtime |
| Package manager | N/A | — | Template repo — no dependencies |
| Task tracking | br (beads_rust) | latest | `which br` — CLI task tracker |
| Graph intelligence | bv (beads_viewer) | latest | `which bv` — robot commands for graph analysis |

## Key Dependencies

| Dependency | Purpose | Version |
|------------|---------|---------|
| N/A | Template repo — no dependencies | — |

Keep to the dependencies that shape architecture decisions. Don't list every transitive dep.

## Verification Commands

```bash
# Typecheck
true  # template repo — no application code

# Lint
true  # template repo — no application code

# Test
true  # template repo — no application code

# Build
true  # template repo — no application code

# Graph state (always available)
bv --robot-triage
br list --status open --status in_progress --json
```

Replace placeholders with your project's actual commands. These are what `/verify` runs.

## Security

```bash
# Dependency audit
true  # template repo — no dependencies

# Secrets scan (if configured)
true  # no secrets scan configured
```

## Constraints

- **Dependencies:** No new dependency without discussion. Audit before adding.
- **Token budget:** Keep each memory file under 2KB. Total memory context under 8KB.
- **No new tooling categories:** Skills = Markdown, commands = Markdown, extensions = TypeScript. If it doesn't fit, discuss first.
- **Verification gate:** Every bead must pass its verification commands before `/review` or `/pr`.

