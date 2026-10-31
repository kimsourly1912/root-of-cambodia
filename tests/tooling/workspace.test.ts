import { test } from "vitest";
import assert from "node:assert/strict";
import {
  readdir,
  readFile,
  mkdtemp,
  mkdir,
  writeFile,
  rm,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { unstable_readConfig } from "wrangler";
import { handoffLocal } from "../../scripts/handoff-local";

const root = path.resolve(import.meta.dirname, "../..");
async function sources(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? sources(path.join(dir, e.name))
          : [path.join(dir, e.name)],
      ),
    )
  ).flat();
}
function backendImport(file: string, specifier: string) {
  if (specifier.startsWith(".")) {
    const resolved = path.resolve(path.dirname(file), specifier);
    assert.ok(
      resolved.startsWith(path.join(root, "packages/backend/src") + path.sep),
      `Shared import escapes backend: ${specifier}`,
    );
  } else {
    assert.ok(
      ["drizzle-orm", "better-auth"].some(
        (name) => specifier === name || specifier.startsWith(name + "/"),
      ),
      `Unsupported shared import: ${specifier}`,
    );
  }
}

test("shared backend imports stay inside its approved package/runtime boundary", async () => {
  for (const file of await sources(path.join(root, "packages/backend/src"))) {
    // Co-located tests and fixtures run under Vitest, not the shipped runtime.
    if (/[\\/](tests|testing)[\\/]/.test(path.relative(root, file))) continue;
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(
      /(?:from\s*|import\s*\(|require\s*\()\s*["']([^"']+)["']/g,
    ))
      backendImport(file, match[1]);
  }
  const example = path.join(root, "packages/backend/src/example.ts");
  for (const forbidden of [
    "next/server",
    "@opennextjs/cloudflare",
    "../../../apps/web/src/runtime",
    "node:fs",
  ])
    assert.throws(() => backendImport(example, forbidden));
  const manifest = JSON.parse(
    await readFile(path.join(root, "packages/backend/package.json"), "utf8"),
  );
  for (const target of Object.values(manifest.exports) as string[])
    await readFile(path.resolve(root, "packages/backend", target));
  const web = unstable_readConfig({
    config: path.join(root, "apps/web/wrangler.jsonc"),
  });
  const jobs = unstable_readConfig({
    config: path.join(root, "apps/jobs/wrangler.jsonc"),
  });
  assert.equal(
    web.d1_databases[0].database_id,
    jobs.d1_databases[0].database_id,
  );
  assert.equal(web.compatibility_date, jobs.compatibility_date);
  assert.deepEqual(web.compatibility_flags, jobs.compatibility_flags);
  for (const [dir, config] of [
    ["apps/web", web],
    ["apps/jobs", jobs],
  ] as const)
    assert.equal(
      path.resolve(
        root,
        dir,
        config.d1_databases[0].migrations_dir ?? "migrations",
      ),
      path.join(root, "packages/backend/migrations"),
    );
});

async function fixture(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "roc-handoff-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test("local handoff preserves legacy database bytes and secret, and never reimports over newer state", () =>
  fixture(async (dir) => {
    await mkdir(path.join(dir, "application/.wrangler/state/v3/d1"), {
      recursive: true,
    });
    await writeFile(
      path.join(dir, "application/.dev.vars"),
      "synthetic-local-secret",
    );
    const db = "v3/d1/synthetic.sqlite";
    await writeFile(
      path.join(dir, "application/.wrangler/state", db),
      new Uint8Array([0, 255, 42]),
    );
    await handoffLocal(dir);
    assert.deepEqual(
      await readFile(path.join(dir, ".wrangler/state", db)),
      await readFile(path.join(dir, "application/.wrangler/state", db)),
    );
    assert.equal(
      await readFile(path.join(dir, "apps/web/.dev.vars"), "utf8"),
      "synthetic-local-secret",
    );
    await writeFile(path.join(dir, ".wrangler/state", db), "newer-state");
    await handoffLocal(dir);
    assert.equal(
      await readFile(path.join(dir, ".wrangler/state", db), "utf8"),
      "newer-state",
    );
  }));
test("local handoff refuses conflicting databases and secrets without overwriting either", () =>
  fixture(async (dir) => {
    for (const folder of [
      "application/.wrangler/state",
      ".wrangler/state",
      "apps/web",
    ])
      await mkdir(path.join(dir, folder), { recursive: true });
    await writeFile(
      path.join(dir, "application/.wrangler/state/legacy"),
      "old",
    );
    await writeFile(path.join(dir, ".wrangler/state/current"), "new");
    await assert.rejects(handoffLocal(dir), /Both legacy/);
    assert.equal(
      await readFile(path.join(dir, ".wrangler/state/current"), "utf8"),
      "new",
    );
    await writeFile(path.join(dir, "application/.dev.vars"), "old-secret");
    await writeFile(path.join(dir, "apps/web/.dev.vars"), "new-secret");
    await assert.rejects(handoffLocal(dir), /Different local secrets/);
    assert.equal(
      await readFile(path.join(dir, "apps/web/.dev.vars"), "utf8"),
      "new-secret",
    );
  }));

test("availability authentication returns allow only bounded local owner destinations", async () => {
  const {guestReturn} = await import("../../apps/web/lib/return-path");
  for (const url of ["/owner/properties/p/availability", "/owner/properties/p/availability/r?start=2026-11-02", "/owner/properties/p/bookings/b?response=abc"])
    assert.equal(guestReturn(url), url);
  for (const url of ["https://evil.invalid/owner", "//evil.invalid", "/owner/properties/p/availability/r/extra", "/owner/properties/p/availability/r#fragment", "/owner/properties/p/availability/r\\evil", "/owner/properties/p/availability/r?x=\u000a", "/owner/properties/p/availability/r?x=" + "a".repeat(4001)])
    assert.equal(guestReturn(url), "/owner");
});

test("external review recovery returns stay local and bounded through authentication", async () => {
  const {guestReturn} = await import("../../apps/web/lib/return-path");
  for(const url of ["/owner/properties/p/bookings/external", "/owner/properties/p/bookings/external/abc"])
    assert.equal(guestReturn(url),url);
  for(const url of ["/owner/properties/p/bookings/external/abc/more", "/owner/properties/p/bookings/external//evil", "/owner/properties/p/bookings/external/abc\\evil"])
    assert.equal(guestReturn(url),"/owner");
});

// Feature boundaries (ADR 0008, docs/architecture/feature-structure.md).
// Lower layers never import the same or a higher layer.
const backendLayers: Record<string, number> = {
  shared: 0,
  accounts: 1, "owner-access": 1, "platform-admin": 1, properties: 1, "property-information": 1, "property-logistics": 1,
  media: 1, rooms: 1, inventory: 1, quotes: 1, payments: 1,
  calendar: 2, publication: 2,
  catalog: 3,
  "listing-controls": 4, bookings: 4,
  "external-bookings": 5, jobs: 5,
};
const importPattern =
  /(?:from\s*|import\s*\(|require\s*\(|^\s*import\s+)["']([^"']+)["']/gm;
const posix = (p: string) => p.split(path.sep).join("/");
// "shared" or a feature name for a backend source path, otherwise null.
function backendUnit(rel: string) {
  const m = rel.match(/^packages\/backend\/src\/(?:(shared)|features\/([^/]+))\//);
  return m ? (m[1] ?? m[2]) : null;
}
const webFeature = (rel: string) =>
  rel.match(/^apps\/web\/features\/([^/]+)\//)?.[1] ?? null;

// Returns the rule a single import breaks, or null. `rel` is the importing
// file relative to the repository root; `client` marks a "use client" file.
function boundaryViolation(rel: string, specifier: string, client = false) {
  const relTarget = specifier.startsWith(".")
    ? posix(path.posix.normalize(path.posix.join(path.posix.dirname(rel), specifier)))
    : null;
  const from = backendUnit(rel);
  if (from && relTarget && !/\/(tests|testing)\//.test(rel)) {
    const to = backendUnit(relTarget + "/");
    if (to && to !== from) {
      if (!/\/index$/.test(relTarget)) return "cross-feature backend import must use the feature index";
      if (backendLayers[to] >= backendLayers[from]) return `backend layer: ${from} may not import ${to}`;
    }
  }
  if (/^(apps|scripts)\//.test(rel) && relTarget?.startsWith("packages/backend/"))
    return "apps and scripts import the backend package, not its files";
  const pkg = specifier.match(/^@root-of-cambodia\/backend\/(.+)$/)?.[1];
  if (pkg !== undefined && !(pkg in backendLayers))
    return `unknown backend entry: ${pkg}`;
  if (rel.startsWith("apps/web/")) {
    const own = webFeature(rel);
    const alias = specifier.startsWith("@/") ? specifier.slice(2) : null;
    if (own && relTarget && !relTarget.startsWith(`apps/web/features/${own}/`))
      return "imports leaving a web feature use @/ aliases";
    const target = alias?.match(/^features\/([^/]+)(?:\/(.+))?$/);
    if (target) {
      const [, name, sub] = target;
      const isRoute = rel.startsWith("apps/web/app/");
      if (!own && !isRoute) return "shared web code may not import a feature";
      if (name !== own && sub && sub !== "server" && !(isRoute && /^(components|screens)\//.test(sub)))
        return "other features import only index or server.ts; routes may also use components/ and screens/";
    }
    if (client && (alias?.startsWith("server/") || /^features\/[^/]+\/server$/.test(alias ?? "")))
      return "client components may not import server-only code";
  }
  return null;
}

test("feature boundary rules reject each kind of violation", () => {
  const bad: [string, string, boolean?][] = [
    ["packages/backend/src/features/catalog/catalog-queries.ts", "../media/media-queries"],
    ["packages/backend/src/features/media/media.ts", "../catalog/index"],
    ["packages/backend/src/shared/access.ts", "../features/rooms/index"],
    ["apps/web/server/http.ts", "../../../packages/backend/src/shared/errors"],
    ["apps/web/app/page.tsx", "@root-of-cambodia/backend/room-persistence"],
    ["apps/web/features/rooms/components/room-type-form.tsx", "../../calendar/components/room-calendar-form"],
    ["apps/web/features/rooms/components/room-type-form.tsx", "@/features/calendar/components/room-calendar-form"],
    ["apps/web/components/sign-out.tsx", "@/features/accounts"],
    ["apps/web/features/rooms/components/room-type-form.tsx", "@/server/http", true],
    ["apps/web/features/rooms/components/room-type-form.tsx", "@/features/media/server", true],
  ];
  for (const [rel, specifier, client] of bad)
    assert.ok(boundaryViolation(rel, specifier, client), `${rel} -> ${specifier} should be refused`);
  const good: [string, string][] = [
    ["packages/backend/src/features/catalog/catalog-queries.ts", "../media/index"],
    ["packages/backend/src/features/catalog/catalog-queries.ts", "./catalog-helpers"],
    ["packages/backend/src/features/rooms/tests/rooms.test.ts", "../room-persistence"],
    ["apps/web/app/owner/page.tsx", "@/features/properties/components/property-form"],
    ["apps/web/app/review/page.tsx", "@/features/publication/server"],
    ["apps/web/features/payments/components/payment-records.tsx", "@/lib/booking-format"],
    ["apps/web/features/media/media-http.ts", "@/server/runtime"],
    ["apps/web/app/page.tsx", "@root-of-cambodia/backend/bookings"],
  ];
  for (const [rel, specifier] of good)
    assert.equal(boundaryViolation(rel, specifier), null, `${rel} -> ${specifier}`);
});

test("source follows the feature boundary rules", async () => {
  const problems: string[] = [];
  for (const dir of ["packages/backend/src", "apps/web/app", "apps/web/features", "apps/web/components", "apps/web/lib", "apps/web/server", "apps/jobs/src", "scripts"])
    for (const file of await sources(path.join(root, dir))) {
      if (!/\.(ts|tsx|mts|mjs)$/.test(file)) continue;
      const rel = posix(path.relative(root, file));
      const source = await readFile(file, "utf8");
      const client = /^\s*["']use client["']/.test(source);
      for (const match of source.matchAll(importPattern)) {
        const problem = boundaryViolation(rel, match[1], client);
        if (problem) problems.push(`${rel}: ${match[1]} (${problem})`);
      }
    }
  assert.deepEqual(problems, []);
});
