import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
export const metadata = {
  title: { default: "Root of Cambodia", template: "%s · Root of Cambodia" },
  description: "Private owner workspace for Root of Cambodia.",
};
export default function Layout({ children }: { children: ReactNode }) {
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
          Local preview · Email delivery is not connected. Drafts stay private.
        </div>
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Root of Cambodia<span className="ml-2 text-primary">↗</span>
            </Link>
            <Link href="/owner" className="text-sm font-medium text-primary">
              Owner workspace
            </Link>
          </div>
        </header>
        {children}
        <footer className="mx-auto max-w-6xl px-5 py-10 text-xs text-muted-foreground sm:px-8">
          Root of Cambodia · Owner preview <span className="mx-2">/</span>{" "}
          Payment at the property
        </footer>
      </body>
    </html>
  );
}
