import { runtime } from "./runtime";
import { diagnostics } from "@root-of-cambodia/backend/diagnostics";
import { DomainError } from "@root-of-cambodia/backend/errors";

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
    // Reuse the local-only runtime guard. This does not introduce a nonlocal
    // provider path or require a session for the allowlisted anonymous reads.
    const { env } = await runtime();
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
