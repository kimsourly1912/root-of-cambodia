import { LoadingState } from "@/components/status-message";
import { PageContainer } from "@/components/page-container";
// Top-level pages (home, sign-in…) render their own PageContainer; area
// layouts below replace this with their own loading.tsx.
export default function Loading() {
  return (
    <PageContainer>
      <LoadingState>Loading page…</LoadingState>
    </PageContainer>
  );
}
