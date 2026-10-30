import { SignOut } from "@/components/sign-out";
import type { ReactNode } from "react";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <nav aria-label="Booking account" className="mb-6 flex justify-end">
        <SignOut />
      </nav>
      {children}
    </main>
  );
}
