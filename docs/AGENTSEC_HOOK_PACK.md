# AgentSec Hook Pack

AgentSec Hook Pack adds runtime safety checks to Claude Code and Codex.

## Quick start

1. Copy `.agentsec/hooks/agentsec-hook.mjs` into your repo.
2. Copy the Claude Code or Codex config snippet.
3. Set `AGENTSEC_API_KEY`.
4. Start in `observe` mode.
5. Switch to `prompt` or `enforce` once policies are tuned.

## Modes

- `observe`: inspect and log, never block
- `prompt`: ask or deny for approval-required actions
- `enforce`: apply allow/block/requires_approval decisions

## Guarded actions

- production deploys
- destructive shell commands
- database migrations
- secret access
- GitHub writes
- MCP write/delete/deploy/send/export tools
