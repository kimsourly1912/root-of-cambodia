import { AccountForm } from "@/features/accounts/components/account-form";
import { PageContainer } from "@/components/page-container";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <PageContainer variant="focused">
      <AccountForm mode="forgot-password" next={next} />
    </PageContainer>
  );
}
