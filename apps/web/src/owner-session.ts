import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { guestReturn } from "./return-path";
import { runtime } from "./runtime";
import { verified } from "@root-of-cambodia/backend/operations";
import { DomainError } from "@root-of-cambodia/backend/errors";
import { diagnostics } from "@root-of-cambodia/backend/diagnostics";
export async function ownerSession(next = "/owner") {
  const suffix =
    next === "/owner" ? "" : "?next=" + encodeURIComponent(guestReturn(next));
  const context = diagnostics("http");
  let result;
  try {
    const { env, auth } = await runtime();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) result = null;
    else {
      const actor = { id: session.user.id };
      await verified(env.DB, actor);
      result = { db: env.DB, actor };
    }
  } catch (error) {
    context.failure(error);
    if (
      error instanceof DomainError &&
      error.code === "verified_session_required"
    )
      redirect("/verify-email" + suffix);
    throw new Error("Owner workspace temporarily unavailable");
  }
  if (!result) redirect("/sign-in" + suffix);
  return result;
}

// SSR reads get the same safe diagnostic boundary as JSON endpoints.
export async function ownerRead<T>(read: () => Promise<T>): Promise<T> {
  const context = diagnostics("http");
  try {
    return await read();
  } catch (error) {
    context.failure(error);
    if (error instanceof DomainError) throw error;
    throw new Error("Owner workspace temporarily unavailable");
  }
}
