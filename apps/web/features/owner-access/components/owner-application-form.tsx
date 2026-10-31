"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusMessage } from "@/components/status-message";
import { TextLink } from "@/components/text-link";

type Values = { businessName: string; phone: string; province: string };

// Apply (or reapply after a decline) for owner access. One retry key per
// attempt: an uncertain result is retried with the same key and body.
export function OwnerApplicationForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false), [pending, setPending] = useState(false),
    [uncertain, setUncertain] = useState(false), [conflict, setConflict] = useState(false),
    [done, setDone] = useState(false), [error, setError] = useState(""), [signIn, setSignIn] = useState(false);
  const busy = useRef(false), attempt = useRef<{ key: string; body: string } | null>(null);
  useEffect(() => setHydrated(true), []);
  const form = useForm({
    defaultValues: initial,
    onSubmit: async ({ value }) => {
      if (!hydrated || busy.current || done || conflict) return;
      if (!attempt.current) {
        if (!/^[+0-9 ()-]{6,40}$/.test(value.phone.trim())) {
          setError("Enter a phone number using digits, spaces, +, - or brackets.");
          return;
        }
        attempt.current = {
          key: crypto.randomUUID(),
          body: JSON.stringify({
            businessName: value.businessName.trim(),
            phone: value.phone.trim(),
            province: value.province.trim(),
          }),
        };
      }
      busy.current = true; setPending(true); setError(""); setSignIn(false);
      try {
        const response = await fetch("/api/owner-access", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.current.key },
          body: attempt.current.body,
        });
        if (response.status >= 500) {
          setUncertain(true);
          setError("We couldn’t confirm your application. Retry the same application to recover it safely.");
          return;
        }
        if (!response.ok) {
          const result = (await response.json()) as { error?: string };
          attempt.current = null; setUncertain(false);
          if (response.status === 401 || response.status === 403) {
            setSignIn(true);
            setError("Sign in again, then return to this page.");
          } else if (response.status === 409) {
            setConflict(true);
            setError("Your application status changed. Reload the page to see the latest status.");
          } else
            setError(
              result.error === "invalid_owner_application"
                ? "Check each field and try again."
                : "We couldn’t send your application. Check the details and try again.",
            );
          return;
        }
        attempt.current = null; setUncertain(false); setDone(true);
        router.refresh();
      } catch {
        setUncertain(true);
        setError("The connection was interrupted. Retry the same application to check whether it was sent.");
      } finally { busy.current = false; setPending(false); }
    },
  });
  return (
    <form
      onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }}
      className="max-w-2xl space-y-5"
    >
      <fieldset disabled={!hydrated || pending || uncertain || conflict || done} className="space-y-4">
        <form.Field name="businessName">{(field) => (
          <div className="space-y-2">
            <Label htmlFor="owner-business-name">Business or owner name</Label>
            <Input id="owner-business-name" name="businessName" maxLength={200} required autoComplete="organization"
              value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} onBlur={field.handleBlur} />
          </div>
        )}</form.Field>
        <form.Field name="phone">{(field) => (
          <div className="space-y-2">
            <Label htmlFor="owner-phone">Phone number</Label>
            <Input id="owner-phone" name="phone" type="tel" maxLength={40} required autoComplete="tel"
              aria-describedby="owner-phone-help"
              value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} onBlur={field.handleBlur} />
            <p id="owner-phone-help" className="text-xs text-muted-foreground">
              The platform team may call to confirm your application. It is not shown to guests.
            </p>
          </div>
        )}</form.Field>
        <form.Field name="province">{(field) => (
          <div className="space-y-2">
            <Label htmlFor="owner-province">Province of your property</Label>
            <Input id="owner-province" name="province" maxLength={100} required
              value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} onBlur={field.handleBlur} />
          </div>
        )}</form.Field>
      </fieldset>
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      {signIn && <TextLink className="block text-sm" href="/sign-in?next=%2Fowner%2Fapply">Sign in again</TextLink>}
      {done && <StatusMessage tone="success">Application sent. Updating status…</StatusMessage>}
      {conflict ? (
        <Button type="button" variant="outline" onClick={() => window.location.reload()}>Reload latest status</Button>
      ) : !done && (
        <Button type="submit" disabled={!hydrated || pending}>
          {pending ? "Sending…" : uncertain ? "Retry same application" : "Send application"}
        </Button>
      )}
      {uncertain && <p className="text-xs text-muted-foreground">Keep this page open until the result is confirmed.</p>}
    </form>
  );
}
