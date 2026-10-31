import { setTimeout as delay } from "node:timers/promises";

export const stagingOrigin = "https://staging.rootsofcambodia.com";

export async function smokeStaging(revision: string, request: typeof fetch = fetch,
  wait: () => Promise<unknown> = () => delay(5000)) {
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error("Expected a full commit SHA.");
  const get = (pathname: string) => request(stagingOrigin + pathname, {
    redirect: "error", signal: AbortSignal.timeout(10000), headers: { "Cache-Control": "no-cache" },
  });
  const noStore = (response: Response) => {
    if (!response.headers.get("cache-control")?.includes("no-store") || response.headers.has("set-cookie"))
      throw new Error("Unexpected staging cache/session behavior.");
  };
  let ready = false;
  // Read-only retries allow the new version to propagate; never retry mutations.
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const health = await get("/api/health");
      noStore(health);
      if (health.status !== 200 || health.headers.get("x-robots-tag") !== "noindex, nofollow")
        throw new Error("Staging readiness unavailable.");
      const body = await health.json() as { status?: string; revision?: string };
      if (body.status === "ok" && body.revision === revision) { ready = true; break; }
    } catch { /* Report only the final, non-sensitive readiness failure. */ }
    if (attempt < 11) await wait();
  }
  if (!ready) throw new Error("Staging did not serve the expected healthy commit.");
  for (const pathname of ["/", "/stays", "/testing"]) {
    const page = await get(pathname);
    const html = await page.text();
    if (page.status !== 200 || !html.includes("Staging test") ||
        !/name="robots" content="noindex, nofollow"/.test(html))
      throw new Error("Staging page/runtime check failed.");
  }
  const catalog = await get("/api/stays");
  noStore(catalog);
  if (catalog.status !== 200 || catalog.headers.get("x-robots-tag") !== "noindex, nofollow" ||
      !Array.isArray((await catalog.json() as { items?: unknown }).items))
    throw new Error("Staging catalog check failed.");
  const session = await get("/api/auth/get-session");
  noStore(session);
  if (session.status !== 200 || await session.json() !== null)
    throw new Error("Unexpected anonymous staging session.");
  for (const pathname of ["/api/owner/properties", "/api/guest/bookings"]) {
    const response = await get(pathname);
    noStore(response);
    if (response.status !== 401) throw new Error("Staging private access check failed.");
  }
  console.log(`Staging smoke passed for commit ${revision}; HTTPS reads only, no fixture/data writes.`);
}

if (import.meta.main) {
  try { await smokeStaging(process.argv[2] ?? ""); }
  catch {
    console.error("Staging smoke failed. Check the expected revision, runtime mode, readiness and private/cache boundaries. No automatic rollback or data changes performed.");
    process.exitCode = 1;
  }
}
