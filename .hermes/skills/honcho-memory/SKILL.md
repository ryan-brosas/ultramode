---
name: honcho-memory
description: Use when querying, writing, or designing Honcho-backed persistent memory for agents — covers efficient tool selection, durable fact boundaries, reasoning levels, and workspace/session/peer defaults.
---

# honcho-memory

## Purpose

Use Honcho as a persistent memory and reasoning layer. Honcho complements br, bv, repository files, and bead artifacts. It does not replace them as source of truth.

## When to Use

- A user's prior preferences, standing instructions, or communication style may affect the task.
- Prior cross-session project decisions may affect implementation.
- You need synthesized memory from previous sessions rather than raw file state.
- You discovered a durable fact future agents should remember.
- You are designing a direct Honcho SDK/MCP integration.

## When Not to Use

- The answer is in repository files, bead artifacts, or current tool output.
- The information is temporary task state, command output, a todo, or scratch context.
- The content is a secret, token, credential, or private key.
- The claim is speculative or unverified.

## Tool Decision Table

| Need | Tool | Rule |
|------|------|------|
| Find prior facts/messages | `honcho_search` | Use before synthesis when exact prior context matters. |
| Synthesize preferences/constraints | `honcho_chat` | Ask a specific question; choose the smallest sufficient reasoning level. |
| Persist durable memory | `honcho_remember` | Store one atomic, verified, durable fact. |

## Reasoning Levels

| Level | Use |
|-------|-----|
| `minimal` | Fast factual lookup. |
| `low` | Default preference/context synthesis. |
| `medium` | Ambiguous or multi-session synthesis. |
| `high` | Complex synthesis that can affect implementation. |
| `max` | Rare deep memory research. |

## Process

1. **Check authority first.** Repository files, bead artifacts, and observed tool output are authoritative.
2. **Search if prior context may matter.** Use `honcho_search` for exact memories or prior decisions.
3. **Synthesize only when needed.** Use `honcho_chat` with a specific query, e.g. "What durable implementation constraints has the user stated?"
4. **Apply minimally.** Use only the memory that changes the decision or response.
5. **Remember only durable facts.** Use `honcho_remember` after verification or explicit user preference.

## Good Queries

- "What durable implementation constraints has the user stated?"
- "What communication style does this user prefer?"
- "What prior decisions affect Honcho usage in this project?"
- "What recurring gotchas should guide this task?"

## Bad Queries

- "What do you know?"
- "What should I do?"
- "Remember current command output."
- "Remember this temporary plan."

## Direct Integration Defaults

If implementing Honcho SDK/MCP integration later:

- Use one shared workspace when tools/agents should share memory.
- Use one stable peer ID per real user or persistent entity.
- Scope sessions to repo, conversation, task run, channel/thread, or import source.
- Reuse sessions for low-volume trickle data so reasoning can batch enough context.
- Use per-run or per-day import sessions only for high-volume data.
- Set deterministic assistant/tool peers to `observe_me: false` when configurable.
- Enable `observe_others` only for perspective-taking or information-asymmetry use cases.
- Do not wait for Honcho queues to drain; queue status is observability, not synchronization.

## Persistence Rules

A fact is safe to remember only if it is:

1. Durable across future sessions.
2. Verified by the user, repo, or observed behavior.
3. Useful for future decisions.
4. Free of secrets and sensitive credentials.

Prefer compact, atomic facts:

- Good: "User prefers boring, maintainable code over speculative abstractions."
- Good: "Project treats br/bv artifacts as canonical workflow state."
- Bad: "Currently editing `.hermes/AGENTS.md`."
