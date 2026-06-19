---
name: design-system
description: Use when generating UI, choosing colors/fonts/spacing, implementing components, or reviewing visual output. Loads the brand contract from DESIGN.md. Ensures every visual value references a token, never a hardcoded hex.
---

# Design System

Brand contract for generating UI that looks intentional, not AI-generated. Adapted from [Open Design](https://github.com/nexu-io/open-design)'s neutral product workspace (Apache 2.0).

## When to Use

- Generating any UI (pages, components, dialogs, forms, dashboards)
- Choosing colors, fonts, spacing, shadows, or radii
- Implementing a new component
- Reviewing visual output
- An agent asks "what color should this button be?"

## When NOT to Use

- Backend logic, API design, database schema — these don't render pixels
- When the task explicitly calls for a different design system (user provides their own brand)

## The Process

### 1. Load the brand contract

Read `DESIGN.md` first. It establishes the palette, typography, components, layout, elevation, do's/don'ts, and responsive behavior.

### 2. Reference tokens, never hardcode

Every visual value must be a CSS custom property. Never output a raw hex or px radius:

| Instead of | Use |
|---|---|
| `#faf9f7` | `var(--bg)` |
| `#fdfcfa` | `var(--bg-panel)` |
| `#1a1916` | `var(--text)` |
| `#c96442` | `var(--accent)` |
| `#2563eb` | `var(--selected)` |
| `#e1e5eb` | `var(--border)` |
| `6px` | `var(--radius-sm)` |
| `8px` | `var(--radius)` |
| `200ms ease` | `var(--dur-enter) var(--ease-out)` |

The full token system is defined in `DESIGN.md` § Color Palette & Roles. Load it when you need the complete mapping.

### 3. Apply the rules

| Rule | Source |
|---|---|
| 5 button variants: default, primary, primary-ghost, ghost, subtle | DESIGN.md § Component Stylings |
| Focus ring on inputs uses `--selected` (blue), buttons use `--accent` (terracotta) | DESIGN.md § Component Stylings |
| Only 6 allowed radii: 4, 6, 8, 10, 12, 999px | DESIGN.md § Do's and Don'ts |
| Single easing curve: `cubic-bezier(0.23, 1, 0.32, 1)`. Never `ease-in` | DESIGN.md § Do's and Don'ts |
| Enter ~200ms, exit ~140ms | DESIGN.md § Do's and Don'ts |
| Never animate from `scale(0)`. Floor is `scale(0.9)` | DESIGN.md § Do's and Don'ts |
| Keep elements mounted, toggle CSS classes. Unmounts skip exit transitions | DESIGN.md § Do's and Don'ts |
| Max 2 accent uses per screen | DESIGN.md § Layout Principles |
| ALL CAPS always `letter-spacing ≥ 0.06em` | DESIGN.md § Typography Rules |
| No pure black or pure white anywhere | DESIGN.md § Color Palette & Roles |
| No emoji as UI icons | DESIGN.md § Do's and Don'ts |
| Light mode default, dark via `[data-theme="dark"]` | DESIGN.md § Responsive Behavior |

### 4. Every surface needs all 5 states

Before considering any interactive UI complete, verify: loading, empty, error, populated, and edge states all render. The most common AI-design failure is shipping only the populated state.

| State | Must contain |
|---|---|
| Loading | Skeleton/spinner + 15s "taking longer" fallback |
| Empty | Headline + explanation + primary CTA |
| Error | Plain-language cause + recovery action + preserved input |
| Populated | The state you designed for |
| Edge | Extreme volume, long strings, missing fields, RTL |

### 5. Verify before completing

- [ ] Every visual value is `var(--token)`, not a hardcoded hex or px
- [ ] Radius is one of: 4, 6, 8, 10, 12, 999px
- [ ] ALL CAPS has `letter-spacing ≥ 0.06em`
- [ ] `--accent` used at most 2 times per screen
- [ ] No Tailwind indigo (`#6366f1`, `#4f46e5`) — use `var(--accent)`
- [ ] No trust gradients (purple→blue, blue→cyan)
- [ ] No emoji as UI icons
- [ ] All 5 states covered
- [ ] Focus visible on all interactive elements
- [ ] Touch targets ≥24px (AA minimum)
- [ ] Animation respects `prefers-reduced-motion`
- [ ] No `ease-in` anywhere
- [ ] No `scale(0)` — minimum `scale(0.9)`

## Attribution

Adapted from [nexu-io/open-design](https://github.com/nexu-io/open-design) (Apache 2.0). DESIGN.md schema from [awesome-claude-design](https://github.com/VoltAgent/awesome-claude-design).

## Craft Rules (Tier 1)

These rules are Tier 1 material (always in context per conventions.md) but live here
to keep conventions.md within its ≤4KB target. They were migrated from conventions.md
on 2026-06-17 during br-hermes-backbone-skill-m6y.

### Animation

- **Easing:** `cubic-bezier(0.23, 1, 0.32, 1)` is the single canonical curve for all UI transitions. Built-in `ease` is too weak; `ease-in` is forbidden for UI elements (feels sluggish).
- **Asymmetric durations:** enter ~200ms, exit ~140ms. Exit reads as decisive because the user has already chosen to dismiss.
- **Accordion expand/collapse:** `grid-template-rows: 0fr → 1fr` (modern auto-height pattern). Pair with opacity fade and the canonical easing. Reuse `.accordion-collapsible` + `.accordion-collapsible-inner`.
- **Scale floor:** Never animate from `transform: scale(0)`. Start from `scale(0.9)` or higher with `opacity: 0`.
- **Mount strategy:** Keep conditionally-visible elements mounted; toggle a CSS class. React unmounts skip the exit transition entirely.
- **Micro-feedback:** 120ms for hover/focus transitions (the `--dur-quick` token).

### Components

- **Buttons:** 5 variants — `default`, `primary`, `primary-ghost`, `ghost`, `subtle`. No new variants without a documented need.
- **Focus rings:** Use `--selected` (blue) + `--selected-soft` ring on inputs/selects. Use `--accent` (terracotta) for button focus-visible outlines. This separation lets a focused input and a primary CTA coexist without competing.

### Theme

- **Light default.** Dark via `[data-theme="dark"]` on `<html>`. System mode via `@media (prefers-color-scheme: dark)` when no explicit theme attribute.
- **Every token has a dark counterpart.** Never approximate dark values — each is chosen for perceptual equivalence.

### Icons

- **Icon set:** Use a single consistent icon library. Prefer 1.6–1.8px-stroke monoline SVG with `currentColor` so icons inherit text color.
- **Icon-only buttons:** Always include an `aria-label`. Pair with `.sr-only` text when the icon's meaning isn't universally obvious.
- **Never use emoji as UI icons.** Emoji render differently across platforms, lack `currentColor` inheritance, and read as unpolished. Reserve emoji for user-generated content only.
- **Icon sizing:** 16px for inline with body text, 20px for standalone UI (toolbar buttons, nav items), 24px for large controls.
- **Decorative icons:** `aria-hidden="true" focusable="false"` on SVGs that repeat adjacent text labels.
