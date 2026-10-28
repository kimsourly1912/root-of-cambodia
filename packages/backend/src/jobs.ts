import { expireDue } from "./bookings";
import { publishDue, deliver, type Publication, type Provider } from "./outbox";
// Entrypoint contracts for the planned Cron/Queues Worker. Infrastructure and
// a live provider are deliberately not provisioned by this change.
export async function maintenance(db: D1Database, queue: Publication) {
  const expired = await expireDue(db, 50);
  const published = await publishDue(db, queue, 50);
  return { expired, published };
}
export async function consume(
  db: D1Database,
  message: unknown,
  provider: Provider,
) {
  if (
    !message ||
    typeof message !== "object" ||
    !("id" in message) ||
    typeof message.id !== "string" ||
    message.id.length > 200
  )
    return { discarded: true };
  return deliver(db, message.id, provider);
}
