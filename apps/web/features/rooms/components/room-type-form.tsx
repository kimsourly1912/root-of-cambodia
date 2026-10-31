"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OwnerRoomType } from "@root-of-cambodia/backend/rooms";
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
import { SectionTitle } from "@/components/typography";
import { TextLink } from "@/components/text-link";
import { StatusMessage } from "@/components/status-message";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
type Attempt = {
  key: string;
  body: {
    name: string;
    adultCapacity: number;
    childCapacity: number;
    totalCapacity: number;
    revision?: number;
  };
};
export function RoomTypeForm({
  propertyId,
  editable,
  room,
}: {
  propertyId: string;
  editable: boolean;
  room?: OwnerRoomType;
}) {
  const router = useRouter();
  const busy = useRef(false);
  const completed = useRef(false);
  const attempt = useRef<Attempt | null>(null);
  const [pending, setPending] = useState(false),
    [settling, setSettling] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [conflict, setConflict] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    completed.current = false;
    setSettling(false);
  }, [room?.id, room?.revision]);
  const base = `/owner/properties/${propertyId}/rooms`;
  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || completed.current) return;
    if (!attempt.current) {
      const data = new FormData(event.currentTarget);
      attempt.current = {
        key: crypto.randomUUID(),
        body: {
          name: String(data.get("name") ?? ""),
          adultCapacity: Number(data.get("adultCapacity")),
          childCapacity: Number(data.get("childCapacity")),
          totalCapacity: Number(data.get("totalCapacity")),
          ...(room ? { revision: room.revision } : {}),
        },
      };
    }
    busy.current = true;
    setPending(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch(
        "/api" + base + (room ? "/" + room.id : ""),
        {
          method: room ? "PATCH" : "POST",
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
        if (response.status === 409) {
          setConflict(true);
          setError(
            "The room type or property changed since you opened it. Reload the latest details before saving again.",
          );
        } else
          setError(
            response.status === 401 || response.status === 403
              ? "Your session needs attention. Sign in again, then return to this page."
              : response.status === 404
                ? "This room type is no longer available to your account."
                : "Check the name and guest limits, then try again.",
          );
        return;
      }
      const receipt = (await response.json()) as { id: string };
      attempt.current = null;
      completed.current = true;
      setSettling(true);
      setUncertain(false);
      setDirty(false);
      setSaved(true);
      router.replace(base + "/" + receipt.id);
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
  return (
    <form
      onSubmit={save}
      onChange={() => {
        setDirty(true);
        setSaved(false);
      }}
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_280px]"
    >
      <fieldset
        disabled={!editable || pending || settling || uncertain || conflict}
        className="min-w-0"
      >
        <Card>
          <CardHeader>
            <CardTitle>Room type details</CardTitle>
            <CardDescription>
              A room type groups units with the same name and guest limits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-7">
            <div className="space-y-2">
              <Label htmlFor="name">
                Room type name <span lang="km">· ប្រភេទបន្ទប់</span>
              </Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={200}
                defaultValue={room?.name}
              />
              <p className="text-xs text-muted-foreground">
                Use a name that helps guests tell your room types apart.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <SectionTitle size="sm">Guest limits per unit</SectionTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Set the adult, child and total limits separately. The total
                  limit applies to adults and children together.
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                {[
                  ["adultCapacity", "Maximum adults", 1, room?.adultCapacity],
                  ["childCapacity", "Maximum children", 0, room?.childCapacity],
                  [
                    "totalCapacity",
                    "Maximum total guests",
                    1,
                    room?.totalCapacity,
                  ],
                ].map(([name, label, min, value]) => (
                  <div key={String(name)} className="space-y-2">
                    <Label htmlFor={String(name)}>{String(label)}</Label>
                    <Input
                      id={String(name)}
                      name={String(name)}
                      type="number"
                      inputMode="numeric"
                      min={Number(min)}
                      max={100}
                      step={1}
                      required
                      defaultValue={
                        value === undefined ? undefined : Number(value)
                      }
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Infant and child-age policies remain undecided. These limits do
                not define those policies.
              </p>
            </div>
          </CardContent>
        </Card>
      </fieldset>
      <aside className="space-y-5 lg:sticky lg:top-8">
        <Card>
          <CardHeader>
            <Badge className="mb-2">
              Private setup
            </Badge>
            <CardTitle>
              {editable ? "Save your room type" : "Room type details"}
            </CardTitle>
            <CardDescription>
              {editable
                ? "Room types stay inside your private draft. Configure prices and dated availability separately."
                : "Editing is available while the property is a private draft."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {room && (
              <p className="text-xs text-muted-foreground">
                {dirty ? "Unsaved changes" : "Saved to your account"}
              </p>
            )}
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
                {!uncertain && !conflict && (
                  <TextLink href="/sign-in">
                    Sign in again
                  </TextLink>
                )}
              </Alert>
            )}
            {saved && (
              <StatusMessage tone="success">
                Room type saved.
              </StatusMessage>
            )}
            {editable && !conflict && (
              <Button
                type="submit"
                className="w-full"
                disabled={pending || settling}
              >
                {pending
                  ? "Saving…"
                  : uncertain
                    ? "Retry same save"
                    : "Save room type"}
              </Button>
            )}
            {room && (
              <TextLink className="block text-center text-sm"
                href={base + "/" + room.id + "/calendar"}>
                Prices and availability →
              </TextLink>
            )}
            <TextLink className="block text-center text-sm"
              href={base}>
              Back to room types
            </TextLink>
            {uncertain && (
              <p className="text-xs text-muted-foreground">
                Keep this page open until the save is confirmed.
              </p>
            )}
          </CardContent>
        </Card>
        <p className="px-1 text-xs text-muted-foreground">
          Set prices and availability from this room type. This does not publish
          your property.
        </p>
      </aside>
    </form>
  );
}
