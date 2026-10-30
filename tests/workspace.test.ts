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
import { handoffLocal } from "../scripts/handoff-local";

const root = path.resolve(import.meta.dirname, "..");
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
  const {guestReturn} = await import("../apps/web/src/return-path");
  for (const url of ["/owner/properties/p/availability", "/owner/properties/p/availability/r?start=2026-11-02", "/owner/properties/p/bookings/b?response=abc"])
    assert.equal(guestReturn(url), url);
  for (const url of ["https://evil.invalid/owner", "//evil.invalid", "/owner/properties/p/availability/r/extra", "/owner/properties/p/availability/r#fragment", "/owner/properties/p/availability/r\\evil", "/owner/properties/p/availability/r?x=\u000a", "/owner/properties/p/availability/r?x=" + "a".repeat(4001)])
    assert.equal(guestReturn(url), "/owner");
});

test("external review recovery returns stay local and bounded through authentication", async () => {
  const {guestReturn} = await import("../apps/web/src/return-path");
  for(const url of ["/owner/properties/p/bookings/external", "/owner/properties/p/bookings/external/abc"])
    assert.equal(guestReturn(url),url);
  for(const url of ["/owner/properties/p/bookings/external/abc/more", "/owner/properties/p/bookings/external//evil", "/owner/properties/p/bookings/external/abc\\evil"])
    assert.equal(guestReturn(url),"/owner");
});
