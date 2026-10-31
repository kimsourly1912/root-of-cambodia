import {
  PropertyNavigationSkeleton,
  type PropertyTab,
} from "@/features/properties/components/property-navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SkeletonAsidePanel,
  SkeletonBadge,
  SkeletonButton,
  SkeletonCard,
  SkeletonField,
  SkeletonFormLayout,
  SkeletonLine,
  SkeletonParagraph,
} from "@/components/page-skeleton";
import { BookingLinesSkeleton, BookingUpdatesSkeleton } from "./site-skeletons";

// Owner workspace skeletons. Each mirrors the markup of the page named above it.

// app/(workspace)/owner/page.tsx
export function OwnerHomeSkeleton() {
  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div>
          <SkeletonLine size="sm" className="mb-2 w-40" />
          <SkeletonLine size="title" className="w-56" />
          <SkeletonLine className="mt-3 w-xl max-w-full" />
        </div>
        <SkeletonButton className="w-40" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <SkeletonBadge />
                <SkeletonLine size="xs" className="w-16" />
              </div>
              <SkeletonLine size="lg" className="w-2/3" />
              <SkeletonLine size="sm" className="w-1/3" />
              <SkeletonLine size="sm" className="my-4 w-24" />
              <SkeletonLine size="sm" className="w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

// app/(workspace)/owner/apply/page.tsx with OwnerApplicationForm
export function OwnerApplySkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <SkeletonLine size="title" className="w-56" />
        <SkeletonParagraph className="mt-3 max-w-2xl" />
      </div>
      <div className="space-y-4">
        <SkeletonLine size="lg" className="w-48" />
        <div className="max-w-xl space-y-5">
          <SkeletonField />
          <SkeletonField />
          <SkeletonField />
          <SkeletonButton className="w-40" />
        </div>
      </div>
    </div>
  );
}

// The heading the property setup pages share: a small line above the title
// (the property name, or "Property setup / 01" in capitals), the title and
// one line of description.
function PropertyHeading({ setup = false, action = false }: { setup?: boolean; action?: boolean }) {
  const heading = (
    <div>
      <SkeletonLine className={setup ? "w-56" : "w-44"} size="title" />
      <SkeletonLine className={setup ? "mb-8 mt-3 w-72 max-w-full" : "mt-3 w-96 max-w-full"} />
    </div>
  );
  return (
    <>
      <SkeletonLine size={setup ? "xs" : "sm"} className={setup ? "mb-3 w-36" : "mb-2 w-40"} />
      {action ? (
        <div className="flex flex-wrap items-start justify-between gap-5">
          {heading}
          <SkeletonButton className="w-36" />
        </div>
      ) : (
        heading
      )}
    </>
  );
}

// app/(workspace)/owner/properties/new/page.tsx and [id]/page.tsx with PropertyForm
export function PropertyDetailsSkeleton({ navigation = true }: { navigation?: boolean }) {
  return (
    <>
      <PropertyHeading setup />
      {navigation && <PropertyNavigationSkeleton active="details" />}
      <SkeletonFormLayout cards={[["input", "input", "input"], ["pair", "textarea"]]} />
    </>
  );
}

// [id]/rooms/page.tsx
export function RoomTypesSkeleton() {
  return (
    <>
      <PropertyHeading action />
      <PropertyNavigationSkeleton active="rooms" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <Card key={index}>
            <CardContent className="space-y-4 p-6">
              <SkeletonLine size="lg" className="w-1/2" />
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 3 }, (_, column) => (
                  <div key={column}>
                    <SkeletonLine size="xs" className="w-14" />
                    <SkeletonLine className="mt-1 w-6" />
                  </div>
                ))}
              </div>
              <SkeletonLine size="sm" className="w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

// [id]/rooms/new/page.tsx and [id]/rooms/[roomId]/page.tsx with RoomTypeForm
export function RoomTypeSkeleton() {
  return (
    <>
      <PropertyHeading />
      <PropertyNavigationSkeleton active="rooms" />
      <SkeletonFormLayout cards={[["input", "triple"]]} />
    </>
  );
}

