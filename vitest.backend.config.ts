import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { unstable_readConfig } from "wrangler";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));
const config = unstable_readConfig({
  config: path.join(root, "apps/web/wrangler.jsonc"),
});
type DatabaseBinding = {
  binding: string;
  migrations_dir?: string;
  migrations_pattern?: string;
};
const bindings: DatabaseBinding[] = config.d1_databases;
const database = bindings.find((binding) => binding.binding === "DB");
if (
  !database ||
  !config.compatibility_date ||
  !config.compatibility_flags.includes("nodejs_compat")
) {
  throw new Error(
    "Backend tests require the application's DB binding, compatibility date and nodejs_compat flag.",
  );
}

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      remoteBindings: false,
      // Test the shared services without importing the built Next.js entrypoint.
      // The separate worker-http project exercises that actual bundle.
      miniflare: {
        compatibilityDate: config.compatibility_date,
        compatibilityFlags: config.compatibility_flags,
        queueProducers: { NOTIFICATIONS: "roc-notifications-local-only" },
        d1Databases: bindings.map((binding) => binding.binding),
        r2Buckets: ["MEDIA"],
        images: { binding: "IMAGES", remote: false },
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations({
            projectPath: path.join(root, "apps/web"),
            migrationsDir: database.migrations_dir ?? "migrations",
            migrationsPattern: database.migrations_pattern,
          }),
        },
      },
    })),
  ],
  test: {
    name: "backend",
    // Feature tests sit beside their feature; cross-feature backend tests in packages/backend/tests.
    include: [
      "packages/backend/src/**/*.test.ts",
      "packages/backend/tests/**/*.test.ts",
    ],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    sequence: { concurrent: false },
  },
});
