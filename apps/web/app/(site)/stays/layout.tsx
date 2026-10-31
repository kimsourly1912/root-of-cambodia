import type { ReactNode } from "react";
import { PageContainer } from "@/components/page-container";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Explore stays",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <PageContainer>
      {children}
    </PageContainer>
  );
}
