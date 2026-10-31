"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
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
  const defaultValues: Record<string, string> = {checkin: "", checkout: ""};
  for (const room of rooms) {
    if (!room.active) continue;
    defaultValues["quantity-" + room.id] = "0";
    defaultValues["adults-" + room.id] = "1";
    defaultValues["children-" + room.id] = "0";
  }
  const form = useForm({
    defaultValues,
    onSubmit: async ({value}) => {
      if (!hydrated || busy.current || recovery) return;
      const lines = rooms.filter(room => room.active && Number(value["quantity-" + room.id]) > 0)
        .map(room => ({roomId: room.id, quantity: Number(value["quantity-" + room.id]),
          adults: Number(value["adults-" + room.id]), children: Number(value["children-" + room.id])}));
      if (!lines.length || lines.length > 10) { setError("Choose one to ten room types with a positive quantity."); return; }
      const id = crypto.randomUUID();
      busy.current = true; setPending(true); setError("");
      try {
        const r = await fetch(`/api/owner/properties/${propertyId}/external/attempts/${id}`,
          {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({
            checkin: value.checkin, checkout: value.checkout, lines})});
        if (r.status >= 500) { setRecovery(id); setError("We couldn’t confirm whether the review was saved. Check the saved review before starting again; no reservation has been requested."); return; }
        if (!r.ok) { setError("The dates, room counts, prices, stock or your access are unavailable. Review the selection and try again. No reservation was requested."); return; }
        setRecovery(id); router.push(base + "/" + id); router.refresh();
      } catch { setRecovery(id); setError("Connection interrupted. Check the saved review. Preparing it never reserves rooms."); }
      finally {busy.current = false; setPending(false);}
    },
  });
  if (!rooms.some(room => room.active)) return <p>No active room types on this page. Configure rooms and dated prices/stock while drafting, or choose another room page.</p>;
  return <div className="space-y-5"><form onSubmit={(event) => {
    event.preventDefault();
    event.stopPropagation();
    void form.handleSubmit();
  }} className="space-y-6">
    <fieldset disabled={!hydrated || pending || !!recovery} className="space-y-5">
      <legend className="sr-only">External reservation selection</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="checkin">{(field) =>
          <div className="space-y-2"><Label htmlFor="external-checkin">Check-in date</Label><Input id="external-checkin" name="checkin" type="date" value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} onBlur={field.handleBlur} required /></div>
        }</form.Field>
        <form.Field name="checkout">{(field) =>
          <div className="space-y-2"><Label htmlFor="external-checkout">Checkout date</Label><Input id="external-checkout" name="checkout" type="date" value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} onBlur={field.handleBlur} required /></div>
        }</form.Field>
      </div>
      {rooms.filter(room => room.active).map(room => <fieldset key={room.id} className="min-w-0 space-y-4 rounded-xl border p-5">
        <legend className="break-words px-2 font-semibold">{room.name}</legend>
        <p className="text-sm">Per unit: {room.adultCapacity} adults · {room.childCapacity} children · {room.totalCapacity} guests total.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {[["quantity", "Rooms", 0, 100], ["adults", "Adults in these rooms", 1, 10000], ["children", "Children in these rooms", 0, 10000]].map(([name, label, min, max]) =>
            <form.Field key={String(name)} name={name + "-" + room.id}>{(field) =>
              <div className="min-w-0 space-y-2"><Label htmlFor={name + "-" + room.id}>{label}</Label><Input id={name + "-" + room.id} name={name + "-" + room.id} type="number" min={Number(min)} max={Number(max)} step={1} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} onBlur={field.handleBlur} required /></div>
            }</form.Field>)}
        </div>
      </fieldset>)}
    </fieldset>
    {!recovery && <Button type="submit" disabled={!hydrated || pending}>{pending ? "Preparing review…" : "Review external reservation"}</Button>}
  </form>
  {error && <StatusMessage tone="error">{error}</StatusMessage>}
  {recovery && <a href={base + "/" + recovery} className={cn(textLinkClass, "inline-block")}>Check saved external review</a>}
  </div>;
}
