"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import type { OwnerProperty } from "@root-of-cambodia/backend/properties";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TimeSelect } from "@/components/time-select";
import { TextLink } from "@/components/text-link";
import { StatusMessage } from "@/components/status-message";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
type Attempt = { key: string; body: Record<string, string | number> };
type PropertyFormValues = {
  ownerName: string;
  nameKm: string;
  nameEn: string;
  province: string;
  checkinTime: string;
  checkoutTime: string;
  policyText: string;
};
export function PropertyForm({
  property,
  ownerName = "",
  profileExists = false,
}: {
  property?: OwnerProperty;
  ownerName?: string;
  profileExists?: boolean;
}) {
  const router = useRouter();
  const pendingRef = useRef(false);
  const attempt = useRef<Attempt | null>(null);
  const completed = useRef(false);
  const [settling, setSettling] = useState(false);
  useEffect(() => {
    completed.current = false;
    setSettling(false);
  }, [property?.id, property?.revision]);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const readOnly = !!property && property.publication !== "draft";
  const defaultValues: PropertyFormValues = {
    ownerName,
    nameKm: property?.nameKm ?? "",
    nameEn: property?.nameEn ?? "",
    province: property?.province ?? "",
    checkinTime: property?.checkinTime ?? "",
    checkoutTime: property?.checkoutTime ?? "",
    policyText: property?.policyText ?? "",
  };
  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      if (pendingRef.current || completed.current) return;
      if (!attempt.current) {
        const body: Record<string, string | number> = {
          nameKm: value.nameKm,
          nameEn: value.nameEn,
          province: value.province,
          checkinTime: value.checkinTime,
          checkoutTime: value.checkoutTime,
          policyText: value.policyText,
        };
        if (!property) body.ownerName = value.ownerName;
        if (property) body.revision = property.revision;
        attempt.current = { key: crypto.randomUUID(), body };
      }
      pendingRef.current = true;
      setPending(true);
      setError("");
      setSaved(false);
      try {
        const response = await fetch(
          property
            ? `/api/owner/properties/${property.id}`
            : "/api/owner/properties",
          {
            method: property ? "PATCH" : "POST",
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
            "We couldn’t confirm this save. Your details are held here. Retry the same save to recover the result safely.",
          );
          return;
        }
        if (!response.ok) {
          attempt.current = null;
          setUncertain(false);
          if (response.status === 409) {
            setConflict(true);
            setError(
              "The property changed since you opened it. Reload the latest version and review your changes before saving again.",
            );
          } else
            setError(
              response.status === 401 || response.status === 403
                ? "Your session needs attention. Sign in again, then return to this page."
                : response.status === 404
                  ? "This property is no longer available to your account."
                  : "Check the fields and try again. The Khmer name, province, times and house rules are required.",
            );
          return;
        }
        const receipt = (await response.json()) as { id: string };
        attempt.current = null;
        setUncertain(false);
        completed.current = true;
        setSettling(true);
        setDirty(false);
        setSaved(true);
        router.replace(`/owner/properties/${receipt.id}`);
        router.refresh();
      } catch {
        setUncertain(true);
        setError(
          "The connection was interrupted. Retry the same save to check whether it completed.",
        );
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
    },
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_280px]"
      onChange={() => {
        setSaved(false);
        setDirty(true);
      }}
    >
      <div className="space-y-6">
        <fieldset
          disabled={pending || settling || uncertain || conflict || readOnly}
          className="space-y-6"
        >
          {!property && (
            <Card>
              <CardHeader>
                <CardTitle>Owner details</CardTitle>
                <CardDescription>
                  This name identifies your owner profile.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label htmlFor="ownerName">Owner display name</Label>
                <form.Field name="ownerName">
                  {(field) => (
                    <Input
                      className="mt-2"
                      id="ownerName"
                      name="ownerName"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      readOnly={profileExists}
                      required
                      maxLength={200}
                    />
                  )}
                </form.Field>
                {profileExists && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Using your existing owner profile.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Property essentials</CardTitle>
              <CardDescription>
                Use the details guests will need to recognise your property.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="nameKm">
                  Property name in Khmer{" "}
                  <span lang="km">· ឈ្មោះកន្លែងស្នាក់នៅ</span>
                </Label>
                <form.Field name="nameKm">
                  {(field) => (
                    <Input
                      id="nameKm"
                      name="nameKm"
                      lang="km"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      required
                      maxLength={200}
                    />
                  )}
                </form.Field>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameEn">
                  Property name in English{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <form.Field name="nameEn">
                  {(field) => (
                    <Input
                      id="nameEn"
                      name="nameEn"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      maxLength={200}
                    />
                  )}
                </form.Field>
              </div>
              <div className="space-y-2">
                <Label htmlFor="province">
                  Province <span lang="km">· ខេត្ត</span>
                </Label>
                <form.Field name="province">
                  {(field) => (
                    <Input
                      id="province"
                      name="province"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      required
                      maxLength={100}
                    />
                  )}
                </form.Field>
                <p className="text-xs text-muted-foreground">
                  Address and map details will be added later.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Stay details</CardTitle>
              <CardDescription>
                Enter your property’s own times and rules. Times use Cambodia
                time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="checkinTime">Check-in time</Label>
                  <form.Field name="checkinTime">
                    {(field) => (
                      <TimeSelect
                        id="checkinTime"
                        name="checkinTime"
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        onBlur={field.handleBlur}
                        required
                      />
                    )}
                  </form.Field>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkoutTime">Check-out time</Label>
                  <form.Field name="checkoutTime">
                    {(field) => (
                      <TimeSelect
                        id="checkoutTime"
                        name="checkoutTime"
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        onBlur={field.handleBlur}
                        required
                      />
                    )}
                  </form.Field>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="policyText">Property house rules</Label>
                <form.Field name="policyText">
                  {(field) => (
                    <Textarea
                      id="policyText"
                      name="policyText"
                      rows={7}
                      className="min-h-40"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      onBlur={field.handleBlur}
                      required
                      maxLength={10000}
                      aria-describedby="policy-help"
                    />
                  )}
                </form.Field>
                <p id="policy-help" className="text-xs text-muted-foreground">
                  Add the house rules you want guests to know. You can revise
                  them while this property is a draft.
                </p>
              </div>
            </CardContent>
          </Card>
        </fieldset>
      </div>
      <aside className="space-y-5 lg:sticky lg:top-8">
        <Card>
          <CardHeader>
            <Badge className="mb-2">
              {property?.publication ?? "Private draft"}
            </Badge>
            <CardTitle>
              {readOnly ? "Saved property" : "Your progress is private"}
            </CardTitle>
            <CardDescription>
              {readOnly
                ? "This page can view this property. Editing beyond draft status is not available in this preview."
                : "Save now and return later. Nothing is published and guests cannot book this draft."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {property && (
              <p className="text-xs text-muted-foreground">
                {dirty ? "Unsaved changes" : "Saved to your account"}
              </p>
            )}
            {error && (
              <Alert variant="destructive" role="alert">
                <p>{error}</p>
                {conflict ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.location.reload()}
                  >
                    Reload latest version
                  </Button>
                ) : (
                  !uncertain && (
                    <TextLink href="/sign-in">
                      Sign in again
                    </TextLink>
                  )
                )}
              </Alert>
            )}
            {saved && (
              <StatusMessage tone="success">
                Draft saved.
              </StatusMessage>
            )}
            {!readOnly && !conflict && (
              <Button
                type="submit"
                className="w-full"
                disabled={pending || settling}
              >
                {pending
                  ? "Saving…"
                  : uncertain
                    ? "Retry same save"
                    : "Save private draft"}
              </Button>
            )}
            <TextLink className="block text-center text-sm"
              href="/owner">
              Back to your properties
            </TextLink>
            {uncertain && (
              <p className="text-xs text-muted-foreground">
                Keep this page open until the save is confirmed.
              </p>
            )}
          </CardContent>
        </Card>
        <p className="px-1 text-xs text-muted-foreground">
          Use Room types to set up rooms, prices and availability. Photos and
          publication review will follow later.
        </p>
      </aside>
    </form>
  );
}
