import type { ComponentProps } from "react";
import Link from "next/link";
import { runtime } from "@/server/runtime";
import { AuthForm } from "./auth-form";

export async function AccountForm(props: ComponentProps<typeof AuthForm>) {
  const { readOnly, fixtureTest } = await runtime();
  if (readOnly || (fixtureTest && props.mode !== "sign-in"))
    return (
      <section className="mx-auto max-w-md rounded-xl border bg-card p-6">
        <h1 className="text-2xl font-semibold">Account access is unavailable</h1>
        <p role="status" className="mt-4 text-muted-foreground">
          {fixtureTest
            ? "Registration, email verification and password recovery are disabled. Use the private demo credentials to sign in."
            : "This staging preview supports browsing only. Sign-in, registration, verification and password recovery are unavailable until email is connected."}
        </p>
        <Link href="/stays" className="mt-6 inline-block text-primary underline">
          Explore stays
        </Link>
      </section>
    );
  return <>
    {fixtureTest && <p className="mx-auto mb-5 max-w-md rounded-xl border p-4 text-sm">
      Use your supplied demo login. These fictional accounts do not represent
      verified customer inboxes. <Link href="/testing" className="text-primary underline">Testing guide</Link>
    </p>}
    <AuthForm {...props} fixtureTest={fixtureTest} verified={fixtureTest ? false : props.verified} />
  </>;
}
