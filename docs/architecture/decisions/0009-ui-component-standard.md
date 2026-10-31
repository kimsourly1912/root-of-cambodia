# ADR 0009: UI component standard

**Status:** accepted and implemented; current component setup verified 31 October 2026 (branch `feat/home-page-ux`).

**Responsible role:** project owner (acceptance); product/design owner (direction); technical maintainer (implementation).

**Last source verification:** 31 October 2026, branch `feat/home-page-ux`.

**Sources:** [UI standard](../../design/ui-standard.md), [component catalog](../../design/components.md), [tests/tooling/ui-standard.test.ts](../../../tests/tooling/ui-standard.test.ts), [screen brief](../../design/screen-brief.md).

## Context

The web app had five shadcn primitives (Button, Card, Input, Label, Textarea), and every button already used `Button`. Patterns without a shared component were hand-styled on each screen, and agents copied whichever version they saw:

- 40 `h1` headings in 6 different styles, and 42 `h2` in 8;
- links styled with 9 different class strings;
- 22 `role="alert"` and 18 `role="status"` messages with at least 5 styles;
- 7 copies of the same pill class string;
- 7 native checkboxes, each styled separately, and 1 native select;
- 5 different `main` containers;
- 4 hand-styled `details`;
- 5 empty states in 5 styles;
- 32 of 38 cards overriding the default shadow.

Colors were already token-based. There was no written UI standard and no automated check.

## Decision

1. **Component-first rule:** screens compose a `components/ui` primitive, then a shared `components/` component, then a feature component. Native controls and hand-styled patterns are not written in screens ([UI standard](../../design/ui-standard.md)).
2. **New primitives:**
   - `Badge`, `Alert`, `Checkbox`/`CheckboxField`, `NativeSelect`.
   - `Card` becomes flat by default.
3. **New shared components:**
   - `PageContainer`;
   - `PageTitle` and `SectionTitle`;
   - `TextLink` and `textLinkClass`;
   - `StatusMessage` and `LoadingState`;
   - `EmptyState`;
   - `Disclosure`.
4. **Native where behavior matters:** `Checkbox`, `NativeSelect` and `Disclosure` wrap native elements instead of custom widgets. This keeps `required`, form submission, server-rendered `disabled` before hydration, and the role-based e2e selectors (`checkbox` is an `input`, not a `button`).
5. **Documentation:**
   - the [UI standard](../../design/ui-standard.md) and [component catalog](../../design/components.md);
   - [foundations](../../design/foundations.md), [UX patterns](../../design/ux-patterns.md) and [content](../../design/content.md);
   - the [UI change playbook](../../playbooks/ui-change.md).
6. **Enforcement:** a tooling test refuses hand-styled native markup, classed headings, hand-styled links, role messages on plain paragraphs, hand-made pills, palette or arbitrary colors and inline styles in `app/` and `features/`.
7. **Visual direction unchanged:** the existing warm-neutral, deep-green, light-only look is documented, not redesigned.
8. **Current shadcn implementation:** `components.json` selects `base-nova`, the current Base UI-based shadcn style. Generated primitives are adapted to the project’s theme, 44 px touch targets and native form behavior; links styled as buttons use `buttonVariants` so they retain link semantics.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Docs only, no migration | Agents copy existing code; the old variants would keep spreading |
| Full shadcn set now (Checkbox, Select, Dialog, Tabs…) | Custom widgets can change element roles and form behavior that the e2e tests and hydration-gated flows rely on; unused components would add dependencies for nothing |
| ESLint with JSX rules | New dependencies and configuration; the regex tooling test covers the patterns with what the repo already has |
| A separate design-system package | Heavy for one app; contradicts the single-library choice in [ADR 0001](0001-modular-monolith.md) |

## Consequences

- One look per pattern, and the test names the component to use when someone strays.
- Components and their runtime dependencies are added only when needed. The shadcn CLI is run with `pnpm dlx` and is not an application dependency.
- **Small visual changes from unifying:**
  - some links gain an underline or medium weight;
  - a few headings change size by one step;
  - error blocks become bordered alerts;
  - empty states share one dashed style;
  - the remaining 6 shadowed cards become flat;
  - the stays and testing pages use the standard page padding.
- Element roles, accessible names and heading levels are unchanged. Built-Worker and browser suites must pass in CI, since the Windows checkout cannot build the Worker.

## Approval record

On 31 October 2026 the owner reviewed the proposed doc set and decisions (new dependencies when needed, docs then staged migration, keep the visual direction) and replied: "ok i all agree you can decide and do it all the way that make this app clean, consistent and help future ai agent can work with ease". This accepts the standard, the migration and the enforcement. It does not authorize merging or deployment.
