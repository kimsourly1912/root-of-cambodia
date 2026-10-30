import { requireStagingAccount } from "./staging-accounts";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { runtime } from "./runtime";
import { guestReturn } from "./return-path";
import { verified } from "@root-of-cambodia/backend/operations";
import { diagnostics } from "@root-of-cambodia/backend/diagnostics";
import { DomainError } from "@root-of-cambodia/backend/errors";
export async function guestSession(next: string) {
  const context = diagnostics("http");
  let result: null | { db: D1Database; actor: { id: string } } = null,
    unverified = false;
  try {
    const { env, auth, readOnly, fixtureTest } = await runtime();
    const session = readOnly ? null : await auth.api.getSession({ headers: await headers() });
    if (session) {
      requireStagingAccount(session.user.id, fixtureTest);
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
      unverified = true;
    else throw new Error("Bookings temporarily unavailable");
  }
  if (!result)
    redirect(
      `${unverified ? "/verify-email" : "/sign-in"}?next=${encodeURIComponent(guestReturn(next))}`,
    );
  return result;
}
