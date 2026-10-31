import Link from "next/link";
import { notFound } from "next/navigation";
import { runtime } from "@/server/runtime";
import { STAGING_ACCOUNTS } from "@/server/staging-accounts";

export default async function Testing() {
  if (!(await runtime()).fixtureTest) notFound();
  return <main id="main" className="mx-auto max-w-5xl space-y-8 px-5 py-12 sm:px-8">
    <div className="max-w-2xl space-y-4">
      <p className="font-medium text-primary">ROOTS OF CAMBODIA · Staging</p>
      <h1 className="text-4xl font-semibold">Try the features we have built</h1>
      <p className="text-muted-foreground">Use the private demo credentials supplied separately. Sign out before switching accounts, or use separate browser profiles for owner and guest.</p>
      <p className="rounded-xl border bg-secondary p-4 text-sm">All properties, people, prices and terms here are fictional test data. Do not enter real guest details or make real reservations. Email, new registration and password recovery remain off.</p>
    </div>
    <div className="grid gap-5 md:grid-cols-3">
      {STAGING_ACCOUNTS.map(account => <section key={account.id} className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="text-xl font-semibold">{account.name}</h2>
        <p className="break-all text-sm text-muted-foreground">{account.email}</p>
        <p className="text-sm">{account.role === "guest" ? "Browse sample stays, review prices and terms, request a booking, track it and cancel." : account.role === "owner" ? "Edit drafts, manage rooms and availability, respond to bookings, record external stays and payments, and pause or correct listings." : "Review a submitted demo property, return it for changes or approve its public listing."}</p>
        <Link className="inline-block font-medium text-primary underline" href={`/sign-in?next=${account.role === "guest" ? "/bookings" : account.role === "reviewer" ? "/review" : "/owner"}`}>Sign in to test</Link>
      </section>)}
    </div>
    <section className="space-y-4 rounded-xl border p-6">
      <h2 className="text-xl font-semibold">Suggested test journey</h2>
      <ol className="list-decimal space-y-3 pl-5 text-sm">
        <li>Explore the demo stays and choose available dates at least 24 hours ahead of check-in.</li>
        <li>Sign in as the demo traveler, review the full price and submit a request. Pending requests do not reserve rooms.</li>
        <li>Sign in as the demo owner, review and accept the request. Then switch back to the traveler to check the confirmed arrival details.</li>
        <li>Try availability edits, an external reservation, cancellation, pause/resume and the offline correction/review flow.</li>
        <li>Use the demo reviewer to review the sample submission or a new owner draft. The displayed terms are for testing only.</li>
      </ol>
      <p className="text-sm text-muted-foreground">Arrival and completion retain their real schedule restrictions. Payment records describe money paid outside the platform; no money is collected here. Notification events remain pending without sending email.</p>
      <Link href="/stays" className="inline-block text-primary underline">Browse demo stays →</Link>
    </section>
  </main>;
}
