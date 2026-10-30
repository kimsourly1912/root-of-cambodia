// Only local guest destinations can survive authentication navigation.
export function guestReturn(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 4000 ||
    !/^\/(?:bookings(?:\/[A-Za-z0-9_-]+)*|stays\/[A-Za-z0-9_-]+\/request)(?:\?[^#\\\u0000-\u0020]*)?$/.test(
      value,
    )
  )
    return "/owner";
  return value;
}
