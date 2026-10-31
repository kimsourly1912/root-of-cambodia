"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { guestReturn } from "@/src/return-path";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export type AuthMode =
  | "sign-in"
  | "sign-up"
  | "verify-email"
  | "forgot-password"
  | "reset-password";
const copy = {
  "sign-in": [
    "Welcome back",
    "Sign in to manage your bookings and properties.",
    "Sign in",
  ],
  "sign-up": [
    "Create your account",
    "Use an email you can access. You’ll verify it before signing in.",
    "Create account",
  ],
  "verify-email": [
    "Verify your email",
    "Request a fresh verification link for your account.",
    "Send verification link",
  ],
  "forgot-password": [
    "Reset your password",
    "We’ll send a link if an account exists for this email.",
    "Send reset link",
  ],
  "reset-password": [
    "Choose a new password",
    "Use at least 8 characters.",
    "Save new password",
  ],
};
export function AuthForm({
  mode,
  token,
  verified = false,
  next: requestedNext,
  fixtureTest = false,
}: {
  mode: AuthMode;
  token?: string;
  verified?: boolean;
  next?: string;
  fixtureTest?: boolean;
}) {
  const router = useRouter();
  const next = guestReturn(requestedNext);
  const suffix = next === "/owner" ? "" : "?next=" + encodeURIComponent(next);
  const authHref = (path: string) => path + suffix;
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [title, description, label] = copy[mode];
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    const callbackURL = new URL(
      "/sign-in?verified=1" +
        (suffix ? "&next=" + encodeURIComponent(next) : ""),
      window.location.origin,
    ).href;
    const requests = {
      "sign-in": ["sign-in/email", { email, password }],
      "sign-up": [
        "sign-up/email",
        {
          email,
          password,
          name: String(values.get("name") ?? "").trim(),
          callbackURL,
        },
      ],
      "verify-email": ["send-verification-email", { email, callbackURL }],
      "forgot-password": [
        "request-password-reset",
        {
          email,
          redirectTo: new URL(
            authHref("/reset-password"),
            window.location.origin,
          ).href,
        },
      ],
      "reset-password": ["reset-password", { token, newPassword: password }],
    } as const;
    try {
      const [path, body] = requests[mode];
      const response = await fetch("/api/auth/" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? "Too many attempts. Please wait a minute and try again."
            : mode === "sign-in"
              ? "Sign-in failed. Check your email and password, and verify your email before trying again."
              : mode === "reset-password"
                ? "This link may have expired. Request a new password reset link."
                : "We couldn’t complete this request. Please try again shortly.",
        );
        return;
      }
      if (mode === "sign-in") {
        router.replace(next);
        router.refresh();
      } else setDone(true);
    } catch {
      setError("The connection was interrupted. Please try again.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <Card className="mx-auto w-full max-w-md shadow-sm">
      <CardHeader>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
          Account access
        </p>
        <CardTitle className="text-2xl">
          <h1>{title}</h1>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {verified && mode === "sign-in" && (
          <p role="status" className="mb-5 rounded-lg bg-secondary p-3 text-sm">
            Your email is verified. You can sign in now.
          </p>
        )}
        {done ? (
          <div role="status" className="space-y-5">
            <p className="rounded-lg bg-secondary p-4 text-sm">
              {mode === "reset-password"
                ? "Password updated. Sign in with your new password."
                : mode === "sign-up"
                  ? "Check your email for a verification link before signing in."
                  : "If this email is eligible, a link has been requested. Check your inbox."}
            </p>
            <p className="text-sm text-muted-foreground">
              This preview captures email locally; it does not deliver to an
              inbox.
            </p>
            <Link
              className="font-medium text-primary underline underline-offset-4"
              href={authHref("/sign-in")}
            >
              Back to sign in
            </Link>
            {mode === "sign-up" && (
              <p>
                <Link
                  href={authHref("/verify-email")}
                  className="text-sm text-primary underline"
                >
                  Request a new verification link
                </Link>
              </p>
            )}
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="space-y-5"
            aria-describedby={error ? "auth-error" : undefined}
          >
            {mode === "sign-up" && (
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={200}
                />
              </div>
            )}
            {mode !== "reset-password" && (
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </div>
            )}
            {["sign-in", "sign-up", "reset-password"].includes(mode) && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "sign-in" ? "current-password" : "new-password"
                  }
                  minLength={8}
                  maxLength={128}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  At least 8 characters.
                </p>
              </div>
            )}
            {error && (
              <p
                id="auth-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {error}
              </p>
            )}
            {mode === "reset-password" && !token ? (
              <p role="alert">
                Reset link missing.{" "}
                <Link
                  href={authHref("/forgot-password")}
                  className="text-primary underline"
                >
                  Request a new link
                </Link>
                .
              </p>
            ) : (
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Please wait…" : label}
              </Button>
            )}
          </form>
        )}
        {!done && !fixtureTest && (
          <div className="mt-6 space-y-3 border-t pt-5 text-sm">
            {mode === "sign-in" ? (
              <>
                <p>
                  New here?{" "}
                  <Link
                    className="font-medium text-primary underline"
                    href={authHref("/sign-up")}
                  >
                    Create an account
                  </Link>
                </p>
                <p>
                  <Link
                    className="text-primary underline"
                    href={authHref("/forgot-password")}
                  >
                    Forgot password?
                  </Link>
                </p>
                <p>
                  <Link
                    className="text-primary underline"
                    href={authHref("/verify-email")}
                  >
                    Resend verification email
                  </Link>
                </p>
              </>
            ) : (
              <Link
                className="font-medium text-primary underline"
                href={authHref("/sign-in")}
              >
                Back to sign in
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
