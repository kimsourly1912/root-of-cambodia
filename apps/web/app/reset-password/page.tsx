import { AccountForm } from "@/features/accounts/components/account-form";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; next?: string }>;
}) {
  const params = await searchParams;
  return (
    <main id="main" className="px-5 py-12 sm:py-16">
      <AccountForm
        mode="reset-password"
        next={params.next}
        token={typeof params.token === "string" ? params.token : undefined}
      />
    </main>
  );
}
