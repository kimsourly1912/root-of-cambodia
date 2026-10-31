import { publicEndpoint } from "@/server/public-http";
import { publicStay } from "@root-of-cambodia/backend/catalog";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return publicEndpoint(({ DB }) => publicStay(DB, id));
}
