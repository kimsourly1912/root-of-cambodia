"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PropertyInformation } from "@root-of-cambodia/backend/property-information";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
const formFrom = (information: PropertyInformation) => ({
  description: information.description,
  address: information.address,
  facilitiesText: information.facilities.join("\n"),
  revision: information.revision,
});
export function PropertyInformationForm({
  propertyId,
  information,
  editable,
}: {
  propertyId: string;
  information: PropertyInformation;
  editable: boolean;
}) {
  const router = useRouter(),
    busy = useRef(false),
    completed = useRef(false),
    attempt = useRef<{ key: string; body: PropertyInformation } | null>(null);
  const [form, setForm] = useState(() => formFrom(information)),
    [dirty, setDirty] = useState(false),
    [pending, setPending] = useState(false),
    [settling, setSettling] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [conflict, setConflict] = useState(false),
    [error, setError] = useState(""),
    [needsSignIn, setNeedsSignIn] = useState(false),
    [saved, setSaved] = useState(false);
  // Keep displayed values and their expected version together after a confirmed refresh.
  useEffect(() => {
    setForm(formFrom(information));
    setDirty(false);
    completed.current = false;
    setSettling(false);
  }, [information.revision]);
  function change(
    field: "description" | "address" | "facilitiesText",
    value: string,
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setSaved(false);
  }
  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || completed.current) return;
    setNeedsSignIn(false);
    setError("");
    if (!attempt.current) {
      const facilities = form.facilitiesText
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
      if (
        facilities.length > 30 ||
        facilities.some((item) => item.length > 120) ||
        new Set(facilities).size !== facilities.length
      ) {
        setError(
          "List up to 30 different facilities, one per line, with no more than 120 characters per entry.",
        );
        return;
      }
      attempt.current = {
        key: crypto.randomUUID(),
        body: {
          description: form.description,
          address: form.address,
          facilities,
          revision: form.revision,
        },
      };
    }
    busy.current = true;
    setPending(true);
    setSaved(false);
    try {
      const response = await fetch(
        `/api/owner/properties/${propertyId}/information`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": attempt.current.key,
          },
          body: JSON.stringify(attempt.current.body),
        },
      );
      if (response.status >= 500) {
        setUncertain(true);
        setError(
          "We couldn’t confirm this save. Retry the same save to recover its result safely.",
        );
        return;
      }
      if (!response.ok) {
        attempt.current = null;
        setUncertain(false);
        setNeedsSignIn(response.status === 401 || response.status === 403);
        if (response.status === 409) {
          setConflict(true);
          setError(
            "The property information or access changed since you opened it. Reload the latest details before saving again.",
          );
        } else
          setError(
            response.status === 401 || response.status === 403
              ? "Your session needs attention. Sign in again, then return to this page."
              : response.status === 404
                ? "This property is no longer available to your account."
                : "Check the description, address and facility entries, then try again.",
          );
        return;
      }
      await response.json();
      attempt.current = null;
      completed.current = true;
      setSettling(true);
      setUncertain(false);
      setDirty(false);
      setSaved(true);
      router.refresh();
    } catch {
      setUncertain(true);
      setError(
        "The connection was interrupted. Retry the same save to check whether it completed.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const frozen = !editable || pending || settling || uncertain || conflict;
  return (
    <form
      onSubmit={save}
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_280px]"
    >
      <fieldset disabled={frozen} className="min-w-0 space-y-6">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>About your property</CardTitle>
            <CardDescription>
              Help guests understand the place you’re preparing to share.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="description">Property description</Label>
            <Textarea
              id="description"
              rows={6}
              maxLength={5000}
              value={form.description}
              onChange={(e) => change("description", e.target.value)}
              aria-describedby="description-help"
            />
            <p id="description-help" className="text-xs text-muted-foreground">
              Describe the property in your own words. Khmer and English text
              are supported.
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Address</CardTitle>
            <CardDescription>
              Write the address guests will need to find the property.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="address">
              Property address <span lang="km">· អាសយដ្ឋាន</span>
            </Label>
            <Textarea
              id="address"
              rows={4}
              maxLength={1000}
              value={form.address}
              onChange={(e) => change("address", e.target.value)}
              aria-describedby="address-help"
            />
            <p id="address-help" className="text-xs text-muted-foreground">
              Include useful village, street and locality details. This address
              is not checked against a map.
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Facilities</CardTitle>
            <CardDescription>
              List the facilities guests can use, including important
              restrictions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="facilities">Facilities — one per line</Label>
            <Textarea
              id="facilities"
              rows={6}
              value={form.facilitiesText}
              onChange={(e) => change("facilitiesText", e.target.value)}
              aria-describedby="facilities-help"
            />
            <p id="facilities-help" className="text-xs text-muted-foreground">
              Up to 30 different entries. A blank list means no facilities are
              listed yet.
            </p>
          </CardContent>
        </Card>
      </fieldset>
      <aside className="space-y-5 lg:sticky lg:top-8">
        <Card className="shadow-none">
          <CardHeader>
            <span className="mb-2 w-fit rounded-full bg-secondary px-3 py-1 text-xs font-medium">
              Private information
            </span>
            <CardTitle>
              {editable ? "Save your progress" : "Property information"}
            </CardTitle>
            <CardDescription>
              {editable
                ? "You can leave some details blank while preparing your draft. Saving does not publish the property."
                : "Editing through this setup page is available while the property is a private draft."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {dirty
                ? "Unsaved changes"
                : form.revision === null
                  ? "No additional details saved yet"
                  : "Saved to your account"}
            </p>
            {error && (
              <div role="alert" className="space-y-3 text-sm text-destructive">
                <p>{error}</p>
                {conflict && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.location.reload()}
                  >
                    Reload latest information
                  </Button>
                )}
                {needsSignIn && (
                  <Link href="/sign-in" className="text-primary underline">
                    Sign in again
                  </Link>
                )}
              </div>
            )}
            {saved && (
              <p role="status" className="text-sm font-medium text-primary">
                Property information saved.
              </p>
            )}
            {editable && !conflict && (
              <Button
                type="submit"
                className="w-full"
                disabled={pending || settling || (!dirty && !uncertain)}
              >
                {pending
                  ? "Saving…"
                  : uncertain
                    ? "Retry same save"
                    : "Save property information"}
              </Button>
            )}
            <Link
              href={`/owner/properties/${propertyId}`}
              className="block text-center text-sm font-medium text-primary underline underline-offset-4"
            >
              Back to property details
            </Link>
            {uncertain && (
              <p className="text-xs text-muted-foreground">
                Keep this page open until the save is confirmed.
              </p>
            )}
          </CardContent>
        </Card>
        <p className="px-1 text-xs text-muted-foreground">
          Use Photos and Location &amp; contact to prepare more of your draft. Publication review follows separately.
        </p>
      </aside>
    </form>
  );
}
