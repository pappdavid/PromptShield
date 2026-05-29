# Audit Log Integrity Design

## 1. Current State of the Audit Log

Currently, audit logging for approval workflows is handled by the `ApprovalAuditEvent` table in the Prisma schema. It records critical lifecycle events for `ApprovalRequest` records. 

The model stores the following information:
- `id`: A unique identifier (CUID) for the audit event.
- `approvalRequestId`: The ID of the associated approval request.
- `eventType`: The type of event (e.g., creation, approval, rejection).
- `actorId`: The ID of the user or system that performed the action.
- `note`: An optional text note or justification for the action.
- `metadata`: A JSON field storing contextual data specific to the event.
- `createdAt`: A timestamp indicating when the event occurred.

## 2. The Integrity Gap

While the current audit log effectively tracks approval events, it lacks technical safeguards against tampering:
- **Mutable Records:** Events can currently be modified or deleted directly in the database by anyone with sufficient database access (e.g., a DBA or an attacker who compromises the database credentials).
- **No Hash Chaining:** There is no cryptographic proof that the sequence of events remains intact. If a record is altered, deleted, or inserted retroactively, the system cannot detect the anomaly.

## 3. Recommended Approach for Tamper-Resistance

To ensure the integrity of the audit log, we recommend implementing a tamper-evident architecture. Two primary approaches can be considered:

1. **Append-Only Database Policies (e.g., Neon/Postgres Policies):** Enforce append-only rules at the database level, preventing `UPDATE` and `DELETE` operations on the `ApprovalAuditEvent` table.
2. **Cryptographic Hash Chaining:** Implement a hash chain where each audit event stores a SHA-256 hash of its own payload combined with the hash of the chronologically preceding event. This creates a linked list of events where any alteration to a past event invalidates the hashes of all subsequent events, making tampering mathematically detectable.

Given the application-level control and cryptographic guarantees it provides, the **Hash Chain** approach is recommended.

## 4. Implementation Sketch

To implement the hash chain approach, the following schema changes would be required for the `ApprovalAuditEvent` model:

```prisma
model ApprovalAuditEvent {
  id                String          @id @default(cuid())
  approvalRequestId String
  eventType         String
  actorId           String?
  note              String?
  metadata          Json?
  createdAt         DateTime        @default(now())
  
  // New fields for hash chaining
  previousHash      String?         // Null for the first event in the chain (genesis event)
  hash              String          // SHA-256(previousHash + payload)

  approvalRequest   ApprovalRequest @relation(fields: [approvalRequestId], references: [id], onDelete: Cascade)
  @@index([approvalRequestId])
}
```

**Payload computation for hashing:**
The `hash` would be computed before insertion:
`hash = sha256(previousHash + approvalRequestId + eventType + actorId + note + stringified metadata + createdAt)`

## 5. Why This Matters for an Approval Gateway Product

As an approval gateway, this product governs high-risk, sensitive operations (e.g., production deployments, accessing customer data). 
- **Non-Repudiation:** It ensures that actions taken by human operators or AI agents cannot be denied after the fact.
- **Compliance & Trust:** Enterprise environments require verifiable audit trails for compliance (e.g., SOC2, HIPAA, ISO 27001). A tamper-evident log provides cryptographic assurance to auditors.
- **Security Investigations:** In the event of a breach or a malicious insider action, incident responders can rely on the audit log as a source of truth, knowing it has not been altered to cover tracks.
