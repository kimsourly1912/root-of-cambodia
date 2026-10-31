import { PublicStayDetailsSkeleton } from "@/features/catalog/components/public-stay-details";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SkeletonAsidePanel,
  SkeletonBadge,
  SkeletonButton,
  SkeletonCard,
  SkeletonField,
  SkeletonLine,
  SkeletonParagraph,
} from "@/components/page-skeleton";

// Guest page skeletons. Each mirrors the markup of the page named above it.

// app/(site)/stays/page.tsx
export function StaysSkeleton() {
  return (
    <>
      <div className="max-w-2xl">
        <SkeletonLine size="sm" className="mb-3 w-32" />
        <SkeletonLine size="hero" className="w-80 max-w-full" />
        <SkeletonLine className="mt-4 w-96 max-w-full" />
      </div>
      <div className="my-8 grid items-end gap-4 rounded-xl border bg-card p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <SkeletonField />
        <SkeletonField />
        <SkeletonButton />
      </div>
      <SkeletonLine size="sm" className="mb-5 w-28" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="min-w-0 overflow-hidden rounded-xl border bg-card p-3">
            <Skeleton className="aspect-[4/3] rounded-lg" />
            <div className="space-y-2 px-1 pb-2 pt-4">
              <SkeletonLine size="sm" className="w-20" />
              <SkeletonLine size="lg" className="w-3/4" />
              <SkeletonLine size="sm" className="w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// app/(site)/stays/[id]/page.tsx
export function StaySkeleton() {
  return (
    <>
      <SkeletonLine size="sm" className="mb-8 w-28" />
      <SkeletonButton className="mb-7 w-32" />
      <PublicStayDetailsSkeleton />
    </>
  );
}

// app/(site)/stays/[id]/request/page.tsx with GuestRequestForm
export function StayRequestSkeleton() {
  return (
    <div className="space-y-7">
      <SkeletonLine className="w-28" />
      <SkeletonLine size="title" className="w-56" />
      <div className="space-y-6">
        <SkeletonCard description={false}>
          <div className="grid gap-5 sm:grid-cols-2">
            <SkeletonField />
            <SkeletonField />
          </div>
        </SkeletonCard>
        <SkeletonCard>
          <div className="grid gap-4 sm:grid-cols-3">
            <SkeletonField />
            <SkeletonField />
            <SkeletonField />
          </div>
        </SkeletonCard>
        <SkeletonButton className="w-40" />
      </div>
    </div>
  );
}

// app/(site)/bookings/page.tsx
export function GuestBookingsSkeleton() {
  return (
    <div className="space-y-7">
      <SkeletonLine size="title" className="w-48" />
      <SkeletonLine className="w-full max-w-xl" />
      <div className="grid gap-5 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <BookingCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

// One booking in a guest or owner booking list.
export function BookingCardSkeleton() {
  return (
    <div className="min-w-0 space-y-3 rounded-xl border bg-card p-5">
      <SkeletonBadge className="w-20" />
      <SkeletonLine className="w-1/2" />
      <SkeletonLine className="w-48" />
      <SkeletonLine className="w-20" />
      <SkeletonLine className="w-28" />
    </div>
  );
}

// app/(site)/bookings/[id]/page.tsx
export function GuestBookingSkeleton() {
  return (
    <div className="space-y-7">
      <SkeletonLine className="w-28" />
      <div className="space-y-3">
        <SkeletonLine className="w-24" />
        <SkeletonLine size="title" className="w-2/3" />
        <SkeletonLine size="xs" className="w-72 max-w-full" />
      </div>
      <div className="space-y-4 rounded-xl border bg-card p-6">
        <SkeletonLine className="w-64 max-w-full" />
        <SkeletonLine className="w-80 max-w-full" />
        <SkeletonLine size="2xl" className="w-28" />
        <SkeletonLine className="w-72 max-w-full" />
      </div>
      <BookingLinesSkeleton />
      <BookingUpdatesSkeleton />
    </div>
  );
}

// The "Rooms and price" section of a booking.
export function BookingLinesSkeleton() {
  return (
    <div className="space-y-4 rounded-xl border p-6">
      <SkeletonLine size="lg" className="w-44" />
      <div className="space-y-3">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="flex flex-wrap justify-between gap-3">
            <div className="w-56 max-w-full">
              <SkeletonLine size="sm" className="w-40" />
              <SkeletonLine size="sm" />
            </div>
            <SkeletonLine size="sm" className="w-36" />
          </div>
        ))}
      </div>
      <SkeletonParagraph />
      <SkeletonLine size="xs" className="w-52" />
    </div>
  );
}

// The "Booking updates" history of a booking.
export function BookingUpdatesSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonLine size="lg" className="w-44" />
      <div className="space-y-3">
        <Skeleton className="h-13 rounded-lg" />
        <Skeleton className="h-13 rounded-lg" />
      </div>
      <SkeletonLine className="w-44" />
    </div>
  );
}

// app/(site)/bookings/requests/[id]/page.tsx with BookingReview
export function BookingRequestSkeleton() {
  return (
    <div className="space-y-7">
      <SkeletonLine size="title" className="w-56" />
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <SkeletonCard>
            <div className="space-y-2 rounded-lg border p-4">
              <SkeletonLine className="w-40" />
              <SkeletonParagraph size="sm" lines={3} />
            </div>
          </SkeletonCard>
          <SkeletonCard description={false}>
            <SkeletonParagraph size="sm" lines={3} />
          </SkeletonCard>
        </div>
        <SkeletonAsidePanel />
      </div>
    </div>
  );
}

// Fallback for pages without their own skeleton: a title and a block of content.
export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <SkeletonLine size="title" className="w-64 max-w-full" />
        <SkeletonLine className="mt-3 w-96 max-w-full" />
      </div>
      <SkeletonCard>
        <SkeletonParagraph lines={3} />
      </SkeletonCard>
    </div>
  );
}
