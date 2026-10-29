export const usd = (cents: number) => `$${(cents / 100).toFixed(2)} USD`;
export const cambodiaTime = (seconds: number) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Phnom_Penh",
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  }).format(new Date(seconds * 1000));
export const bookingStatus = (value: string) =>
  ({
    pending: "Pending confirmation",
    confirmed: "Confirmed",
    declined: "Declined",
    expired: "Expired",
    cancelled: "Cancelled",
    checked_in: "Checked in",
    completed: "Completed",
  })[value] ?? "Unavailable";
