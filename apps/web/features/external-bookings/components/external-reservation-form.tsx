"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OwnerRoomType } from "@root-of-cambodia/backend/rooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusMessage } from "@/components/status-message";
import { textLinkClass } from "@/components/text-link";
import { cn } from "@/lib/utils";
export function ExternalReservationForm({propertyId, rooms, base}: {
  propertyId: string; rooms: OwnerRoomType[]; base: string;
}) {
  const router = useRouter(), busy = useRef(false);
  const [hydrated, setHydrated] = useState(false), [pending, setPending] = useState(false),
    [recovery, setRecovery] = useState(""), [error, setError] = useState("");
  useEffect(() => setHydrated(true), []);
  async function prepare(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); if (!hydrated || busy.current || recovery) return;
    const data = new FormData(event.currentTarget);
    const lines = rooms.filter(room => room.active && Number(data.get("quantity-" + room.id)) > 0)
      .map(room => ({roomId: room.id, quantity: Number(data.get("quantity-" + room.id)),
        adults: Number(data.get("adults-" + room.id)), children: Number(data.get("children-" + room.id))}));
    if (!lines.length || lines.length > 10) { setError("Choose one to ten room types with a positive quantity."); return; }
    const id = crypto.randomUUID();
    busy.current = true; setPending(true); setError("");
    try {
      const r = await fetch(`/api/owner/properties/${propertyId}/external/attempts/${id}`,
        {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({
          checkin: String(data.get("checkin")), checkout: String(data.get("checkout")), lines})});
      if (r.status >= 500) { setRecovery(id); setError("We couldn’t confirm whether the review was saved. Check the saved review before starting again; no reservation has been requested."); return; }
      if (!r.ok) { setError("The dates, room counts, prices, stock or your access are unavailable. Review the selection and try again. No reservation was requested."); return; }
      setRecovery(id); router.push(base + "/" + id); router.refresh();
    } catch { setRecovery(id); setError("Connection interrupted. Check the saved review. Preparing it never reserves rooms."); }
    finally {busy.current = false; setPending(false);}
  }
  if (!rooms.some(room => room.active)) return <p>No active room types on this page. Configure rooms and dated prices/stock while drafting, or choose another room page.</p>;
  return <div className="space-y-5"><form onSubmit={prepare} className="space-y-6">
    <fieldset disabled={!hydrated || pending || !!recovery} className="space-y-5">
      <legend className="sr-only">External reservation selection</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="external-checkin">Check-in date</Label><Input id="external-checkin" name="checkin" type="date" required /></div>
        <div className="space-y-2"><Label htmlFor="external-checkout">Checkout date</Label><Input id="external-checkout" name="checkout" type="date" required /></div>
      </div>
      {rooms.filter(room => room.active).map(room => <fieldset key={room.id} className="min-w-0 space-y-4 rounded-xl border p-5">
        <legend className="break-words px-2 font-semibold">{room.name}</legend>
        <p className="text-sm">Per unit: {room.adultCapacity} adults · {room.childCapacity} children · {room.totalCapacity} guests total.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {[["quantity", "Rooms", 0, 100, 0], ["adults", "Adults in these rooms", 1, 10000, 1], ["children", "Children in these rooms", 0, 10000, 0]].map(([name, label, min, max, value]) =>
            <div key={String(name)} className="min-w-0 space-y-2"><Label htmlFor={name + "-" + room.id}>{label}</Label><Input id={name + "-" + room.id} name={name + "-" + room.id} type="number" min={Number(min)} max={Number(max)} step={1} defaultValue={Number(value)} required /></div>)}
        </div>
      </fieldset>)}
    </fieldset>
    {!recovery && <Button type="submit" disabled={!hydrated || pending}>{pending ? "Preparing review…" : "Review external reservation"}</Button>}
  </form>
  {error && <StatusMessage tone="error">{error}</StatusMessage>}
  {recovery && <a href={base + "/" + recovery} className={cn(textLinkClass, "inline-block")}>Check saved external review</a>}
  </div>;
}
