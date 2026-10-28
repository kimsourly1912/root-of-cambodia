import type { ReactNode } from "react";
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="km">
      <body>{children}</body>
    </html>
  );
}
