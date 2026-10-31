import { endpoint } from "../../../../../src/http";
import { updatePropertyDraft } from "@root-of-cambodia/backend/properties";
import { ownerProperty } from "@root-of-cambodia/backend/properties";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  return endpoint(request, false, ({ db, actor }) =>
    ownerProperty(db, actor, id),
  );
}
export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return endpoint(request, true, ({ db, actor, key, body }) =>
    updatePropertyDraft(db, actor, key, id, body),
  );
}
