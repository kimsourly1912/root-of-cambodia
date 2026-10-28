import {getPlatformProxy} from "wrangler";
import {getMigrations} from "better-auth/db/migration";
import {writeFile} from "node:fs/promises";
import {makeAuth,emailFixtureSQL} from "../src/auth";
import {migrate,fixture} from "../tests/support";
const proxy=await getPlatformProxy<CloudflareEnv>({configPath:"wrangler.jsonc",remoteBindings:false});
try {
  const auth=makeAuth(proxy.env.DB,{secret:proxy.env.BETTER_AUTH_SECRET,baseURL:proxy.env.AUTH_URL,mode:proxy.env.PROOF_MODE});
  const migration=await getMigrations(auth.options);
  await writeFile("schema/auth-generated.sql",await migration.compileMigrations());
  await migration.runMigrations();
  await proxy.env.DB.prepare(emailFixtureSQL).run();
  await migrate(proxy.env.DB); await fixture(proxy.env.DB);
  console.log("Local auth schema, booking schema, and synthetic fixtures ready.");
} finally {await proxy.dispose();}
