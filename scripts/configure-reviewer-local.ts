// Trusted local operator command. Never imported by the application.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import { adminChangeStatements } from "./platform-staff.ts";
const args = process.argv.slice(2);
let userId = "",
  terms: string | null | undefined;
const seen = new Set<string>();
for (let i = 0; i < args.length; i++) {
  const flag = args[i];
  if (seen.has(flag)) throw new Error("Duplicate option");
  seen.add(flag);
  if (flag === "--clear-terms") terms = null;
  else if (
    ["--user-id", "--terms-version"].includes(flag) &&
    args[i + 1] &&
    !args[i + 1].startsWith("--")
  ) {
    const value = args[++i].trim();
    if (flag === "--user-id") userId = value;
    else terms = value;
  } else
    throw new Error(
      "Use --user-id <verified app user ID> [--terms-version <approved version> | --clear-terms]",
    );
}
if (
  !userId ||
  userId.length > 256 ||
  (seen.has("--terms-version") && seen.has("--clear-terms")) ||
  (typeof terms === "string" &&
    (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(terms) ||
      terms === "unconfigured"))
)
  throw new Error(
    "Specify one verified app account and an optional approved terms version",
  );
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const proxy = await getPlatformProxy<{
  DB: D1Database;
}>({
  configPath: path.join(root, "apps/web/wrangler.jsonc"),
  remoteBindings: false,
  // Same database as wrangler dev/d1 --persist-to .wrangler/state, which append v3.
  persist: {
    path: path.join(root, ".wrangler/state/v3"),
  },
});
try {
  const db = proxy.env.DB;
  // The pilot setting and the reviewer's admin grant (ADR 0010) commit together.
  const [result] = await db.batch([
    db
    .prepare(
      `INSERT INTO pilot_publication_config(singleton,reviewer_user_id,terms_version)
    SELECT 1,?,? WHERE EXISTS(SELECT 1 FROM user WHERE id=? AND emailVerified=1)
    ON CONFLICT(singleton) DO UPDATE SET reviewer_user_id=excluded.reviewer_user_id,
    terms_version=CASE WHEN ? THEN excluded.terms_version ELSE pilot_publication_config.terms_version END,
    revision=pilot_publication_config.revision+1`,
    )
    .bind(userId, terms ?? null, userId, terms === undefined ? 0 : 1),
    ...adminChangeStatements(db, userId, true, "reviewer:local", "Local pilot publication reviewer"),
  ]);
  if (result.meta.changes !== 1)
    throw new Error(
      "Account must already exist and have verified email in this local database",
    );
  console.log("Local pilot reviewer configuration and admin grant saved.");
} finally {
  await proxy.dispose();
}
