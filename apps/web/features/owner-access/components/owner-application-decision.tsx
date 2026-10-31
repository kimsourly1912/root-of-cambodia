"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusMessage } from "@/components/status-message";
import { TextLink } from "@/components/text-link";

// An admin approves or declines one pending application, with a required reason,
// against the application revision shown on the page.
export function OwnerApplicationDecision({ userId, revision, applicant }: {
  userId: string; revision: number; applicant: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState(""), [hydrated, setHydrated] = useState(false),
    [pending, setPending] = useState(false), [uncertain, setUncertain] = useState(false),
    [conflict, setConflict] = useState(false), [done, setDone] = useState(""), [error, setError] = useState(""),
    [signIn, setSignIn] = useState(false);
  const busy = useRef(false), attempt = useRef<{ key: string; body: { action: string; reason: string; revision: number } } | null>(null);
  useEffect(() => setHydrated(true), []);
  const id = "decision-reason-" + userId;
  async function decide(action: "approve" | "decline") {
    if (!hydrated || busy.current || done || conflict) return;
    setError(""); setSignIn(false);
    if (!attempt.current) {
      if (!reason.trim()) { setError("Add a reason before approving or declining."); return; }
      attempt.current = { key: crypto.randomUUID(), body: { action, reason: reason.trim(), revision } };
    }
    busy.current = true; setPending(true);
    try {
      const response = await fetch("/api/admin/owner-applications/" + encodeURIComponent(userId), {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.current.key },
        body: JSON.stringify(attempt.current.body),
      });
      if (response.status >= 500) {
        setUncertain(true);
        setError("We couldn’t confirm this decision. Retry the same decision to recover it safely.");
        return;
      }
      if (!response.ok) {
        attempt.current = null; setUncertain(false);
        if (response.status === 401 || response.status === 403) { setSignIn(true); setError("Sign in again, then return to this page."); }
        else if (response.status === 409 || response.status === 404) {
          setConflict(true);
          setError("This application or your admin access changed. Reload the latest applications.");
        } else setError("Check the reason and try again.");
        return;
      }
      const result = (await response.json()) as { status: string };
      setDone(result.status === "approved" ? "Approved. Updating applications…" : "Declined. Updating applications…");
      attempt.current = null; setUncertain(false);
      router.refresh();
    } catch {
      setUncertain(true);
      setError("The connection was interrupted. Retry the same decision to check whether it was saved.");
    } finally { busy.current = false; setPending(false); }
  }
  const locked = !hydrated || pending || uncertain || conflict || !!done;
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={id}>Reason for {applicant}</Label>
        <Textarea id={id} rows={3} maxLength={1000} value={reason} disabled={locked}
          onChange={(event) => setReason(event.target.value)} aria-describedby={id + "-help"} />
        <p id={id + "-help"} className="text-xs text-muted-foreground">
          Required. A decline reason is shown to the applicant.
        </p>
      </div>
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      {signIn && <TextLink className="block text-sm" href="/sign-in?next=%2Fadmin%2Fowners">Sign in again</TextLink>}
      {done && <StatusMessage tone="success">{done}</StatusMessage>}
      {conflict ? (
        <Button variant="outline" onClick={() => window.location.reload()}>Reload latest applications</Button>
      ) : uncertain ? (
        <Button disabled={!hydrated || pending} onClick={() => decide(attempt.current?.body.action === "approve" ? "approve" : "decline")}>
          {pending ? "Checking…" : "Retry same decision"}
        </Button>
      ) : !done && (
        <div className="flex flex-wrap gap-3">
          <Button disabled={locked} onClick={() => decide("approve")}>{pending ? "Saving…" : "Approve owner"}</Button>
          <Button variant="outline" disabled={locked} onClick={() => decide("decline")}>Decline</Button>
        </div>
      )}
    </div>
  );
}
