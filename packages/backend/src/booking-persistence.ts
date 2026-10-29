import {
  operate,
  verifiedSQL,
  assertion,
  finish,
  type Actor,
} from "./operations";
import { prepareAcceptance } from "./booking-logistics";
import type { Quote, QuoteInput } from "./quotes";

// Internal persistence boundary. Services perform early authorization; SQL and
// migration guards recheck mutable permissions/invariants at commit time.
// Each call below owns one complete batch through operate(), including its receipt.
export async function commitRequest(
  db: D1Database,
  actor: Actor,
  key: string,
  input: QuoteInput,
  quoteHash: string,
  source: "online" | "external",
  prepareQuote: () => Promise<Quote>,
) {
  // Keep preparation lazy: a matching stored receipt must replay without reading
  // today's prices, availability or policy. The service authorizes before entry.
  return operate(
    db,
    actor,
    key,
    { kind: "submit", source, input, quoteHash },
    async (op) => {
      const q = await prepareQuote();
      const id = crypto.randomUUID(),
        p = q.property;
      const statements = [
        assertion(
          db,
          op,
          verifiedSQL +
            " AND EXISTS(SELECT 1 FROM property p JOIN place pl ON pl.id=p.id JOIN user u ON u.id=? WHERE p.id=? AND p.revision=? AND pl.name_km=? AND u.name=? AND u.email=? AND " +
            (source === "online"
              ? "pl.publication='published'"
              : "p.owner_id=?") +
            ")",
          [
            actor.id,
            actor.id,
            p.id,
            p.revision,
            p.name,
            q.user.name,
            q.user.email,
            ...(source === "external" ? [actor.id] : []),
          ],
        ),
        db
          .prepare(
            "INSERT INTO booking(id,property_id,guest_id,source,submitted_at,expires_at,checkin_date,checkout_date,checkin_at,checkout_at,property_name,guest_name,guest_email,timezone,checkin_time,checkout_time,policy_version,policy_text,terms_version,cancellation_text,total_cents,last_operation_id) VALUES (?,?,?,?,unixepoch(),unixepoch()+43200,?,?,?,?,?,?,?,'Asia/Phnom_Penh',?,?,?,?,?,'Free guest cancellation before scheduled check-in. Encourage 24 hours notice; no platform fee.',?,?)",
          )
          .bind(
            id,
            p.id,
            source === "online" ? actor.id : null,
            source,
            input.checkin,
            input.checkout,
            q.checkinAt,
            q.checkoutAt,
            p.name,
            source === "online" ? q.user.name : "External reservation",
            source === "online" ? q.user.email : null,
            p.checkin_time,
            p.checkout_time,
            p.policy_version,
            p.policy_text,
            p.terms_version,
            q.totalCents,
            op,
          ),
      ];
      if (source === "online" && key.startsWith("guest-request:")) {
        statements.push(
          assertion(
            db,
            op,
            "EXISTS(SELECT 1 FROM guest_booking_attempt a JOIN operation o ON o.id=? AND o.principal='user:'||a.guest_id AND o.key='guest-request:'||a.id WHERE a.guest_id=? AND o.fingerprint=json_extract(a.input_json,'$._operationFingerprint'))",
            [op, actor.id],
          ),
        );
      }
      for (const [i, l] of q.lines.entries()) {
        const line = id + ":" + i;
        statements.push(
          db
            .prepare(
              "INSERT INTO booking_line(id,booking_id,property_id,room_type_id,room_name,quantity,adults,children,adult_capacity,child_capacity,total_capacity) SELECT ?,?,property_id,id,name,?,?,?,adult_capacity,child_capacity,total_capacity FROM room_type WHERE id=? AND property_id=? AND revision=? AND active=1",
            )
            .bind(
              line,
              id,
              l.selection.quantity,
              l.selection.adults,
              l.selection.children,
              l.room.id,
              p.id,
              l.room.revision,
            ),
        );
        for (const r of l.rates)
          statements.push(
            db
              .prepare(
                "INSERT INTO booking_night(line_id,night,unit_cents) SELECT ?,night,unit_cents FROM nightly_rate WHERE room_type_id=? AND night=? AND revision=? AND unit_cents=?",
              )
              .bind(line, l.room.id, r.night, r.revision, r.unit_cents),
          );
      }
      for (const c of q.charges)
        statements.push(
          db
            .prepare("INSERT INTO booking_charge VALUES (?,?,?,?)")
            .bind(id, c.code, c.label, c.amountCents),
        );
      statements.push(
        assertion(
          db,
          op,
          "(SELECT count(*) FROM booking_line WHERE booking_id=?)=?",
          [id, q.lines.length],
        ),
        assertion(
          db,
          op,
          "NOT EXISTS(SELECT 1 FROM booking_line l JOIN booking_night n ON n.line_id=l.id LEFT JOIN inventory_night i ON i.room_type_id=l.room_type_id AND i.night=n.night WHERE l.booking_id=? AND (i.room_type_id IS NULL OR i.capacity-i.blocked-i.reserved<l.quantity))",
          [id],
        ),
        db
          .prepare("UPDATE booking SET status=? WHERE id=?")
          .bind(source === "online" ? "pending" : "confirmed", id),
        finish(db, op, id),
      );
      return statements;
    },
    source === "external" ? "owner" : "guest",
  );
}
export type BookingChange =
  | "accept"
  | "decline"
  | "cancel_guest"
  | "cancel_owner"
  | "complete";
