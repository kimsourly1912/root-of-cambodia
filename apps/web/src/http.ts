import { runtime } from "./runtime";
import { verified, type Actor } from "@root-of-cambodia/backend/operations";
import { DomainError } from "@root-of-cambodia/backend/errors";
import { diagnostics } from "@root-of-cambodia/backend/diagnostics";
export async function endpoint(
  request: Request,
  mutates: boolean,
  handle: (context: {
    db: D1Database;
    actor: Actor;
    key: string;
    body: Record<string, unknown>;
  }) => Promise<unknown>,
) {
  const context = diagnostics("http");
  const headers = {
    "Cache-Control": "private, no-store",
    Vary: "Cookie",
    "X-Request-Id": context.correlationId,
  };
  try {
    const { env, auth } = await runtime();
    if (
      mutates &&
      (request.headers.get("origin") !== env.AUTH_URL ||
        request.headers.get("content-type")?.split(";")[0] !==
          "application/json")
    )
      throw new DomainError("forbidden", 403);
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new DomainError("unauthorized", 401);
    const actor = { id: session.user.id };
    await verified(env.DB, actor);
    let body: Record<string, unknown> = {};
    if (mutates) {
      const reader = request.body?.getReader();
      if (!reader) throw new DomainError("invalid_request", 422);
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 32768) {
          await reader.cancel();
          throw new DomainError("request_too_large", 413);
        }
        chunks.push(value);
      }
      const buffer = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }
      try {
        body = JSON.parse(new TextDecoder().decode(buffer));
      } catch {
        throw new DomainError("invalid_json", 422);
      }
      if (!body || Array.isArray(body) || typeof body !== "object")
        throw new DomainError("invalid_request", 422);
    }
    const response = Response.json(
      await handle({
        db: env.DB,
        actor,
        key: request.headers.get("idempotency-key") ?? "",
        body,
      }),
      { headers },
    );
    context.completed();
    return response;
  } catch (error) {
    const failure = context.failure(error);
    // The response body/status and uncertain-outcome retry contract are retained.
    return Response.json(
      { error: failure.code },
      { status: failure.status, headers },
    );
  }
}
