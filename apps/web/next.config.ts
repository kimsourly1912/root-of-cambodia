import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
const config: NextConfig = {
  outputFileTracingRoot: path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
  ),
  transpilePackages: ["@root-of-cambodia/backend"],
  poweredByHeader: false,
  experimental: { cpus: 2 },
};
export default config;
