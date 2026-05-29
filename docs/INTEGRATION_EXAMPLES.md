# AgentSec Integration Examples

This document provides copy-paste examples for integrating AgentSec into various environments. AgentSec protects your AI agents by enforcing policy constraints on agent actions at runtime.

## Environment Variables

When configuring an external agent to use AgentSec, you will need the API Base URL and an API Key.

```env
# The base URL of your AgentSec instance
AGENTSEC_API_BASE_URL=https://your-agentsec-instance.com

# Your AgentSec API Key
AGENTSEC_API_KEY=your_agentsec_api_key
```

## 1. curl

You can use standard HTTP requests to check if an action is allowed.

```bash
# 1. Inspect the action
curl -X POST "$AGENTSEC_API_BASE_URL/api/runtime/inspect" \
  -H "Authorization: Bearer $AGENTSEC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "action-123",
    "agentId": "agent-456",
    "agentName": "CustomerSupportBot",
    "actionType": "customer_data_export",
    "description": "Exporting user data for GDPR request",
    "context": { "userId": "user-789" },
    "timestamp": "2023-10-27T10:00:00Z",
    "environment": "production"
  }'

# Response:
# {
#   "actionId": "action-123",
#   "decision": "requires_approval",
#   "policyRule": "strict-data-export",
#   "riskAssessment": { "level": "high", "score": 85, "reasons": ["Exporting sensitive customer data."] },
#   "approvalId": "appr-abc",
#   "approvalUrl": "https://your-agentsec-instance.com/approvals/appr-abc",
#   "message": "Action requires human approval."
# }

# 2. Poll for status (if decision is "requires_approval")
curl -X GET "$AGENTSEC_API_BASE_URL/api/runtime/actions/appr-abc" \
  -H "Authorization: Bearer $AGENTSEC_API_KEY"

# Response:
# {
#   "approvalId": "appr-abc",
#   "actionId": "action-123",
#   "status": "approved",
#   "decidedAt": "2023-10-27T10:05:00Z",
#   "decisionNote": "Looks good."
# }
```

## 2. fetch (JavaScript/TypeScript)

```typescript
const baseUrl = process.env.AGENTSEC_API_BASE_URL;
const apiKey = process.env.AGENTSEC_API_KEY;

async function checkAction() {
  const action = {
    id: crypto.randomUUID(),
    agentId: 'agent-1',
    agentName: 'MyAgent',
    actionType: 'database_migration', // Must be an ActionType (e.g., 'production_deploy', 'database_migration', 'github_write')
    description: 'Running migration script',
    context: { script: '001_init.sql' },
    timestamp: new Date().toISOString(),
    environment: 'production'
  };

  const response = await fetch(`${baseUrl}/api/runtime/inspect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(action),
  });

  const decision = await response.json();

  if (decision.decision === 'block') {
    throw new Error(`Action blocked: ${decision.message}`);
  }

  if (decision.decision === 'requires_approval') {
    console.log(`Approval required. Please visit: ${decision.approvalUrl}`);
    // You would then implement polling here
  }

  console.log('Action allowed!');
}
```

## 3. TypeScript SDK (`AgentSecClient`)

The provided `AgentSecClient` simplifies interaction.

```typescript
import { AgentSecClient } from './src/lib/sdk/agentsec-client';
import { AgentAction } from './src/lib/agentsec/contracts';

const client = new AgentSecClient(
  process.env.AGENTSEC_API_BASE_URL!,
  process.env.AGENTSEC_API_KEY!
);

