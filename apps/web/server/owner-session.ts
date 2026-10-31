import { requireStagingAccount } from "./staging-accounts";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { guestReturn } from "@/lib/return-path";
import { runtime } from "./runtime";
import { verified } from "@root-of-cambodia/backend/shared";
import { DomainError } from "@root-of-cambodia/backend/shared";
import { diagnostics } from "@root-of-cambodia/backend/shared";
export async function ownerSession(next = "/owner") {
  const suffix =
    next === "/owner" ? "" : "?next=" + encodeURIComponent(guestReturn(next));
  const context = diagnostics("http");
  let result;
  try {
    const { env, auth, readOnly, fixtureTest } = await runtime();
    const session = readOnly ? null : await auth.api.getSession({ headers: await headers() });
    if (!session) result = null;
    else {
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

// Independent reads (each rechecks session and ownership) run together but
// settle in argument order, so the first failure listed wins, as if they ran
// one after another.
export async function readTogether<T extends unknown[]>(
  ...reads: { [K in keyof T]: Promise<T[K]> }
): Promise<T> {
  for (const read of reads) read.catch(() => {});
  const results = [];
  for (const read of reads) results.push(await read);
  return results as T;
}
