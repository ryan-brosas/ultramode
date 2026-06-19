<!-- DENSITY: Minimum 200 lines. No upper bound — be thorough. <200 = incomplete (findings lack specificity, no severity ratings, recommendations are vague). This is an AI handoff: the review report must give the reviewer enough detail to act on every finding without re-reading the implementation. Every finding needs: agent source, severity, file:line, concrete issue, actionable recommendation. -->
# Review Report: {bead-id}

## Verdict

`{approved | changes-requested | blocked}` — {one-line justification}

**Ready for close:** {true | false}

## Review Summary

- Agents run: {N} ({which agents})
- Total raw findings: {N}
- High-confidence (≥80): {N}
- False positives filtered: {N}

## Findings

### #{N}: {title} (confidence: {0-100})

- **Agent:** {which review agent found this}
- **Severity:** {critical | high | medium | low}
- **File:** `{path}`#{line}
- **Issue:** {what's wrong — concrete, specific}
- **Recommendation:** {how to fix — actionable}

### #{N}: {title} (confidence: {0-100})

...

## Spec ↔ Code Adherence

- PRD requirement coverage: {N}/{M} requirements implemented
- Plan task coverage: {N}/{M} tasks completed
- Drift from plan: {None | description of deviations and why}

## Residual Risks

- {Risk not covered by verification — and why it's accepted or deferred}

## Summary

{2-3 sentences — what passed, what needs attention, whether this is safe to merge.}
