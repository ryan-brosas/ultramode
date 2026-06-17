---
purpose: Known pitfalls, warnings, and workarounds — what will bite the next developer
updated: 2026-06-17
---

# Gotchas: OMP Beads Template

Every entry must include impact and mitigation. A gotcha without a mitigation is just a complaint.

## Active Warnings

| Date | Area | Gotcha | Impact | Mitigation |
|------|------|--------|--------|------------|
| 2026-06 | memory | Memory templates waste tokens if left as placeholders | ~1KB of template text the agent reads every session | Fill with real project content immediately. Delete placeholder gotchas when real ones exist. |

## Template Bootstrap Gotchas

> These gotchas ship with the OMP Beads Template. They apply to any project using this template. Replace with your project's actual gotchas as you discover them.

| Date | Area | Gotcha | Impact | Mitigation |
|------|------|--------|--------|------------|
| 2026-06 | workflow | The workflow gate only understands the active bead if `br list --status open --status in_progress --json` works | Gate won't block edits, agents write without PRD/plan | Verify `br` is initialized and beads exist before relying on the gate |
| 2026-06 | workflow | The gate blocks `edit` and `write` but shell-based mutation bypasses it | Agent can circumvent gate via `bash` tool | Trust the gate as a signal, not a hard boundary. Agent conventions are the real enforcement. |
| 2026-06 | workflow | Implementing without a bead or plan | Untracked work, no evidence, no review, no PR | Always `/create` + `/plan` before `/ship` |
| 2026-06 | workflow | Assuming requirements without reading PRD | Misses acceptance criteria, scope creep | Read PRD + plan before every `/ship` |
| 2026-06 | commands | Commands are prompt templates, not compiled code | Inconsistent behavior across models and sessions | Keep commands explicit and deterministic. Test with different models. |
| 2026-06 | omp | OMP loads from `.omp/` — moving files to `.pi/` stops native discovery | Silent breakage, agent loses skills and commands | Never create `.pi/` directory. Everything lives under `.omp/`. |
| 2026-06 | bv | `bv` requires git history — robot commands return empty until at least one commit exists | Graph queries fail silently | Create at least one commit before relying on bv |
| 2026-06 | bv | `bv` requires br data — robot commands need `.beads/` database | bv errors if no beads database | Run `br init` before any bv command |
| 2026-06 | memory | Stale memory is worse than no memory | Agents learn wrong conventions, make wrong decisions | Update on every milestone. `/close` now has a structural memory audit (Phase 1.5) that checks all 5 memory files for drift against bead artifacts and blocks close on full rejection. |
| 2026-06 | models | Lazy/small models skip steps, assume context, don't follow workflow | Wrong output, missing evidence, skipped verification | Use thinking/reasoning-capable models for workflow phases. Explicit prompts compensate for weaker models. |
| 2026-06 | skills | Loading domain-specific skills in the wrong project wastes context | Agent reads irrelevant instructions every session | Only load skills that match the project's tech stack and domain |

## How to Add a Gotcha

1. Date = when discovered (YYYY-MM).
2. Area = the subsystem (workflow, bv, br, skills, commands, memory, git, <your-component>).
3. Gotcha = what happens — be specific ("bv returns empty" not "bv is broken").
4. Impact = concrete consequence ("no graph context for review" not "bad").
5. Mitigation = actionable — something the next person can DO.

Remove entries once the underlying bug is fixed. Keep entries for ongoing design constraints.
