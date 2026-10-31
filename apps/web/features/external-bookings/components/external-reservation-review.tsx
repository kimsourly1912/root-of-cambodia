"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ExternalReview } from "@root-of-cambodia/backend/external-bookings";
import { usd, cambodiaTime } from "@/lib/booking-format";
import { Button } from "@/components/ui/button";
import { PageTitle, SectionTitle } from "@/components/typography";
import { TextLink, textLinkClass } from "@/components/text-link";
import { StatusMessage } from "@/components/status-message";
import { CheckboxField } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
export function ExternalReservationReview({propertyId, review, base}: {
  propertyId: string; review: ExternalReview; base: string;
}) {
  const q = review.preview, router = useRouter(), busy = useRef(false);
  const [hydrated, setHydrated] = useState(false), [confirmed, setConfirmed] = useState(false),
    [pending, setPending] = useState(false), [uncertain, setUncertain] = useState(false),
    [blocked, setBlocked] = useState(false), [error, setError] = useState(""), [auth, setAuth] = useState(false);
  useEffect(() => setHydrated(true), []);
  async function apply() {
    if (!hydrated || !confirmed || busy.current || blocked) return;
    busy.current = true; setPending(true); setError("");
    try {
      const r = await fetch(`/api/owner/properties/${propertyId}/external/attempts/${review.id}/apply`,
        {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({confirmed: true})});
      if (r.status >= 500) {setUncertain(true); setError("We couldn’t confirm the result. Retry this same saved reservation or reload this review to recover its receipt."); return;}
      if (!r.ok) {
        setAuth(r.status === 401 || r.status === 403);
        if (r.status !== 401 && r.status !== 403) setBlocked(true);
        setError("The saved price, stock, settings or your access changed. This review cannot create a new reservation without a fresh review."); return;
      }
      const receipt = await r.json() as {id: string};
      setBlocked(true); router.replace(`/owner/properties/${propertyId}/bookings/${receipt.id}`); router.refresh();
    } catch {setUncertain(true); setError("Connection interrupted. Retry this same saved reservation or reload this review to recover its receipt.");}
    finally {busy.current = false; setPending(false);}
  }
  return <section className="space-y-6">
    <PageTitle>Review external reservation</PageTitle>
    <p className="break-words font-semibold">{q.propertyName}</p>
    <p>Check-in: {cambodiaTime(q.checkinAt)} · Checkout: {cambodiaTime(q.checkoutAt)} Cambodia time</p>
    <p className="text-sm">This saved review holds no stock. Confirmation rechecks all nights and reserves them immediately. No guest contact or account is created.</p>
    <div className="space-y-4">{q.lines.map(line => <div key={line.selection.roomId} className="min-w-0 space-y-2 rounded-xl border p-5">
      <SectionTitle size="sm">{line.roomName} · {line.selection.quantity} room(s)</SectionTitle>
      <p>{line.selection.adults} adults · {line.selection.children} children across these rooms</p>
      {line.rates.map(rate => <p key={rate.night} className="text-sm">{rate.night} · {usd(rate.unitCents)} × {line.selection.quantity} = {usd(rate.unitCents * line.selection.quantity)}</p>)}
    </div>)}</div>
    {q.charges.map((charge, i) => <p key={i}>{charge.label}: {usd(charge.amountCents)}</p>)}
    <p className="text-2xl font-semibold">Total: {usd(q.totalCents)}</p>
    <section className="space-y-2"><SectionTitle size="sm">Saved property rules</SectionTitle><p className="whitespace-pre-wrap">{q.policyText}</p><p className="text-sm">Recorded terms version: {q.input.termsVersion}. This owner stock record does not establish a guest’s agreement to legal terms.</p></section>
    <CheckboxField checked={confirmed} disabled={!hydrated || pending || uncertain || blocked} onChange={e => setConfirmed(e.target.checked)}>I want to reserve these rooms immediately at this catalog total. This does not record a payment.</CheckboxField>
    {!blocked && <Button onClick={apply} disabled={!hydrated || pending || !confirmed}>{pending ? "Confirming reservation…" : uncertain ? "Retry same external reservation" : "Confirm external reservation"}</Button>}
    {error && <StatusMessage tone="error">{error}</StatusMessage>}
    {auth && <TextLink className="block" href={"/sign-in?next=" + encodeURIComponent(base + "/" + review.id)}>Sign in and recover this reservation</TextLink>}
    <a href={base + "/" + review.id} className={cn(textLinkClass, "block")}>Reload saved review and check result</a>
    {!uncertain && <TextLink className="block" href={base}>Prepare a new external review</TextLink>}
  </section>;
}
