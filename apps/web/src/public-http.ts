import { runtime } from "./runtime";
import { diagnostics } from "@root-of-cambodia/backend/shared";
import { DomainError } from "@root-of-cambodia/backend/shared";

export async function publicEndpoint(
  handle: (env: CloudflareEnv) => Promise<unknown>,
  image = false,
) {
  const context = diagnostics("http");
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Request-Id": context.correlationId,
  };
  try {
    // Runtime admits local capture or the exact read-only staging origin.
    // Anonymous reads retain the existing public field/media allowlist.
    const { env, isStaging } = await runtime();
    const data = await handle(env);
    const response = image
      ? new Response(data as BodyInit, {
          headers: {
            ...headers,
            "Content-Type": "image/jpeg",
            "Content-Disposition": "inline; filename=property-photo.jpg",
          },
        })
      : Response.json(data, { headers });
    context.completed();
    if (isStaging) response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  } catch (error) {
    const failure = context.failure(error);
    return Response.json(
      { error: failure.code },
      { status: failure.status, headers },
    );
  }
}
export async function publicPage<T>(read: () => Promise<T>) {
  const context = diagnostics("http");
  try {
    return await read();
  } catch (error) {
    context.failure(error);
    if (error instanceof DomainError && error.code === "not_found") return null;
    throw new Error("Stay browsing temporarily unavailable");
  }
}
