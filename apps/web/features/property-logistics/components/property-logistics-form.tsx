"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import type { PropertyLogistics } from "@root-of-cambodia/backend/property-logistics";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
const formFrom = (logistics: PropertyLogistics) => ({
  latitude: logistics.latitude === null ? "" : String(logistics.latitude),
  longitude: logistics.longitude === null ? "" : String(logistics.longitude),
  contactName: logistics.contactName,
  contactPhone: logistics.contactPhone,
  contactEmail: logistics.contactEmail,
  arrivalInstructions: logistics.arrivalInstructions,
  revision: logistics.revision,
});
export function PropertyLogisticsForm({
  propertyId,
  logistics,
  editable,
}: {
  propertyId: string;
  logistics: PropertyLogistics;
  editable: boolean;
}) {
  const router = useRouter(),
    busy = useRef(false),
    completed = useRef(false),
    attempt = useRef<{ key: string; body: PropertyLogistics } | null>(null);
  const [dirty, setDirty] = useState(false),
    [pending, setPending] = useState(false),
    [settling, setSettling] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [conflict, setConflict] = useState(false),
    [error, setError] = useState(""),
    [needsSignIn, setNeedsSignIn] = useState(false),
    [saved, setSaved] = useState(false);
  const form = useForm({
    defaultValues: formFrom(logistics),
    onSubmit: async ({ value }) => {
      if (busy.current || completed.current) return;
      setNeedsSignIn(false);
      setError("");
      if (!attempt.current) {
        const latitude = value.latitude.trim() === "" ? null : Number(value.latitude);
        const longitude = value.longitude.trim() === "" ? null : Number(value.longitude);
        if ((latitude === null) !== (longitude === null) ||
          (latitude !== null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90)) ||
          (longitude !== null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180))) {
          setError("Enter both valid coordinates, or leave both blank.");
          return;
        }
        attempt.current = {
          key: crypto.randomUUID(),
          body: {
            latitude, longitude,
            contactName: value.contactName,
            contactPhone: value.contactPhone,
            contactEmail: value.contactEmail,
            arrivalInstructions: value.arrivalInstructions,
            revision: value.revision,
          },
        };
      }
      busy.current = true;
      setPending(true);
      setSaved(false);
      try {
        const response = await fetch(
          `/api/owner/properties/${propertyId}/logistics`,
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
              "These details or your access changed since you opened this page. Reload the latest details before saving again.",
            );
          } else
            setError(
              response.status === 401 || response.status === 403
                ? "Your session needs attention. Sign in again, then return to this page."
                : response.status === 404
                  ? "This property is no longer available to your account."
                  : "Check the coordinates, contact details and arrival instructions, then try again.",
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
    const values = formFrom(logistics);
    for (const field of Object.keys(values) as (keyof typeof values)[]) {
      form.setFieldValue(field, values[field]);
    }
    setDirty(false);
    completed.current = false;
    setSettling(false);
  }, [logistics.revision]);
  const frozen = !editable || pending || settling || uncertain || conflict;
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
            <CardTitle>Location coordinates</CardTitle>
            <CardDescription>Optional coordinates for the property you are preparing.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <form.Field name="latitude">{(field) =>
                <Input id="latitude" type="number" step="any" min={-90} max={90}
                  value={field.state.value} onChange={(event) => {
                    field.handleChange(event.target.value);
                    setDirty(true);
                    setSaved(false);
                  }} onBlur={field.handleBlur}
                  aria-describedby="coordinates-help" />
              }</form.Field>
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <form.Field name="longitude">{(field) =>
                <Input id="longitude" type="number" step="any" min={-180} max={180}
                  value={field.state.value} onChange={(event) => {
                    field.handleChange(event.target.value);
                    setDirty(true);
                    setSaved(false);
                  }} onBlur={field.handleBlur}
                  aria-describedby="coordinates-help" />
              }</form.Field>
            </div>
            <p id="coordinates-help" className="text-xs text-muted-foreground sm:col-span-2">
              Enter both coordinates or leave both blank. They are not checked against a map.
              You can edit the address in the Information tab.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Property contact</CardTitle>
            <CardDescription>Keep the contact details you plan to use for your property.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Contact name</Label>
              <form.Field name="contactName">{(field) =>
                <Input id="contact-name" maxLength={200} value={field.state.value}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                    setDirty(true);
                    setSaved(false);
                  }} onBlur={field.handleBlur} />
              }</form.Field>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Contact phone</Label>
              <form.Field name="contactPhone">{(field) =>
                <Input id="contact-phone" type="tel" maxLength={100} value={field.state.value}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                    setDirty(true);
                    setSaved(false);
                  }} onBlur={field.handleBlur} aria-describedby="contact-help" />
              }</form.Field>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Contact email</Label>
              <form.Field name="contactEmail">{(field) =>
                <Input id="contact-email" type="email" maxLength={254} value={field.state.value}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                    setDirty(true);
                    setSaved(false);
                  }} onBlur={field.handleBlur} aria-describedby="contact-help" />
              }</form.Field>
            </div>
            <p id="contact-help" className="text-xs text-muted-foreground">
              These are owner-entered contact details, not verified contact methods.
              Changing them does not change your sign-in email.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Arrival instructions</CardTitle>
            <CardDescription>Add useful directions and practical information for a future stay.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="arrival-instructions">Directions and arrival notes</Label>
            <form.Field name="arrivalInstructions">{(field) =>
              <Textarea id="arrival-instructions" rows={6} maxLength={5000}
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                  setDirty(true);
                  setSaved(false);
                }} onBlur={field.handleBlur}
                aria-describedby="arrival-help" />
            }</form.Field>
            <p id="arrival-help" className="text-xs text-muted-foreground">
              These notes do not change booking terms or enable check-in.
              Keep passwords, access codes and other secrets out of this field.
            </p>
          </CardContent>
        </Card>
      </fieldset>
      <aside className="space-y-5 lg:sticky lg:top-8">
        <Card>
          <CardHeader>
            <Badge className="mb-2">
              Private draft details
            </Badge>
            <CardTitle>
              {editable ? "Save your progress" : "Location & contact"}
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
                : logistics.revision === null
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
                    Reload latest details
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
                Location and contact details saved.
              </StatusMessage>
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
                    : "Save location and contact"}
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
          Saving these details does not publish the property or share them with guests.
        </p>
      </aside>
    </form>
  );
}
