# AgentSec Integration Guide

This guide explains how to integrate external agent systems (such as AI agents, CI/CD pipelines, or autonomous scripts) with the AgentSec runtime inspection API.

## 1. Quick Start

Integrating an external agent with AgentSec is a 3-step process:

1. **Submit Action:** Before your agent executes a sensitive action, send an inspection request to `POST /api/runtime/inspect`.
2. **Poll for Decision:** If the response requires approval, poll the `GET /api/runtime/actions/:id` endpoint until the status is approved or rejected.
3. **Handle Result:** Execute the action if allowed or approved, and safely abort if blocked or rejected.

## 2. Request Format (`POST /api/runtime/inspect`)

Send a POST request to `/api/runtime/inspect` with the following JSON body.

### Required Fields

*   `id` (string): A unique identifier for the action.
*   `agentId` (string): The identifier of the agent requesting the action.
*   `agentName` (string): A human-readable name for the agent.
*   `actionType` (string): The type of action being requested. Valid types include: `production_deploy`, `customer_data_export`, `database_migration`, `external_webhook`, `shell_command`, `github_write`, `db_write`, `filesystem_read`, `env_secret_access`, `prompt_injection_marker`.
*   `description` (string): A human-readable description of what the action does.
*   `context` (object): Additional key-value pairs providing context about the action (e.g., target environment, repository).
*   `timestamp` (string): ISO 8601 formatted timestamp of the request.

### Authentication

Provide your AgentSec API key in the `Authorization` header:

```
Authorization: Bearer <YOUR_AGENTSEC_API_KEY>
```

## 3. Response Format

The `/api/runtime/inspect` endpoint returns a JSON object with the following structure:

*   `decision` (string): One of `allow`, `requires_approval`, or `block`.
*   `policyRule` (object): The specific policy rule that triggered the decision.
*   `riskAssessment` (object): Details on the risk level evaluated by the engine.
*   `actionId` (string): The unique ID of the action (matches the request `id`).
*   `approvalUrl` (string): (Optional) The URL where a human operator can review and approve the request, provided if the decision is `requires_approval`.
*   `approvalId` (string): (Optional) The ID to use for polling the status, provided if the decision is `requires_approval`.

## 4. Polling for Approval (`GET /api/runtime/actions/:id`)

If the decision is `requires_approval`, use the returned `approvalId` to poll the status.

Endpoint: `GET /api/runtime/actions/:id`

The response will include a `status` field which will be one of:
*   `pending`: The request is still waiting for human review.
*   `approved`: The request has been approved. You may proceed.
*   `rejected`: The request has been denied. Do not proceed.

## 5. Full cURL Example

Here is a complete cURL command for a `production_deploy` action:

```bash
curl -X POST https://your-agentsec-domain.com/api/runtime/inspect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "id": "req-12345",
    "agentId": "agent-deployer-01",
    "agentName": "AutoDeploy Agent",
    "actionType": "production_deploy",
    "description": "Deploying version 2.1.0 to production cluster.",
    "context": {
      "environment": "production",
      "repository": "github.com/org/repo",
      "commit": "a1b2c3d4"
    },
    "timestamp": "2024-05-20T10:00:00Z"
  }'
```

## 6. Full TypeScript/Fetch Example

Here is how you might implement the submission and polling logic in TypeScript:

```typescript
async function executeSecureAction() {
  const inspectUrl = 'https://your-agentsec-domain.com/api/runtime/inspect';
  const apiKey = 'YOUR_API_KEY';
  
  // 1. Submit Action
  const response = await fetch(inspectUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      agentId: 'agent-ts-01',
      agentName: 'TS Worker Agent',
      actionType: 'database_migration',
      description: 'Running migration script v4.',
      context: { target: 'primary-db' },
      timestamp: new Date().toISOString(),
    }),
  });

  const result = await response.json();

  if (result.decision === 'block') {
    throw new Error('Action blocked by AgentSec.');
  }

  if (result.decision === 'allow') {
    console.log('Action allowed directly.');
    // Execute your action here
    return;
  }

  if (result.decision === 'requires_approval') {
    console.log(`Approval required. Please review at: ${result.approvalUrl}`);
    
    // 2. Poll for Decision
    const approvalId = result.approvalId || result.actionId;
    let status = 'pending';
    
    while (status === 'pending') {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
      
      const pollResponse = await fetch(`https://your-agentsec-domain.com/api/runtime/actions/${approvalId}`);
      const pollResult = await pollResponse.json();
      status = pollResult.status;
      
      if (status === 'approved') {
        console.log('Action approved!');
        // Execute your action here
        return;
      } else if (status === 'rejected') {
        throw new Error('Action rejected by reviewer.');
      }
    }
  }
}
```

## 7. Framework-Specific Notes

### LangGraph Agents
For LangGraph, integrate the AgentSec check as a conditional edge or a dedicated node before critical tools (e.g., executing bash commands or modifying databases). If the check returns `requires_approval`, you can pause the graph execution (using `interrupt`) and wait for an external system to resume it once the approval status is `approved`.

### GitHub Actions
When using AgentSec in GitHub Actions, use a custom action or a simple bash script step to make the `curl` call. You can use the `sleep` command in a loop to poll the status. Ensure your AgentSec API key is stored securely as a GitHub Secret and injected into the workflow.

### General AI Agent Patterns
In any agentic loop (like ReAct), wrap sensitive tools with an AgentSec interceptor. The interceptor should abstract the submission and polling logic, returning a success or failure signal back to the agent. This prevents the LLM from needing to understand the security handshake directly.
