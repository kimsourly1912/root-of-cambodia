import type { ComponentProps } from "react";
import { runtime } from "@/server/runtime";
import { AuthForm } from "./auth-form";

import { PageTitle } from "@/components/typography";
import { TextLink } from "@/components/text-link";
import { StatusMessage } from "@/components/status-message";
export async function AccountForm(props: ComponentProps<typeof AuthForm>) {
  const { readOnly, fixtureTest } = await runtime();
  if (readOnly || (fixtureTest && props.mode !== "sign-in"))
    return (
      <section className="mx-auto max-w-md rounded-xl border bg-card p-6">
        <PageTitle>Account access is unavailable</PageTitle>
        <StatusMessage tone="info" className="mt-4">
          {fixtureTest
            ? "Registration, email verification and password recovery are disabled. Use the private demo credentials to sign in."
            : "This staging preview supports browsing only. Sign-in, registration, verification and password recovery are unavailable until email is connected."}
        </StatusMessage>
        <TextLink className="mt-6 inline-block" href="/stays">
          Explore stays
        </TextLink>
      </section>
    );
  return <>
    {fixtureTest && <p className="mx-auto mb-5 max-w-md rounded-xl border p-4 text-sm">
      Use your supplied demo login. These fictional accounts do not represent
      verified customer inboxes. <TextLink href="/testing">Testing guide</TextLink>
    </p>}
    <AuthForm {...props} fixtureTest={fixtureTest} verified={fixtureTest ? false : props.verified} />
  </>;
}
