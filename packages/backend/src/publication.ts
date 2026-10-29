import { verified, type Actor } from "./operations";
import { requireOwnedProperty } from "./access";
import { DomainError } from "./errors";
import {
  readSnapshot,
  requestRecord,
  requireReviewer,
  reviewConfig,
  reviewPhotoAsset,
} from "./publication-queries";
import { commitPublicationAction } from "./publication-persistence";
import { mediaKeys } from "./media-queries";
const revision = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) > 0;
function fields(input: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(input).some((key) => !allowed.includes(key)))
    throw new DomainError("invalid_review", 422);
}
export async function ownerReviewAction(
  db: D1Database,
  actor: Actor,
  key: string,
  propertyId: string,
  input: Record<string, unknown>,
) {
  await verified(db, actor);
  await requireOwnedProperty(db, actor, propertyId);
  if (input.action === "submit") {
    fields(input, ["action", "propertyRevision"]);
    if (!revision(input.propertyRevision))
      throw new DomainError("invalid_review", 422);
    const receipt = await commitPublicationAction(
      db,
      actor,
      key,
      {
        action: "submit",
        propertyId,
        propertyRevision: input.propertyRevision,
      },
      async () => {
        const config = await reviewConfig(db);
        if (
          !config ||
          !(await db
            .prepare("SELECT 1 ok FROM user WHERE id=? AND emailVerified=1")
            .bind(config.reviewerId)
            .first())
        )
          throw new DomainError("reviewer_not_configured", 422);
        const snapshot = await readSnapshot(db, propertyId, actor.id);
        if (
          snapshot.data.rooms.length > 100 ||
          new TextEncoder().encode(snapshot.json).length > 262144
        )
          throw new DomainError("request_size_limit", 422);
        if (snapshot.data.photos.some((photo) => photo.state !== "ready"))
          throw new DomainError("unfinished_photos", 422);
        return {
          action: "submit",
          propertyId,
          propertyRevision: Number(input.propertyRevision),
          snapshotJson: snapshot.json,
        };
      },
      "owner",
    );
    await verified(db, actor);
    await requireOwnedProperty(db, actor, propertyId);
    return receipt;
  }
  if (input.action === "withdraw") {
    fields(input, ["action", "requestId", "revision"]);
    if (typeof input.requestId !== "string" || !revision(input.revision))
      throw new DomainError("invalid_review", 422);
    const requestId = input.requestId,
      request = await requestRecord(db, requestId);
    if (request.propertyId !== propertyId || request.ownerId !== actor.id)
      throw new DomainError("not_found", 404);
    const receipt = await commitPublicationAction(
      db,
      actor,
      key,
      {
        action: "withdraw",
        propertyId,
        requestId,
        revision: input.revision,
      },
      async () => ({
        action: "withdraw",
        requestId,
        revision: Number(input.revision),
      }),
      "owner",
    );
    await verified(db, actor);
    await requireOwnedProperty(db, actor, propertyId);
    return receipt;
  }
  throw new DomainError("invalid_review", 422);
}
export async function decideReview(
  db: D1Database,
  actor: Actor,
  key: string,
  requestId: string,
  input: Record<string, unknown>,
) {
  await requireReviewer(db, actor);
  await requestRecord(db, requestId);
  fields(input, ["action", "revision", "configRevision", "reason"]);
  const action = input.action;
  if (
    !["approve", "return_changes"].includes(String(action)) ||
    !revision(input.revision) ||
    !revision(input.configRevision) ||
    (input.reason !== undefined && typeof input.reason !== "string")
  )
    throw new DomainError("invalid_review", 422);
  const reason =
    typeof input.reason === "string" ? input.reason.trim() || null : null;
  if (
    (reason &&
      (reason.length > 2000 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(reason))) ||
    (action === "return_changes" && !reason)
  )
    throw new DomainError("invalid_review", 422);
  const receipt = await commitPublicationAction(
    db,
    actor,
    key,
    {
      action: String(action),
      requestId,
      revision: input.revision,
      configRevision: input.configRevision,
      reason,
    },
    async () => {
      const config = await requireReviewer(db, actor);
      if (config.revision !== input.configRevision)
        throw new DomainError("review_conflict", 409);
      if (action === "approve" && !config.termsVersion)
        throw new DomainError("publication_terms_not_configured", 422);
      return {
        action: action as "approve" | "return_changes",
        requestId,
        revision: Number(input.revision),
        reason,
        config,
      };
    },
    "reviewer",
  );
  await requireReviewer(db, actor);
  await requestRecord(db, requestId);
  return receipt;
}
export async function readReviewPreview(
  db: D1Database,
  store: Pick<R2Bucket, "get">,
  actor: Actor,
  requestId: string,
  photoId: string,
) {
  const asset = await reviewPhotoAsset(db, actor, requestId, photoId);
  const object = await store.get(mediaKeys(asset).preview);
  if (!object) throw new DomainError("photo_processing_unavailable", 503);
  await reviewPhotoAsset(db, actor, requestId, photoId);
  return object.body;
}
