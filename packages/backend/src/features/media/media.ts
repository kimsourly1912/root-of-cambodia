import { DomainError } from "../../shared/index";
import { type Actor } from "../../shared/index";
import { ownerMediaAsset, requireMediaOwner, mediaKeys } from "./media-queries";
import {
  registerMedia,
  completeMedia,
  reorderMedia,
  removeMedia,
  type UploadDescriptor,
} from "./media-persistence";

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export interface PhotoProcessor {
  inspect(
    bytes: Uint8Array,
  ): Promise<{ format: string; width: number; height: number }>;
  preview(bytes: Uint8Array): Promise<Uint8Array>;
}
export type PhotoStore = Pick<R2Bucket, "get" | "put" | "delete">;
function validRevision(value: unknown, absent = false): value is number | null {
  return (
    (absent && value === null) ||
    (Number.isSafeInteger(value) && Number(value) > 0)
  );
}
function exactFields(input: Record<string, unknown>, names: string[]) {
  if (
    Object.keys(input).length !== names.length ||
    names.some((name) => !Object.hasOwn(input, name))
  )
    throw new DomainError("invalid_photo", 422);
}
export async function preparePhoto(
  db: D1Database,
  actor: Actor,
  key: string,
  propertyId: string,
  input: Record<string, unknown>,
) {
  await requireMediaOwner(db, actor, propertyId);
  exactFields(input, ["contentType", "byteSize", "sha256", "revision"]);
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(
      String(input.contentType),
    ) ||
    !Number.isSafeInteger(input.byteSize) ||
    Number(input.byteSize) < 1 ||
    Number(input.byteSize) > MAX_PHOTO_BYTES ||
    typeof input.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(input.sha256) ||
    !validRevision(input.revision, true)
  )
    throw new DomainError("invalid_photo", 422);
  const fields: UploadDescriptor = {
    contentType: input.contentType as UploadDescriptor["contentType"],
    byteSize: Number(input.byteSize),
    sha256: input.sha256,
  };
  const result = await registerMedia(
    db,
    actor,
    key,
    propertyId,
    input.revision,
    fields,
  );
  await requireMediaOwner(db, actor, propertyId);
  return result;
}
export async function editPhotos(
  db: D1Database,
  actor: Actor,
  key: string,
  propertyId: string,
  input: Record<string, unknown>,
) {
  await requireMediaOwner(db, actor, propertyId);
  if (input.action === "reorder") {
    exactFields(input, ["action", "revision", "ids"]);
    if (
      !validRevision(input.revision) ||
      !Array.isArray(input.ids) ||
      input.ids.length > 20 ||
      input.ids.some(
        (id) => typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id),
      ) ||
      new Set(input.ids).size !== input.ids.length
    )
      throw new DomainError("invalid_photo", 422);
    const result = await reorderMedia(
      db,
      actor,
      key,
      propertyId,
      input.revision!,
      input.ids as string[],
    );
    await requireMediaOwner(db, actor, propertyId);
    return result;
  }
  if (input.action === "remove") {
    exactFields(input, ["action", "revision", "id"]);
    if (!validRevision(input.revision) || typeof input.id !== "string")
      throw new DomainError("invalid_photo", 422);
    const result = await removeMedia(
      db,
      actor,
      key,
      propertyId,
      input.revision!,
      input.id,
    );
    await requireMediaOwner(db, actor, propertyId);
    return result;
  }
  throw new DomainError("invalid_photo", 422);
}
export async function photoDigest(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
// Header checks only reject unsupported inputs. The Images decoder remains the
// authority for whether a file is a usable image; a filename is never evidence.
function sourceFormat(bytes: Uint8Array) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  const text = (a: number, b: number) =>
    String.fromCharCode(...bytes.subarray(a, b));
  if (
    bytes.length >= 33 &&
    bytes[0] === 137 &&
    text(1, 8) === "PNG\r\n\x1a\n"
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 8; i + 12 <= bytes.length; ) {
      const length = view.getUint32(i);
      if (length > bytes.length - i - 12)
        throw new DomainError("invalid_photo", 422);
      if (text(i + 4, i + 8) === "acTL")
        throw new DomainError("invalid_photo", 422);
      i += length + 12;
    }
    return "image/png";
  }
  if (bytes.length >= 20 && text(0, 4) === "RIFF" && text(8, 12) === "WEBP") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(4, true) + 8 !== bytes.length)
      throw new DomainError("invalid_photo", 422);
    for (let i = 12; i + 8 <= bytes.length; ) {
      const length = view.getUint32(i + 4, true),
        kind = text(i, i + 4);
      if (
        length > bytes.length - i - 8 ||
        kind === "ANIM" ||
        kind === "ANMF" ||
        (kind === "VP8X" && (bytes[i + 8] & 2) !== 0)
      )
        throw new DomainError("invalid_photo", 422);
      i += 8 + length + (length % 2);
    }
    return "image/webp";
  }
  throw new DomainError("invalid_photo", 422);
}
function dimensions(width: number, height: number, max = 8000) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > max ||
    height > max ||
    width * height > 24_000_000
  )
    throw new DomainError("invalid_photo", 422);
}
// Strip every JPEG APP/COM segment, including EXIF/GPS, ICC and comments. This
// also protects local previews where the Images emulator implements fewer options.
export function safeJpeg(bytes: Uint8Array) {
  if (
    bytes.length < 4 ||
    bytes.length > MAX_PHOTO_BYTES ||
    bytes[0] !== 255 ||
    bytes[1] !== 216
  )
    throw new DomainError("photo_processing_unavailable", 503);
  const chunks: Uint8Array[] = [bytes.subarray(0, 2)];
  let foundDimensions = false,
    foundScan = false;
  for (let i = 2; i < bytes.length; ) {
    const start = i;
    if (bytes[i++] !== 255) break;
    while (bytes[i] === 255) i++;
    const marker = bytes[i++];
    if (marker === 217) {
      if (!foundDimensions || !foundScan || i !== bytes.length) break;
      chunks.push(bytes.subarray(start, i));
      const result = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result;
    }
    if (
      marker === 0 ||
      marker === 216 ||
      marker === 1 ||
      (marker >= 208 && marker <= 215)
    )
      break;
    if (i + 2 > bytes.length) break;
    const length = bytes[i] * 256 + bytes[i + 1];
    if (length < 2 || i + length > bytes.length) break;
    if ([192, 193, 194].includes(marker)) {
      if (length < 8) break;
      dimensions(
        bytes[i + 5] * 256 + bytes[i + 6],
        bytes[i + 3] * 256 + bytes[i + 4],
        1600,
      );
      foundDimensions = true;
    }
    if (!((marker >= 224 && marker <= 239) || marker === 254))
      chunks.push(bytes.subarray(start, i + length));
    i += length;
    if (marker === 218) {
      foundScan = true;
      const scanStart = i;
      // Entropy data escapes FF as FF00; restart markers are part of the scan.
      // Stop at the next structural marker, including in progressive JPEGs,
      // so metadata between scans or before EOI is stripped too.
      while (i < bytes.length) {
        if (bytes[i] === 255) {
          const next = bytes[i + 1];
          if (next === 0 || (next >= 208 && next <= 215)) {
            i += 2;
            continue;
          }
          break;
        }
        i++;
      }
      chunks.push(bytes.subarray(scanStart, i));
    }
  }
  throw new DomainError("photo_processing_unavailable", 503);
}
export async function uploadPhoto(
  db: D1Database,
  store: PhotoStore,
  processor: PhotoProcessor,
  actor: Actor,
  propertyId: string,
  id: string,
  bytes: Uint8Array,
) {
  const asset = await ownerMediaAsset(db, actor, propertyId, id);
  if (
    bytes.length !== asset.byte_size ||
    bytes.length > MAX_PHOTO_BYTES ||
    (await photoDigest(bytes)) !== asset.sha256
  )
    throw new DomainError("invalid_photo", 422);
  if (asset.state === "removed") throw new DomainError("not_found", 404);
  // A completed retry cannot process or write files again, including after later edits.
  if (asset.state === "ready") return { id, status: "ready" };
  if (sourceFormat(bytes) !== asset.content_type)
    throw new DomainError("invalid_photo", 422);
  let info: Awaited<ReturnType<PhotoProcessor["inspect"]>>;
  try {
    info = await processor.inspect(bytes);
  } catch {
    throw new DomainError("invalid_photo", 422);
  }
  const formats: Record<string, string> = {
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    "image/jpeg": "image/jpeg",
    "image/png": "image/png",
    "image/webp": "image/webp",
  };
  if (formats[info.format.toLowerCase()] !== asset.content_type)
    throw new DomainError("invalid_photo", 422);
  dimensions(info.width, info.height);
  let preview: Uint8Array;
  try {
    preview = safeJpeg(await processor.preview(bytes));
  } catch {
    throw new DomainError("photo_processing_unavailable", 503);
  }
  // Immutable object names are journalled BEFORE any external write. Conditional
  // creation means same-asset concurrent retries cannot overwrite existing bytes.
  const keys = mediaKeys(asset);
  await store.put(keys.original, bytes, {
    onlyIf: { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: asset.content_type },
  });
  await store.put(keys.preview, preview, {
    onlyIf: { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: "image/jpeg" },
  });
  // Both objects must exist before D1 can expose the preview. A concurrent removal
  // wins permanently; subsequent cleanup also catches late in-flight R2 writes.
  const result = await completeMedia(
    db,
    actor,
    "photo-ready:" + id,
    propertyId,
    id,
    info.width,
    info.height,
  );
  if ((await ownerMediaAsset(db, actor, propertyId, id)).state !== "ready")
    throw new DomainError("not_found", 404);
  return result;
}
export async function readPhotoPreview(
  db: D1Database,
  store: PhotoStore,
  actor: Actor,
  propertyId: string,
  id: string,
) {
  const asset = await ownerMediaAsset(db, actor, propertyId, id);
  if (asset.state !== "ready") throw new DomainError("not_found", 404);
  const object = await store.get(mediaKeys(asset).preview);
  if (!object) throw new DomainError("photo_processing_unavailable", 503);
  // Recheck after the external read so removal/revocation during it is respected.
  if ((await ownerMediaAsset(db, actor, propertyId, id)).state !== "ready")
    throw new DomainError("not_found", 404);
  return object.body;
}
// Trusted maintenance only. Keep tombstones and resweep even successful deletions:
// an interrupted upload may finish an R2 write after removal. No retention/erasure
// policy or abandoned-upload expiry is inferred by this engineering retry interval.
export async function cleanupRemovedPhotos(
  db: D1Database,
  store: Pick<PhotoStore, "delete">,
) {
  const rows = (
    await db
      .prepare(
        "SELECT id,property_id FROM property_media WHERE state='removed' AND cleanup_at<=unixepoch() ORDER BY cleanup_at,id LIMIT 20",
      )
      .all<{ id: string; property_id: string }>()
  ).results;
  let failed = 0;
  for (const row of rows) {
    let failure = 0;
    try {
      await store.delete(Object.values(mediaKeys(row)));
    } catch {
      failed++;
      failure = 1;
    }
    await db
      .prepare(
        "UPDATE property_media SET cleanup_at=unixepoch()+300,cleanup_attempts=cleanup_attempts+1,cleanup_failures=cleanup_failures+? WHERE id=? AND state='removed'",
      )
      .bind(failure, row.id)
      .run();
  }
  return { attempted: rows.length, failed };
}
