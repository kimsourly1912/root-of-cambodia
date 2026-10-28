import { endpoint } from "../../../src/http";
import { editInventory } from "../../../src/inventory";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return endpoint(request, true, ({ db, actor, key, body }) =>
    editInventory(db, actor, key, body),
  );
}
