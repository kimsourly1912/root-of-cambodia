# UI change playbook

**Status:** active task procedure; does not grant authorization.

**Responsible role:** maintainer (responsibility, not an assigned person).

**Last source verification:** 31 October 2026, branch `feat/home-page-ux`.

**Sources:** [UI standard](../design/ui-standard.md), [component catalog](../design/components.md), [UX patterns](../design/ux-patterns.md), [content](../design/content.md), [tests/tooling/ui-standard.test.ts](../../tests/tooling/ui-standard.test.ts), [tests/e2e/](../../tests/e2e/).

## Use when

Building a new screen, changing how an existing screen looks or behaves, or adding a UI component. For the business logic behind a screen, also follow the [feature slice](feature-slice.md) playbook.

## Steps

1. **Read** the [UI standard](../design/ui-standard.md) and find every element you need in the [catalog](../design/components.md). Check the [screen brief](../design/screen-brief.md) for what the screen may promise.
2. **Missing component?** Add it first ([adding a component](../design/ui-standard.md#adding-a-component)), in the same PR, with a catalog row.
3. **Place the code:** the route in `apps/web/app/` stays thin; UI goes in `apps/web/features/<feature>/components/`; shared pieces in `apps/web/components/` (see [feature structure](../architecture/feature-structure.md)).
4. **Build the page structure** from [UX patterns](../design/ux-patterns.md#page-structure): back link, `PageTitle`, intro, actions, sections.
5. **Cover every state** in the [state table](../design/ux-patterns.md#every-screen-handles-these-states): loading, empty, error, saving, saved, stale, uncertain, signed out. Add `loading.tsx`, `error.tsx` and `not-found.tsx` for a new route area.
6. **Write the copy** with the [content](../design/content.md) terms and message patterns.
7. **Check accessibility** against the [baseline](../design/ui-standard.md#accessibility-baseline).
8. **Test.** Extend the journey in [tests/e2e](../../tests/e2e/) using roles and labels (`getByRole`, `getByLabel`), never CSS classes. Include the phone project and a no-horizontal-overflow check.
9. **Look at it** with `pnpm dev` at about 1440 px and 390 px wide, with long Khmer names and every state you added.

## Checks

~~~sh
pnpm exec vitest run --project tooling          # UI standard + feature boundaries
pnpm --filter @root-of-cambodia/web run typecheck
pnpm build                                      # Next.js compile (works on Windows)
pnpm build:worker && pnpm test:browser          # e2e; Linux/CI or Windows Developer Mode
~~~

## Done when

- The tooling test passes with no new exemptions.
- No hand-styled native markup, palette colors or inline styles were added.
- Every state renders and has wording from the content guide.
- e2e selectors use roles and labels, and desktop and phone pass in CI.
- New components are in the catalog.

## Pitfalls seen in this repository

- **Changing an element's role breaks e2e tests you cannot run locally.** A custom checkbox widget may be a `button` with `role="checkbox"`; this project's checkbox is a native `input`. Keep native elements where forms rely on them.
- **Controls clicked before hydration** submitted native forms (PR #28, PR #34). Gate on `hydrated`.
- **A link styled as a button by hand** drifted from `Button` (the stay page's "Request to book", fixed in the UI standard migration). Use `buttonVariants` on the `Link`; the configured Base UI `Button` is for button actions, not links.
