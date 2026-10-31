"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import * as z from "zod";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { guestReturn } from "@/lib/return-path";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { TextLink } from "@/components/text-link";
import { StatusMessage } from "@/components/status-message";
import { PageTitle } from "@/components/typography";
export type AuthMode =
  | "sign-in"
  | "sign-up"
  | "verify-email"
  | "forgot-password"
  | "reset-password";
type AuthValues = {
  name: string;
  email: string;
  password: string;
};
const authSchema = (mode: AuthMode) =>
  z
    .object({
      name: z.string(),
      email: z.string(),
      password: z.string(),
    })
    .superRefine(({ name, email, password }, context) => {
      if (mode === "sign-up") {
        if (!name.trim()) {
          context.addIssue({
            code: "custom",
            path: ["name"],
            message: "Enter your name.",
          });
        } else if (name.length > 200) {
          context.addIssue({
            code: "custom",
            path: ["name"],
            message: "Your name must be 200 characters or fewer.",
          });
        }
      }

      if (mode !== "reset-password") {
        if (!email.trim()) {
          context.addIssue({
            code: "custom",
            path: ["email"],
            message: "Enter your email address.",
          });
        } else if (!z.email().safeParse(email.trim()).success) {
          context.addIssue({
            code: "custom",
            path: ["email"],
            message: "Enter a valid email address.",
          });
        }

        if (email.length > 254) {
          context.addIssue({
            code: "custom",
            path: ["email"],
            message: "Your email address must be 254 characters or fewer.",
          });
        }
      }

      if (["sign-in", "sign-up", "reset-password"].includes(mode)) {
        if (password.length < 8) {
          context.addIssue({
            code: "custom",
            path: ["password"],
            message: "Use at least 8 characters.",
          });
        } else if (password.length > 128) {
          context.addIssue({
            code: "custom",
            path: ["password"],
            message: "Your password must be 128 characters or fewer.",
          });
        }
      }
    });
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
  verificationLinkInvalid = false,
}: {
  mode: AuthMode;
  token?: string;
  verified?: boolean;
  next?: string;
  fixtureTest?: boolean;
  verificationLinkInvalid?: boolean;
}) {
  const router = useRouter();
  const next = guestReturn(requestedNext);
  const suffix = next === "/owner" ? "" : "?next=" + encodeURIComponent(next);
  const authHref = (path: string) => path + suffix;
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [title, description, label] = copy[mode];
  useEffect(() => setHydrated(true), []);

  const form = useForm({
    defaultValues: { name: "", email: "", password: "" } satisfies AuthValues,
    validators: {
      onSubmit: authSchema(mode),
    },
    onSubmit: async ({ value }) => {
      if (busy.current) return;
      busy.current = true;
      setPending(true);
      setError("");
      const email = value.email.trim();
      const password = value.password;
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
            name: value.name.trim(),
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
    },
  });
  return (
    <Card className="mx-auto w-full max-w-md shadow-sm">
      <CardHeader>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
          Account access
        </p>
        <CardTitle>
          <PageTitle className="text-2xl">{title}</PageTitle>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {fixtureTest && mode === "sign-in" && (
          <Alert variant="info" role="status" className="mb-5">
            <AlertDescription>
              Use your supplied demo login. These fictional accounts do not
              represent verified customer inboxes.{" "}
              <TextLink href="/testing">Testing guide</TextLink>
            </AlertDescription>
          </Alert>
        )}
        {verified && mode === "sign-in" && (
          <Alert variant="info" className="mb-5" role="status">
            Your email is verified. You can sign in now.
          </Alert>
        )}
        {verificationLinkInvalid && mode === "sign-in" && (
          <Alert variant="destructive" className="mb-5">
            Verification link invalid or expired.{" "}
            <TextLink href={authHref("/verify-email")}>
              Request a fresh link
            </TextLink>
            .
          </Alert>
        )}
        {done ? (
          <div className="space-y-5">
            <Alert variant="info" role="status">
              <AlertDescription>
                {mode === "reset-password"
                  ? "Password updated. Sign in with your new password."
                  : mode === "sign-up"
                    ? "Check your email for a verification link before signing in."
                    : "If this email is eligible, a link has been requested. Check your inbox."}
              </AlertDescription>
            </Alert>
            <Link
              href={authHref("/sign-in")}
              className={buttonVariants({
                variant: "outline",
                className: "w-full",
              })}
            >
              Back to sign in
            </Link>
            {mode === "sign-up" && (
              <p className="text-sm">
                <TextLink href={authHref("/verify-email")}>
                  Request a new verification link
                </TextLink>
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              This preview captures email locally; it does not deliver to an
              inbox.
            </p>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
            noValidate
            className="space-y-5"
            aria-describedby={error ? "auth-error" : undefined}
          >
            <fieldset disabled={!hydrated || pending}>
              <FieldGroup>
                {mode === "sign-up" && (
                  <form.Field name="name">
                    {(field) => {
                      const isInvalid = field.state.meta.errors.length > 0;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>Your name</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            autoComplete="name"
                            aria-invalid={isInvalid}
                            aria-describedby={
                              isInvalid ? "name-error" : undefined
                            }
                            required
                            maxLength={200}
                          />
                          {isInvalid && (
                            <FieldError
                              id="name-error"
                              errors={field.state.meta.errors}
                            />
                          )}
                        </Field>
                      );
                    }}
                  </form.Field>
                )}
                {mode !== "reset-password" && (
                  <form.Field name="email">
                    {(field) => {
                      const isInvalid = field.state.meta.errors.length > 0;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>
                            Email address
                          </FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="email"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            autoComplete="email"
                            autoCapitalize="none"
                            spellCheck={false}
                            aria-invalid={isInvalid}
                            aria-describedby={
                              isInvalid ? "email-error" : undefined
                            }
                            required
                            maxLength={254}
                          />
                          {isInvalid && (
                            <FieldError
                              id="email-error"
                              errors={field.state.meta.errors}
                            />
                          )}
                        </Field>
                      );
                    }}
                  </form.Field>
                )}
                {["sign-in", "sign-up", "reset-password"].includes(mode) && (
                  <form.Field name="password">
                    {(field) => {
                      const isInvalid = field.state.meta.errors.length > 0;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                          <InputGroup>
                            <InputGroupInput
                              id={field.name}
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(event) =>
                                field.handleChange(event.target.value)
                              }
                              type={showPassword ? "text" : "password"}
                              autoComplete={
                                mode === "sign-in"
                                  ? "current-password"
                                  : "new-password"
                              }
                              minLength={8}
                              maxLength={128}
                              aria-invalid={isInvalid}
                              aria-describedby={
                                isInvalid
                                  ? "password-error"
                                  : "password-description"
                              }
                              required
                            />
                            <InputGroupAddon align="inline-end">
                              <InputGroupButton
                                type="button"
                                size="icon-sm"
                                disabled={!hydrated || pending}
                                aria-label={
                                  showPassword ? "Hide password" : "Show password"
                                }
                                aria-pressed={showPassword}
                                onClick={() =>
                                  setShowPassword((visible) => !visible)
                                }
                                className="[@media(pointer:coarse)]:min-w-11"
                              >
                                {showPassword ? (
                                  <EyeOff aria-hidden="true" />
                                ) : (
                                  <Eye aria-hidden="true" />
                                )}
                              </InputGroupButton>
                            </InputGroupAddon>
                          </InputGroup>
                          {!isInvalid && (
                            <FieldDescription id="password-description">
                              At least 8 characters.
                            </FieldDescription>
                          )}
                          {isInvalid && (
                            <FieldError
                              id="password-error"
                              errors={field.state.meta.errors}
                            />
                          )}
                        </Field>
                      );
                    }}
                  </form.Field>
                )}
              </FieldGroup>
              {mode === "reset-password" && !token ? (
                <StatusMessage tone="error">
                  Reset link missing.{" "}
                  <TextLink href={authHref("/forgot-password")}>
                    Request a new link
                  </TextLink>
                  .
                </StatusMessage>
              ) : (
                <Button
                  type="submit"
                  disabled={!hydrated || pending}
                  className="w-full"
                >
                  {pending ? "Please wait…" : label}
                </Button>
              )}
            </fieldset>
            {error && (
              <StatusMessage tone="error" id="auth-error">
                {error}
              </StatusMessage>
            )}
          </form>
        )}
      </CardContent>
      {!done && !fixtureTest && (
        <CardFooter className="flex-col items-stretch gap-4">
          <div className="space-y-3 text-sm">
            {mode === "sign-in" ? (
              <>
                <p className="text-center text-muted-foreground">
                  New here?{" "}
                  <TextLink href={authHref("/sign-up")}>
                    Create an account
                  </TextLink>
                </p>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
                  <TextLink href={authHref("/forgot-password")}>
                    Forgot password?
                  </TextLink>
                  <TextLink href={authHref("/verify-email")}>
                    Resend verification email
                  </TextLink>
                </div>
              </>
            ) : (
              <TextLink href={authHref("/sign-in")}>
                Back to sign in
              </TextLink>
            )}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
