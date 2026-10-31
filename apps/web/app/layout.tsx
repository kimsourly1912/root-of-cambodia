import type { ReactNode } from "react";
import Link from "next/link";
import { runtime } from "@/server/runtime";
import "./globals.css";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { isStaging } = await runtime();
  return {
    title: { default: "Root of Cambodia", template: "%s · Root of Cambodia" },
    description: "Explore accommodation in Cambodia and manage your property.",
    ...(isStaging ? { robots: { index: false, follow: false } } : {}),
  };
}
export default async function Layout({ children }: { children: ReactNode }) {
  const { readOnly, fixtureTest, isStaging } = await runtime();
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:bg-white focus:p-3"
        >
          Skip to content
        </a>
        <div className="border-b bg-secondary px-5 py-2 text-center text-xs text-secondary-foreground">
          {fixtureTest ? "Staging test · Sample data only. Email is off." : readOnly
            ? "Staging preview · Browsing only. Accounts, bookings and email are unavailable."
            : "Local preview · Email delivery is not connected. Drafts stay private."}
        </div>
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Root of Cambodia<span className="ml-2 text-primary">↗</span>
            </Link>
            <nav
              aria-label="Main navigation"
              className="flex flex-wrap gap-5 text-sm font-medium text-primary"
            >
              <Link href="/stays">Explore stays</Link>
              {fixtureTest && <Link href="/testing">Testing guide</Link>}
              {!readOnly && <>
                <Link href="/bookings">My bookings</Link>
                <Link href="/owner">Owner workspace</Link>
              </>}
            </nav>
          </div>
        </header>
        {children}
        <footer className="mx-auto max-w-6xl px-5 py-10 text-xs text-muted-foreground sm:px-8">
          Root of Cambodia · {isStaging ? "Staging preview" : "Local preview"} <span className="mx-2">/</span>{" "}
          Payment at the property
        </footer>
      </body>
    </html>
  );
}
