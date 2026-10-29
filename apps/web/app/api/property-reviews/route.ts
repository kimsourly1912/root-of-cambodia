import { endpoint } from "@/src/http";
import { reviewQueue } from "@root-of-cambodia/backend/publication-queries";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return endpoint(request, false, ({ db, actor }) =>
    reviewQueue(
      db,
      actor,
      new URL(request.url).searchParams.get("cursor") ?? "",
    ),
  );
}
