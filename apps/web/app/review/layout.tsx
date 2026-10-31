import type { ReactNode } from "react";
import { SignOut } from "@/components/sign-out";
import { TextLink } from "@/components/text-link";
import { PageContainer } from "@/components/page-container";
export const dynamic = "force-dynamic";
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <PageContainer>
      <nav
        aria-label="Reviewer navigation"
        className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b pb-5"
      >
        <TextLink href="/review">
          Publication reviews
        </TextLink>
        <TextLink className="text-sm" href="/owner">
          Your properties
        </TextLink>
        <SignOut />
      </nav>
      {children}
    </PageContainer>
  );
}
