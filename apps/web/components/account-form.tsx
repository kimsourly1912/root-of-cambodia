import type { ComponentProps } from "react";
import Link from "next/link";
import { runtime } from "@/src/runtime";
import { AuthForm } from "./auth-form";

export async function AccountForm(props: ComponentProps<typeof AuthForm>) {
  if ((await runtime()).readOnly)
    return (
      <section className="mx-auto max-w-md rounded-xl border bg-card p-6">
        <h1 className="text-2xl font-semibold">Account access is unavailable</h1>
        <p role="status" className="mt-4 text-muted-foreground">
          This staging preview supports browsing only. Sign-in, registration,
          verification and password recovery are unavailable until email is connected.
        </p>
        <Link href="/stays" className="mt-6 inline-block text-primary underline">
          Explore stays
        </Link>
      </section>
    );
  return <AuthForm {...props} />;
}
