import { Card, CardContent } from "@/components/ui/card";
import {
  SkeletonBadge,
  SkeletonButton,
  SkeletonLine,
  SkeletonParagraph,
} from "@/components/page-skeleton";
import { ChecklistLayoutSkeleton } from "./owner-skeletons";

// Admin skeletons. Each mirrors the markup of the page named above it.

function AdminHeading({ title }: { title: string }) {
  return (
    <div>
      <SkeletonLine size="title" className={title} />
      <SkeletonParagraph className="mt-3 max-w-2xl" />
    </div>
  );
}

// app/(workspace)/admin/page.tsx
export function AdminHomeSkeleton() {
  return (
    <div className="space-y-8">
      <AdminHeading title="w-32" />
      <div className="space-y-4">
        <SkeletonLine size="lg" className="w-40" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }, (_, index) => (
            <Card key={index}>
              <CardContent className="space-y-3 p-6">
                <SkeletonLine className="w-48" />
                <SkeletonLine size="2xl" className="w-32" />
                <SkeletonButton className="w-36" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <SkeletonLine size="lg" className="w-24" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="space-y-1 rounded-xl border bg-card p-5">
              <SkeletonLine size="sm" className="w-20" />
              <SkeletonLine size="2xl" className="w-10" />
              <SkeletonLine size="sm" className="w-28 max-w-full" />
            </div>
          ))}
        </div>
        <SkeletonLine size="sm" className="w-64 max-w-full" />
      </div>
    </div>
  );
}

// app/(workspace)/admin/owners/page.tsx
export function AdminOwnersSkeleton() {
  return (
    <div className="space-y-6">
      <AdminHeading title="w-72 max-w-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <Card key={index}>
            <CardContent className="space-y-4 p-6">
              <SkeletonLine className="w-1/2" />
              <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
                {["w-56", "w-28", "w-24", "w-40"].map((width) => (
                  <div key={width} className="contents">
                    <SkeletonLine size="sm" className="w-20" />
                    <SkeletonLine size="sm" className={width + " max-w-full"} />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <SkeletonButton />
                <SkeletonButton className="w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// app/(workspace)/admin/properties/page.tsx
export function AdminPropertiesSkeleton() {
  return (
    <div className="space-y-6">
      <AdminHeading title="w-56" />
      <div className="flex flex-wrap gap-2">
        {["w-12", "w-14", "w-28", "w-20", "w-16"].map((width) => (
          <SkeletonButton key={width} size="sm" className={width} />
        ))}
      </div>
      <div className="divide-y rounded-xl border bg-card">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
            <div className="min-w-0 space-y-1">
              <SkeletonLine className="w-48" />
              <SkeletonLine size="sm" className="w-36" />
              <SkeletonLine size="sm" className="w-64 max-w-full" />
            </div>
            <SkeletonBadge className="w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

// app/(workspace)/admin/reviews/page.tsx
export function AdminReviewsSkeleton() {
  return (
    <>
      <SkeletonLine size="title" className="w-72 max-w-full" />
      <SkeletonLine className="mb-8 mt-3 w-72 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-6">
              <SkeletonLine size="lg" className="w-2/3" />
              <SkeletonLine size="sm" className="w-24" />
              <SkeletonLine size="sm" className="w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

// app/(workspace)/admin/reviews/[id]/page.tsx
export function AdminReviewSkeleton() {
  return (
    <>
      <SkeletonLine size="title" className="w-64" />
      <SkeletonParagraph className="mb-8 mt-3 max-w-2xl" />
      <ChecklistLayoutSkeleton />
    </>
  );
}
