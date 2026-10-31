// Read-only check of relative Markdown links and heading anchors.
// Usage: node scripts/check-doc-links.ts [file-or-directory ...]
// Writes nothing and needs no install, initialization or network.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skipped = new Set([
  "node_modules",
  ".git",
  ".next",
  ".open-next",
  ".wrangler",
  "test-results",
  "playwright-report",
  ".pnpm-local-store",
  "dist",
]);

async function markdownFiles(target: string): Promise<string[]> {
  if (!(await stat(target)).isDirectory())
    return target.endsWith(".md") ? [target] : [];
  const found: string[] = [];
  for (const entry of await readdir(target, { withFileTypes: true })) {
    if (skipped.has(entry.name)) continue;
    found.push(...(await markdownFiles(path.join(target, entry.name))));
  }
  return found;
}

// Drop fenced blocks and inline code so example syntax is not checked.
function prose(text: string): string {
  return text
    .replace(/^(~~~|```)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "")
    .replace(/`[^`\n]*`/g, "");
}

// GitHub heading slugs: lowercase, drop punctuation, spaces become hyphens.
function slug(heading: string): string {
  return heading
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-");
}

const anchorCache = new Map<string, Set<string>>();
async function anchors(file: string): Promise<Set<string>> {
  const cached = anchorCache.get(file);
  if (cached) return cached;
  const seen = new Map<string, number>();
  const result = new Set<string>();
  for (const match of prose(await readFile(file, "utf8")).matchAll(
    /^#{1,6}\s+(.+?)\s*#*\s*$/gm,
  )) {
    const base = slug(match[1]);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    result.add(count ? `${base}-${count}` : base);
  }
  anchorCache.set(file, result);
  return result;
}

const exists = (file: string) =>
  stat(file).then(
    () => true,
    () => false,
  );

const targets = process.argv.slice(2);
const files = (
  await Promise.all(
    (targets.length ? targets : ["."]).map((t) =>
      markdownFiles(path.resolve(root, t)),
    ),
  )
).flat();

let checked = 0;
const failures: string[] = [];
for (const file of files) {
  const text = prose(await readFile(file, "utf8"));
  for (const match of text.matchAll(/\]\(<?([^)\s>]+)>?(?:\s+"[^"]*")?\)/g)) {
    const link = match[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(link)) continue;
    checked++;
    const [rawPath, anchor] = link.split("#", 2);
    const resolved = rawPath
      ? path.resolve(path.dirname(file), decodeURIComponent(rawPath))
      : file;
    const where = path.relative(root, file).replaceAll("\\", "/");
    if (!(await exists(resolved))) {
      failures.push(`${where}: missing ${link}`);
      continue;
    }
    if (
      anchor &&
      resolved.endsWith(".md") &&
      !(await anchors(resolved)).has(decodeURIComponent(anchor))
    )
      failures.push(`${where}: missing anchor ${link}`);
  }
}

for (const failure of failures) console.error(failure);
console.log(
  `${files.length} Markdown files, ${checked} relative links/anchors, ${failures.length} failures`,
);
if (failures.length) process.exitCode = 1;
