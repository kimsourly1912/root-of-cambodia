import { publicEndpoint } from "@/server/public-http";

export const dynamic = "force-dynamic";

// Public readiness only: no account, binding identifiers or business data.
export async function GET() {
  return publicEndpoint(async (env) => {
    await env.DB.prepare("SELECT 1").first();
    return { status: "ok", revision: env.WORKER_VERSION_METADATA.tag ?? null };
  });
}
