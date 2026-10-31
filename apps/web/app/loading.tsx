import { PageContainer } from "@/components/page-container";
import { RouteSkeleton } from "@/app/_skeletons/route-skeleton";
// Top-level pages (home, sign-in…) render their own PageContainer; area
// layouts below replace this with their own loading.tsx.
export default function Loading() {
  return (
    <PageContainer>
      <RouteSkeleton />
    </PageContainer>
  );
}
