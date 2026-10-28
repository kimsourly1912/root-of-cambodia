// Typed read projections. Versioned SQL migrations are authoritative, including
// composite FKs, CHECK constraints and triggers; do not run drizzle-kit push.
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const properties = sqliteTable("property", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
});
export const bookings = sqliteTable("booking", {
  id: text("id").primaryKey(),
  propertyId: text("property_id").notNull(),
  guestId: text("guest_id"),
  source: text("source").notNull(),
  status: text("status").notNull(),
  submittedAt: integer("submitted_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  checkinDate: text("checkin_date").notNull(),
  checkoutDate: text("checkout_date").notNull(),
  checkinAt: integer("checkin_at").notNull(),
  checkoutAt: integer("checkout_at").notNull(),
  propertyName: text("property_name").notNull(),
  guestName: text("guest_name").notNull(),
  guestEmail: text("guest_email"),
  timezone: text("timezone").notNull(),
  checkinTime: text("checkin_time").notNull(),
  checkoutTime: text("checkout_time").notNull(),
  policyVersion: text("policy_version").notNull(),
  policyText: text("policy_text").notNull(),
  termsVersion: text("terms_version").notNull(),
  cancellationText: text("cancellation_text").notNull(),
  currency: text("currency").notNull(),
  totalCents: integer("total_cents").notNull(),
});
