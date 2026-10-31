# Component catalog

**Status:** active; every component listed as available exists in `apps/web/components/`.

**Responsible role:** technical maintainer (responsibility, not an assigned person).

**Last source verification:** 31 October 2026, branch `feat/home-page-ux`.

**Sources:** [apps/web/components/ui/](../../apps/web/components/ui/), [apps/web/components/](../../apps/web/components/), [UI standard](ui-standard.md).

Look up what you need here before writing markup. Rules for choosing and adding components are in the [UI standard](ui-standard.md).

## I need…

| I need | Use | Import from |
| --- | --- | --- |
| State and submit an interactive form | TanStack React Form: `useForm`, `form.Field` and `form.handleSubmit()`; keep native GET search/filter forms for URL navigation | `@tanstack/react-form` |
| Compose a labeled form control with help or validation | `<Field>` + `<FieldLabel>` + control + optional `<FieldDescription>` / `<FieldError>`, grouped with `<FieldGroup>` | `@/components/ui/field` |
| Add a control beside an input (for example, show/hide password) | `<InputGroup>` + `<InputGroupInput>` + `<InputGroupAddon>` / `<InputGroupButton>` | `@/components/ui/input-group` |
| The page's main area | `<PageContainer>` (`variant`: `default`, `focused` for single-task pages such as sign-in, `landing`) | `@/components/page-container` |
| The page heading (one per page) | `<PageTitle>` (`size="hero"` only on the landing page) | `@/components/typography` |
| A section heading | `<SectionTitle>` (`as="h3"` for nested sections, `size="sm"` for a quieter heading) | `@/components/typography` |
| A heading inside a card | `<CardTitle><h2>…</h2></CardTitle>` | `@/components/ui/card` |
| An action | `<Button>` (`variant`: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`; `size`: `default`, `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`) | `@/components/ui/button` |
| A link that looks like a button | `<Link className={buttonVariants(...)} href=…>…</Link>` | `@/components/ui/button`, `next/link` |
| A text link | `<TextLink href=…>` (`className` for layout: `block`, margins, `text-sm`) | `@/components/text-link` |
| A native `<a>` forcing a full page load | `<a className={cn(textLinkClass, "block")} href=…>` | `@/components/text-link`, `@/lib/utils` |
| A grouped surface | `<Card>`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` (flat by default) | `@/components/ui/card` |
| A text field | `<Label htmlFor>` + `<Input id>` | `@/components/ui/label`, `@/components/ui/input` |
| A multi-line field | `<Label>` + `<Textarea>` | `@/components/ui/textarea` |
| A choice from a short list | `<Label>` + `<NativeSelect>` with `<option>`s | `@/components/ui/native-select` |
| A checkbox with its text | `<CheckboxField required …>text</CheckboxField>` (takes all input props) | `@/components/ui/checkbox` |
| A bare checkbox (custom layout) | `<Checkbox>` inside your own `<label>` | `@/components/ui/checkbox` |
| A group of related fields | `<fieldset>` + `<legend>` (native; style the legend like `SectionTitle size="sm"`) | — |
| A one-line error after an action | `<StatusMessage tone="error">` (renders `role="alert"`) | `@/components/status-message` |
| A one-line success or progress note | `<StatusMessage tone="success">` / `tone="info"` (renders `role="status"`) | `@/components/status-message` |
| A boxed notice with more content (retry buttons, lists) | `<Alert role="alert" variant="destructive">` / `variant="info"` / default | `@/components/ui/alert` |
| A route loading screen (`loading.tsx`) | `<LoadingState>Loading …</LoadingState>` | `@/components/status-message` |
| Show that a navigation link's page is loading | `<LinkPending />` as the last child of a `relative` `<Link>` in a navigation bar (decorative bar, shown after a short delay) | `@/components/link-pending` |
| A list or area with nothing in it | `<EmptyState title description icon?>` + action as children | `@/components/empty-state` |
| A status word (Draft, Pending, Paused…) | `<Badge>` (`variant`: `secondary` default, `default`, `outline`, `destructive`) | `@/components/ui/badge` |
| Show more / collapsible section | `<Disclosure summary="…" open? variant="card" \| "plain">` | `@/components/disclosure` |
| Sign-out button in a layout | `<SignOut />` (the workspace shell already renders it) | `@/components/sign-out` |
| The owner/reviewer workspace frame | `<WorkspaceShell>`; only `app/(workspace)/layout.tsx` renders it | `@/components/workspace-shell` |
| The environment notice above a layout | `<PreviewNotice fixtureTest readOnly />`; only the two group layouts render it | `@/components/preview-notice` |
| Sidebar parts inside a workspace frame | `Sidebar*` parts (`SidebarGroup`, `SidebarMenuButton render={<Link …/>}` …); used by `WorkspaceShell`, not by pages | `@/components/ui/sidebar` |
| A panel sliding in from an edge | `<Sheet>` + `<SheetContent side>` (Base UI dialog); the sidebar uses it on phones | `@/components/ui/sheet` |
| A short hover/focus hint | `<Tooltip>` + `<TooltipTrigger>` + `<TooltipContent>`; needs a `TooltipProvider` | `@/components/ui/tooltip` |
| A shape placeholder while loading | `<Skeleton className=…/>` (decorative; keep `LoadingState` text for the status) | `@/components/ui/skeleton` |
| Money, Cambodia time, booking status words | `usd()`, `cambodiaTime()`, `bookingStatus()` | `@/lib/booking-format` |
| Join class names | `cn()` | `@/lib/utils` |

## Feature building blocks

Shared inside the owner workspace; import them from the feature folder in routes.

| Component | Feature | Use |
| --- | --- | --- |
| `SiteHeader` | Shared layout | Responsive primary navigation with runtime-aware links; public pages only (`app/(site)/layout.tsx`) |
| `PropertyNavigation` | properties | Tabs across one property's pages (`active` names the current page) |
| `PublicStayDetails` | catalog | The guest-facing listing view (also used as the preview in review screens) |
| `StayPhoto` | catalog | A processed public photo |
| `BookingLogistics` | bookings | Confirmed-only arrival and contact copy |

## Planned: add when first needed

Add these only when needed, using the configured shadcn `base-nova` style (Base UI); follow the [adding a component](ui-standard.md#adding-a-component) steps and move the row up.

| Need | Component | Notes |
| --- | --- | --- |
| Confirm a destructive or irreversible action in a modal | shadcn `AlertDialog` | Today confirmations use a required `CheckboxField` plus a button, which works before hydration; keep that for forms |
| Tabular data (owner booking lists at scale) | shadcn `Table` | Lists use cards and `<ul>`/`<ol>` today |
| Transient success notices | shadcn `Toast` | Keep `StatusMessage` for anything the user must be able to re-read |
| Icons | `lucide-react` | Decorative icons get `aria-hidden`; icon-only buttons need `aria-label` |
| Segmented navigation | shadcn `Tabs` | `PropertyNavigation` is a link list, which is correct for page navigation |
| Searchable choice from a long list | shadcn `Command`/`Combobox` | `NativeSelect` for short lists |