// [id]/rooms/[roomId]/calendar/page.tsx with RoomCalendarForm
export function RoomCalendarSkeleton() {
  return (
    <>
      <PropertyHeading />
      <PropertyNavigationSkeleton active="rooms" />
      <SkeletonLine size="sm" className="mb-6 w-36" />
      <WeekPickerSkeleton className="mb-6" />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <SkeletonLine className="w-48" />
          </CardHeader>
          <CardContent className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <SkeletonField key={index} />
            ))}
          </CardContent>
        </Card>
        <div className="space-y-3">
          {Array.from({ length: 7 }, (_, night) => (
            <div key={night} className="min-w-0 rounded-xl border bg-card p-4 sm:p-5">
              <div className="grid grid-cols-2 items-end gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <div className="col-span-2 self-center sm:col-span-3 lg:col-span-1">
                  <SkeletonLine className="w-24" />
                  <SkeletonLine size="xs" className="w-16" />
                </div>
                <SkeletonField className="col-span-2 sm:col-span-1" />
                <SkeletonField />
                <SkeletonField />
                <Skeleton className="col-span-2 h-14 rounded-lg sm:col-span-3 lg:col-span-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// The "First night" date picker and previous/next week links.
function WeekPickerSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-5", className)}>
      <div className="flex flex-wrap items-end gap-3">
        <SkeletonField className="w-40" />
        <SkeletonButton className="w-24" />
      </div>
      <div className="flex gap-5">
        <SkeletonLine size="sm" className="w-28" />
        <SkeletonLine size="sm" className="w-24" />
      </div>
    </div>
  );
}

// [id]/information/page.tsx with PropertyInformationForm
export function PropertyInformationSkeleton() {
  return (
    <>
      <PropertyHeading />
      <PropertyNavigationSkeleton active="information" />
      <SkeletonFormLayout cards={[["textarea"], ["input"], ["textarea"]]} />
    </>
  );
}

// [id]/logistics/page.tsx with PropertyLogisticsForm
export function PropertyLogisticsSkeleton() {
  return (
    <>
      <PropertyHeading />
      <PropertyNavigationSkeleton active="logistics" />
      <SkeletonFormLayout cards={[["pair"], ["input", "input", "input"], ["textarea"]]} />
    </>
  );
}

// [id]/photos/page.tsx with PropertyPhotos
export function PropertyPhotosSkeleton() {
  return (
    <>
      <PropertyHeading />
      <PropertyNavigationSkeleton active="photos" />
      <div className="space-y-8">
        <SkeletonCard>
          {/* The drop zone: icon, prompt and limits. */}
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10">
            <Skeleton className="size-10 rounded-lg" />
            <SkeletonLine size="sm" className="w-56 max-w-full" />
            <SkeletonParagraph size="xs" className="w-full max-w-md" />
          </div>
        </SkeletonCard>
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <SkeletonLine size="lg" className="w-32" />
              <SkeletonLine size="sm" className="mt-1 w-64 max-w-full" />
            </div>
            <SkeletonBadge className="w-24" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Card key={index} className="min-w-0 gap-0 py-0">
                <Skeleton className="aspect-4/3 rounded-none" />
                <div className="flex items-center justify-between gap-2 p-3">
                  <SkeletonLine size="sm" className="w-16" />
                  <div className="flex gap-1">
                    {Array.from({ length: 3 }, (_, button) => (
                      <Skeleton
                        key={button}
                        className="size-7 rounded-lg [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
                      />
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// [id]/review/page.tsx
export function PropertyReviewSkeleton() {
  return (
    <>
      <SkeletonLine size="title" className="w-64" />
      <SkeletonLine className="mt-3 w-96 max-w-full" />
      <PropertyNavigationSkeleton active="review" />
      <div className="my-6 space-y-4 rounded-xl border p-5">
        <SkeletonLine size="lg" className="w-40" />
        <SkeletonParagraph size="sm" />
      </div>
      <ChecklistLayoutSkeleton />
    </>
  );
}

// A publication checklist and listing preview beside the decision panel
// (owner review and admin review).
export function ChecklistLayoutSkeleton() {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-6">
        <SkeletonCard>
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-5 shrink-0 rounded-full" />
                <SkeletonLine size="sm" className="w-56 max-w-full" />
              </div>
            ))}
          </div>
        </SkeletonCard>
        <div className="rounded-xl border bg-card p-5">
          <SkeletonLine className="w-44" />
        </div>
      </div>
      <SkeletonAsidePanel />
    </div>
  );
}

// The stacked heading of the bookings and availability pages: title, the
// property name and the tab row.
function StackedHeading({ active, title }: { active: PropertyTab; title: string }) {
  return (
    <>
      <SkeletonLine size="title" className={title} />
      <SkeletonLine className="w-48" />
      <PropertyNavigationSkeleton active={active} />
    </>
  );
}

// [id]/bookings/page.tsx
export function PropertyBookingsSkeleton() {
  return (
    <div className="space-y-6">
      <StackedHeading active="bookings" title="w-64" />
      <SkeletonLine className="w-64" />
      <SkeletonParagraph size="sm" />
      <div className="flex flex-wrap gap-2">
        {["w-32", "w-24", "w-28", "w-24", "w-28"].map((width, index) => (
          <Skeleton key={index} className={`h-9 rounded-full ${width}`} />
        ))}
      </div>
      <SkeletonParagraph size="sm" />
      <div className="grid gap-5 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="min-w-0 space-y-3 rounded-xl border p-5">
            <SkeletonBadge className="w-20" />
            <SkeletonLine className="w-1/2" />
            <SkeletonLine className="w-48" />
            <SkeletonLine className="w-20" />
            <SkeletonLine className="w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

// [id]/bookings/[bookingId]/page.tsx
export function PropertyBookingSkeleton() {
  return (
    <div className="space-y-7">
      <SkeletonLine className="w-36" />
      <SkeletonLine className="w-24" />
      <SkeletonLine size="title" className="w-2/3" />
      <SkeletonLine size="xs" className="w-72 max-w-full" />
      <div className="space-y-3 rounded-xl border p-6">
        <SkeletonLine size="lg" className="w-40" />
        <SkeletonLine className="w-56" />
        <SkeletonLine className="w-96 max-w-full" />
        <SkeletonLine size="2xl" className="w-28" />
        <SkeletonLine className="w-80 max-w-full" />
      </div>
      <BookingLinesSkeleton />
      <SkeletonCard>
        <SkeletonParagraph size="sm" />
        <SkeletonButton className="w-36" />
      </SkeletonCard>
      <BookingUpdatesSkeleton />
    </div>
  );
}

// [id]/bookings/external/page.tsx and its saved review
export function ExternalReservationSkeleton() {
  return (
    <div className="space-y-6">
      <StackedHeading active="bookings" title="w-96 max-w-full" />
      <SkeletonParagraph />
      <SkeletonParagraph size="sm" />
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonField />
          <SkeletonField />
        </div>
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="space-y-3 rounded-xl border p-5">
            <SkeletonLine className="w-40" />
            <div className="grid gap-4 sm:grid-cols-3">
              <SkeletonField />
              <SkeletonField />
              <SkeletonField />
            </div>
          </div>
        ))}
        <SkeletonButton className="w-40" />
      </div>
    </div>
  );
}

// [id]/availability/page.tsx
export function AvailabilitySkeleton() {
  return (
    <div className="space-y-6">
      <StackedHeading active="availability" title="w-72 max-w-full" />
      <SkeletonParagraph />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="min-w-0 space-y-3 rounded-xl border p-5">
            <SkeletonLine className="w-1/2" />
            <SkeletonLine className="w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

// [id]/availability/[roomId]/page.tsx with InventoryNightForm
export function RoomAvailabilitySkeleton() {
  return (
    <div className="space-y-6">
      <StackedHeading active="availability" title="w-72 max-w-full" />
      <SkeletonLine className="w-32" />
      <SkeletonParagraph />
      <WeekPickerSkeleton />
      <div className="grid gap-5 md:grid-cols-2">
        {Array.from({ length: 7 }, (_, night) => (
          <div key={night} className="min-w-0 space-y-4 rounded-xl border p-5">
            <SkeletonLine className="w-24" />
            <SkeletonLine size="sm" className="w-64 max-w-full" />
            <SkeletonLine size="sm" className="w-48" />
            <div className="grid gap-4 sm:grid-cols-2">
              <SkeletonField />
              <SkeletonField />
            </div>
            <SkeletonButton className="w-24" />
            <SkeletonLine className="w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
