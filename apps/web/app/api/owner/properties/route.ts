import { endpoint } from "@/server/http";
import { createPropertyDraft } from "@root-of-cambodia/backend/properties";
import { ownerProperties } from "@root-of-cambodia/backend/properties";
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
