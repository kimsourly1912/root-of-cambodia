import { endpoint } from "../../../../../../src/http";
import { ownerMediaGallery } from "@root-of-cambodia/backend/media";
import { preparePhoto, editPhotos } from "@root-of-cambodia/backend/media";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  return endpoint(request, false, ({ db, actor }) =>
    ownerMediaGallery(db, actor, id),
  );
}
export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  return endpoint(
    request,
    true,
    ({ db, actor, key, body }) => preparePhoto(db, actor, key, id, body),
    201,
  );
}
export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return endpoint(request, true, ({ db, actor, key, body }) =>
    editPhotos(db, actor, key, id, body),
  );
}
