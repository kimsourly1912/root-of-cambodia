"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import {
  ArrowLeft,
  ArrowRight,
  ImageOff,
  ImagePlus,
  Images,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { MediaGallery } from "@root-of-cambodia/backend/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SectionTitle } from "@/components/typography";
import { EmptyState } from "@/components/empty-state";
import { StatusMessage } from "@/components/status-message";
import { cn } from "@/lib/utils";
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
const accepted = ["image/jpeg", "image/png", "image/webp"],
  maxBytes = 8 * 1024 * 1024,
  maxPhotos = 20;
function fileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export function PropertyPhotos({
  propertyId,
  initial,
}: {
  propertyId: string;
  initial: MediaGallery;
}) {
  const base = `/api/owner/properties/${propertyId}/photos`;
  const router = useRouter();
  const attempt = useRef<Attempt | null>(null),
    busy = useRef(false),
    fileInput = useRef<HTMLInputElement>(null);
  const [gallery, setGallery] = useState(initial),
    [pending, setPending] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [conflict, setConflict] = useState(false),
    [error, setError] = useState(""),
    [fileError, setFileError] = useState(""),
    [message, setMessage] = useState(""),
    [preview, setPreview] = useState(""),
    [dragging, setDragging] = useState(false),
    [uploading, setUploading] = useState(false);
  const form = useForm({
    defaultValues: { file: null as File | null },
    onSubmit: async ({ value }) => upload(value.file),
  });
  // The local preview is an object URL; release it when it is replaced or the page closes.
  useEffect(() => () => URL.revokeObjectURL(preview), [preview]);
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
  function choose(file: File | null) {
    form.setFieldValue("file", file);
    setPreview(file ? URL.createObjectURL(file) : "");
    setError("");
    setMessage("");
    setFileError(
      file && (!accepted.includes(file.type) || file.size < 1 || file.size > maxBytes)
        ? "Choose a JPEG, PNG or WebP file up to 8 MiB."
        : "",
    );
  }
  function clear() {
    choose(null);
    if (fileInput.current) fileInput.current.value = "";
  }
  async function execute() {
    if (busy.current || !attempt.current) return;
    busy.current = true;
    setPending(true);
    setUploading(attempt.current.kind === "upload");
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
      router.refresh();
      attempt.current = null;
      setUncertain(false);
      if (action.kind === "upload") {
        form.reset();
        clear();
      }
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
      setUploading(false);
    }
  }
  async function upload(file: File | null) {
    if (busy.current || attempt.current || !file) return;
    if (
      !accepted.includes(file.type) ||
      file.size < 1 ||
      file.size > maxBytes
    ) {
      setFileError("Choose a JPEG, PNG or WebP file up to 8 MiB.");
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
      setFileError("The file could not be read. Choose it again.");
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
  const frozen = pending || uncertain || conflict,
    full = gallery.photos.length >= maxPhotos;
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Add a photo</h2>
          </CardTitle>
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
            <Label htmlFor="property-photo" className="sr-only">
              Photo file
            </Label>
            {/* The file input covers the whole zone, so a click, a keypress or a
                dropped file all reach the browser's own picker. */}
            <div
              onDragEnter={() => setDragging(true)}
              onDragLeave={() => setDragging(false)}
              onDrop={() => setDragging(false)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 has-[:disabled]:opacity-60",
                dragging ? "border-primary bg-secondary" : "hover:bg-muted/50",
              )}
            >
              <ImagePlus className="size-10 text-primary" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {full
                    ? "You have reached 20 photos"
                    : dragging
                      ? "Drop the photo to choose it"
                      : "Drag a photo here, or click to browse"}
                </p>
                <p id="photo-limits" className="text-xs text-muted-foreground">
                  {full
                    ? "Remove a photo to add another."
                    : "Still JPEG, PNG or WebP, up to 8 MiB each. Maximum 8,000 pixels per side and 24 megapixels. Up to 20 photos, including unfinished uploads."}
                </p>
              </div>
              <form.Field name="file">
                {() => (
                  <Input
                    ref={fileInput}
                    id="property-photo"
                    type="file"
                    accept={accepted.join(",")}
                    disabled={frozen || full}
                    onChange={(event) =>
                      choose(event.target.files?.[0] ?? null)
                    }
                    aria-describedby={
                      fileError ? "photo-limits photo-file-error" : "photo-limits"
                    }
                    aria-invalid={fileError ? true : undefined}
                    className="absolute inset-0 h-full cursor-pointer opacity-0"
                  />
                )}
              </form.Field>
            </div>
            <form.Subscribe selector={(state) => state.values.file}>
              {(file) =>
                file && (
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 sm:flex-nowrap">
                    {/* Decorative: the file name beside it says what was chosen. */}
                    <img
                      src={preview}
                      alt=""
                      className="size-16 shrink-0 rounded-lg bg-muted object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {fileSize(file.size)}
                      </p>
                    </div>
                    <div className="flex w-full gap-2 sm:w-auto">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={frozen}
                        aria-label="Clear chosen photo"
                        onClick={clear}
                      >
                        <X />
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1 sm:flex-none"
                        disabled={frozen || full || !!fileError}
                      >
                        <Upload data-icon="inline-start" />
                        {pending ? "Saving…" : "Upload photo"}
                      </Button>
                    </div>
                  </div>
                )
              }
            </form.Subscribe>
            {fileError && (
              <StatusMessage tone="error" id="photo-file-error">
                {fileError}
              </StatusMessage>
            )}
          </form>
        </CardContent>
      </Card>
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="space-y-3">
            <p>{error}</p>
            {uncertain ? (
              <Button
                type="button"
                disabled={pending}
                onClick={() => void execute()}
              >
                {pending ? "Checking…" : "Retry same action"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Reload latest photos
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      {message && <StatusMessage tone="success">{message}</StatusMessage>}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <SectionTitle>Your photos</SectionTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              The order here is the order you arrange them in.
            </p>
          </div>
          <Badge variant={full ? "destructive" : "secondary"}>
            {gallery.photos.length} of {maxPhotos} photos
          </Badge>
        </div>
        {!gallery.photos.length && !uploading ? (
          <EmptyState
            icon={<Images />}
            description="No photos yet. Add your first property photo above."
          />
        ) : (
          <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {gallery.photos.map((photo, index) => (
              <li key={photo.id} className="min-w-0">
                <Card className="gap-0 py-0">
                  <div className="relative aspect-4/3 bg-muted">
                    {photo.state === "ready" ? (
                      <GalleryImage
                        src={`${base}/${photo.id}`}
                        alt={`Property photo ${index + 1}`}
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
                        <ImageOff className="size-6" aria-hidden="true" />
                        Unfinished upload. Remove it and upload again if this
                        page was closed.
                      </div>
                    )}
                    <Badge
                      variant="outline"
                      className="absolute top-3 left-3 bg-card"
                    >
                      {index + 1}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 p-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="text-sm font-medium">Photo {index + 1}</p>
                      {photo.state === "pending" && (
                        <Badge variant="destructive">Unfinished</Badge>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        disabled={frozen || index === 0}
                        aria-label={`Move photo ${index + 1} earlier`}
                        title="Move earlier"
                        onClick={() => move(index, -1)}
                      >
                        <ArrowLeft />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        disabled={frozen || index === gallery.photos.length - 1}
                        aria-label={`Move photo ${index + 1} later`}
                        title="Move later"
                        onClick={() => move(index, 1)}
                      >
                        <ArrowRight />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-sm"
                        disabled={frozen}
                        aria-label={`Remove photo ${index + 1}`}
                        title="Remove"
                        onClick={() => edit({ action: "remove", id: photo.id })}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
            {uploading && (
              <li className="min-w-0" aria-hidden="true">
                <Card className="gap-0 py-0">
                  <Skeleton className="aspect-4/3 rounded-none" />
                  <div className="flex items-center justify-between gap-2 p-3">
                    <p className="text-sm text-muted-foreground">Uploading…</p>
                    <Skeleton className="h-7 w-24 rounded-lg" />
                  </div>
                </Card>
              </li>
            )}
          </ol>
        )}
      </section>
      <p className="text-xs text-muted-foreground">
        Order applies to this private gallery. Public display and publication
        requirements will be reviewed separately.
      </p>
    </div>
  );
}
// A private photo with a skeleton until it arrives, and a plain notice if it cannot load.
function GalleryImage({ src, alt }: { src: string; alt: string }) {
  const image = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"loading" | "loaded" | "failed">(
    "loading",
  );
  // A cached image can finish before hydration attaches onLoad.
  useEffect(() => {
    if (image.current?.complete)
      setState(image.current.naturalWidth > 0 ? "loaded" : "failed");
  }, []);
  return (
    <>
      {state === "loading" && (
        <Skeleton className="absolute inset-0 rounded-none" />
      )}
      {state === "failed" ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
          <ImageOff className="size-6" aria-hidden="true" />
          This photo could not be shown. Reload the page to try again.
        </div>
      ) : (
        <img
          ref={image}
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setState("loaded")}
          onError={() => setState("failed")}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-300",
            state === "loaded" ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </>
  );
}
