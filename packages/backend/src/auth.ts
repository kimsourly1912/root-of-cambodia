import { betterAuth } from "better-auth";
export type AuthMailer = {
  send: (message: {
    recipient: string;
    kind: "verify" | "reset";
    url: string;
  }) => Promise<void>;
};
export function makeAuth(
  db: D1Database,
  options: { secret: string; baseURL: string; mailer: AuthMailer },
) {
  if (options.secret.length < 32)
    throw new Error("Authentication secret is required");
  return betterAuth({
    database: db,
    secret: options.secret,
    baseURL: options.baseURL,
    trustedOrigins: [options.baseURL],
    advanced: { ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] } },
    rateLimit: { enabled: true, storage: "database" },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      sendResetPassword: async ({ user, url }) =>
        options.mailer.send({ recipient: user.email, kind: "reset", url }),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      sendVerificationEmail: async ({ user, url }) =>
        options.mailer.send({ recipient: user.email, kind: "verify", url }),
    },
  });
}
