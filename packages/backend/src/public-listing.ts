import { digest } from "./operations";
import type { ReviewSnapshot } from "./publication-queries";

// This is a display-authorization version, not a booking/legal terms version.
export const PUBLIC_DISCLOSURE_VERSION = "public-listing-v1";
type PublicSource = {
  property: Pick<
    ReviewSnapshot["property"],
    | "id"
    | "nameKm"
    | "nameEn"
    | "province"
    | "checkinTime"
    | "checkoutTime"
    | "policyText"
    | "charges"
  >;
  information: Pick<
    ReviewSnapshot["information"],
    "description" | "facilities"
  >;
  rooms: Pick<
    ReviewSnapshot["rooms"][number],
    | "id"
    | "name"
    | "active"
    | "adultCapacity"
    | "childCapacity"
    | "totalCapacity"
  >[];
  photos: Pick<ReviewSnapshot["photos"][number], "id" | "state">[];
};
// Build fresh objects explicitly. Never spread a private snapshot into a public
// response or pass it as props to a public/client component.
export function publicListing(source: PublicSource) {
  return {
    id: source.property.id,
    nameKm: source.property.nameKm,
    nameEn: source.property.nameEn,
    province: source.property.province,
    description: source.information.description,
    facilities: source.information.facilities.map((facility) => facility),
    checkinTime: source.property.checkinTime,
    checkoutTime: source.property.checkoutTime,
    policyText: source.property.policyText,
    charges: source.property.charges.map((charge) => ({
      code: charge.code,
      label: charge.label,
      amountCents: charge.amountCents,
    })),
    rooms: source.rooms
      .filter((room) => room.active === 1)
      .map((room) => ({
        id: room.id,
        name: room.name,
        adultCapacity: room.adultCapacity,
        childCapacity: room.childCapacity,
        totalCapacity: room.totalCapacity,
      })),
    photos: source.photos
      .filter((photo) => photo.state === "ready")
      .map((photo) => ({
        id: photo.id,
      })),
  };
}
export type PublicListing = ReturnType<typeof publicListing>;
export type PublicDisclosure = {
  version: typeof PUBLIC_DISCLOSURE_VERSION;
  previewHash: string;
};
export async function publicDisclosurePreview(
  source: PublicSource,
): Promise<PublicDisclosure & { listing: PublicListing }> {
  const listing = publicListing(source);
  return {
    version: PUBLIC_DISCLOSURE_VERSION,
    previewHash: await digest({ version: PUBLIC_DISCLOSURE_VERSION, listing }),
    listing,
  };
}

// Public queries select only these allowlisted fields, not snapshot_json itself.
// Keep array order identical to the immutable submission and the preview above.
export const publicSourceSQL = `json_object(
 'property',json_object(
  'id',json_extract(r.snapshot_json,'$.property.id'),
  'nameKm',json_extract(r.snapshot_json,'$.property.nameKm'),
  'nameEn',json_extract(r.snapshot_json,'$.property.nameEn'),
  'province',json_extract(r.snapshot_json,'$.property.province'),
  'checkinTime',json_extract(r.snapshot_json,'$.property.checkinTime'),
  'checkoutTime',json_extract(r.snapshot_json,'$.property.checkoutTime'),
  'policyText',json_extract(r.snapshot_json,'$.property.policyText'),
  'charges',json((SELECT json_group_array(json_object('code',json_extract(j.value,'$.code'),'label',json_extract(j.value,'$.label'),'amountCents',json_extract(j.value,'$.amountCents'))) FROM (SELECT value FROM json_each(r.snapshot_json,'$.property.charges') ORDER BY CAST(key AS INTEGER)) j))),
 'information',json_object('description',json_extract(r.snapshot_json,'$.information.description'),'facilities',json(json_extract(r.snapshot_json,'$.information.facilities'))),
 'rooms',json((SELECT json_group_array(json_object('id',json_extract(j.value,'$.id'),'name',json_extract(j.value,'$.name'),'active',1,'adultCapacity',json_extract(j.value,'$.adultCapacity'),'childCapacity',json_extract(j.value,'$.childCapacity'),'totalCapacity',json_extract(j.value,'$.totalCapacity'))) FROM (SELECT value FROM json_each(r.snapshot_json,'$.rooms') WHERE json_extract(value,'$.active')=1 ORDER BY CAST(key AS INTEGER)) j)),
 'photos',json((SELECT json_group_array(json_object('id',json_extract(j.value,'$.id'),'state','ready')) FROM (SELECT value FROM json_each(r.snapshot_json,'$.photos') WHERE json_extract(value,'$.state')='ready' ORDER BY CAST(key AS INTEGER)) j))
)`;
export async function verifiedPublicProjection(
  sourceJSON: string,
  expectedHash: string,
) {
  const preview = await publicDisclosurePreview(
    JSON.parse(sourceJSON) as PublicSource,
  );
  return preview.previewHash === expectedHash ? preview.listing : null;
}
