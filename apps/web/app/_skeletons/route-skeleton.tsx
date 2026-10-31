"use client";
import type { ComponentType } from "react";
import { usePathname } from "next/navigation";
import { LoadingState } from "@/components/status-message";
import {
  BookingRequestSkeleton,
  GuestBookingSkeleton,
  GuestBookingsSkeleton,
  PageSkeleton,
  StayRequestSkeleton,
  StaySkeleton,
  StaysSkeleton,
} from "./site-skeletons";
import {
  AvailabilitySkeleton,
  ExternalReservationSkeleton,
  OwnerApplySkeleton,
  OwnerHomeSkeleton,
  PropertyBookingSkeleton,
  PropertyBookingsSkeleton,
  PropertyDetailsSkeleton,
  PropertyInformationSkeleton,
  PropertyLogisticsSkeleton,
  PropertyPhotosSkeleton,
  PropertyReviewSkeleton,
  RoomAvailabilitySkeleton,
  RoomCalendarSkeleton,
  RoomTypeSkeleton,
  RoomTypesSkeleton,
} from "./owner-skeletons";
import {
  AdminHomeSkeleton,
  AdminOwnersSkeleton,
  AdminPropertiesSkeleton,
  AdminReviewSkeleton,
  AdminReviewsSkeleton,
} from "./admin-skeletons";

// Every loading.tsx renders this. One loading.tsx covers every page below its
// folder, so the skeleton is chosen by the destination path: during a
// navigation usePathname() already returns the new URL. First match wins.
const property = "/owner/properties/[^/]+";
const routes: [RegExp, string, ComponentType][] = [
  [/^\/stays$/, "Loading stays…", StaysSkeleton],
  [/^\/stays\/[^/]+$/, "Loading stay…", StaySkeleton],
  [/^\/stays\/[^/]+\/request$/, "Loading booking request…", StayRequestSkeleton],
  [/^\/bookings$/, "Loading your bookings…", GuestBookingsSkeleton],
  [/^\/bookings\/requests\/[^/]+$/, "Loading your booking review…", BookingRequestSkeleton],
  [/^\/bookings\/[^/]+$/, "Loading your booking…", GuestBookingSkeleton],
  [/^\/owner$/, "Loading your properties…", OwnerHomeSkeleton],
  [/^\/owner\/apply$/, "Loading owner application…", OwnerApplySkeleton],
  [/^\/owner\/properties\/new$/, "Loading property…", () => <PropertyDetailsSkeleton navigation={false} />],
  [new RegExp(`^${property}$`), "Loading property…", PropertyDetailsSkeleton],
  [new RegExp(`^${property}/rooms$`), "Loading room types…", RoomTypesSkeleton],
  [new RegExp(`^${property}/rooms/[^/]+/calendar$`), "Loading calendar…", RoomCalendarSkeleton],
  [new RegExp(`^${property}/rooms/[^/]+$`), "Loading room type…", RoomTypeSkeleton],
  [new RegExp(`^${property}/information$`), "Loading property information…", PropertyInformationSkeleton],
  [new RegExp(`^${property}/logistics$`), "Loading location and contact…", PropertyLogisticsSkeleton],
  [new RegExp(`^${property}/photos$`), "Loading photos…", PropertyPhotosSkeleton],
  [new RegExp(`^${property}/review$`), "Loading publication review…", PropertyReviewSkeleton],
  [new RegExp(`^${property}/bookings$`), "Loading bookings…", PropertyBookingsSkeleton],
  [new RegExp(`^${property}/bookings/external(/[^/]+)?$`), "Loading external reservation…", ExternalReservationSkeleton],
  [new RegExp(`^${property}/bookings/[^/]+$`), "Loading booking…", PropertyBookingSkeleton],
  [new RegExp(`^${property}/availability$`), "Loading availability…", AvailabilitySkeleton],
  [new RegExp(`^${property}/availability/[^/]+$`), "Loading availability…", RoomAvailabilitySkeleton],
  [/^\/admin$/, "Loading admin…", AdminHomeSkeleton],
  [/^\/admin\/owners$/, "Loading owner applications…", AdminOwnersSkeleton],
  [/^\/admin\/properties$/, "Loading properties…", AdminPropertiesSkeleton],
  [/^\/admin\/reviews$/, "Loading publication reviews…", AdminReviewsSkeleton],
  [/^\/admin\/reviews\/[^/]+$/, "Loading submission…", AdminReviewSkeleton],
];

export function RouteSkeleton() {
  const pathname = usePathname();
  const [, label, Skeleton] = routes.find(([pattern]) => pattern.test(pathname)) ?? [
    null,
    "Loading page…",
    PageSkeleton,
  ];
  return (
    <LoadingState label={label}>
      <Skeleton />
    </LoadingState>
  );
}
