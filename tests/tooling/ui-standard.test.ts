import { test } from "vitest";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// UI standard (docs/design/ui-standard.md): screens in apps/web/app and
// apps/web/features compose shared components instead of hand-styling native
// markup. apps/web/components holds the primitives and is not scanned.
const root = path.resolve(import.meta.dirname, "../..");
const palette =
  "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone";
const rules: [RegExp, string][] = [
  [/<button[\s>]/, "use Button from @/components/ui/button"],
  [/<input[\s>/]/, "use Input, Checkbox or CheckboxField from @/components/ui"],
  [/<select[\s>]/, "use NativeSelect from @/components/ui/native-select"],
  [/<textarea[\s>]/, "use Textarea from @/components/ui/textarea"],
  [/<table[\s>]/, "add a Table primitive to components/ui first (see components.md)"],
  [/<main[\s>]/, "use PageContainer from @/components/page-container"],
  [/<details[\s>]/, "use Disclosure from @/components/disclosure"],
  [/<h[1-6]\s[^>]*className=/, "use PageTitle or SectionTitle from @/components/typography"],
  [/<(Link|a)\s[^>]*className="[^"]*\b(text-primary|underline)\b/, "use TextLink or textLinkClass from @/components/text-link"],
  [/<p\s[^>]*role="(alert|status)"/, "use StatusMessage or LoadingState from @/components/status-message"],
  [/className="[^"]*\brounded-full\b[^"]*\bbg-secondary\b/, "use Badge from @/components/ui/badge"],
  [new RegExp(`\\b(text|bg|border|ring|outline|fill|stroke|from|to|via)-(${palette})-\\d{2,3}\\b`), "use theme tokens (primary, muted, destructive…), not palette colors"],
  [/-\[(#|rgb|hsl)/, "use theme tokens, not arbitrary color values"],
  [/\bstyle=\{\{/, "use Tailwind classes or a component variant, not inline styles"],
];

function uiViolations(source: string) {
  // Tags may span lines; compare each JSX opening tag as one line.
  const flat = source.replace(/<[A-Za-z][^<>]*>/g, (tag) => tag.replace(/\s+/g, " "));
  return rules.filter(([pattern]) => pattern.test(flat)).map(([, fix]) => fix);
}

async function sources(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) => (e.isDirectory() ? sources(path.join(dir, e.name)) : [path.join(dir, e.name)])),
    )
  ).flat();
}

test("UI rules refuse each kind of hand-styled markup", () => {
  const bad = [
    `<button onClick={go}>Save</button>`,
    `<input\n  type="checkbox"\n  required\n/>`,
    `<select id="x">`,
    `<textarea />`,
    `<table>`,
    `<main id="main" className="px-5">`,
    `<details open>`,
    `<h1 className="text-3xl font-semibold">Title</h1>`,
    `<Link href="/x" className="text-primary underline">x</Link>`,
    `<a\n  href={path}\n  className="block underline"\n>`,
    `<p role="alert" className="text-sm text-destructive">`,
    `<span className="rounded-full bg-secondary px-3 py-1 text-xs">`,
    `<p className="text-red-600">`,
    `<div className="bg-[#245743]">`,
    `<div style={{ color: "red" }}>`,
  ];
  for (const source of bad) assert.ok(uiViolations(source).length, `should refuse: ${source}`);
  const good = [
    `<Button onClick={go}>Save</Button>`,
    `<CheckboxField required>I agree</CheckboxField>`,
    `<PageTitle>Title</PageTitle>`,
    `<CardTitle><h2>Photos</h2></CardTitle>`,
    `<TextLink href="/x" className="block">x</TextLink>`,
    `<a href={path} className={cn(textLinkClass, "block")}>`,
    `<StatusMessage tone="error">{error}</StatusMessage>`,
    `<Badge className="capitalize">{state}</Badge>`,
    `<p className="text-sm text-muted-foreground">`,
    `<div className="rounded-xl border bg-card p-5">`,
  ];
  for (const source of good) assert.deepEqual(uiViolations(source), [], source);
});

test("screens follow the UI standard", async () => {
  const problems: string[] = [];
  for (const dir of ["apps/web/app", "apps/web/features"])
    for (const file of await sources(path.join(root, dir))) {
      if (!file.endsWith(".tsx")) continue;
      for (const fix of uiViolations(await readFile(file, "utf8")))
        problems.push(`${path.relative(root, file).split(path.sep).join("/")}: ${fix}`);
    }
  assert.deepEqual(problems, []);
});
