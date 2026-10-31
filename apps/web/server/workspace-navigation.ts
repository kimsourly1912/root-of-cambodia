import { ownerProperties } from "@root-of-cambodia/backend/properties";
import { diagnostics, DomainError } from "@root-of-cambodia/backend/shared";
import { runtime } from "./runtime";
import { viewer } from "./viewer";
import type { WorkspaceNavigation } from "@/components/workspace-shell";

// Navigation only, never authorization: pages and services still check the
// session, capabilities and ownership. Any failure shows only guest links
// instead of an error, and never redirects, so each page keeps its own sign-in
// return path.
export async function workspaceNavigation(): Promise<WorkspaceNavigation | null> {
  const current = await viewer();
  if (!current) return null;
  const context = diagnostics("http");
  try {
    const { env } = await runtime();
    const result = await ownerProperties(env.DB, current.actor, "");
    return {
      owner: current.owner,
      admin: current.admin,
      properties: result.items.map(({ id, nameKm, nameEn }) => ({ id, nameKm, nameEn })),
      moreProperties: Boolean(result.nextCursor),
    };
  } catch (error) {
    if (!(error instanceof DomainError)) context.failure(error);
    return null;
  }
}
