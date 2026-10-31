import type { ReactNode } from "react";
import { runtime } from "@/server/runtime";
import { SiteHeader } from "@/components/site-header";
import { PreviewNotice } from "@/components/preview-notice";
import { viewer } from "@/server/viewer";

export default async function Layout({ children }: { children: ReactNode }) {
  const [{ readOnly, fixtureTest, isStaging }, current] = await Promise.all([runtime(), viewer()]);
  return (
    <>
      <PreviewNotice fixtureTest={fixtureTest} readOnly={readOnly} />
      <SiteHeader
        fixtureTest={fixtureTest}
        readOnly={readOnly}
        viewer={current && { owner: current.owner, admin: current.admin }}
      />
      {children}
      <footer className="mx-auto max-w-6xl px-5 py-10 text-xs text-muted-foreground sm:px-8">
        Root of Cambodia · {isStaging ? "Staging preview" : "Local preview"} <span className="mx-2">/</span>{" "}
        Payment at the property
      </footer>
    </>
  );
}
