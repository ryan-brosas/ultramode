# OMP Workspace

> Neutral product workspace design system. Adapted from Open Design's token architecture.
> 9-section schema per the `awesome-claude-design` convention.
> Reference: `.omp/skills/design-system/tokens.css` for the canonical token values.

## Visual Theme & Atmosphere

Calm, competent, unobtrusive. A workspace for long sessions — warm paper tones that don't fatigue, chrome that recedes when you're working and surfaces when you need it. Think "well-lit study" not "dark mode hacker." Generous whitespace. One accent color per screen.

## Color Palette & Roles

- **Background:** `#faf9f7` (warm off-white paper) — app shell, empty states
- **Panel:** `#fdfcfa` (slightly brighter warm white) — cards, dialogs, elevated surfaces
- **Subtle:** `#f4f5f7` (cool-leaning neutral) — hover states, striped rows
- **Muted:** `#eef1f5` (slightly stronger neutral) — pressed states, disabled fills
- **Foreground:** `#1a1916` (near-black, slightly warm) — body text
- **Foreground strong:** `#0d0c0a` — headings, emphasis
- **Muted text:** `#74716b` — secondary text, timestamps, metadata
- **Soft text:** `#989590` — placeholders, disabled text
- **Faint text:** `#b3b0a8` — decorative, non-essential
- **Accent (primary):** `#c96442` (terracotta) — primary CTAs, links, focus rings
- **Accent hover:** `#b45a3b` — hover/pressed primary
- **Accent soft:** `#f5d8cb` — accent background tints
- **Accent tint:** `#fbeee5` — very subtle accent wash
- **Selected:** `#2563eb` (blue) — "this option is active" (separate from accent so selected state and primary CTA can coexist)
- **Selected soft:** `rgba(37, 99, 235, 0.16)` — focus rings, active fills
- **Border:** `#e1e5eb` — default borders
- **Border strong:** `#c9d0da` — hover borders, emphasis
- **Border soft:** `#edf0f4` — subtle dividers

Never use pure black (`#000`) or pure white (`#fff`) anywhere user-facing.

## Typography Rules

- **UI text:** system font stack — `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei UI', 'Noto Sans', Roboto, 'Helvetica Neue', Arial, sans-serif`
- **Prose/reading:** `'Source Serif Pro', 'Source Serif 4', 'Iowan Old Style', 'Apple Garamond', Georgia, 'Times New Roman', serif`
- **Code:** `ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace`
- **Scale (px):** 11 · 12 · 13 · 14 · 15 · 16 · 18 · 20 · 24 · 28 · 32 · 40 · 48 · 56
- **UI body:** 13px default, 15px for prose/reading blocks
- **Line-height:** 1.5 for UI, 1.75 for prose, 1.65 for code
- **Letter-spacing:** -0.01em for headings ≥ 24px; default elsewhere
- **Font weight:** 400 body, 500 emphasis, 600 headings

## Component Stylings

- **Buttons:** 5 variants — `default` (panel bg, border), `primary` (accent fill, white label), `primary-ghost` (panel bg, accent border/label), `ghost` (transparent bg, border), `subtle` (subtle bg, no border). All: 6px radius, 6px 12px padding, 13px font. Focus-visible: 2px accent outline, 2px offset.
- **Inputs/Textareas:** 1px border, 6px radius, 7px 10px padding, 13px font. Focus: border → selected, 3px selected-soft ring. Placeholder: faint text color.
- **Select:** Native chrome stripped. Custom chevron SVG (theme-aware). Same padding/radius as inputs.
- **Cards/Dialogs:** Panel background, 1px border, 8px radius, 16-24px internal padding. Shadow only on elevation (not default).
- **Links:** Accent color, 1px underline at 40% accent opacity. Hover: background tint, no underline.
- **Code blocks:** Subtle header bar, muted body bg, 13px mono, 1.65 line-height.

## Layout Principles

- Max content width: 1200px. Generous horizontal padding (24-32px at desktop).
- Vertical rhythm: 8px base grid. Section spacing: 32px default, 48px major, 16px minor.
- Sidebar/content split: 240-280px sidebar, fluid content.
- Dense data (tables, logs): tighter spacing allowed (4-8px).
- One accent element per screen. If two things compete for terracotta, one of them is wrong.

## Depth & Elevation

Minimal. Three elevation levels:

- **Flat (0):** everything by default — no shadow
- **Raised (1):** cards on hover, dropdown menus — `0 1px 2px rgba(28,27,26,0.05), 0 1px 3px rgba(28,27,26,0.04)`
- **Overlay (2):** modals, dialogs — `0 6px 24px rgba(28,27,26,0.07), 0 2px 6px rgba(28,27,26,0.04)`
- **Sheet (3):** slide-overs, large overlays — `0 24px 60px rgba(28,27,26,0.16), 0 8px 16px rgba(28,27,26,0.07)`

No shadows on inputs. No shadows on page chrome. No glassmorphism, no neumorphism.

## Do's and Don'ts

- ✅ Let whitespace breathe. A short heading on generous padding is correct.
- ✅ Use the radius scale (`4, 6, 8, 10, 12, 999px`). Never invent a 7px or 9px radius.
- ✅ Use the easing curve (`cubic-bezier(0.23, 1, 0.32, 1)`) for all UI transitions. Never `ease-in`.
- ✅ Enter ~200ms, exit ~140ms. Exit reads as decisive.
- ✅ Keep conditionally-visible elements mounted; toggle CSS classes. React unmounts skip exit transitions.
- ✅ Prefer CSS Modules colocated with components over global stylesheets.
- ❌ No gradients in UI chrome.
- ❌ No emojis in product copy (UI labels, headings, status text).
- ❌ No border-radius above 24px (except `--radius-pill` for fully-rounded badges/avatars).
- ❌ No `transform: scale(0)`. Start from `scale(0.9)` minimum with `opacity: 0`.
- ❌ No pure black or pure white.

## Responsive Behavior

- **Desktop ≥ 1024px:** full layout, 24-32px page padding, sidebars visible
- **Tablet 640–1023px:** collapsible sidebar, 20px page padding, stacked where needed
- **Phone < 640px:** single column, 16px page padding, all padding -25%

## Agent Prompt Guide

When generating UI against this design system:

- This is a **developer tooling product** — prioritize information density over marketing flair. Beautiful means clear, not decorative.
- Lead with typography and spacing; chrome (borders, shadows) is subtractive.
- Color tokens are non-negotiable. Do not invent new hex values. If a request needs a color outside this palette, produce a warning and use the closest existing token.
- The `--selected` blue and `--accent` terracotta serve different purposes. Selected = "this is active." Accent = "click this to act." They can coexist on the same screen.
- Default to the light theme. Dark theme is a mirror of every token — never approximate it.
- Code blocks always use the mono stack at 13px/1.65. Never style code as prose.