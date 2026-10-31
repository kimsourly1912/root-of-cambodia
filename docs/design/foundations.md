# Design foundations

**Status:** active; values come from [globals.css](../../apps/web/app/globals.css) and the shared components.

**Responsible role:** product/design owner (direction); technical maintainer (tokens).

**Last source verification:** 31 October 2026, branch `feat/home-page-ux`.

**Sources:** [apps/web/app/globals.css](../../apps/web/app/globals.css), [apps/web/components/typography.tsx](../../apps/web/components/typography.tsx), [apps/web/components/page-container.tsx](../../apps/web/components/page-container.tsx), [screen brief](screen-brief.md).

Visual direction (from the [screen brief](screen-brief.md)): light warm-neutral surfaces, white cards, charcoal text and a restrained deep green; useful spacing and a clear price/date hierarchy. Light mode only. There is no dark theme; do not add `dark:` classes.

## Color tokens

Defined once in `globals.css` as CSS variables and exposed to Tailwind (`bg-primary`, `text-muted-foreground`, …). Use these names only.

| Token | Value | Use for |
| --- | --- | --- |
| `background` / `foreground` | #f8f7f3 / #222b28 | Page background and body text |
| `card` / `card-foreground` | #fff / #222b28 | Cards, disclosures, alerts |
| `primary` / `primary-foreground` | #245743 / #fff | Main actions, links, the brand accent |
| `secondary` / `secondary-foreground` | #edf1eb / #274c3a | Badges, quiet surfaces, the preview banner |
| `muted` / `muted-foreground` | #f1f1ec / #626c65 | Supporting text (hints, metadata, counts) |
| `accent` / `accent-foreground` | #edf1eb / #274c3a | Hover background for outline and ghost buttons |
| `destructive` / `destructive-foreground` | #b42318 / #fff | Errors and destructive actions only |
| `border` / `input` | #dce1d9 / #c3cdc2 | Dividers and card borders / form control borders |
| `ring` | #32795a | Focus rings |
| `sidebar`, `sidebar-foreground`, `sidebar-accent`, `sidebar-border`, `sidebar-ring`… | Same values as `card`, `foreground`, `accent`, `border`, `ring` | The workspace sidebar only (shadcn Sidebar names) |

Opacity modifiers on tokens are fine (`border-destructive/40`, `hover:bg-primary/90`). Do not add a color outside the tokens; propose a new token in `globals.css` instead, in the same PR as its first use.

Meaning is never carried by color alone: errors also say what went wrong, and statuses are written in a `Badge`.

## Typography

Font stack: Arial for Latin text, then the bundled **Noto Sans Khmer** (400 and 600) for Khmer, then sans-serif. Body text is 16 px with line height 1.65. Inputs, selects, and textareas use 16 px text on coarse-pointer devices so iOS does not zoom on focus; fine-pointer devices use the compact shadcn `base-nova` text size.

| Role | Component / class | Size |
| --- | --- | --- |
| Landing hero | `PageTitle size="hero"` | `text-4xl`, `sm:text-5xl` |
| Page title (h1) | `PageTitle` | `text-3xl`, semibold, tight tracking |
| Section heading | `SectionTitle` | `text-xl`, semibold |
| Quiet heading, card list item | `SectionTitle size="sm"` | `text-base`, semibold |
| Body | default | `text-base` |
| Secondary text, form hints, messages | `text-sm` (with `text-muted-foreground` for hints) | 14 px |
| Metadata (revision, counts) | `text-xs text-muted-foreground` | 12 px |
| Eyebrow above a title | `text-sm text-primary` (often Khmer, with `lang="km"`) | 14 px |
| Money totals | `text-2xl font-semibold` | Keep totals visually dominant on review screens |

Weights: `font-semibold` for headings and totals, `font-medium` for labels, links and badges. Do not use `font-bold`.

## Spacing

Tailwind's 4 px scale. Use these steps so screens line up:

| Between | Class |
| --- | --- |
| A label and its control; a heading and its description | `space-y-2` |
| Fields in a form | `space-y-4` or `space-y-5` |
| Blocks inside a card or section | `space-y-4` |
| Sections of a page | `space-y-6` or `space-y-8` |
| Items in a grid of cards | `gap-4` or `gap-5` |
| Buttons in a row | `gap-3` (wrap with `flex flex-wrap`) |
| Card padding | `CardContent` defaults; `p-5` or `p-6` for custom surfaces |

Prefer `space-y-*` and `gap-*` on the parent over margins on children. Margins (`mt-*`, `mb-*`) are fine for one-off offsets.

## Layout

- **Page width:** `PageContainer` gives `max-w-6xl` with `px-5` (`sm:px-8`) side gutters. The area layouts (owner, bookings, review, stays) render it once; their pages render fragments or a `div`.
- **Two frames:** `app/(site)/layout.tsx` gives public and guest pages the notice, `SiteHeader` and footer. `app/(workspace)/layout.tsx` gives owner and reviewer pages `WorkspaceShell`: a 16 rem sidebar from `md` (768 px) up, a slide-in sheet on phones, and a top bar with the menu button and sign-out. URLs do not include the group names.
- **Readable width:** long text and single forms stay within `max-w-2xl` (forms) or `max-w-md` (auth cards, empty-state text).
- **Grids:** one column on phones, two from `sm:` or `md:`, three from `lg:` or `xl:` for photo grids.
- **Breakpoints:** mobile first. `sm` (640 px) and `lg` (1024 px) are the common steps; `md` and `xl` are rare.
- **Radius:** shadcn `base-nova` uses `rounded-lg` for controls and alerts, `rounded-xl` for cards and large surfaces, and pill rounding only for `Badge` and icon circles.
- **Elevation:** flat. Cards have a border, not a shadow; the sign-in card (`shadow-sm`) is the one exception.
- **Control sizing:** shadcn `base-nova` compact sizes are used with fine pointers (32 px default buttons and inputs); coarse-pointer devices retain at least 44 px control hit heights.

## Khmer and mixed text

- Put `lang="km"` on any element whose text is Khmer (names, eyebrows), so screen readers and line breaking use Khmer rules.
- Khmer names can be long and have no spaces: titles include `break-words`. Do not truncate names in owner screens.
- Show the Khmer name first where both exist, then the English name as `text-sm text-muted-foreground`.
- The document is currently `lang="en"` with Khmer marked inline. Switching the page language and full Khmer localization are open decision **D13**; do not change them without that decision.

## Images

Listing photos are processed JPEGs served through the media routes; use `StayPhoto` for guest views. Always give meaningful `alt` text (property and room name) or `alt=""` for decorative images. Keep aspect ratios stable (`aspect-[4/3]` style classes) so pages do not jump while loading.
