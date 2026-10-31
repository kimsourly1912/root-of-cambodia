import type { ComponentProps } from "react";
import { runtime } from "@/server/runtime";
import { AuthForm } from "./auth-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageTitle } from "@/components/typography";
import { TextLink } from "@/components/text-link";

export async function AccountForm(props: ComponentProps<typeof AuthForm>) {
  const { readOnly, fixtureTest } = await runtime();
  const fixtureOnly = fixtureTest && !readOnly;
  if (readOnly || (fixtureTest && props.mode !== "sign-in"))
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <PageTitle className="text-2xl">
              Account access is unavailable
            </PageTitle>
          </CardTitle>
          <CardDescription>
            {fixtureOnly
              ? "Account registration and email-based account actions are disabled in this preview."
              : "This staging preview supports browsing only."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Alert variant="info" role="status">
            <AlertDescription>
              {fixtureOnly
                ? "Use the private demo credentials to sign in."
                : "Sign-in, registration, verification and password recovery are unavailable until email is connected."}
            </AlertDescription>
          </Alert>
          <TextLink className="inline-block" href="/stays">
            Explore stays
          </TextLink>
        </CardContent>
      </Card>
    );
  return (
    <AuthForm
      {...props}
      fixtureTest={fixtureTest}
      verified={fixtureTest ? false : props.verified}
    />
  );
}
