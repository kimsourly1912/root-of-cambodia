import { endpoint } from "@/server/http";
import { ownerPublication } from "@root-of-cambodia/backend/publication";
import { ownerReviewAction } from "@root-of-cambodia/backend/publication";
export const dynamic = "force-dynamic";
type Context = {
  params: Promise<{
    id: string;
  }>;
};
export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  return endpoint(request, false, ({ db, actor }) =>
    ownerPublication(db, actor, id),
  );
}
export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  return endpoint(request, true, ({ db, actor, key, body }) =>
    ownerReviewAction(db, actor, key, id, body),
  );
}
