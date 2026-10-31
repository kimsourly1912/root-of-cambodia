// Trusted local operator command for platform admin grants (ADR 0010). Never
// imported by the application. Writes only the local emulator database.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import { adminChangeStatements } from "./platform-staff.ts";
const args = process.argv.slice(2);
let action: "grant" | "revoke" | "" = "",
  userId = "",
  reason = "";
const seen = new Set<string>();
for (let i = 0; i < args.length; i++) {
  const flag = args[i];
  if (seen.has(flag)) throw new Error("Duplicate option");
  seen.add(flag);
  const value = args[i + 1];
  if (["--grant", "--revoke", "--reason"].includes(flag) && value && !value.startsWith("--")) {
    i++;
    if (flag === "--reason") reason = value.trim();
    else {
      if (action) throw new Error("Use either --grant or --revoke");
      action = flag === "--grant" ? "grant" : "revoke";
      userId = value.trim();
    }
  } else throw new Error('Use --grant <verified app user ID> | --revoke <app user ID>, with --reason "<why>"');
}
if (!action || !userId || userId.length > 256 || !reason || reason.length > 500)
  throw new Error("Specify one account, --grant or --revoke, and a reason of at most 500 characters");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const proxy = await getPlatformProxy<{ DB: D1Database }>({
  configPath: path.join(root, "apps/web/wrangler.jsonc"),
  remoteBindings: false,
  // Same database as wrangler dev/d1 --persist-to .wrangler/state, which append v3.
  persist: { path: path.join(root, ".wrangler/state/v3") },
});
try {
  const db = proxy.env.DB;
  const [event] = await db.batch(
    adminChangeStatements(db, userId, action === "grant", "admin:local", reason),
  );
  const current = await db
    .prepare("SELECT active FROM platform_staff WHERE user_id=?")
    .bind(userId)
    .first<{ active: number }>();
  if (action === "grant" && current?.active !== 1)
    throw new Error("Account must already exist and have verified email in this local database");
  console.log(
    event.meta.changes === 1
      ? `Local platform admin ${action} saved.`
      : `No change: the account is already ${action === "grant" ? "an active admin" : "not an admin"}.`,
  );
} finally {
  await proxy.dispose();
}
