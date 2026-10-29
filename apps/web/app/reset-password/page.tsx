import { AuthForm } from "@/components/auth-form";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return (
    <main id="main" className="px-5 py-12 sm:py-16">
      <AuthForm
        mode="reset-password"
        token={typeof params.token === "string" ? params.token : undefined}
      />
    </main>
  );
}
