import type { ReactNode } from "react";
import { PageContainer } from "@/components/page-container";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
// Navigation and sign-out come from the workspace shell (app/(workspace)/layout.tsx).
export default function Layout({ children }: { children: ReactNode }) {
  return <PageContainer>{children}</PageContainer>;
}
