import { AccountForm } from "@/features/accounts/components/account-form";
import { StatusMessage } from "@/components/status-message";
import { PageContainer } from "@/components/page-container";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; error?: string; next?: string }>;
}) {
  const params = await searchParams;
  return (
    <PageContainer variant="focused">
      {params.error && (
        <StatusMessage tone="error" className="mx-auto mb-5 max-w-md">
          Verification link invalid or expired. Request a fresh link.
        </StatusMessage>
      )}
      <AccountForm
        mode="sign-in"
        next={params.next}
        verified={params.verified === "1" && !params.error}
      />
    </PageContainer>
  );
}
