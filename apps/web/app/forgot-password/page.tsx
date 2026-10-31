import { AccountForm } from "@/features/accounts/components/account-form";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main id="main" className="px-5 py-12 sm:py-16">
      <AccountForm mode="forgot-password" next={next} />
    </main>
  );
}
