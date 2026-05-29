# AgentSec Webhook Design

This document describes the webhook callback mechanism for AgentSec. When an approval decision is made, AgentSec will send a POST request to a caller-supplied webhook URL, notifying them of the result.

## 1. Specifying the Webhook URL

Callers can subscribe to webhook notifications by including a `webhookUrl` and an optional `webhookSecret` in the JSON body of the `POST /api/runtime/inspect` request. 

Example inspect request:
```json
{
  "action": {
    "type": "database_write",
    "resource": "users",
    "details": { "id": "123" }
  },
  "webhookUrl": "https://api.example.com/webhooks/agentsec",
  "webhookSecret": "your_secure_random_secret_here"
}
```

If `webhookUrl` is omitted, no callback will be sent.

## 2. Webhook Payload

When an approval request is decided (approved or rejected), AgentSec sends an HTTP POST to the registered webhook URL with a JSON payload containing the following fields:

- `actionId` (string): The unique identifier for the action that was evaluated.
- `decision` (string): The final outcome. Possible values include `approved`, `rejected`.
- `status` (string): The status of the request (e.g., `resolved`).
- `decidedBy` (string | null): The identifier (e.g., user ID or email) of the person or system that made the decision.
- `decidedAt` (string): The ISO 8601 timestamp of when the decision was made.
- `riskScore` (number): The computed risk score for the action.
- `policyRule` (string | null): The specific policy rule that triggered the decision.

Example payload:
```json
{
  "actionId": "req_abc123",
  "decision": "approved",
  "status": "resolved",
  "decidedBy": "admin@example.com",
  "decidedAt": "2023-10-01T12:00:00Z",
  "riskScore": 85,
  "policyRule": "high_risk_database_write"
}
```

## 3. Retry Policy

If the webhook delivery fails (e.g., network error, 5xx status code from the receiver, or a timeout), AgentSec will retry the delivery according to the following policy:

- **Maximum attempts:** 3 (the initial attempt + 2 retries).
- **Backoff strategy:** Exponential backoff.
- **Initial delay:** 1 second.

The delays between retries will therefore be approximately 1 second and 2 seconds.

## 4. Security

To ensure that the webhook originated from AgentSec and its contents have not been tampered with, AgentSec signs the payload using HMAC-SHA256. 

- The signature is sent in the `X-AgentSec-Signature` header.
- The HMAC is computed over the raw request body string.
- The secret key is the `webhookSecret` provided in the initial inspect request (or a pre-configured fallback secret if one wasn't provided, depending on integration).

Receivers should compute the HMAC-SHA256 signature of the raw request body using their secret, and compare it to the value in the `X-AgentSec-Signature` header.

## 5. Receiver Examples

### Node.js (Express)

```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();
const WEBHOOK_SECRET = process.env.AGENTSEC_WEBHOOK_SECRET;

// Use middleware to capture the raw body for signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.post('/webhooks/agentsec', (req, res) => {
  const signature = req.headers['x-agentsec-signature'];

  if (!signature) {
    return res.status(401).send('Missing signature');
  }

  // Compute the expected signature
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return res.status(401).send('Invalid signature');
  }

  const payload = req.body;
  console.log(`Received decision for action ${payload.actionId}: ${payload.decision}`);

  // Acknowledge receipt
  res.status(200).send('OK');
});

app.listen(3000, () => console.log('Webhook receiver listening on port 3000'));
```

### Python (Flask)

```python
import os
import hmac
import hashlib
from flask import Flask, request, jsonify

app = Flask(__name__)
WEBHOOK_SECRET = os.environ.get('AGENTSEC_WEBHOOK_SECRET', '').encode('utf-8')

@app.route('/webhooks/agentsec', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('X-AgentSec-Signature')
    
    if not signature:
        return jsonify({"error": "Missing signature"}), 401
        
    raw_body = request.get_data()
    
    # Compute the expected signature
    expected_signature = hmac.new(
        WEBHOOK_SECRET, 
        msg=raw_body, 
        digestmod=hashlib.sha256
    ).hexdigest()
    
    # Use hmac.compare_digest to prevent timing attacks
    if not hmac.compare_digest(signature, expected_signature):
        return jsonify({"error": "Invalid signature"}), 401
        
    payload = request.json
    print(f"Received decision for action {payload.get('actionId')}: {payload.get('decision')}")
    
    # Acknowledge receipt
    return jsonify({"status": "OK"}), 200

if __name__ == '__main__':
    app.run(port=3000)
```
