import { DomainError } from "@root-of-cambodia/backend/shared";

// Fictional identities in the isolated staging database only. These are not
// claims that a customer's inbox or real identity has been verified.
export const STAGING_ACCOUNTS = [
  { role: "owner", id: "staging-owner-v1", email: "owner@roc-staging.invalid", name: "Demo property owner" },
  { role: "guest", id: "staging-guest-v1", email: "guest@roc-staging.invalid", name: "Demo traveler" },
  { role: "reviewer", id: "staging-reviewer-v1", email: "reviewer@roc-staging.invalid", name: "Demo publication reviewer" },
] as const;

export function requireStagingAccount(id: string, fixtureTest: boolean) {
  if (fixtureTest && !STAGING_ACCOUNTS.some(account => account.id === id))
    throw new DomainError("unauthorized", 401);
}

// Restrict interactive staging to seeded accounts. No public registration,
// verification, account editing or password recovery is admitted without mail.
export async function stagingAuthAction(request: Request) {
  const path = new URL(request.url).pathname;
  if (request.method === "GET" && path === "/api/auth/get-session") return "session";
  if (request.method !== "POST" || request.headers.get("origin") !== "https://staging.rootsofcambodia.com") return null;
  if (path === "/api/auth/sign-out") return "signout";
  if (path !== "/api/auth/sign-in/email" || request.headers.get("content-type")?.split(";")[0] !== "application/json") return null;
  const reader = request.clone().body?.getReader();
  if (!reader) return null;
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 2048) { void reader.cancel().catch(() => {}); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const input = body as Record<string, unknown>;
    if (Object.keys(input).some(key => !["email", "password"].includes(key)) ||
      typeof input.email !== "string" || typeof input.password !== "string" ||
      input.password.length < 8 || input.password.length > 128 ||
      !STAGING_ACCOUNTS.some(account => account.email === String(input.email).trim().toLowerCase())) return null;
    return "signin";
  } catch { return null; }
}
