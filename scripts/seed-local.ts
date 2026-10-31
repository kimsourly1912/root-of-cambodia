// Trusted local operator command. Never imported by the application.
// Seeds the fictional staging fixtures into local emulator state only, through
// the same backend services the staging tests use. Remote bindings are disabled.
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import { STAGING_ACCOUNTS } from "../apps/web/server/staging-accounts";
import {
  seedStagingAccounts,
  seedStagingProperties,
  type StagingCredential,
} from "./staging-fixtures";

if (process.argv.length > 2) throw new Error("seed:local takes no options");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const state = path.join(root, ".wrangler/state");
// Inside ignored local state; never commit or share either file.
const credentialPath = path.join(state, "local-fixture-credentials.json");
// Readable copy of the same passwords, rewritten on every seed.
const loginPath = path.join(state, "local-fixture-logins.txt");

let credentials: StagingCredential[];
try {
  credentials = JSON.parse(await readFile(credentialPath, "utf8"));
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  // One random password per machine, shared by all local fixture accounts.
  const password = randomBytes(18).toString("base64url");
  credentials = STAGING_ACCOUNTS.map((a) => ({ id: a.id, password }));
  await writeFile(credentialPath, JSON.stringify(credentials, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
}

const proxy = await getPlatformProxy<{
  DB: D1Database;
  MEDIA: R2Bucket;
  IMAGES: ImagesBinding;
  APP_MODE: string;
}>({
  configPath: path.join(root, "apps/web/wrangler.jsonc"),
  remoteBindings: false,
  // Same database as wrangler dev/d1 --persist-to .wrangler/state, which append v3.
  persist: { path: path.join(state, "v3") },
});
try {
  if (proxy.env.APP_MODE !== "local") throw new Error("Local mode only");
  await seedStagingAccounts(proxy.env.DB, credentials);
  const logins = STAGING_ACCOUNTS.map((a) => {
    const password = credentials.find((c) => c.id === a.id)?.password;
    if (!password) throw new Error(`Missing local password for ${a.id}`);
    return `${a.role.padEnd(9)} ${a.email.padEnd(29)} ${password}`;
  });
  await writeFile(
    loginPath,
    [
      "LOCAL FICTIONAL TEST ACCOUNTS. Never commit or share this file.",
      "Sign in at http://127.0.0.1:8787",
      "",
      ...logins,
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  const seed = await seedStagingProperties(proxy.env, root);
  console.log(
    JSON.stringify(
      {
        accounts: STAGING_ACCOUNTS.map((a) => ({ role: a.role, email: a.email })),
        logins: path.relative(root, loginPath),
        properties: seed.properties.map((p) => ({ name: p.name, state: p.state })),
        draftId: seed.draftId,
        bookings: seed.bookings,
        calendar: seed.properties[0] && {
          from: seed.properties[0].start,
          until: seed.properties[0].end,
        },
      },
      null,
      2,
    ),
  );
} finally {
  await proxy.dispose();
}
