import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { runtime } from "@/server/runtime";
import { workspaceNavigation } from "@/server/workspace-navigation";
import { PreviewNotice } from "@/components/preview-notice";
import { WorkspaceShell } from "@/components/workspace-shell";

export default async function Layout({ children }: { children: ReactNode }) {
  const [{ readOnly, fixtureTest }, navigation, jar] = await Promise.all([
    runtime(),
    workspaceNavigation(),
    cookies(),
  ]);
  return (
    <WorkspaceShell
      navigation={navigation}
      defaultOpen={jar.get("sidebar_state")?.value !== "false"}
      notice={<PreviewNotice fixtureTest={fixtureTest} readOnly={readOnly} />}
    >
      {children}
    </WorkspaceShell>
  );
}
