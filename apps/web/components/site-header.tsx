import Link from "next/link";
import { House } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { LinkPending } from "@/components/link-pending";

type SiteHeaderProps = {
  fixtureTest: boolean;
  readOnly: boolean;
  // Capabilities of the signed-in account (ADR 0010); null when signed out.
  // Choosing links only: every destination checks access itself.
  viewer: { owner: boolean; admin: boolean } | null;
};

function SiteHeader({ fixtureTest, readOnly, viewer }: SiteHeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Link
          href="/"
          aria-label="Root of Cambodia home"
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md text-lg font-semibold tracking-tight text-foreground"
        >
          <House aria-hidden="true" className="size-5 text-primary" />
          Root of Cambodia
        </Link>
        <nav aria-label="Main navigation">
          <ul className="flex flex-wrap items-center gap-1">
            <li>
              <Link
                href="/stays"
                className={buttonVariants({ variant: "ghost", size: "sm", className: "relative" })}
              >
                Explore stays
                <LinkPending />
              </Link>
            </li>
            {fixtureTest && (
              <li>
                <Link
                  href="/testing"
                  className={buttonVariants({ variant: "ghost", size: "sm", className: "relative" })}
                >
                  Testing guide
                  <LinkPending />
                </Link>
              </li>
            )}
            {!readOnly && (
              <>
                <li>
                  <Link
                    href="/bookings"
                    className={buttonVariants({ variant: "ghost", size: "sm", className: "relative" })}
                  >
                    My bookings
                    <LinkPending />
                  </Link>
                </li>
                <li>
                  <Link
                    href={viewer && !viewer.owner ? "/owner/apply" : "/owner"}
                    className={buttonVariants({ variant: "ghost", size: "sm", className: "relative" })}
                  >
                    {viewer?.owner ? "Owner workspace" : "List your property"}
                    <LinkPending />
                  </Link>
                </li>
                {viewer?.admin && (
                  <li>
                    <Link
                      href="/admin"
                      className={buttonVariants({ variant: "ghost", size: "sm", className: "relative" })}
                    >
                      Admin
                      <LinkPending />
                    </Link>
                  </li>
                )}
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export { SiteHeader };
