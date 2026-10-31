import { endpoint } from "@/server/http";
import { applyForOwnerAccess, ownerAccessStatus } from "@root-of-cambodia/backend/owner-access";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return endpoint(request, false, ({ db, actor }) => ownerAccessStatus(db, actor));
}
export function POST(request: Request) {
  return endpoint(request, true, ({ db, actor, key, body }) => applyForOwnerAccess(db, actor, key, body));
}
