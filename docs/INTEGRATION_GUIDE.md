# AgentSec Runtime Inspection Integration

PromptShield exposes a deterministic, stateless inspection endpoint used by the AgentSec Hook Pack:

`POST /api/runtime/inspect`

The endpoint classifies a proposed action before execution and returns one of three decisions:

- `allow`: recognized read-only operation
- `requires_approval`: remote, privileged, state-changing, or unrecognized operation
- `block`: recognizable destructive or credential-exfiltration pattern

## Authentication

Configure the PromptShield server with either:

- `AGENTSEC_API_SECRET`, preferred for the runtime endpoint
- `MCP_API_SECRET`, accepted as a fallback for installations using one shared programmatic-access secret

Configure the AgentSec client with the same value in `AGENTSEC_API_KEY`.

Requests use:

`Authorization: Bearer <shared secret>`

The endpoint returns `401` when the secret is absent or does not match.

## AgentSec Hook Payload

This is the payload emitted by `agentsec-hook-pack`:

```json
{
  "agentId": "local-coding-agent",
  "sessionId": "session-123",
  "action": {
    "type": "shell_command",
    "tool": "Bash",
    "command": "git status --short",
    "cwd": "/path/to/repository"
  }
}
```

The response is deterministic:

```json
{
  "decision": "allow",
  "actionId": "generated-action-id",
  "policyRule": {
    "id": "runtime.allow.read-only",
    "description": "Allow recognized read-only inspection and verification actions."
  },
  "riskAssessment": {
    "level": "low",
    "reasons": ["recognized read-only action"]
  }
}
```

## Legacy Flat Payload

The endpoint also accepts the earlier flat integration shape:

```json
{
  "id": "request-123",
  "agentId": "external-agent",
  "actionType": "filesystem_read",
  "description": "Read a documentation file",
  "context": {
    "path": "README.md"
  }
}
```

This compatibility exists for older integrations. New integrations should use the nested AgentSec Hook payload.

## Example Request

```bash
curl -X POST http://localhost:3000/api/runtime/inspect \
  -H "Authorization: Bearer $AGENTSEC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "local-coding-agent",
    "sessionId": "session-123",
    "action": {
      "type": "github_write",
      "tool": "Bash",
      "command": "publish reviewed branch",
      "cwd": "/path/to/repository"
    }
  }'
```

The example returns `requires_approval` because `github_write` is a remote state-changing action.

## Current Scope

The runtime endpoint is intentionally stateless. It does not currently provide:

- a durable approval queue
- approval polling
- approval persistence
- organization-specific policy storage

When PromptShield returns `requires_approval`, the calling client owns the approval interaction. The AgentSec Hook Pack maps this decision to Claude Code's `ask` response or a nonzero Codex exit with an approval-required message.

Durable approval workflows belong in an approval service such as ApproveOps rather than being implied by this endpoint.

## Verification

PromptShield CI verifies the production server with both payload formats and checks:

- missing authentication returns `401`
- a read-only AgentSec action returns `allow`
- a `github_write` action returns `requires_approval`
- a legacy `filesystem_read` action returns `allow`
- malformed payloads are rejected
