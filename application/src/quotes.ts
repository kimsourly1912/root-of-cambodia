import {
  readQuoteProperty,
  readQuoteRoom,
  readQuoteRates,
  readQuoteStock,
} from "./quote-queries";
import { DomainError } from "./errors";
import { digest, verified, type Actor } from "./operations";
export type Selection = {
  roomId: string;
  quantity: number;
  adults: number;
  children: number;
};
export type QuoteInput = {
  propertyId: string;
  checkin: string;
  checkout: string;
  lines: Selection[];
  termsVersion: string;
};
export type Charge = { code: string; label: string; amountCents: number };
// Engineering bounds, not cancellation or maximum-stay product policies. Revisit before pilot.
const integer = (n: unknown, min: number, max: number) =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
export function dates(checkin: string, checkout: string) {
  const valid = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s + "T00:00:00Z")) &&
    new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
  if (!valid(checkin) || !valid(checkout) || checkout <= checkin)
    throw new DomainError("invalid_dates", 422);
  const nights = (Date.parse(checkout) - Date.parse(checkin)) / 86400000;
  if (nights > 366) throw new DomainError("request_size_limit", 422);
  return Array.from({ length: nights }, (_, i) =>
    new Date(Date.parse(checkin) + i * 86400000).toISOString().slice(0, 10),
  );
}
export const localInstant = (date: string, time: string) =>
  Date.parse(date + "T" + time + ":00+07:00") / 1000;
export function normalize(value: unknown): QuoteInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new DomainError("invalid_request", 422);
  const input = value as Record<string, unknown>;
  if ("infants" in input)
    throw new DomainError("infant_policy_decision_required", 422);
  if (
    !input ||
    typeof input.propertyId !== "string" ||
    typeof input.checkin !== "string" ||
    typeof input.checkout !== "string" ||
    typeof input.termsVersion !== "string" ||
    !Array.isArray(input.lines) ||
    input.lines.length < 1 ||
    input.lines.length > 10
  )
    throw new DomainError("invalid_request", 422);
  if (dates(input.checkin, input.checkout).length * input.lines.length > 60)
    throw new DomainError("request_size_limit", 422);
  const lines = input.lines
    .map((l) => {
      if (
        !l ||
        typeof l !== "object" ||
        Object.keys(l).some(
          (k) => !["roomId", "quantity", "adults", "children"].includes(k),
        ) ||
        typeof l.roomId !== "string" ||
        typeof l.quantity !== "number" ||
        typeof l.adults !== "number" ||
        typeof l.children !== "number" ||
        !integer(l.quantity, 1, 100) ||
        !integer(l.adults, 1, 10000) ||
        !integer(l.children, 0, 10000)
      )
        throw new DomainError("invalid_occupancy", 422);
      return {
        roomId: l.roomId,
        quantity: l.quantity,
        adults: l.adults,
        children: l.children,
      };
    })
    .sort((a, b) => (a.roomId < b.roomId ? -1 : a.roomId > b.roomId ? 1 : 0));
  if (new Set(lines.map((l) => l.roomId)).size !== lines.length)
    throw new DomainError("duplicate_room_type", 422);
  return {
    propertyId: input.propertyId,
    checkin: input.checkin,
    checkout: input.checkout,
    termsVersion: input.termsVersion,
    lines,
  };
}
export async function quote(
  db: D1Database,
  actor: Actor,
  raw: unknown,
  source: "online" | "external" = "online",
) {
  const user = await verified(db, actor);
  const input = normalize(raw),
    nights = dates(input.checkin, input.checkout);
  const property = await readQuoteProperty(db, actor, input.propertyId, source);
  if (property.terms_version !== input.termsVersion)
    throw new DomainError("terms_changed");
  const checkinAt = localInstant(input.checkin, property.checkin_time),
    checkoutAt = localInstant(input.checkout, property.checkout_time);
  // The authoritative lead-time check is repeated by the submission trigger using database time.
  const charges: Charge[] = JSON.parse(property.charges_json);
  if (
    !Array.isArray(charges) ||
    charges.length > 20 ||
    charges.some(
      (c) =>
        !c ||
        typeof c.code !== "string" ||
        !c.code ||
        c.code.length > 100 ||
        typeof c.label !== "string" ||
        !c.label ||
        c.label.length > 200 ||
        !integer(c.amountCents, 0, 100000000),
    )
  )
    throw new DomainError("invalid_property_charges");
  if (new Set(charges.map((c) => c.code)).size !== charges.length)
    throw new DomainError("invalid_property_charges");
  const lines = [];
  for (const selection of input.lines) {
    const room = await readQuoteRoom(db, input.propertyId, selection.roomId);
    if (
      selection.adults > room.adult_capacity * selection.quantity ||
      selection.children > room.child_capacity * selection.quantity ||
      selection.adults + selection.children >
        room.total_capacity * selection.quantity
    )
      throw new DomainError("occupancy_exceeded", 422);
    const rates = await readQuoteRates(
      db,
      room.id,
      input.checkin,
      input.checkout,
    );
    if (
      rates.length !== nights.length ||
      rates.some((r, i) => r.night !== nights[i])
    )
      throw new DomainError("incomplete_rates");
    // Missing calendar nights are unavailable, including on request submission.
    const stock = await readQuoteStock(
      db,
      room.id,
      input.checkin,
      input.checkout,
    );
    if (
      stock.length !== nights.length ||
      stock.some(
        (r, i) => r.night !== nights[i] || r.available < selection.quantity,
      )
    )
      throw new DomainError("inventory_unavailable");
    lines.push({ selection, room, rates });
  }
  const totalCents =
    charges.reduce((s, c) => s + c.amountCents, 0) +
    lines.reduce(
      (s, l) =>
        s +
        l.rates.reduce((n, r) => n + r.unit_cents * l.selection.quantity, 0),
      0,
    );
  if (!integer(totalCents, 0, 1000000000))
    throw new DomainError("quote_size_limit", 422);
  const snapshot = {
    input,
    source,
    property,
    user: { id: user.id, name: user.name, email: user.email },
    checkinAt,
    checkoutAt,
    lines,
    charges,
    totalCents,
  };
  return { ...snapshot, hash: await digest(snapshot) };
}
export type Quote = Awaited<ReturnType<typeof quote>>;
