"use client";
import { useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import type { MediaGallery } from "@root-of-cambodia/backend/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

import { SectionTitle } from "@/components/typography";
import { EmptyState } from "@/components/empty-state";
import { StatusMessage } from "@/components/status-message";
import { Alert } from "@/components/ui/alert";
type Attempt =
  | {
      kind: "upload";
      file: File;
      key: string;
      body: Record<string, unknown>;
      id?: string;
    }
  | { kind: "edit"; key: string; body: Record<string, unknown> };
class Rejected extends Error {
  constructor(public status: number) {
    super("Request rejected");
  }
}
export function PropertyPhotos({
  propertyId,
  initial,
}: {
  propertyId: string;
  initial: MediaGallery;
}) {
  const base = `/api/owner/properties/${propertyId}/photos`;
  const attempt = useRef<Attempt | null>(null),
    busy = useRef(false),
    fileInput = useRef<HTMLInputElement>(null);
  const [gallery, setGallery] = useState(initial),
    [pending, setPending] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [conflict, setConflict] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const form = useForm({
    defaultValues: { file: null as File | null },
    onSubmit: async ({ value }) => upload(value.file),
  });
  async function checked(response: Response) {
    if (!response.ok) {
      if (response.status < 500) throw new Rejected(response.status);
      throw new Error("uncertain");
    }
    return response;
  }
  async function refresh() {
    const response = await checked(await fetch(base, { cache: "no-store" }));
    const result = (await response.json()) as MediaGallery;
    setGallery(result);
    return result;
  }
  async function execute() {
    if (busy.current || !attempt.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const action = attempt.current;
      if (action.kind === "upload") {
        if (!action.id) {
          const response = await checked(
            await fetch(base, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": action.key,
              },
              body: JSON.stringify(action.body),
            }),
          );
          action.id = ((await response.json()) as { id: string }).id;
        }
        await checked(
          await fetch(`${base}/${action.id}`, {
            method: "PUT",
            headers: { "Content-Type": action.file.type },
            body: action.file,
          }),
        );
      } else {
        await checked(
          await fetch(base, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": action.key,
            },
            body: JSON.stringify(action.body),
          }),
        );
      }
      // Retain the complete attempt until both commit and fresh gallery are confirmed.
      await refresh();
      attempt.current = null;
      setUncertain(false);
      form.reset();
      if (fileInput.current) fileInput.current.value = "";
      setMessage(
        action.kind === "upload"
          ? "Photo saved privately."
          : "Photo changes saved.",
      );
    } catch (cause) {
      if (cause instanceof Rejected) {
        attempt.current = null;
        setUncertain(false);
        setConflict(cause.status === 409);
        setError(
          cause.status === 409
            ? "The photos changed in another tab. Reload the latest photos before trying again."
            : cause.status === 401 || cause.status === 403
              ? "Sign in with your verified account again, then return here."
              : cause.status === 404
                ? "This draft or photo is no longer available to your account."
                : "The photo could not be accepted. Use a still JPEG, PNG or WebP within the limits below. Reload to remove any unfinished upload.",
        );
      } else {
        setUncertain(true);
        setError(
          "We couldn't confirm the result. Keep this page open and retry the same action safely.",
        );
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function upload(file: File | null) {
    if (busy.current || attempt.current || !file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size < 1 ||
      file.size > 8 * 1024 * 1024
    ) {
      setError("Choose a JPEG, PNG or WebP file up to 8 MiB.");
      return;
    }
    // Freeze before hashing too, so a quick second click cannot create another attempt.
    busy.current = true;
    setPending(true);
    try {
      const bytes = await file.arrayBuffer(),
        hash = await crypto.subtle.digest("SHA-256", bytes);
      const sha256 = Array.from(new Uint8Array(hash), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      attempt.current = {
        kind: "upload",
        file,
        key: crypto.randomUUID(),
        body: {
          contentType: file.type,
          byteSize: file.size,
          sha256,
          revision: gallery.revision,
        },
      };
    } catch {
      setError("The file could not be read. Choose it again.");
    } finally {
      busy.current = false;
      setPending(false);
    }
    await execute();
  }
  function edit(body: Record<string, unknown>) {
    if (busy.current || attempt.current) return;
    attempt.current = {
      kind: "edit",
      key: crypto.randomUUID(),
      body: { ...body, revision: gallery.revision },
    };
    void execute();
  }
  function move(index: number, delta: number) {
    const ids = gallery.photos.map((photo) => photo.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    edit({ action: "reorder", ids });
  }
  const frozen = pending || uncertain || conflict;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add a photo</CardTitle>
          <CardDescription>
            Only you can view these draft photos. Uploading does not publish the
            property.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            <Label htmlFor="property-photo">Photo file</Label>
            <form.Field name="file">
              {(field) => (
                <Input
                  ref={fileInput}
                  id="property-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={frozen || gallery.photos.length >= 20}
                  onChange={(event) => {
                    field.handleChange(event.target.files?.[0] ?? null);
                    setError("");
                    setMessage("");
                  }}
                  aria-describedby="photo-limits"
                />
              )}
            </form.Field>
            <p id="photo-limits" className="text-xs text-muted-foreground">
              Still JPEG, PNG or WebP, up to 8 MiB each. Maximum 8,000 pixels
              per side and 24 megapixels. Up to 20 photos, including unfinished
              uploads.
            </p>
            <form.Subscribe selector={(state) => state.values.file}>
              {(file) => (
                <Button
                  type="submit"
                  disabled={frozen || !file || gallery.photos.length >= 20}
                >
                  {pending ? "Saving." : "Upload photo"}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>
      {error && (
        <Alert variant="destructive" role="alert">
          <p>{error}</p>
          {uncertain && (
            <Button
              type="button"
              disabled={pending}
              onClick={() => void execute()}
            >
              {pending ? "Checking." : "Retry same action"}
            </Button>
          )}
          {!uncertain && (
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Reload latest photos
            </Button>
          )}
        </Alert>
      )}
      {message && (
        <StatusMessage tone="success">
          {message}
        </StatusMessage>
      )}
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>Your photos</SectionTitle>
        <p className="text-sm text-muted-foreground">
          {gallery.photos.length} / 20
        </p>
      </div>
      {!gallery.photos.length ? (
        <EmptyState description="No photos yet. Add your first property photo above." />
      ) : (
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {gallery.photos.map((photo, index) => (
            <li
              key={photo.id}
              className="min-w-0 overflow-hidden rounded-xl border bg-card"
            >
              {photo.state === "ready" ? (
                <img
                  src={`${base}/${photo.id}`}
                  alt={`Property photo ${index + 1}`}
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-muted px-6 text-center text-sm text-muted-foreground">
                  Unfinished upload. Remove it and upload again if this page was
                  closed.
                </div>
              )}
              <div className="space-y-3 p-4">
                <p className="text-sm font-medium">
                  Photo {index + 1}
                  {photo.state === "pending" ? " · Unfinished" : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={frozen || index === 0}
                    aria-label={`Move photo ${index + 1} earlier`}
                    onClick={() => move(index, -1)}
                  >
                    Move earlier
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={frozen || index === gallery.photos.length - 1}
                    aria-label={`Move photo ${index + 1} later`}
                    onClick={() => move(index, 1)}
                  >
                    Move later
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={frozen}
                    aria-label={`Remove photo ${index + 1}`}
                    onClick={() => edit({ action: "remove", id: photo.id })}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-muted-foreground">
        Order applies to this private gallery. Public display and publication
        requirements will be reviewed separately.
      </p>
    </div>
  );
}
