"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ExternalReview } from "@root-of-cambodia/backend/external-bookings";
import { usd, cambodiaTime } from "./booking-format";
import { Button } from "./ui/button";
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
    <h1 className="text-3xl font-semibold">Review external reservation</h1>
    <p className="break-words font-semibold">{q.propertyName}</p>
    <p>Check-in: {cambodiaTime(q.checkinAt)} · Checkout: {cambodiaTime(q.checkoutAt)} Cambodia time</p>
    <p className="text-sm">This saved review holds no stock. Confirmation rechecks all nights and reserves them immediately. No guest contact or account is created.</p>
    <div className="space-y-4">{q.lines.map(line => <div key={line.selection.roomId} className="min-w-0 space-y-2 rounded-xl border p-5">
      <h2 className="break-words font-semibold">{line.roomName} · {line.selection.quantity} room(s)</h2>
      <p>{line.selection.adults} adults · {line.selection.children} children across these rooms</p>
      {line.rates.map(rate => <p key={rate.night} className="text-sm">{rate.night} · {usd(rate.unitCents)} × {line.selection.quantity} = {usd(rate.unitCents * line.selection.quantity)}</p>)}
    </div>)}</div>
    {q.charges.map((charge, i) => <p key={i}>{charge.label}: {usd(charge.amountCents)}</p>)}
    <p className="text-2xl font-semibold">Total: {usd(q.totalCents)} USD</p>
    <section className="space-y-2"><h2 className="font-semibold">Saved property rules</h2><p className="whitespace-pre-wrap">{q.policyText}</p><p className="text-sm">Recorded terms version: {q.input.termsVersion}. This owner stock record does not establish a guest’s agreement to legal terms.</p></section>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4 shrink-0" checked={confirmed} disabled={!hydrated || pending || uncertain || blocked} onChange={e => setConfirmed(e.target.checked)} /><span>I want to reserve these rooms immediately at this catalog total. This does not record a payment.</span></label>
    {!blocked && <Button onClick={apply} disabled={!hydrated || pending || !confirmed}>{pending ? "Confirming reservation…" : uncertain ? "Retry same external reservation" : "Confirm external reservation"}</Button>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {auth && <Link href={"/sign-in?next=" + encodeURIComponent(base + "/" + review.id)} className="block text-primary underline">Sign in and recover this reservation</Link>}
    <a href={base + "/" + review.id} className="block text-primary underline">Reload saved review and check result</a>
    {!uncertain && <Link href={base} className="block text-primary underline">Prepare a new external review</Link>}
  </section>;
}
