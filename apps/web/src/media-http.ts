import { requireStagingAccount } from "./staging-accounts";
import { runtime } from "./runtime";
import { photoProcessor } from "./media-runtime";
import {
  MAX_PHOTO_BYTES,
  uploadPhoto,
  readPhotoPreview,
} from "@root-of-cambodia/backend/media";
import { ownerMediaAsset } from "@root-of-cambodia/backend/media";
import { DomainError } from "@root-of-cambodia/backend/shared";
import { diagnostics } from "@root-of-cambodia/backend/shared";

export async function photoTransfer(
  request: Request,
  propertyId: string,
  photoId: string,
  upload: boolean,
) {
  const context = diagnostics("http");
  const headers = {
    "Cache-Control": "private, no-store",
    Vary: "Cookie",
    "X-Request-Id": context.correlationId,
    "X-Content-Type-Options": "nosniff",
  };
  try {
    const { env, auth, readOnly, fixtureTest } = await runtime();
    if (readOnly && upload) throw new DomainError("staging_read_only", 503);
    if (readOnly) throw new DomainError("unauthorized", 401);
    if (upload && request.headers.get("origin") !== env.AUTH_URL)
      throw new DomainError("forbidden", 403);
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new DomainError("unauthorized", 401);
    requireStagingAccount(session.user.id, fixtureTest);
    const actor = { id: session.user.id };
    const asset = await ownerMediaAsset(env.DB, actor, propertyId, photoId);
    if (!upload) {
      const body = await readPhotoPreview(
        env.DB,
        env.MEDIA,
        actor,
        propertyId,
        photoId,
      );
      context.completed();
      return new Response(body, {
        headers: {
          ...headers,
          "Content-Type": "image/jpeg",
          "Content-Disposition": "inline; filename=property-photo.jpg",
        },
      });
    }
    if (asset.state === "removed") throw new DomainError("not_found", 404);
    if (request.headers.get("content-type") !== asset.content_type)
      throw new DomainError("invalid_photo", 422);
    const declared = request.headers.get("content-length");
    if (
      declared !== null &&
      (!/^\d+$/.test(declared) || Number(declared) > MAX_PHOTO_BYTES)
    )
      throw new DomainError("request_too_large", 413);
    const reader = request.body?.getReader();
    if (!reader) throw new DomainError("invalid_photo", 422);
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_PHOTO_BYTES || size > asset.byte_size) {
        await reader.cancel();
        throw new DomainError("request_too_large", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (!env.IMAGES) throw new DomainError("photo_processing_unavailable", 503);
    const result = await uploadPhoto(
      env.DB,
      env.MEDIA,
      photoProcessor(env.IMAGES),
      actor,
      propertyId,
      photoId,
      bytes,
    );
    context.completed();
    return Response.json(result, { headers });
  } catch (error) {
    const failure = context.failure(error);
    return Response.json(
      { error: failure.code },
      { status: failure.status, headers },
    );
  }
}
