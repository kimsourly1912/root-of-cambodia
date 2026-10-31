import { AccountForm } from "@/features/accounts/components/account-form";
import { PageContainer } from "@/components/page-container";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; error?: string; next?: string }>;
}) {
  const params = await searchParams;
  return (
    <PageContainer variant="focused">
      <AccountForm
        mode="sign-in"
        next={params.next}
        verified={params.verified === "1" && !params.error}
        verificationLinkInvalid={Boolean(params.error)}
      />
    </PageContainer>
  );
}