const ownerSQL =
  "EXISTS(SELECT 1 FROM property p WHERE p.id=booking.property_id AND p.owner_id=?)";

export async function commitBookingTransition(
  db: D1Database,
  actor: Actor,
  key: string,
  id: string,
  action: BookingChange,
  text: string | null,
  acceptanceHash?: string,
) {
  const asGuest = action === "cancel_guest";
  const spec = {
    accept: {
      status: "confirmed",
      where: "status='pending' AND expires_at>unixepoch()",
    },
    decline: {
      status: "declined",
      where: "status='pending' AND expires_at>unixepoch()",
    },
    cancel_guest: {
      status: "cancelled",
      where: "status IN ('pending','confirmed') AND checkin_at>unixepoch()",
    },
    cancel_owner: {
      status: "cancelled",
      where: "status IN ('pending','confirmed') AND checkin_at>unixepoch()",
    },
    complete: { status: "completed", where: "status='checked_in'" },
  }[action];

  return operate(
    db,
    actor,
    key,
    {
      kind: action,
      id,
      reason: text,
      ...(action === "accept" && acceptanceHash !== undefined
        ? { acceptanceHash }
        : {}),
    },
    async (op) => {
      const statements: D1PreparedStatement[] = [];
      if (key.startsWith("owner-response:"))
        statements.push(
          assertion(
            db,
            op,
            "EXISTS(SELECT 1 FROM owner_booking_attempt a JOIN operation o ON o.id=? AND o.principal='user:'||a.actor_id AND o.key='owner-response:'||a.id WHERE a.actor_id=? AND o.fingerprint=a.operation_fingerprint)",
            [op, actor.id],
          ),
        );
      if (action === "accept") {
        const preview = await prepareAcceptance(db, actor, id, acceptanceHash);
        statements.push(
          db
            .prepare(
              "INSERT INTO booking_acceptance(booking_id,operation_id,owner_id,information_revision,logistics_revision,preview_hash,details_json) VALUES (?,?,?,?,?,?,?)",
            )
            .bind(
              id,
              op,
              actor.id,
              preview.informationRevision,
              preview.logisticsRevision,
              preview.hash,
              JSON.stringify(preview.details),
            ),
        );
      }
      statements.push(
        db
          .prepare(
            "UPDATE booking SET status=?,last_operation_id=?,reason=? WHERE id=? AND " +
              spec.where +
              " AND " +
              verifiedSQL +
              " AND " +
              (asGuest ? "guest_id=?" : ownerSQL),
          )
          .bind(spec.status, op, text, id, actor.id, actor.id),
        finish(db, op, id),
      );
      return statements;
    },
    asGuest ? "guest" : "owner",
  );
}
export async function expireRequest(db: D1Database, id: string) {
  return operate(db, null, "expire:" + id, { kind: "expire", id }, (op) => [
    db
      .prepare(
        "UPDATE booking SET status='expired',last_operation_id=?,reason=NULL WHERE id=? AND status='pending' AND expires_at<=unixepoch()",
      )
      .bind(op, id),
    finish(db, op, id),
  ]);
}
