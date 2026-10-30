// A deliberately narrow staging mode, independent of account email delivery.
// It cannot be used to admit production, a different origin or local capture
// against a remote HTTPS origin.
export function runtimePolicy(mode: string, authURL: string) {
  if (
    mode === "local" &&
    ["http://127.0.0.1:8787", "http://localhost:8787"].includes(authURL)
  ) return { readOnly: false, fixtureTest: false, localCapture: true, isStaging: false };
  if (
    mode === "staging-read-only" &&
    authURL === "https://staging.rootsofcambodia.com"
  ) return { readOnly: true, fixtureTest: false, localCapture: false, isStaging: true };
  if (
    mode === "staging-test" &&
    authURL === "https://staging.rootsofcambodia.com"
  ) return { readOnly: false, fixtureTest: true, localCapture: false, isStaging: true };
  throw new Error("Application runtime is not configured");
}

export function stagingAuthRead(request: Request) {
  return request.method === "GET" &&
    new URL(request.url).pathname === "/api/auth/get-session";
}
