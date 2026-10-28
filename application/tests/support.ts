import { getPlatformProxy } from "wrangler";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { quote, type QuoteInput } from "../src/quotes";
import { submit } from "../src/bookings";
export function splitSQL(schema: string) {
  const statements: string[] = [];
  let buffer = "",
    trigger = false;
  for (const line of schema.split("\n")) {
    if (line.startsWith("CREATE TRIGGER")) trigger = true;
    buffer += line + "\n";
    if (
      (!trigger && line.trim().endsWith(";")) ||
      (trigger && line.trim() === "END;")
    ) {
      statements.push(buffer.trim());
      buffer = "";
      trigger = false;
    }
  }
  if (buffer.trim() && !/^--[^\n]*$/.test(buffer.trim()))
    throw new Error("Unterminated migration");
  return statements;
}
export async function migrate(
  db: D1Database,
  files = [
    "0001_identity_catalog.sql",
    "0002_booking_operations.sql",
    "0003_delivery_recovery.sql",
  ],
) {
  for (const file of files)
    await db.batch(
      splitSQL(await readFile(path.resolve("migrations", file), "utf8")).map(
        (s) => db.prepare(s),
      ),
    );
}
export async function database() {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: path.resolve("wrangler.jsonc"),
    remoteBindings: false,
    persist: false,
  });
  await migrate(proxy.env.DB);
  return { ...proxy, db: proxy.env.DB };
}
export const guest = { id: "guest" },
  owner = { id: "owner" },
  other = { id: "other" },
  unverified = { id: "unverified" };
export async function catalog(db: D1Database, capacity = 2) {
  const days = Array.from({ length: 3 }, (_, i) =>
    new Date(Date.now() + (i + 3) * 86400000).toISOString().slice(0, 10),
  );
  await db.batch([
    ...[guest, owner, other, unverified].map((u) =>
      db
        .prepare(
          "INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,?,?,?)",
        )
        .bind(
          u.id,
          u.id,
          u.id + "@example.invalid",
          u === unverified ? 0 : 1,
          Date.now(),
          Date.now(),
        ),
    ),
    db.prepare(
      "INSERT INTO owner_profile VALUES ('owner','Owner'),('other','Other')",
    ),
    db.prepare(
      "INSERT INTO place(id,name_km,name_en,province,publication) VALUES ('p','ផ្ទះ','House','Kampot','published'),('other','ផ្សេង','Other','Kampot','published')",
    ),
    ...["p", "other"].map((id) =>
      db
        .prepare(
          "INSERT INTO property(id,owner_id,checkin_time,checkout_time,policy_version,policy_text,terms_version,charges_json) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          id === "p" ? "owner" : "other",
          "14:00",
          "11:00",
          "policy-v1",
          "Property rules at submission.",
          "terms-v1",
          JSON.stringify([
            { code: "cleaning", label: "Cleaning per stay", amountCents: 500 },
          ]),
        ),
    ),
    ...[
      ["r", "p"],
      ["r2", "p"],
      ["other-r", "other"],
    ].map(([id, p]) =>
      db
        .prepare(
          "INSERT INTO room_type(id,property_id,name,adult_capacity,child_capacity,total_capacity) VALUES (?,?,?,2,1,3)",
        )
        .bind(id, p, id),
    ),
    ...["r", "r2", "other-r"].flatMap((r) =>
      days
        .slice(0, 2)
        .flatMap((day) => [
          db
            .prepare(
              "INSERT INTO inventory_night(room_type_id,night,capacity) VALUES (?,?,?)",
            )
            .bind(r, day, capacity),
          db
            .prepare(
              "INSERT INTO nightly_rate(room_type_id,night,unit_cents) VALUES (?,?,3500)",
            )
            .bind(r, day),
        ]),
    ),
  ]);
  const input: QuoteInput = {
    propertyId: "p",
    checkin: days[0],
    checkout: days[2],
    termsVersion: "terms-v1",
    lines: [{ roomId: "r", quantity: 1, adults: 2, children: 0 }],
  };
  return { days, input };
}
export async function request(
  db: D1Database,
  input: QuoteInput,
  key = crypto.randomUUID(),
) {
  const q = await quote(db, guest, input);
  return submit(db, guest, key, input, q.hash);
}
export async function scalar(
  db: D1Database,
  sql: string,
  ...values: (string | number)[]
) {
  return (await db
    .prepare(sql)
    .bind(...values)
    .first<{ n: number }>())!.n;
}
