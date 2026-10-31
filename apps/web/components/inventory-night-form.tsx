"use client";
import { useEffect, useRef, useState } from "react";
import type { CalendarNight } from "@root-of-cambodia/backend/calendar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { usd } from "./booking-format";
export function InventoryNightForm({roomId, night, returnTo}: {
  roomId: string; night: CalendarNight; returnTo: string;
}) {
  const [hydrated, setHydrated] = useState(false), [pending, setPending] = useState(false),
    [uncertain, setUncertain] = useState(false), [blocked, setBlocked] = useState(false),
    [done, setDone] = useState(false), [error, setError] = useState(""), [auth, setAuth] = useState(false);
  const busy = useRef(false), attempt = useRef<{key: string; body: string} | null>(null);
  useEffect(() => setHydrated(true), []);
  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrated || busy.current || blocked || done) return;
    if (!attempt.current) {
      const data = new FormData(event.currentTarget);
      const capacity = Number(data.get("capacity")), blockedUnits = Number(data.get("blocked"));
      if (!Number.isInteger(capacity) || !Number.isInteger(blockedUnits) || capacity < blockedUnits + (night.reserved ?? 0)) {
        setError("Capacity must cover reserved and blocked units together."); return;
      }
      attempt.current = {key: crypto.randomUUID(), body: JSON.stringify({
        roomId, night: night.night, capacity, blocked: blockedUnits, revision: night.inventoryRevision
      })};
    }
    busy.current = true; setPending(true); setError("");
    try {
      const r = await fetch("/api/inventory", {method: "POST",
        headers: {"Content-Type": "application/json", "Idempotency-Key": attempt.current.key},
        body: attempt.current.body});
      if (r.status >= 500) { setUncertain(true); setError("We couldn’t confirm this save. Retry the same availability update."); return; }
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) { setAuth(true); setUncertain(true); }
        else setBlocked(true);
        setError("Availability or your access changed. Reload the latest week before a new edit."); return;
      }
      setDone(true); setUncertain(false);
    } catch {
      setUncertain(true); setError("Connection interrupted. Keep this tab open and retry the same availability update.");
    } finally { busy.current = false; setPending(false); }
  }
  return <section aria-label={"Availability for " + night.night} className="min-w-0 space-y-4 rounded-xl border p-5">
    <h2 className="text-lg font-semibold">{night.night}</h2>
    {night.inventoryRevision === null ? <p>No inventory configured for this night.</p> : <>
      <p className="text-sm">Reserved: {night.reserved} · Available when loaded: {night.capacity! - night.blocked! - night.reserved!}</p>
      <p className="text-sm">{night.unitCents === null ? "No price configured; this night cannot be booked." : "Saved nightly price: " + usd(night.unitCents)}</p>
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={!hydrated || pending || uncertain || blocked || done} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor={"capacity-" + night.night}>Capacity</Label><Input id={"capacity-" + night.night} name="capacity" type="number" min={0} max={10000} step={1} defaultValue={night.capacity!} required /></div>
          <div className="space-y-2"><Label htmlFor={"blocked-" + night.night}>Blocked units</Label><Input id={"blocked-" + night.night} name="blocked" type="number" min={0} max={10000} step={1} defaultValue={night.blocked!} required /></div>
        </fieldset>
        {!done && !blocked && <Button type="submit" disabled={!hydrated || pending}>{pending ? "Saving…" : uncertain ? "Retry same availability update" : "Save night"}</Button>}
      </form>
      {done && <p role="status">Availability saved. Reload the latest week to see current counts or edit again.</p>}
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {auth && <a href={"/sign-in?next=" + encodeURIComponent(returnTo)} target="_blank" rel="noopener" className="block text-primary underline">Sign in in a new tab, then retry here</a>}
    {!uncertain && <a href={returnTo} className="inline-block text-primary underline">Reload latest week</a>}
    {uncertain && <p className="text-xs">Keep this tab open to preserve the exact save. Reloading or changing weeks discards this pending attempt.</p>}
  </section>;
}
