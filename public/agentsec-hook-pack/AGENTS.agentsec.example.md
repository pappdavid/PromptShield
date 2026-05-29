# PromptShield Orchestration & Security Rules

This file documents the security boundaries and interception rules for autonomous coding agents running in this repository.

## PreToolUse Hook Integration

To protect our production environments, database schemas, and credentials from rogue agent actions or prompt injections, coding agents run behind the **AgentSec PreToolUse Guard**.

### Guarded Tools

1. **Bash / CLI Commands**: Any command execution is scanned.
2. **File Modifying Tools**: `WriteFile`, `EditFile`, `replace_file_content`.
3. **File Reading Tools**: `ReadFile`, `view_file` (specifically when accessing config/keys).
4. **MCP Tools**: Any remote MCP executions.

### Policy Enforcement Levels

*   **Observe Mode**: Scans and logs all actions to AgentSec without blocking or pausing. Good for tuning rules.
*   **Prompt Mode**: Pauses high-risk actions and waits for human approval.
*   **Enforce Mode**: Strictly blocks unauthorized actions or requires approval for migrations, production deploys, and secret access.

## Quick Setup

1. Copy `.agentsec/hooks/agentsec-hook.mjs` and `agentsec.config.example.json` (rename to `agentsec.config.json`) to your repository.
2. Add the appropriate config snippet to your agent configuration.
3. Export `AGENTSEC_API_KEY="your-api-key"` in your shell.
4. Launch your agent and proceed normally!
