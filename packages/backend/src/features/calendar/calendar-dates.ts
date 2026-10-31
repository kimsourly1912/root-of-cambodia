import { DomainError } from "../../shared/index";
// Inventory nights are local date labels. UTC arithmetic here never sets arrival instants.
export function validNight(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(value + "T00:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function shiftNight(night: string, days: number) {
  if (!validNight(night)) throw new DomainError("invalid_dates", 422);
  const date = new Date(night + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  const result = date.toISOString().slice(0, 10);
  if (!validNight(result)) throw new DomainError("invalid_dates", 422);
  return result;
}
export function calendarWeek(start: string) {
  return Array.from({ length: 7 }, (_, i) => shiftNight(start, i));
}
export function cambodiaToday() {
  return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
}
