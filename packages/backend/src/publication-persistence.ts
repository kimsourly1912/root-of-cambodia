import { digest, verifiedSQL, type Actor } from "./operations";
import { DomainError } from "./errors";
import {
  snapshotSQL,
  type ReviewConfig,
  type ReviewStatus,
} from "./publication-queries";
export type ReviewReceipt = {
  id: string;
  status: ReviewStatus;
};
export type PublicationWrite =
  | {
      action: "submit";
      propertyId: string;
      propertyRevision: number;
      snapshotJson: string;
    }
  | {
      action: "withdraw";
      requestId: string;
      revision: number;
    }
  | {
      action: "approve" | "return_changes";
      requestId: string;
      revision: number;
      reason: string | null;
      config: ReviewConfig;
    };
export async function commitPublicationAction(
  db: D1Database,
  actor: Actor,
  key: string,
  fingerprintInput: {
    action: string;
    [key: string]: unknown;
  },
  prepare: () => Promise<PublicationWrite>,
  role: "owner" | "reviewer",
): Promise<ReviewReceipt> {
  if (!/^[A-Za-z0-9:_-]{1,128}$/.test(key))
    throw new DomainError("invalid_idempotency_key", 422);
  const fingerprint = await digest({
    role,
    payload: fingerprintInput,
  });
  const existing = () =>
    db
      .prepare(
        "SELECT fingerprint,result_json AS result FROM property_review_command WHERE actor_id=? AND key=?",
      )
      .bind(actor.id, key)
      .first<{
        fingerprint: string;
        result: string | null;
      }>();
  const replay = (row: { fingerprint: string; result: string | null }) => {
    if (row.fingerprint !== fingerprint)
      throw new DomainError("idempotency_conflict");
    if (!row.result) throw new DomainError("operation_incomplete");
    return JSON.parse(row.result) as ReviewReceipt;
  };
  const previous = await existing();
  if (previous) return replay(previous);
  const command = crypto.randomUUID();
  try {
    const write = await prepare();
    const statements: D1PreparedStatement[] = [
      db
        .prepare(
          "INSERT INTO property_review_command(id,actor_id,actor_role,key,fingerprint,action) VALUES (?,?,?,?,?,?)",
        )
        .bind(command, actor.id, role, key, fingerprint, write.action),
    ];
    if (write.action === "submit") {
      statements.push(
        db
          .prepare(
            "UPDATE place SET publication='review' WHERE id=? AND publication='draft' AND EXISTS(SELECT 1 FROM property WHERE id=place.id AND owner_id=? AND revision=?) AND " +
              verifiedSQL +
              " AND (" +
              snapshotSQL +
              ")=? AND EXISTS(SELECT 1 FROM pilot_publication_config c JOIN user u ON u.id=c.reviewer_user_id WHERE c.singleton=1 AND u.emailVerified=1)",
          )
          .bind(
            write.propertyId,
            actor.id,
            write.propertyRevision,
            actor.id,
            write.propertyId,
            actor.id,
            write.snapshotJson,
          ),
        db
          .prepare(
            "INSERT INTO property_review_request(id,property_id,owner_id,status,snapshot_json,last_command_id) SELECT ?,p.id,p.owner_id,'pending',?,? FROM property p JOIN place l ON l.id=p.id WHERE p.id=? AND p.owner_id=? AND l.publication='review' AND changes()=1",
          )
          .bind(
            command,
            write.snapshotJson,
            command,
            write.propertyId,
            actor.id,
          ),
      );
    } else {
      const status =
        write.action === "withdraw"
          ? "withdrawn"
          : write.action === "approve"
            ? "approved"
            : "returned";
      const reviewer = write.action !== "withdraw";
      const permission = reviewer
        ? "EXISTS(SELECT 1 FROM pilot_publication_config WHERE singleton=1 AND reviewer_user_id=? AND revision=?)"
        : "owner_id=?";
      const snapshotGuard =
        write.action === "approve"
          ? " AND (" +
            snapshotSQL.replace(
              "WHERE p.id=? AND p.owner_id=?",
              "WHERE p.id=property_review_request.property_id AND p.owner_id=property_review_request.owner_id",
            ) +
            ")=snapshot_json"
          : "";
      const approval =
        write.action === "approve"
          ? " AND EXISTS(SELECT 1 FROM pilot_publication_config c JOIN user u ON u.id=property_review_request.owner_id WHERE c.singleton=1 AND c.terms_version=? AND u.emailVerified=1)"
          : "";
      const terms =
        write.action === "approve" ? write.config.termsVersion : null;
      statements.push(
        db
          .prepare(
            "UPDATE property_review_request SET status=?,revision=revision+1,last_command_id=?,approved_terms_version=? WHERE id=? AND status='pending' AND revision=? AND " +
              verifiedSQL +
              " AND " +
              permission +
              approval +
              snapshotGuard +
              " AND EXISTS(SELECT 1 FROM property p JOIN place l ON l.id=p.id WHERE p.id=property_review_request.property_id AND p.owner_id=property_review_request.owner_id AND l.publication='review')",
          )
          .bind(
            status,
            command,
            terms,
            write.requestId,
            write.revision,
            actor.id,
            ...(reviewer ? [actor.id, write.config.revision] : [actor.id]),
            ...(write.action === "approve" ? [terms] : []),
          ),
      );
      if (write.action === "approve")
        statements.push(
          db
            .prepare(
              "UPDATE property SET terms_version=? WHERE id=(SELECT property_id FROM property_review_request WHERE id=? AND last_command_id=? AND status='approved')",
            )
            .bind(terms, write.requestId, command),
        );
      statements.push(
        db
          .prepare(
            "UPDATE place SET publication=? WHERE id=(SELECT property_id FROM property_review_request WHERE id=? AND last_command_id=? AND status=?) AND publication='review'",
          )
          .bind(
            write.action === "approve" ? "published" : "draft",
            write.requestId,
            command,
            status,
          ),
      );
    }
    const requestId = write.action === "submit" ? command : write.requestId;
    const reason =
      write.action === "return_changes" || write.action === "approve"
        ? write.reason
        : null;
    statements.push(
      db
        .prepare(
          "INSERT INTO property_review_event(command_id,request_id,actor_id,actor_role,action,reason) SELECT ?,id,?,?,?,? FROM property_review_request WHERE id=? AND last_command_id=?",
        )
        .bind(
          command,
          actor.id,
          role,
          write.action,
          reason,
          requestId,
          command,
        ),
      db
        .prepare(
          "UPDATE property_review_command SET result_json=(SELECT json_object('id',r.id,'status',r.status) FROM property_review_event e JOIN property_review_request r ON r.id=e.request_id WHERE e.command_id=?),sealed=1 WHERE id=?",
        )
        .bind(command, command),
    );
    await db.batch(statements);
  } catch (error) {
    const committed = await existing();
    if (committed) return replay(committed);
    if (error instanceof DomainError) throw error;
    const message = error instanceof Error ? error.message : "";
    if (/constraint|RAISE|invalid_|immutable_/i.test(message))
      throw new DomainError("review_conflict", 409, "database_guard_rejected");
    throw error;
  }
  const result = await existing();
  if (!result) throw new DomainError("retry_same_operation", 503);
  return replay(result);
}
