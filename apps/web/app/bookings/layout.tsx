import { SignOut } from "@/components/sign-out";
import type { ReactNode } from "react";
import { PageContainer } from "@/components/page-container";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <PageContainer>
      <nav aria-label="Booking account" className="mb-6 flex justify-end">
        <SignOut />
      </nav>
      {children}
    </PageContainer>
  );
}
