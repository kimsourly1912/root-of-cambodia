import { photoTransfer } from "@/features/media/server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; photoId: string }> };
export async function GET(request: Request, context: Context) {
  const { id, photoId } = await context.params;
  return photoTransfer(request, id, photoId, false);
}
export async function PUT(request: Request, context: Context) {
  const { id, photoId } = await context.params;
  return photoTransfer(request, id, photoId, true);
}
