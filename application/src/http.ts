import { runtime } from "./runtime";
import { verified, type Actor } from "./operations";
import { DomainError } from "./errors";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
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
    return Response.json(
      await handle({
        db: env.DB,
        actor,
        key: request.headers.get("idempotency-key") ?? "",
        body,
      }),
      { headers },
    );
  } catch (error) {
    if (error instanceof DomainError)
      return Response.json(
        { error: error.code },
        { status: error.status, headers },
      );
    // A generic 503 deliberately does not claim whether a mutation committed.
    return Response.json(
      { error: "temporarily_unavailable_retry_same_key" },
      { status: 503, headers },
    );
  }
}
