# $repo

Active project using Hermes beads workflow. br for tracking, bv for graph intelligence.

@memory/project/project.md
@memory/project/conventions.md

## Workflow

```
/brainstorm → /create → /plan → /ship → /verify → /review → /pr → /close
```

Read `.hermes/prompts/<phase>.md` before each phase. Use Hermes tools directly: terminal, read_file, write_file, patch. Templates in `.hermes/templates/`.

## Rules

- Never commit or push to main — feature branch only
- Never auto-merge PRs
- Use `--actor <profile>` on all br mutations
- Quality minimums are MANDATORY
- If nothing's worth doing, [SILENT]
