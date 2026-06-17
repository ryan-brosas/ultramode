# Animation discipline craft rules

Universal rules for when motion earns its place in a UI and what numbers
constrain it. The active `DESIGN.md` decides brand-specific motion
personality; this file decides whether motion should run at all and at
what duration, easing, and accessibility floor.

> Adapted from Open Design's `craft/animation-discipline.md`.
> Grounded in: Tversky/Morrison/Bétrancourt 2002 (IJHCS), Heer &
> Robertson TVCG 2007, Material 3 motion tokens, WCAG 2.2.2 + 2.3.3.

## When motion earns its place

Animate when the user is moving through **space, time, or state** —
navigation, container expansion, progress feedback, gesture
follow-through. Don't animate to teach, decorate, signal "premium",
or fill silence.

The canonical project easing curve is `var(--ease-out)` =
`cubic-bezier(0.23, 1, 0.32, 1)`. This is the single curve for all UI
transitions unless a spring is called for.

## Duration thresholds

The cross-design-system convergence is **150 ms** — Material 3 `short3`,
IBM Carbon `moderate-01`, Shopify Polaris `150`, Tailwind default.

| Duration | Use |
|---|---|
| 50–100 ms | Instant feedback (button press, toggle commit, hover) |
| 150 ms | Default for state-confirmation |
| 200–300 ms | Entering UI (modals, sheets, dropdowns) |
| 300–500 ms | Cross-screen transitions, container morphs |
| > 500 ms | Reserved for cross-screen, staged, or platform-native transitions |

Non-navigation microinteractions — hover, press, toggle, validation,
chip selection, row expansion — should stay under 500 ms. Past that the
user notices the motion as motion and waits on the UI rather than
working through it.

Two qualifications: frequent animations (a hover effect seen 50 times
per session) need to stay ≤200 ms; mobile animations should run 20–30%
shorter than desktop equivalents because travel distances are shorter.

## Curve vs spring

Use a curve for opacity, color, and any property that changes value
between two known points. Use a spring for position, scale, rotation,
and gesture-driven motion — anything that should feel physical.

## Reduced motion

Every animation that translates, scales, rotates, or parallaxes must
respect `@media (prefers-reduced-motion: reduce)`.

Working rule: strip motion-on-an-axis (translate, scale, rotate,
parallax). Keep opacity/color crossfades as substitutes when a state
change still needs to be conveyed.

WCAG calibration: 2.2.2 (Pause/Stop/Hide) is Level A — the legal floor.
2.3.3 (Animation from Interactions) is AAA — vestibular protection
beyond the floor. Building for vestibular users is a craft commitment,
not a WCAG mandate.

## Flashing limits

WCAG 2.3.1 (Level A): no more than three flashes within any one-second
period, or the flashing area stays below the general and red flash
thresholds. WCAG 2.3.2 (AAA): forbids flashing more than three times
within any one-second period, regardless of area or brightness.

For gamified UI, onboarding celebrations, sparkles, confetti, level-up
bursts, and shimmer: avoid rapid flashing unless tested against the
thresholds, and prefer one-shot animations over loops.

## Repeated and ambient motion

- Cap iteration count: carousels at 3-5 cycles then pause; skeleton
  shimmer until content lands, never indefinitely.
- WCAG 2.2.2 (Level A) requires a pause control for any motion running
  longer than 5 seconds — moving, blinking, or scrolling content.
- Cancel ambient motion on route change.
- Reward animations are one-shot. Confetti, sparkles, level-up bursts
  fire once and dismiss; no looping timer.
- Spinners must not run indefinitely. Escalate to progress/cancel
  states and stop animation at 60 s.

## Common mistakes

- Animating from `transform: scale(0)`. Floor is `scale(0.9)`.
- `ease-in` on UI elements — feels sluggish, never use it.
- More than 500 ms on any non-cross-screen transition.
- Animation as the only signal of state change. Reduced-motion users
  miss it; always pair with a static affordance (color, position, label).
- Ignoring `prefers-reduced-motion` on transform-based animations —
  the highest-cost vestibular triggers.
- Curve-based animation on a `transform: scale()` that should feel
  physical. Use a spring.
- Hero choreography in productivity tools. Motion budget belongs inside
  the product on functional micro-feedback, not on landing-page sequences.
