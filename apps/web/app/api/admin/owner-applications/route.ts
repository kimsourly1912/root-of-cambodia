import { endpoint } from "@/server/http";
import { ownerApplications } from "@root-of-cambodia/backend/owner-access";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return endpoint(request, false, ({ db, actor }) =>
    ownerApplications(db, actor, new URL(request.url).searchParams.get("cursor") ?? ""),
  );
}
