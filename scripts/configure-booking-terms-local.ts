// Trusted local command; terms content must already have project-owner approval.
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
const args = process.argv.slice(2);
if (
  args.length !== 4 ||
  args[0] !== "--version" ||
  args[2] !== "--file" ||
  !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(args[1]) ||
  args[1] === "unconfigured"
)
  throw new Error(
    "Use --version <approved version> --file <approved plain-text terms file>",
  );
if ((await stat(args[3])).size > 80000) throw new Error("Terms file too large");
const content = (await readFile(args[3], "utf8")).trim();
if (!content || content.length > 20000)
  throw new Error("Terms must contain 1–20,000 characters");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const proxy = await getPlatformProxy<{ DB: D1Database }>({
  configPath: path.join(root, "apps/web/wrangler.jsonc"),
  remoteBindings: false,
  persist: { path: path.join(root, ".wrangler/state") },
});
try {
  await proxy.env.DB.prepare(
    "INSERT INTO booking_terms_document(version,content) VALUES (?,?) ON CONFLICT(version) DO NOTHING",
  )
    .bind(args[1], content)
    .run();
  const saved = await proxy.env.DB.prepare(
    "SELECT content FROM booking_terms_document WHERE version=?",
  )
    .bind(args[1])
    .first<{ content: string }>();
  if (saved?.content !== content)
    throw new Error(
      "This immutable version already has different content; use a newly approved version",
    );
  console.log(
    "Approved terms document saved locally. Reviewer terms-version selection is configured separately.",
  );
} finally {
  await proxy.dispose();
}
