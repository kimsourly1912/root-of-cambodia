import { endpoint } from "../../../../../../src/http";
import { ownerPropertyLogistics } from "@root-of-cambodia/backend/property-logistics-queries";
import { savePropertyLogistics } from "@root-of-cambodia/backend/property-logistics";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  return endpoint(request, false, ({ db, actor }) =>
    ownerPropertyLogistics(db, actor, id),
  );
}
export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return endpoint(request, true, ({ db, actor, key, body }) =>
    savePropertyLogistics(db, actor, key, id, body),
  );
}
