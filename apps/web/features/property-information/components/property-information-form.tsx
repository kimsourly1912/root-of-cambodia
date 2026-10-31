"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
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
import { TextLink } from "@/components/text-link";
import { StatusMessage } from "@/components/status-message";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
  const [hydrated, setHydrated] = useState(false),
    [dirty, setDirty] = useState(false),
    [pending, setPending] = useState(false),
    [settling, setSettling] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [conflict, setConflict] = useState(false),
    [error, setError] = useState(""),
    [needsSignIn, setNeedsSignIn] = useState(false),
    [saved, setSaved] = useState(false);
  const form = useForm({
    defaultValues: formFrom(information),
    onSubmit: async ({ value }) => {
      if (!hydrated || busy.current || completed.current) return;
      setNeedsSignIn(false);
      setError("");
      if (!attempt.current) {
        const facilities = value.facilitiesText
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
            description: value.description,
            address: value.address,
            facilities,
            revision: value.revision,
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
    },
  });
  // Keep displayed values and their expected version together after a confirmed refresh.
  useEffect(() => {
    const values = formFrom(information);
    for (const field of Object.keys(values) as (keyof typeof values)[]) {
      form.setFieldValue(field, values[field]);
    }
    setDirty(false);
    completed.current = false;
    setSettling(false);
    setHydrated(true);
  }, [information.revision]);
  const frozen = !hydrated || !editable || pending || settling || uncertain || conflict;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_280px]"
    >
      <fieldset disabled={frozen} className="min-w-0 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>About your property</CardTitle>
            <CardDescription>
              Help guests understand the place you’re preparing to share.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="description">Property description</Label>
            <form.Field name="description">{(field) =>
              <Textarea
                id="description"
                rows={6}
                maxLength={5000}
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                  setDirty(true);
                  setSaved(false);
                }}
                onBlur={field.handleBlur}
                aria-describedby="description-help"
              />
            }</form.Field>
            <p id="description-help" className="text-xs text-muted-foreground">
              Describe the property in your own words. Khmer and English text
              are supported.
            </p>
          </CardContent>
        </Card>
        <Card>
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
            <form.Field name="address">{(field) =>
              <Textarea
                id="address"
                rows={4}
                maxLength={1000}
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                  setDirty(true);
                  setSaved(false);
                }}
                onBlur={field.handleBlur}
                aria-describedby="address-help"
              />
            }</form.Field>
            <p id="address-help" className="text-xs text-muted-foreground">
              Include useful village, street and locality details. This address
              is not checked against a map.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Facilities</CardTitle>
            <CardDescription>
              List the facilities guests can use, including important
              restrictions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="facilities">Facilities — one per line</Label>
            <form.Field name="facilitiesText">{(field) =>
              <Textarea
                id="facilities"
                rows={6}
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                  setDirty(true);
                  setSaved(false);
                }}
                onBlur={field.handleBlur}
                aria-describedby="facilities-help"
              />
            }</form.Field>
            <p id="facilities-help" className="text-xs text-muted-foreground">
              Up to 30 different entries. A blank list means no facilities are
              listed yet.
            </p>
          </CardContent>
        </Card>
      </fieldset>
      <aside className="space-y-5 lg:sticky lg:top-8">
        <Card>
          <CardHeader>
            <Badge className="mb-2">
              Private information
            </Badge>
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
                : information.revision === null
                  ? "No additional details saved yet"
                  : "Saved to your account"}
            </p>
            {error && (
              <Alert variant="destructive" role="alert">
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
                  <TextLink href="/sign-in">
                    Sign in again
                  </TextLink>
                )}
              </Alert>
            )}
            {saved && (
              <StatusMessage tone="success">
                Property information saved.
              </StatusMessage>
            )}
            {editable && !conflict && (
              <Button
                type="submit"
                className="w-full"
                disabled={!hydrated || pending || settling || (!dirty && !uncertain)}
              >
                {pending
                  ? "Saving…"
                  : uncertain
                    ? "Retry same save"
                    : "Save property information"}
              </Button>
            )}
            <TextLink className="block text-center text-sm"
              href={`/owner/properties/${propertyId}`}>
              Back to property details
            </TextLink>
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
