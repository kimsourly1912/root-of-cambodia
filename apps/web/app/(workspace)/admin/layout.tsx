import type { ReactNode } from "react";
import { PageContainer } from "@/components/page-container";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
// Platform admin pages (ADR 0010). Navigation and sign-out come from the
// workspace shell; every page and service checks admin access itself.
export default function Layout({ children }: { children: ReactNode }) {
  return <PageContainer>{children}</PageContainer>;
}
