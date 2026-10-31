# UX patterns

**Status:** active; describes behavior the current screens already implement, so new screens behave the same way.

**Responsible role:** product/design owner (direction); technical maintainer (implementation).

**Last source verification:** 31 October 2026, branch `feat/ui-standard`.

**Sources:** [apps/web/features/](../../apps/web/features/), [apps/web/app/](../../apps/web/app/), [bookings](../features/bookings.md), [publication review](../features/publication-review.md), [testing](../development/testing.md#select-meaningful-checks).

Use the [component catalog](components.md) for *what* to render; this page is *how screens behave*. Product rules (deadlines, cancellation, what Pending means) come from [scope](../product/scope.md) and the feature contracts; never invent them in UI copy.

## Page structure

Every page, top to bottom:

1. Optional back link: `TextLink` with `←`, `text-sm`, above the title.
2. Optional eyebrow (`text-sm text-primary`, often Khmer with `lang="km"`).
3. `PageTitle`, then one short paragraph saying what the page is for.
4. Primary actions on the right on wide screens; they wrap below on phones (`flex flex-wrap items-start justify-between gap-5`).
5. Owner property pages show `PropertyNavigation` under the title, with `active` set to the current page.
6. Content sections, each with a `SectionTitle` or inside a `Card`.

Each route area has `loading.tsx` (`LoadingState`), `error.tsx` (`PageTitle`, one sentence, a `Button` that calls `reset`) and `not-found.tsx` (`PageTitle`, one sentence, a `TextLink` back to a safe page).

## Every screen handles these states

| State | Show |
| --- | --- |
| Loading (route) | `LoadingState` with "Loading …" in plain words |
| Empty | `EmptyState`: title, one-line reason and the next step (a `Button` or `TextLink`) |
| Not found / no access | The route's `not-found` page; never reveal whether a private record exists |
| Validation error | `StatusMessage tone="error"` saying what to check: "Check the name and guest limits, then try again." |
| Saving | The submit button is disabled and reads "Saving…" (or "Checking…", "Cancelling…") |
| Saved | `StatusMessage tone="success"`, and refresh the server data (`router.refresh()`) |
| Stale (someone else changed it) | Explain, and offer a reload: "Reload the latest details before saving again." Do not overwrite |
| Uncertain (connection lost after sending) | Keep the form as sent and offer "Retry same save" (see below) |
| Signed out mid-task | A link to sign in that returns here (`/sign-in?next=…`), opened in a new tab when the form must keep its state |

## Forms

- Every field has a visible `Label`. Put required-ness in the label text or the form intro, not only in an asterisk.
- Group related fields in a `fieldset` with a `legend`; use `space-y-2` between a label and its control and `space-y-4` or `space-y-5` between fields.
- Validate on the server (the backend services are the authority). Client checks only prevent obvious mistakes and must not be the only check.
- Show form-level errors with `StatusMessage tone="error"` directly above or below the submit button; give a field-specific error `aria-describedby` on that input.
- Keep the user's input after an error. Never clear a form because a save failed.
- One primary `Button` per form; secondary actions use `variant="outline"` or `"ghost"`.
- Dates are shown and entered in **Cambodia time**, and the screen says so where it matters (deadlines, check-in).

## Hydration and double submits

Server-rendered controls can be clicked before React attaches its handlers. Forms and action buttons that call JavaScript are **disabled until hydration** (a `hydrated` state set in `useEffect`); see `listing-controls.tsx` and `payment-records.tsx`. A required `CheckboxField` in such a form is also disabled until hydrated. While a request is pending, disable the submit button so it cannot be sent twice.

## Retries and uncertain results

Writes carry an operation key. When the response is lost (network error, timeout):

- Keep the exact same request (same key, same body) and show **"Retry same save"** / **"Retry same action"**.
- Explain: "Connection interrupted. Retry the same save to check whether it completed."
- Never generate a new attempt automatically, and never re-enable editing that would change the body under the old key.
- Navigating away loses an unsent retry; say so where it matters.

This is a product safety rule from [AGENTS.md](../../AGENTS.md#correctness-and-privacy-rules), not a styling choice.

## Confirmations and irreversible actions

- Actions with consequences (submit for review, accept a booking, record a payment, pause a listing) use a **required `CheckboxField`** stating exactly what will happen, then the action `Button`. This works before hydration and in tests.
- Destructive actions use `Button variant="destructive"` or `"outline"`, never the primary style, and say what will change ("Cancel this booking request").
- Show a review step with the exact data before applying owner responses and payments (the existing "preview → apply" flows).

## Lists and pagination

- Lists use cards in a responsive grid, or `<ul>`/`<ol>` for compact rows.
- Pagination is cursor-based: "Next page →" and "First page" links; keep filters in the URL so links are shareable.
- Each item shows its status with a `Badge`, its key facts and one `TextLink` to open it.

## Money, time and status

- Money: `usd(cents)` from `@/lib/booking-format` ("$70.00 USD"). Show the full total and make clear nothing is paid online: the screens use "$0 collected by this platform · Pay at the property".
- Time: `cambodiaTime(seconds)` and the words "Cambodia time" near deadlines.
- Booking status: `bookingStatus(value)` for the word, inside a `Badge`. Pending must read as a request, not a confirmed booking (see [screen brief](screen-brief.md)).

## Navigation

- The site header holds the main destinations; area layouts add their own `nav` with `aria-label` (for example "Owner navigation").
- Mark the current page with `aria-current="page"` (as `PropertyNavigation` does).
- Back links go up one level (to the list), not browser-back.

## Privacy in the UI

Private data (guest contact, arrival instructions, exact address) appears only on the screens the feature contracts allow, never in public pages, URLs or client logs. Do not cache private pages; the server adapters already send no-store.
