import { digest, DomainError, type Actor } from "../../shared/index";

export type OwnerAccessReceipt = { id: string; status: "pending" | "approved" | "declined" };
export type OwnerAccessWrite =
  | {
      action: "apply";
      from: "none" | "declined";
      businessName: string;
      phone: string;
      province: string;
    }
  | {
      action: "approve" | "decline";
      subjectId: string;
      applicationRevision: number;
      reason: string;
    };

// The one named atomic save for owner applications and admin decisions: the
// command (receipt and history), the access change and the application commit
// together, or a failed assertion aborts all of them. A same-key retry replays
// the stored receipt before any current-state check.
export async function commitOwnerAccess(
  db: D1Database,
  actor: Actor,
  key: string,
  role: "applicant" | "admin",
  fingerprintInput: { action: string; [key: string]: unknown },
  prepare: () => Promise<OwnerAccessWrite>,
): Promise<OwnerAccessReceipt> {
  if (!/^[A-Za-z0-9:_-]{1,128}$/.test(key))
    throw new DomainError("invalid_idempotency_key", 422);
  const fingerprint = await digest({ role, payload: fingerprintInput });
  const existing = () =>
    db
      .prepare("SELECT fingerprint,result_json AS result FROM owner_access_command WHERE actor_id=? AND key=?")
      .bind(actor.id, key)
      .first<{ fingerprint: string; result: string | null }>();
  const replay = (row: { fingerprint: string; result: string | null }) => {
    if (row.fingerprint !== fingerprint) throw new DomainError("idempotency_conflict");
    if (!row.result) throw new DomainError("operation_incomplete");
    return JSON.parse(row.result) as OwnerAccessReceipt;
  };
  const previous = await existing();
  if (previous) return replay(previous);
  const write = await prepare();
  const command = crypto.randomUUID();
  const subject = write.action === "apply" ? actor.id : write.subjectId;
  const status = write.action === "apply" ? "pending" : write.action === "approve" ? "approved" : "declined";
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        "INSERT INTO owner_access_command(id,actor_id,actor_role,key,fingerprint,action,subject_id,reason) VALUES (?,?,?,?,?,?,?,?)",
      )
      .bind(command, actor.id, role, key, fingerprint, write.action, subject, write.action === "apply" ? null : write.reason),
  ];
  if (write.action === "apply") {
    statements.push(
      write.from === "none"
        ? db
            .prepare(
              "INSERT INTO owner_access(user_id,status,source) SELECT ?,'pending','application' WHERE NOT EXISTS(SELECT 1 FROM owner_access WHERE user_id=?)",
            )
            .bind(actor.id, actor.id)
        : db
            .prepare(
              "UPDATE owner_access SET status='pending',decided_by=NULL,decided_at=NULL WHERE user_id=? AND status='declined'",
            )
            .bind(actor.id),
      db
        .prepare(
          `INSERT INTO owner_application(user_id,business_name,phone,province,revision) SELECT ?,?,?,?,1 WHERE changes()=1
           ON CONFLICT(user_id) DO UPDATE SET business_name=excluded.business_name,phone=excluded.phone,
           province=excluded.province,revision=owner_application.revision+1,submitted_at=unixepoch()`,
        )
        .bind(actor.id, write.businessName, write.phone, write.province),
    );
  } else {
    statements.push(
      db
        .prepare(
          "UPDATE owner_access SET status=?,decided_by=?,decided_at=unixepoch() WHERE user_id=? AND status='pending' AND EXISTS(SELECT 1 FROM owner_application WHERE user_id=? AND revision=?)",
        )
        .bind(status, actor.id, subject, subject, write.applicationRevision),
    );
  }
  statements.push(
    db
      .prepare("UPDATE owner_access_command SET result_json=json_object('id',?,'status',?) WHERE id=? AND changes()=1")
      .bind(subject, status, command),
    db
      .prepare(
        "INSERT INTO owner_access_assert VALUES (?,CASE WHEN (SELECT result_json FROM owner_access_command WHERE id=?) IS NOT NULL THEN 1 ELSE 0 END)",
      )
      .bind(command, command),
  );
  try {
    await db.batch(statements);
  } catch (error) {
    // Another request may have won the key, or the commit succeeded and the
    // response was lost; never guess that the write failed.
    const committed = await existing();
    if (committed) return replay(committed);
    const message = error instanceof Error ? error.message : "";
    if (/constraint|RAISE|invalid_/i.test(message)) throw new DomainError("owner_access_conflict", 409);
    throw error;
  }
  const committed = await existing();
  if (!committed) throw new DomainError("retry_same_operation", 503);
  return replay(committed);
}