async function performAction() {
  const action: AgentAction = {
    id: crypto.randomUUID(),
    agentId: 'agent-123',
    agentName: 'DeploymentBot',
    actionType: 'production_deploy',
    description: 'Deploying v2.0.0 to production',
    context: { version: 'v2.0.0' },
    timestamp: new Date().toISOString(),
    environment: 'production'
  };

  try {
    // inspectAndWait automatically handles polling if approval is required
    const result = await client.inspectAndWait(action, 2000); // Poll every 2 seconds

    // Result can be either an ApprovalStatus (if it required approval) or RuntimeDecision (if immediate)
    const isApproved =
      ('status' in result && result.status === 'approved') ||
      ('decision' in result && result.decision === 'allow');

    if (isApproved) {
      console.log('Action approved, proceeding...');
      // Execute the actual action here
    } else {
      console.error('Action was denied or blocked.');
    }
  } catch (error) {
    console.error('AgentSec error:', error);
  }
}
```

## 4. GitHub Actions

You can use AgentSec in CI/CD pipelines to guard deployment steps.

```yaml
name: Production Deploy
on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Check AgentSec Policy
        id: agentsec
        run: |
          ACTION_ID=$(uuidgen)
          TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

          RESPONSE=$(curl -s -X POST "${{ secrets.AGENTSEC_API_BASE_URL }}/api/runtime/inspect" \
            -H "Authorization: Bearer ${{ secrets.AGENTSEC_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d "{
              \"id\": \"$ACTION_ID\",
              \"agentId\": \"github-actions\",
              \"agentName\": \"CI/CD Pipeline\",
              \"actionType\": \"production_deploy\",
              \"description\": \"Triggering production deploy from commit ${{ github.sha }}\",
              \"context\": { \"repo\": \"${{ github.repository }}\", \"sha\": \"${{ github.sha }}\" },
              \"timestamp\": \"$TIMESTAMP\",
              \"environment\": \"production\"
            }")

          DECISION=$(echo $RESPONSE | jq -r .decision)

          if [ "$DECISION" = "block" ]; then
            echo "Deploy blocked by AgentSec"
            exit 1
          elif [ "$DECISION" = "requires_approval" ]; then
            APPROVAL_URL=$(echo $RESPONSE | jq -r .approvalUrl)
            APPROVAL_ID=$(echo $RESPONSE | jq -r .approvalId)
            echo "Approval required. URL: $APPROVAL_URL"

            # Simple polling loop
            while true; do
              STATUS_RESP=$(curl -s -X GET "${{ secrets.AGENTSEC_API_BASE_URL }}/api/runtime/actions/$APPROVAL_ID" \
                -H "Authorization: Bearer ${{ secrets.AGENTSEC_API_KEY }}")
              STATUS=$(echo $STATUS_RESP | jq -r .status)

              if [ "$STATUS" = "approved" ]; then
                echo "Approved!"
                break
              elif [ "$STATUS" = "rejected" ]; then
                echo "Rejected by human reviewer."
                exit 1
              fi
              echo "Waiting for approval..."
              sleep 10
            done
          fi

      - name: Actual Deployment Step
        run: echo "Deploying..."
```

## 5. LangGraph (Python)

Integrate AgentSec as a node or within a tool in your LangGraph application.

```python
import os
import requests
import uuid
from datetime import datetime, timezone
from typing import TypedDict

class AgentState(TypedDict):
    messages: list
    approved: bool

def check_agentsec(state: AgentState):
    api_base = os.getenv("AGENTSEC_API_BASE_URL")
    api_key = os.getenv("AGENTSEC_API_KEY")

    action_payload = {
        "id": str(uuid.uuid4()),
        "agentId": "langgraph-agent",
        "agentName": "LangGraphBot",
        "actionType": "shell_command",
        "description": "Executing a shell command",
        "context": {"command": "ls -la"},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    headers = {"Authorization": f"Bearer {api_key}"}
    response = requests.post(f"{api_base}/api/runtime/inspect", json=action_payload, headers=headers)
    response.raise_for_status()

    decision = response.json()

    if decision["decision"] == "block":
        return {"approved": False}

    if decision["decision"] == "requires_approval":
        # In a real async environment, you might suspend execution here
        print(f"Approval required: {decision['approvalUrl']}")
        return {"approved": False} # Or implement a blocking poll

    return {"approved": True}
```

## 6. OpenAI Agents SDK (Python)

Using AgentSec with OpenAI's tools.

```python
import os
import requests
import uuid
from datetime import datetime, timezone

def execute_sensitive_action(query: str):
    """A tool that performs a sensitive database write."""
    api_base = os.getenv("AGENTSEC_API_BASE_URL")
    api_key = os.getenv("AGENTSEC_API_KEY")

    payload = {
        "id": str(uuid.uuid4()),
        "agentId": "openai-agent",
        "agentName": "DBWriterBot",
        "actionType": "db_write",
        "description": f"Executing DB query: {query}",
        "context": {"query": query},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    resp = requests.post(
        f"{api_base}/api/runtime/inspect",
        json=payload,
        headers={"Authorization": f"Bearer {api_key}"}
    )
    data = resp.json()

    if data["decision"] == "allow":
        # Actually run the query
        return f"Successfully executed: {query}"
    elif data["decision"] == "block":
        return f"Error: Action blocked by security policy. Reason: {data.get('message')}"
    else:
        return f"Action requires approval. Please visit: {data['approvalUrl']}"

# Example OpenAI setup
# tools = [{"type": "function", "function": {"name": "execute_sensitive_action", ...}}]
```
