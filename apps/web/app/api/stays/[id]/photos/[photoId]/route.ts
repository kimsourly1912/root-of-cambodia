import { publicEndpoint } from "@/src/public-http";
import { readPublicPhoto } from "@root-of-cambodia/backend/catalog-queries";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; photoId: string }> },
) {
  const { id, photoId } = await context.params;
  return publicEndpoint(
    ({ DB, MEDIA }) => readPublicPhoto(DB, MEDIA, id, photoId),
    true,
  );
}
