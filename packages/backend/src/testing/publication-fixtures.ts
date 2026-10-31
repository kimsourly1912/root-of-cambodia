import type { Actor } from "@root-of-cambodia/backend/shared";
import { savePropertyInformation } from "@root-of-cambodia/backend/property-information";
import { savePropertyLogistics } from "@root-of-cambodia/backend/property-logistics";
import { createRoomType } from "@root-of-cambodia/backend/rooms";
import { saveRoomCalendar } from "@root-of-cambodia/backend/calendar";
import { preparePhoto } from "@root-of-cambodia/backend/media";
import { completeMedia } from "../features/media/media-persistence";
import { readSnapshot } from "@root-of-cambodia/backend/publication";
import { publicDisclosurePreview } from "@root-of-cambodia/backend/publication";
export async function disclosureFor(
  db: D1Database,
  propertyId: string,
  ownerId: string,
) {
  const { version, previewHash } = await publicDisclosurePreview(
    (await readSnapshot(db, propertyId, ownerId)).data,
  );
  return { version, previewHash };
}

// Synthetic metadata fixture for publication rules. Actual bytes/Images/R2 and
// HTTP upload are covered by media tests and the browser supply journey.
export async function readyPublicationFixture(
  db: D1Database,
  actor: Actor,
  propertyId: string,
  photo = true,
  calendarNight?: string | null,
) {
  const prefix = "ready:" + propertyId + ":";
  await savePropertyInformation(db, actor, prefix + "info", propertyId, {
    description: "A quiet place to stay.",
    address: "River lane, Kampot",
    facilities: [],
    revision: null,
  });
  await savePropertyLogistics(db, actor, prefix + "contact", propertyId, {
    latitude: null,
    longitude: null,
    contactName: "",
    contactPhone: "",
    contactEmail: "stay@example.invalid",
    arrivalInstructions: "",
    revision: null,
  });
  const room = await createRoomType(db, actor, prefix + "room", propertyId, {
    name: "Garden room",
    adultCapacity: 2,
    childCapacity: 0,
    totalCapacity: 2,
  });
  const night =
    calendarNight ??
    new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  if (calendarNight !== null)
    await saveRoomCalendar(
      db,
      actor,
      prefix + "calendar",
      propertyId,
      room.id,
      {
        roomRevision: 1,
        nights: [
          {
            night,
            capacity: 1,
            blocked: 0,
            unitCents: 3500,
            inventoryRevision: null,
            rateRevision: null,
          },
        ],
      },
    );
  let photoId: string | null = null;
  if (photo) {
    const registered = await preparePhoto(
      db,
      actor,
      prefix + "photo",
      propertyId,
      {
        contentType: "image/jpeg",
        byteSize: 4,
        sha256: "b".repeat(64),
        revision: null,
      },
    );
    await completeMedia(
      db,
      actor,
      prefix + "processed",
      propertyId,
      registered.id,
      10,
      10,
    );
    photoId = registered.id;
  }
  return { roomId: room.id, photoId, night };
}
