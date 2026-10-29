import type { ReactNode } from "react";
import Link from "next/link";
import { SignOut } from "@/components/sign-out";
export const dynamic = "force-dynamic";
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <nav
        aria-label="Reviewer navigation"
        className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b pb-5"
      >
        <Link href="/review" className="font-medium text-primary">
          Publication reviews
        </Link>
        <Link href="/owner" className="text-sm underline">
          Your properties
        </Link>
        <SignOut />
      </nav>
      {children}
    </main>
  );
}
