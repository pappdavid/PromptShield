# AgentSec Security Controls

> This document describes security controls currently implemented in AgentSec.
> It does not constitute a compliance certification claim.

## Purpose

AgentSec is a runtime approval gateway for AI agents. This document records
the security controls in place as of the current release.

## Authentication and Authorization

### Operator Access
- All operator-facing routes require Clerk authentication
- Protected routes: /observability, /approveops, /promptshield, /mcpguard
- Unauthenticated requests redirect to /sign-in (HTTP 307)

### Agent API Access
- POST /api/runtime/inspect requires AGENTSEC_API_KEY bearer token when configured
- Token is compared using string equality (upgrade to timing-safe comparison recommended)
- Requests without valid token receive HTTP 401

### Public Endpoints
- GET /api/runtime/actions/:id — public (approval status polling)
- GET /api/runtime/actions/:id/report — public (report download)
- GET /demo, /developers — public informational pages

## Input Validation

- Required fields enforced: id, agentId, agentName, actionType, description, context, timestamp
- actionType restricted to known values (allowlist)
- Array fields length-limited to prevent payload abuse
- Invalid requests return HTTP 400 with descriptive error

## Risk Assessment

- Risk engine is deterministic (no LLM dependency)
- Risk scoring based on action type, environment, context fields
- Policy engine evaluates rules in specificity order (action-specific before generic)
- Policy rules return decision (allow/requires_approval/block) and named policyRule

## Approval Workflow

- Self-approval prevented: decidedBy != submittedBy enforced server-side
- Approval state transitions: pending → approved/rejected/expired
- Audit timeline records all significant events with metadata

## Error Handling and Information Disclosure

- HTTP 500 responses return generic "Internal Server Error" text
- Server-side errors log error.message only (not raw error objects)
- Stream errors sanitized before propagation to clients
- No stack traces or connection strings returned in error responses

## Audit Trail

- All approval lifecycle events recorded in ApprovalAuditEvent table
- Events include: action received, policy matched, risk assessed, decision recorded
- Events include metadata: agentId, actionType, riskScore, policyRule

## Known Gaps (see THREAT_MODEL.md for details)

1. No rate limiting on public endpoints
2. Audit events are not hash-chained or immutable
3. No API key management UI
4. Approval IDs potentially enumerable
5. Token comparison is string equality (not timing-safe)

## Out of Scope

- SOC 2 / ISO 27001 certification (not claimed)
- Formal penetration testing (not performed)
- Multi-tenant isolation (not yet implemented)
