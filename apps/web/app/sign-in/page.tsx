import { AuthForm } from "@/components/auth-form";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main id="main" className="px-5 py-12 sm:py-16">
      {params.error && (
        <p
          role="alert"
          className="mx-auto mb-5 max-w-md text-sm text-destructive"
        >
          Verification link invalid or expired. Request a fresh link.
        </p>
      )}
      <AuthForm
        mode="sign-in"
        verified={params.verified === "1" && !params.error}
      />
    </main>
  );
}
