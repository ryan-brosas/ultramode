---
purpose: Architecture decision records with rationale and confidence
updated: 2026-06-17
---

# Decisions: OMP Beads Template

Every architecture decision that affects the shape of the project goes here.
Use the table. Dates, rationale, and confidence are required.

## Decision Log

| # | Date | Decision | Rationale | Confidence |
|---|------|----------|-----------|------------|
| 1 | 2026-06 | Use br/bv for task tracking and graph intelligence | Graph-informed workflow is the template's core differentiator. Alternatives (linear, plain markdown) lack the graph query ability. | High |
| 2 | 2026-06 | Commands + skills only, no scripts | Every gap solvable through better prompts and skill knowledge. Scripts add maintenance burden, platform dependencies, and hidden logic. | High |
| 3 | 2026-06 | Bare command names (`/create`, `/plan`) | OMP resolves commands by directory. Prefix would be noise. | High |
| 4 | 2026-06 | `.omp/` as native project root | OMP loads from `.omp/`. Parallel `.pi/` config creates confusion. | High |
| 5 | 2026-06 | Ergonomic tooling lives in separate template repos | omp-makora-provider and friends are independent packages. The beads template stays pure workflow — install providers separately. | High |
| 6 | 2026-06 | Memory audit at /close: inserted as Phase 1.5 with per-file user approval, checklist-driven drift detection, and hard STOP on full rejection | Embedded in /close so it can't be skipped. Phase 1.5 preserves Phase 2-6 identity (no renumbering). Per-file approval prevents one bad proposal from rejecting all. Checklist over algorithm because memory files are freeform — agent reasoning handles semantic drift better than regex. Hard STOP on full rejection forces resolution of stale memory before close. | High |

## How to Add a Decision

1. Assign the next sequential `#`.
2. Date = month of decision (e.g. `2026-06`).
3. Decision = one sentence. Concrete, not abstract.
4. Rationale = what we rejected, what we accepted, why. Enough that someone 6 months later can follow.
5. Confidence = High (multiple sources confirmed), Medium (strong consensus but one uncertainty), Low (experiment, subject to change).

