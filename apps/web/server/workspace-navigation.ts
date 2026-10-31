import { headers } from "next/headers";
import { canReview } from "@root-of-cambodia/backend/publication";
import { ownerProperties } from "@root-of-cambodia/backend/properties";
import { diagnostics, DomainError } from "@root-of-cambodia/backend/shared";
import { requireStagingAccount } from "./staging-accounts";
import { runtime } from "./runtime";
import type { WorkspaceNavigation } from "@/components/workspace-shell";

// Navigation only, never authorization: pages and services still check the
// session and ownership. Any failure shows the plain menu instead of an error,
// and never redirects, so each page keeps its own sign-in return path.
export async function workspaceNavigation(): Promise<WorkspaceNavigation | null> {
  const context = diagnostics("http");
  try {
    const { env, auth, readOnly, fixtureTest } = await runtime();
    if (readOnly) return null;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return null;
    requireStagingAccount(session.user.id, fixtureTest);
    const actor = { id: session.user.id };
    const [reviewer, result] = await Promise.all([
      canReview(env.DB, actor),
      ownerProperties(env.DB, actor, ""),
    ]);
    return {
      reviewer,
      properties: result.items.map(({ id, nameKm, nameEn }) => ({ id, nameKm, nameEn })),
      moreProperties: Boolean(result.nextCursor),
    };
  } catch (error) {
    if (!(error instanceof DomainError)) context.failure(error);
    return null;
  }
}
