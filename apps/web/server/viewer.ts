import { cache } from "react";
import { headers } from "next/headers";
import { capabilities, diagnostics, DomainError, type Actor } from "@root-of-cambodia/backend/shared";
import { requireStagingAccount } from "./staging-accounts";
import { runtime } from "./runtime";

export type Viewer = { actor: Actor; owner: boolean; admin: boolean };

// The signed-in account's capabilities (ADR 0010) for choosing navigation only.
// Never authorization: pages and services check again. Any failure, a missing
// session or a read-only site gives null, and this never redirects.
export const viewer = cache(async (): Promise<Viewer | null> => {
  const context = diagnostics("http");
  try {
    const { env, auth, readOnly, fixtureTest } = await runtime();
    if (readOnly) return null;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return null;
    requireStagingAccount(session.user.id, fixtureTest);
    const actor = { id: session.user.id };
    const { owner, admin } = await capabilities(env.DB, actor);
    return { actor, owner, admin };
  } catch (error) {
    if (!(error instanceof DomainError)) context.failure(error);
    return null;
  }
});
