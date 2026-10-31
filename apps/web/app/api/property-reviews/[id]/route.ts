import { endpoint } from "@/src/http";
import { reviewDetails } from "@root-of-cambodia/backend/publication";
import { decideReview } from "@root-of-cambodia/backend/publication";
export const dynamic = "force-dynamic";
type Context = {
  params: Promise<{
    id: string;
  }>;
};
export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  return endpoint(request, false, ({ db, actor }) =>
    reviewDetails(db, actor, id),
  );
}
export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  return endpoint(request, true, ({ db, actor, key, body }) =>
    decideReview(db, actor, key, id, body),
  );
}
