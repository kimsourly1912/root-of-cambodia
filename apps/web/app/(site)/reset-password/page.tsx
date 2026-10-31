import { AccountForm } from "@/features/accounts/components/account-form";
import { PageContainer } from "@/components/page-container";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; next?: string }>;
}) {
  const params = await searchParams;
  return (
    <PageContainer variant="focused">
      <AccountForm
        mode="reset-password"
        next={params.next}
        token={typeof params.token === "string" ? params.token : undefined}
      />
    </PageContainer>
  );
}
