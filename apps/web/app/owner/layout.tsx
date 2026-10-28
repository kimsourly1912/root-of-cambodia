import type { ReactNode } from "react";
import Link from "next/link";
import { SignOut } from "@/components/sign-out";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <nav
        aria-label="Owner navigation"
        className="mb-8 flex items-center justify-between border-b pb-5"
      >
        <Link href="/owner" className="font-medium text-primary">
          Your properties
        </Link>
        <SignOut />
      </nav>
      {children}
    </main>
  );
}
