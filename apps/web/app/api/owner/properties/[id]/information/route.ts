import { endpoint } from "../../../../../../src/http";
import { ownerPropertyInformation } from "@root-of-cambodia/backend/property-information-queries";
import { savePropertyInformation } from "@root-of-cambodia/backend/property-information";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  return endpoint(request, false, ({ db, actor }) =>
    ownerPropertyInformation(db, actor, id),
  );
}
export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return endpoint(request, true, ({ db, actor, key, body }) =>
    savePropertyInformation(db, actor, key, id, body),
  );
}
