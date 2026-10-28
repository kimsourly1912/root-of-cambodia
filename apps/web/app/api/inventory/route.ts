import { endpoint } from "../../../src/http";
import { editInventory } from "@root-of-cambodia/backend/inventory";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return endpoint(request, true, ({ db, actor, key, body }) =>
    editInventory(db, actor, key, body),
  );
}
