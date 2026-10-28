import { endpoint } from "../../../../src/http";
import { createPropertyDraft } from "@root-of-cambodia/backend/property-drafts";
import { ownerProperties } from "@root-of-cambodia/backend/property-queries";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return endpoint(request, false, ({ db, actor }) =>
    ownerProperties(
      db,
      actor,
      new URL(request.url).searchParams.get("cursor") ?? "",
    ),
  );
}
export function POST(request: Request) {
  return endpoint(
    request,
    true,
    ({ db, actor, key, body }) => createPropertyDraft(db, actor, key, body),
    201,
  );
}
