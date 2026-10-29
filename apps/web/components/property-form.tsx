"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OwnerProperty } from "@root-of-cambodia/backend/property-queries";
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
type Attempt = { key: string; body: Record<string, string | number> };
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
  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current || completed.current) return;
    if (!attempt.current) {
      const data = new FormData(event.currentTarget);
      const body: Record<string, string | number> = {};
      for (const name of [
        "nameKm",
        "nameEn",
        "province",
        "checkinTime",
        "checkoutTime",
        "policyText",
        ...(!property ? ["ownerName"] : []),
      ])
        body[name] = String(data.get(name) ?? "");
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
  }
  return (
    <form
      onSubmit={save}
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
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Owner details</CardTitle>
                <CardDescription>
                  This name identifies your owner profile.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label htmlFor="ownerName">Owner display name</Label>
                <Input
                  className="mt-2"
                  id="ownerName"
                  name="ownerName"
                  defaultValue={ownerName}
                  readOnly={profileExists}
                  required
                  maxLength={200}
                />
                {profileExists && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Using your existing owner profile.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          <Card className="shadow-none">
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
                <Input
                  id="nameKm"
                  name="nameKm"
                  lang="km"
                  defaultValue={property?.nameKm}
                  required
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameEn">
                  Property name in English{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="nameEn"
                  name="nameEn"
                  defaultValue={property?.nameEn}
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="province">
                  Province <span lang="km">· ខេត្ត</span>
                </Label>
                <Input
                  id="province"
                  name="province"
                  defaultValue={property?.province}
                  required
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">
                  Address and map details will be added later.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-none">
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
                  <Input
                    id="checkinTime"
                    name="checkinTime"
                    type="time"
                    step={60}
                    defaultValue={property?.checkinTime}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkoutTime">Check-out time</Label>
                  <Input
                    id="checkoutTime"
                    name="checkoutTime"
                    type="time"
                    step={60}
                    defaultValue={property?.checkoutTime}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="policyText">Property house rules</Label>
                <Textarea
                  id="policyText"
                  name="policyText"
                  rows={7}
                  className="min-h-40"
                  defaultValue={property?.policyText}
                  required
                  maxLength={10000}
                  aria-describedby="policy-help"
                />
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
        <Card className="shadow-none">
          <CardHeader>
            <span className="mb-2 w-fit rounded-full bg-secondary px-3 py-1 text-xs font-medium">
              {property?.publication ?? "Private draft"}
            </span>
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
              <div role="alert" className="space-y-3 text-sm text-destructive">
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
                    <Link href="/sign-in" className="text-primary underline">
                      Sign in again
                    </Link>
                  )
                )}
              </div>
            )}
            {saved && (
              <p role="status" className="text-sm font-medium text-primary">
                Draft saved.
              </p>
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
            <Link
              href="/owner"
              className="block text-center text-sm font-medium text-primary underline underline-offset-4"
            >
              Back to your properties
            </Link>
            {uncertain && (
              <p className="text-xs text-muted-foreground">
                Keep this page open until the save is confirmed.
              </p>
            )}
          </CardContent>
        </Card>
        <p className="px-1 text-xs text-muted-foreground">
          Use Room types to continue setup. Prices, availability and publication
          review will be added separately.
        </p>
      </aside>
    </form>
  );
}
