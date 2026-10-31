# UI standard

**Status:** active standard under accepted [ADR 0009](../architecture/decisions/0009-ui-component-standard.md); enforced by [tests/tooling/ui-standard.test.ts](../../tests/tooling/ui-standard.test.ts).

**Responsible role:** product/design owner (direction); technical maintainer (components and checks).

**Last source verification:** 31 October 2026, branch `feat/home-page-ux`.

**Sources:** [apps/web/components/](../../apps/web/components/), [apps/web/app/globals.css](../../apps/web/app/globals.css), [apps/web/components.json](../../apps/web/components.json), [tests/tooling/ui-standard.test.ts](../../tests/tooling/ui-standard.test.ts), [shadcn TanStack Form guide](https://ui.shadcn.com/docs/forms/tanstack-form).

This is the entry point for any UI work. It says **which building block to use and where code goes**. Details live in four companion pages:

| Page | Answers |
| --- | --- |
| [Component catalog](components.md) | "I need X" → which component, import path and variant |
| [Foundations](foundations.md) | Colors, type scale, spacing, layout widths, breakpoints, Khmer text |
| [UX patterns](ux-patterns.md) | How screens behave: forms, states, retries, confirmations, money and dates |
| [Content](content.md) | How the UI talks: labels, messages, terms |

Product rules (what a screen may promise) stay in [scope](../product/scope.md) and the [screen brief](screen-brief.md).

## Choose a building block in this order

1. **A primitive in `apps/web/components/ui/`** (shadcn `base-nova` style, using Base UI where an interactive primitive is needed): Button, Card, Input, Label, Textarea, Checkbox, NativeSelect, Badge, Alert, Field, InputGroup, Separator, and the workspace Sidebar with its Sheet, Tooltip and Skeleton parts.
2. **A shared app component in `apps/web/components/`**: PageContainer, PageTitle, SectionTitle, TextLink, StatusMessage, LoadingState, LinkPending, EmptyState, Disclosure, SignOut, and the layout-only SiteHeader, WorkspaceShell and PreviewNotice.
3. **A feature component in `apps/web/features/<feature>/components/`**, composed from 1 and 2.
4. **Nothing fits?** Add a primitive or shared component first (see [adding a component](#adding-a-component)), then use it. Never hand-style a native element in a screen as a shortcut.

## Rules

1. **Screens compose components; they do not style native controls.** In `apps/web/app/` and `apps/web/features/` there is no `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`, `<main>` or `<details>`. Use the component the [catalog](components.md) names.
2. **Headings use `PageTitle` (one `h1` per page) and `SectionTitle`.** Keep the real heading level with `as="h3"`; change prominence with `size`. A bare `<h2>` inside `CardTitle` is fine because the card styles it.
3. **Links use `TextLink`.** A link that looks like a button uses `<Link className={buttonVariants(...)} …>…</Link>`; do not render a link through `Button`, because Base UI's button semantics override the link role. A native `<a>` that must force a full page load uses `className={cn(textLinkClass, …)}`.
4. **Feedback uses `StatusMessage`, `Alert`, `LoadingState` or `EmptyState`.** Never a hand-colored `<p role="alert">`.
5. **Colors come from theme tokens** (`primary`, `secondary`, `muted`, `destructive`, `border`…; see [foundations](foundations.md#color-tokens)). No palette classes such as `text-red-600`, no arbitrary values such as `bg-[#245743]`, and no inline `style`.
6. **`className` on a shared component is for layout only:** margins, width, `block`, grid placement, text alignment. Look-and-feel belongs in the component's variants. If you need a new look, add a variant.
7. **Keep semantics stable.** Changing a component must not change an element's role, accessible name or heading level. The e2e tests find elements by role and label (`getByRole`, `getByLabel`), not by class.
8. **Interactive controls are disabled until hydration** wherever a server-rendered control could submit before React attaches its handler (see [UX patterns](ux-patterns.md#hydration-and-double-submits)).
9. **Mobile first.** Every screen works at 390 px wide with no horizontal scroll; widen with `sm:`, `md:`, `lg:`.
10. **Use the selected UI stack.** Add shadcn components only when first needed; the project uses the `base-nova` style, Base UI primitives where appropriate, and TanStack React Form for interactive forms. Anything outside this setup needs a decision.

## Where UI code goes

| Code | Location |
| --- | --- |
| shadcn-style primitive (no app knowledge) | `apps/web/components/ui/<name>.tsx` |
| App component used by 2+ features or by layouts | `apps/web/components/<name>.tsx` |
| Component used by one feature | `apps/web/features/<feature>/components/<name>.tsx` |
| Pure display helper (money, time, status words) | `apps/web/lib/` when shared, else the feature's `lib/` |
| Design tokens | `apps/web/app/globals.css` only |

This follows the [feature structure](../architecture/feature-structure.md): build inside the feature first; promote to `components/` when a second feature needs it.

## Adding a component

1. Check the [catalog](components.md) and its "planned" table first.
2. **shadcn component:** from `apps/web`, run `pnpm dlx shadcn@latest add <name>`; it reads [components.json](../../apps/web/components.json). The CLI is a one-off development tool, not an application dependency. Review generated code and dependency changes; adapt them to the project's tokens, accessible names, 44 px touch targets, native form requirements and the current Base UI APIs. Keep components in `components/ui/`. Shared state variants needed by the generated components are defined locally in [globals.css](../../apps/web/app/globals.css); preserve them and inline any newly required variants instead of adding an unresolved `shadcn/tailwind.css` import.
3. **Prefer native elements where behavior matters.** This project's `Checkbox` and `NativeSelect` wrap native inputs so `required`, form submission and server-rendered `disabled` keep working before hydration. Use the configured Base UI primitive only when a native element cannot do the job (for example a dialog or searchable combobox).
4. **App component:** add it to `components/` with a short header comment saying when to use it, built from primitives and tokens only.
5. Add a row to the [catalog](components.md), and a rule to [ui-standard.test.ts](../../tests/tooling/ui-standard.test.ts) if it replaces a native pattern.
6. Verify with the [UI change playbook](../playbooks/ui-change.md).

## Accessibility baseline

Every screen meets these; the e2e tests rely on most of them.

- One `PageContainer` (the `main` landmark, target of the skip link) and one `PageTitle` per page; headings do not skip levels.
- Every control has a visible `Label` (or `CheckboxField` text); placeholder text is not a label.
- Errors use `StatusMessage tone="error"` or `Alert role="alert"` next to the control or form; a field error is referenced with `aria-describedby` when it belongs to one input.
- Status is shown in words, not color alone (`Badge` text, `StatusMessage` text).
- Focus is visible (tokens `ring`, the global `a:focus-visible` outline); never remove outlines.
- Touch targets: on touch devices (`pointer: coarse`), buttons, text inputs and selects have a 44 px minimum hit height; icon buttons have a 44 px minimum width; `CheckboxField` gives native checkboxes a 44 px minimum row. On fine-pointer devices, shadcn `base-nova` compact sizes apply.
- Text that may be Khmer carries `lang="km"` (see [foundations](foundations.md#khmer-and-mixed-text)); long names use `break-words`, which `PageTitle` and `SectionTitle` already include.
- Images have meaningful `alt` text, or `alt=""` when decorative.

## Enforcement

[tests/tooling/ui-standard.test.ts](../../tests/tooling/ui-standard.test.ts) runs in `pnpm test` and `pnpm exec vitest run --project tooling`. It scans every `.tsx` file in `apps/web/app` and `apps/web/features` and fails, naming the component to use, on:

- native `button`, `input`, `select`, `textarea`, `table`, `main` and `details` elements;
- headings with a `className`;
- links styled with `text-primary` or `underline`;
- a `role="alert"` or `role="status"` on a plain paragraph;
- hand-made pills;
- palette or arbitrary colors, and inline styles.

`apps/web/components/` is not scanned, because the primitives live there. A table of deliberate violations in the same test proves each rule works.
