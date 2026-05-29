# Data Model

This document outlines the core data models related to approvals in the AgentSec system.

## Models

### `ApprovalRequest`
Represents a request for approval.

#### Fields:
- `id` (String): Unique identifier (cuid).
- `submittedById` (String): The ID of the `User` who submitted the request.
- `decidedById` (String?): The ID of the `User` who made the decision (optional).
- `title` (String): The title of the approval request.
- `description` (String?): The detailed description of the request.
- `riskLevel` (String): The assessed risk level, default is `"low"`.
- `riskReasons` (String[]): An array of reasons explaining the risk level.
- `riskSummary` (String?): A summarized text describing the risk.
- `status` (String): The current status of the request (e.g., `"pending"`, `"approved"`, `"rejected"`), default is `"pending"`.
- `decisionNote` (String?): Optional notes added by the decider when the decision is made.
- `decidedAt` (DateTime?): Timestamp of when the decision was made.
- `createdAt` (DateTime): The timestamp when the request was created.
- `updatedAt` (DateTime): The timestamp when the request was last updated.

#### Relations:
- `submittedBy`: A relation to the `User` model, linking to `submittedById`. (On delete: Cascade).
- `decidedBy`: A relation to the `User` model, linking to `decidedById`. (On delete: SetNull).
- `auditEvents`: A one-to-many relation to `ApprovalAuditEvent` representing the history of events for this request.

#### Indexes:
- `@@index([submittedById])`
- `@@index([status])`
- `@@index([createdAt])`

### `ApprovalAuditEvent`
Represents an event or action taken on an `ApprovalRequest`.

#### Fields:
- `id` (String): Unique identifier (cuid).
- `approvalRequestId` (String): The ID of the parent `ApprovalRequest`.
- `eventType` (String): The type of event (e.g., `"submitted"`, `"approved"`, `"rejected"`).
- `actorId` (String?): The ID of the actor responsible for the event.
- `note` (String?): An optional note associated with the event.
- `metadata` (Json?): Optional JSON metadata for the event.
- `createdAt` (DateTime): The timestamp when the event occurred.

#### Relations:
- `approvalRequest`: A relation to the `ApprovalRequest` model, linking to `approvalRequestId`. (On delete: Cascade).

#### Indexes:
- `@@index([approvalRequestId])`
- `@@index([createdAt])`

## Relations Summary

- **User to ApprovalRequest**: A user can submit many approval requests (`submittedApprovals`), and a user can decide many approval requests (`decidedApprovals`).
- **ApprovalRequest to ApprovalAuditEvent**: An `ApprovalRequest` can have many `ApprovalAuditEvent`s (one-to-many relationship).

## Typical Query Patterns

- **Fetching Requests by Status**:
  ```typescript
  const pendingRequests = await prisma.approvalRequest.findMany({
    where: { status: 'pending' }
  });
  ```

- **Fetching Recent Requests**:
  ```typescript
  const recentRequests = await prisma.approvalRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  ```

- **Fetching Requests with Associated Audit Events**:
  ```typescript
  const requestWithEvents = await prisma.approvalRequest.findUnique({
    where: { id: requestId },
    include: { auditEvents: true }
  });
  ```
