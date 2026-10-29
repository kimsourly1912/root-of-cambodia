import type { ReactNode } from "react";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Explore stays",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      {children}
    </main>
  );
}
