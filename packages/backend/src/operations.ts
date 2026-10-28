import { DomainError } from "./errors";
export type Actor = { id: string };
export type Receipt = { id: string; status: string };
export const verifiedSQL =
  "EXISTS(SELECT 1 FROM user WHERE id=? AND emailVerified=1)";
export async function verified(db: D1Database, actor: Actor) {
  const user = await db
    .prepare("SELECT id,name,email,emailVerified FROM user WHERE id=?")
    .bind(actor.id)
    .first<{
      id: string;
      name: string;
      email: string;
      emailVerified: number;
    }>();
  if (user?.emailVerified !== 1)
    throw new DomainError("verified_session_required", 403);
  return user;
}
export async function digest(value: unknown) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function operate(
  db: D1Database,
  actor: Actor | null,
  key: string,
  payload: { kind: string; [key: string]: unknown },
  build: (id: string) => D1PreparedStatement[] | Promise<D1PreparedStatement[]>,
  role: "guest" | "owner" | "system" = actor ? "guest" : "system",
) {
  if (!/^[A-Za-z0-9:_-]{1,128}$/.test(key))
    throw new DomainError("invalid_idempotency_key", 422);
  const principal = actor ? "user:" + actor.id : "system";
  const fingerprint = await digest({ role, payload });
  const existing = () =>
    db
      .prepare(
        "SELECT fingerprint,result_json FROM operation WHERE principal=? AND key=?",
      )
      .bind(principal, key)
      .first<{ fingerprint: string; result_json: string | null }>();
  const replay = (row: { fingerprint: string; result_json: string | null }) => {
    if (row.fingerprint !== fingerprint)
      throw new DomainError("idempotency_conflict");
    if (!row.result_json) throw new DomainError("operation_incomplete");
    return JSON.parse(row.result_json) as Receipt;
  };
  const previous = await existing();
  if (previous) return replay(previous);
  const id = crypto.randomUUID();
  try {
    await db.batch([
      db
        .prepare(
          "INSERT INTO operation(id,principal,actor_id,key,fingerprint,kind,actor_role) VALUES (?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          principal,
          actor?.id ?? null,
          key,
          fingerprint,
          payload.kind,
          role,
        ),
      ...(await build(id)),
      db
        .prepare(
          "INSERT INTO operation_assert VALUES (?,CASE WHEN (SELECT result_json FROM operation WHERE id=?) IS NOT NULL THEN 1 ELSE 0 END) ON CONFLICT(operation_id) DO UPDATE SET ok=excluded.ok",
        )
        .bind(id, id),
    ]);
  } catch (error) {
    // Covers another request winning the key AND commit-success/response-timeout ambiguity.
    // If this lookup also fails, the caller retries the same key; never guess that the write failed.
    const committed = await existing();
    if (committed) return replay(committed);
    const message = error instanceof Error ? error.message : "";
    if (
      /constraint|RAISE|lead_time|incomplete_nights|missing_inventory|invalid_|request_expired|not_due|empty_lines/i.test(
        message,
      )
    )
      throw new DomainError("booking_conflict");
    throw error;
  }
  const committed = await existing();
  if (!committed) throw new DomainError("retry_same_operation", 503);
  return replay(committed);
}
export const assertion = (
  db: D1Database,
  id: string,
  condition: string,
  values: (string | number | null)[] = [],
) =>
  db
    .prepare(
      "INSERT INTO operation_assert VALUES (?,CASE WHEN (" +
        condition +
        ") THEN 1 ELSE 0 END) ON CONFLICT(operation_id) DO UPDATE SET ok=excluded.ok",
    )
    .bind(id, ...values);
export const finish = (db: D1Database, op: string, booking: string) =>
  db
    .prepare(
      "UPDATE operation SET result_json=(SELECT json_object('id',id,'status',status) FROM booking WHERE id=? AND last_operation_id=?) WHERE id=?",
    )
    .bind(booking, op, op);
