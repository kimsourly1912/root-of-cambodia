import { access, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const exists = async (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

// Preserve legacy ignored state before the first workspace initialization.
// Refuse to merge two databases or silently choose between different secrets.
export async function handoffLocal(root: string) {
  const oldSecret = path.join(root, "application/.dev.vars");
  const newSecret = path.join(root, "apps/web/.dev.vars");
  if (await exists(oldSecret)) {
    if (await exists(newSecret)) {
      if (!(await readFile(oldSecret)).equals(await readFile(newSecret)))
        throw new Error(
          "Different local secrets exist; reconcile the two .dev.vars files before initialization.",
        );
    } else {
      await mkdir(path.dirname(newSecret), { recursive: true });
      await cp(oldSecret, newSecret, { errorOnExist: true, force: false });
    }
  }
  const legacy = path.join(root, "application/.wrangler/state");
  const target = path.join(root, ".wrangler/state");
  const marker = path.join(root, ".wrangler/legacy-application-imported");
  if ((await exists(legacy)) && !(await exists(marker))) {
    if (await exists(target))
      throw new Error(
        "Both legacy and workspace local state exist; reconcile them before initialization.",
      );
    await mkdir(path.dirname(target), { recursive: true });
    await cp(legacy, target, {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
    await writeFile(
      marker,
      "Legacy application local state copied; original retained.\n",
      { flag: "wx" },
    );
  }
}
