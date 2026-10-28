import { test } from "vitest";
import assert from "node:assert/strict";
import {
  diagnostics,
  notificationReference,
  type DiagnosticRecord,
} from "@root-of-cambodia/backend/diagnostics";
import { DomainError, safeFailure } from "@root-of-cambodia/backend/errors";
import { database, catalog, request, owner, scalar } from "./support";
import { transition } from "@root-of-cambodia/backend/bookings";

test("diagnostics allowlist output and replace untrusted codes, details and correlation inputs", async () => {
  const secret =
    "private@example.invalid /auth?token=secret Cookie=session-secret";
  const records: DiagnosticRecord[] = [];
  const context = diagnostics("http", (record) => records.push(record));
  const error = Object.assign(new Error(secret), {
    cause: new Error(secret),
    token: secret,
    body: secret,
  });
  assert.deepEqual(context.failure(error, secret), {
    code: "temporarily_unavailable_retry_same_key",
    status: 503,
    reason: "unexpected_failure",
  });
  const forged = new DomainError("booking_conflict");
  Reflect.set(forged, "code", secret);
  assert.equal(context.failure(forged).status, 503);
  const valid = new DomainError("booking_conflict", 409);
  Reflect.set(valid, "diagnostic", secret);
  assert.equal(context.failure(valid).reason, "domain_rejection");
  context.completed();
  const message = { id: crypto.randomUUID() + ":pending:private-recipient" };
  const reference = await notificationReference(message);
  assert.match(reference!, /^[a-f0-9]{64}$/);
  assert.equal(reference, await notificationReference(message));
  assert.notEqual(
    reference,
    await notificationReference({ id: message.id + "x" }),
  );
  const job = diagnostics("jobs_queue", (record) => records.push(record));
  const result = {
    outcome: "provider_accepted" as const,
    email: secret,
    token: secret,
  };
  job.notification(result, reference);
  const serialized = JSON.stringify(records);
  for (const forbidden of [
    secret,
    "private-recipient",
    message.id,
    "session-secret",
    '"stack"',
    '"cause"',
    '"email"',
    '"token"',
  ])
    assert.ok(!serialized.includes(forbidden), forbidden);
  assert.match(context.correlationId, /^[a-f0-9-]{36}$/);
  assert.notEqual(job.correlationId, context.correlationId);
  assert.ok(
    records.every((r) =>
      Object.keys(r).every((k) =>
        [
          "version",
          "source",
          "correlationId",
          "event",
          "code",
          "reason",
          "status",
          "reference",
        ].includes(k),
      ),
    ),
  );
});

test("a failing diagnostic sink cannot change safe failures, completion or delivery handling", () => {
  const context = diagnostics("jobs_queue", () => {
    throw new Error("logging unavailable");
  });
  assert.equal(
    context.failure(new DomainError("booking_conflict", 409)).code,
    "booking_conflict",
  );
  assert.doesNotThrow(() => context.completed());
  assert.doesNotThrow(() =>
    context.notification({ outcome: "provider_accepted" }),
  );
});

test("native database guards keep public conflict codes while adding a safe diagnostic hint", async () => {
  const p = await database();
  try {
    const db = p.db,
      { input, days } = await catalog(db);
    const pending = await request(db, input);
    await db
      .prepare("DELETE FROM inventory_night WHERE room_type_id='r' AND night=?")
      .bind(days[1])
      .run();
    const before = await scalar(
      db,
      "SELECT count(*) n FROM notification_outbox",
    );
    await assert.rejects(
      transition(db, owner, "diagnostic-accept", pending.id, "accept"),
      (error) => {
        assert.ok(error instanceof DomainError);
        assert.deepEqual(safeFailure(error), {
          code: "booking_conflict",
          status: 409,
          reason: "inventory_unavailable",
        });
        return true;
      },
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM notification_outbox"),
      before,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM operation WHERE key='diagnostic-accept'",
      ),
      0,
    );
    assert.equal(await scalar(db, "SELECT count(*) n FROM allocation"), 0);
  } finally {
    await p.dispose();
  }
});

for (const phase of ["before", "after"] as const) {
  test(`a ${phase}-commit timeout plus failed receipt lookup remains uncertain and retries the same operation`, async () => {
    const p = await database();
    try {
      const db = p.db,
        { input } = await catalog(db);
      const pending = await request(db, input);
      let uncertain = false;
      const flaky = new Proxy(db, {
        get(target, prop) {
          if (prop === "batch")
            return async (...args: Parameters<D1Database["batch"]>) => {
              if (phase === "after") await target.batch(...args);
              uncertain = true;
              throw new Error("private-payload token=write-timeout");
            };
          if (prop === "prepare")
            return (sql: string) => {
              const statement = target.prepare(sql);
              if (!sql.startsWith("SELECT fingerprint,result_json"))
                return statement;
              // bind() returns another statement; intercept only the receipt read.
              return new Proxy(statement, {
                get(stmt, method) {
                  if (method === "bind")
                    return (...values: (string | number | null)[]) => {
                      const bound = stmt.bind(...values);
                      return new Proxy(bound, {
                        get(b, m) {
                          if (m === "first")
                            return async () => {
                              if (uncertain)
                                throw new Error(
                                  "private-receipt-query token=lookup-timeout",
                                );
                              return b.first();
                            };
                          const value = Reflect.get(b, m);
                          return typeof value === "function"
                            ? value.bind(b)
                            : value;
                        },
                      });
                    };
                  const value = Reflect.get(stmt, method);
                  return typeof value === "function" ? value.bind(stmt) : value;
                },
              });
            };
          const value = Reflect.get(target, prop);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      await assert.rejects(
        transition(flaky, owner, "uncertain-accept", pending.id, "accept"),
        (error) => {
          assert.deepEqual(safeFailure(error), {
            code: "temporarily_unavailable_retry_same_key",
            status: 503,
            reason: "unexpected_failure",
          });
          return true;
        },
      );
      assert.equal(
        await scalar(
          db,
          "SELECT count(*) n FROM operation WHERE key='uncertain-accept'",
        ),
        phase === "after" ? 1 : 0,
      );
      const recovered = await transition(
        db,
        owner,
        "uncertain-accept",
        pending.id,
        "accept",
      );
      assert.equal(recovered.status, "confirmed");
      assert.deepEqual(
        await transition(db, owner, "uncertain-accept", pending.id, "accept"),
        recovered,
      );
      assert.equal(
        await scalar(
          db,
          "SELECT count(*) n FROM operation WHERE key='uncertain-accept'",
        ),
        1,
      );
      assert.equal(
        await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
        2,
      );
    } finally {
      await p.dispose();
    }
  });
}
