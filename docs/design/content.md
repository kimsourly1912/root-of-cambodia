# UI content and wording

**Status:** active writing standard for interface text; product promises stay in [scope](../product/scope.md) and the [screen brief](screen-brief.md).

**Responsible role:** product/design owner (responsibility, not an assigned person).

**Last source verification:** 31 October 2026, branch `feat/ui-standard`.

**Sources:** [apps/web/features/](../../apps/web/features/), [apps/web/app/](../../apps/web/app/), [screen brief](screen-brief.md), [open decisions](../product/open-decisions.md).

How the interface talks. Write for owners and guests in Cambodia who may read English as a second language: short sentences, common words, one idea per sentence.

## Voice

- Plain, calm and specific. Say what happened and what to do next.
- Address the reader as "you"; refer to the product as "Root of Cambodia" only where a name is needed.
- No exclamation marks, jokes or marketing language in workspaces and errors.
- Never promise what the product does not do: no "Book now", "Instant confirmation", "Pay now", "Guaranteed" or quality badges.

## Words we use

Use the same word for the same thing on every screen.

| Use | Not | Meaning |
| --- | --- | --- |
| stay | hotel, listing (to guests) | A published place guests browse |
| property | listing (to owners) | What an owner sets up and manages |
| room type | room, unit | A kind of room with a quantity |
| booking request | booking, reservation (before acceptance) | What a guest sends; it is Pending until the owner accepts |
| Request to book | Book now, Reserve | The guest's action |
| Pending confirmation | Booked, Reserved | Status after sending; no room is held |
| Confirmed | Booked | Status after the owner accepts |
| Pay at the property | Pay later, Pay now | How money changes hands |
| external reservation | manual booking, offline booking | A booking an owner records from elsewhere |
| publication review | approval, moderation | The pilot reviewer's check before a property is public |
| paused | hidden, disabled | An owner temporarily hiding a published listing |
| Cambodia time | local time, ICT | The time zone for every date and deadline |

## Labels and buttons

- Buttons start with a verb and name the result: "Save room type", "Save location and contact", "Submit saved draft", "Send request to owner", "Upload photo". Avoid "OK", "Submit", "Yes".
- While working: the verb in "-ing" form with an ellipsis: "Saving…", "Checking…", "Cancelling…".
- Retry after an uncertain result: "Retry same save" / "Retry same action" (see [UX patterns](ux-patterns.md#retries-and-uncertain-results)).
- Links say where they go: "Open property →", "Explore stays", "All room types". Not "Click here".
- Field labels are nouns ("Khmer name", "Check-in time"); hints go below the field in `text-sm text-muted-foreground`.

## Messages

| Type | Pattern | Example |
| --- | --- | --- |
| Validation error | "Check …, then try again." | "Check the name and guest limits, then try again." |
| Conflict / stale | What changed + reload | "Availability or your access changed. Reload the latest week before a new edit." |
| Uncertain result | What happened + safe retry | "Connection interrupted. Retry the same save to check whether it completed." |
| Success | Past tense, what changed | "Availability saved." |
| Empty | What is missing + next step | "No room types yet" / "Start with a name and guest limits." |
| Unavailable | Plain fact, no blame | "Stays are temporarily unavailable. Please try again." |

Error messages never show codes, stack traces, provider messages or guest data. Public errors come from the backend's safe error codes.

## Numbers, dates and money

- Money: "$70.00 USD" via `usd()`. Always show the currency.
- Dates: written in full in confirmations ("13 November 2026"); add "Cambodia time" next to deadlines and times.
- Counts: digits ("2 adults", "3 / 20 photos").

## Khmer and English

- The working UI is English with Khmer property names and some Khmer eyebrows. Mark Khmer text with `lang="km"` (see [foundations](foundations.md#khmer-and-mixed-text)).
- Do not machine-translate interface copy into Khmer in code. Khmer-first copy, translation review and switching the page language are open decision **D13**; write English that translates cleanly (no idioms, no wordplay).
- Show the Khmer property name first where both exist.

## Preview and test environments

The site-wide banner states the environment ("Local preview · Email delivery is not connected."). Sample data is labeled as fictional. Never use real people, businesses or reviews in fixtures or screenshots.
