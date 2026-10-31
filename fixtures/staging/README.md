# Staging demo fixtures

These three original JPEG illustrations are labeled fictional property test
images. They depict no real accommodation and contain no third-party material.

The trusted seed script uses existing property/room/calendar/media/publication
and booking services, including actual image decoding/processing and owner
acknowledgement/review. It supplies synthetic users and mock terms only to the
exact isolated staging database. It never disables real email verification,
changes production or introduces a public seeding endpoint.

Run the trusted operator from the repository root with pinned dependencies and
Wrangler authenticated to the recorded account. Use
`node --use-env-proxy --import tsx scripts/seed-staging.ts --bootstrap --credentials /private/credentials.json`,
then deploy the tested Worker and use the same command with `--populate`.
The bootstrap checks the exact database, migration count and existing identities,
then inserts only password hashes, fictional users and clearly labeled mock terms.
Populate signs in and drives normal HTTPS application APIs, including live Images.
No credentials or provider errors are printed. Never commit the private input or
its sibling seed-state.json, which preserves the date range/retry checkpoint.
Applying fixtures requires explicit operator intent and a private JSON input
with credentials for exactly the three fixed fixture IDs. Do not commit that
input or print passwords. Existing non-fixture identities/configuration cause
refusal; mismatched existing passwords are not overwritten. Existing reviewed
listings and booking attempts are preserved on rerun, including user test edits.
