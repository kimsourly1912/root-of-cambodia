import { requireStagingAccount } from "@/server/staging-accounts";
import { runtime } from "@/server/runtime";
import { readReviewPreview } from "@root-of-cambodia/backend/publication";
import { DomainError } from "@root-of-cambodia/backend/shared";
import { diagnostics } from "@root-of-cambodia/backend/shared";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      photoId: string;
    }>;
  },
) {
  const context = diagnostics("http");
  const headers = {
    "Cache-Control": "private, no-store",
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
    "X-Request-Id": context.correlationId,
  };
  try {
    const { env, auth, readOnly, fixtureTest } = await runtime();
    if (readOnly) throw new DomainError("unauthorized", 401);
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (!session) throw new DomainError("unauthorized", 401);
    requireStagingAccount(session.user.id, fixtureTest);
    const { id, photoId } = await params;
    const body = await readReviewPreview(
      env.DB,
      env.MEDIA,
      {
        id: session.user.id,
      },
      id,
      photoId,
    );
    context.completed();
    return new Response(body, {
      headers: {
        ...headers,
        "Content-Type": "image/jpeg",
        "Content-Disposition": "inline; filename=property-photo.jpg",
      },
    });
  } catch (error) {
    const failure = context.failure(error);
    return Response.json(
      {
        error: failure.code,
      },
      {
        status: failure.status,
        headers,
      },
    );
  }
}
