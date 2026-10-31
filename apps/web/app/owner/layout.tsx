import type { ReactNode } from "react";
import { SignOut } from "@/components/sign-out";
import { TextLink } from "@/components/text-link";
import { PageContainer } from "@/components/page-container";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <PageContainer>
      <nav
        aria-label="Owner navigation"
        className="mb-8 flex items-center justify-between border-b pb-5"
      >
        <TextLink href="/owner">
          Your properties
        </TextLink>
        <SignOut />
      </nav>
      {children}
    </PageContainer>
  );
}
