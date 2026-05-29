#!/usr/bin/env node

/**
 * AgentSec Guard — PreToolUse Interceptor Hook
 * 
 * This hook interceptor executes before sensitive coding agent tools run.
 * It parses the tool context from stdin, maps the action to AgentSec policies,
 * calls the /api/runtime/inspect API, and optionally blocks or polls for human approval.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Setup basic logging
function log(msg) {
  console.error(`[AgentSec] ${msg}`);
}

function debugLog(msg, debug = false) {
  if (debug) {
    console.error(`[AgentSec] [DEBUG] ${msg}`);
  }
}

// Stdin reading helper
async function readStdin() {
  if (process.stdin.isTTY) {
    return '';
  }
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    
    const timer = setTimeout(() => {
      resolve(data);
    }, 200);

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// Generate a random ID
function generateId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Search for configuration file (agentsec.config.json)
function loadConfig() {
  const searchPaths = [
    path.join(process.cwd(), 'agentsec.config.json'),
    path.join(process.cwd(), '.agentsec/hooks/agentsec.config.json'),
    path.join(process.cwd(), '.agentsec/agentsec.config.json'),
  ];

  for (const p of searchPaths) {
    if (fs.existsSync(p)) {
      try {
        const fileContent = fs.readFileSync(p, 'utf8');
        return JSON.parse(fileContent);
      } catch (err) {
        log(`Warning: Failed to parse config file at ${p}: ${err.message}`);
      }
    }
  }

  // Fallbacks if no config is found
  return {
    baseUrl: process.env.AGENTSEC_BASE_URL || 'https://promptshield-cyan.vercel.app',
    mode: process.env.AGENTSEC_MODE || 'observe',
    agentId: process.env.AGENTSEC_AGENT_ID || 'local-coding-agent',
    agentName: process.env.AGENTSEC_AGENT_NAME || 'Local Coding Agent',
    failClosedFor: [
      'production_deploy',
      'database_migration',
      'env_secret_access',
      'customer_data_export'
    ]
  };
}

// Main execution function
async function main() {
  const clientArgIndex = process.argv.indexOf('--client');
  const client = clientArgIndex !== -1 ? process.argv[clientArgIndex + 1] : 'claude';
  const isDebug = process.argv.includes('--debug');

  const config = loadConfig();
  const apiKey = process.env.AGENTSEC_API_KEY;

  debugLog(`Loaded configuration: ${JSON.stringify(config)}`, isDebug);

  // Read tool use details from stdin
  const stdinData = await readStdin();
  let toolName = 'Unknown';
  let toolInput = {};
  
  if (stdinData.trim()) {
    try {
      const parsed = JSON.parse(stdinData);
      toolName = parsed.tool_name || parsed.tool || 'Unknown';
      toolInput = parsed.tool_input || parsed.input || parsed.arguments || parsed || {};
      debugLog(`Parsed stdin tool call: name=${toolName}, input=${JSON.stringify(toolInput)}`, isDebug);
    } catch (err) {
      debugLog(`Could not parse stdin as JSON: ${err.message}. Raw: ${stdinData}`, isDebug);
      toolName = 'Bash';
      toolInput = { command: stdinData.trim() };
    }
  } else {
    // Graceful fallback: check environment or argv if running outside interactive shell
    toolName = 'Bash';
    toolInput = { command: process.argv.slice(2).filter(a => !a.startsWith('--')).join(' ') || 'unknown_shell_call' };
    debugLog(`Empty stdin. Falling back to arguments: name=${toolName}, input=${JSON.stringify(toolInput)}`, isDebug);
  }

  // Determine Action Type based on tool name and command text
  let actionType = 'shell_command';
  let description = `Running agent tool: ${toolName}`;

  const commandStr = (toolInput.command || toolInput.CommandLine || '').toLowerCase();
  const filePathStr = (toolInput.path || toolInput.TargetFile || '').toLowerCase();

  if (toolName.toLowerCase().includes('bash') || toolName.toLowerCase().includes('execute') || toolName.toLowerCase().includes('command')) {
    actionType = 'shell_command';
    description = `Execute shell command: ${toolInput.command || toolInput.CommandLine}`;

    if (commandStr.includes('vercel deploy') || commandStr.includes('fly deploy') || commandStr.includes('aws deploy') || commandStr.includes('deploy --prod') || commandStr.includes('npm run deploy')) {
      actionType = 'production_deploy';
    } else if (commandStr.includes('migrate') || commandStr.includes('db push') || commandStr.includes('prisma db push') || commandStr.includes('db:migrate')) {
      actionType = 'database_migration';
    } else if (commandStr.includes('git push') || commandStr.includes('gh pr merge')) {
      actionType = 'github_write';
    } else if (commandStr.includes('npm publish') || commandStr.includes('publish ')) {
      actionType = 'github_write';
    } else if (commandStr.includes('.env') || commandStr.includes('secrets') || commandStr.includes('credentials')) {
      actionType = 'env_secret_access';
    } else if (commandStr.includes('rm -rf') || commandStr.includes('rm -f ') || commandStr.includes('destructive')) {
      actionType = 'shell_command';
    }
  } else if (toolName.toLowerCase().includes('write') || toolName.toLowerCase().includes('edit') || toolName.toLowerCase().includes('replace')) {
    actionType = 'db_write';
    description = `Modify file: ${toolInput.path || toolInput.TargetFile}`;
    if (filePathStr.includes('.env') || filePathStr.includes('secret') || filePathStr.includes('key')) {
      actionType = 'env_secret_access';
    }
  } else if (toolName.toLowerCase().includes('read') || toolName.toLowerCase().includes('view') || toolName.toLowerCase().includes('grep')) {
    actionType = 'filesystem_read';
    description = `Read file/directory: ${toolInput.path || toolInput.TargetFile || toolInput.SearchPath}`;
    if (filePathStr.includes('.env') || filePathStr.includes('secret') || filePathStr.includes('key')) {
      actionType = 'env_secret_access';
    }
  } else if (toolName.toLowerCase().startsWith('mcp__') || toolName.toLowerCase().includes('mcp')) {
    actionType = 'external_webhook';
    description = `Call MCP Tool: ${toolName}`;
  }

  // Construct standard API request payload
  const inspectPayload = {
    id: generateId(),
    agentId: config.agentId,
    agentName: config.agentName,
    actionType: actionType,
    description: description,
    context: {
      tool: toolName,
      input: toolInput,
      client: client,
      directory: process.cwd(),
      hookVersion: '1.0.0'
    },
    timestamp: new Date().toISOString()
  };

  debugLog(`Sending inspect payload: ${JSON.stringify(inspectPayload)}`, isDebug);

  const isFailClosed = config.failClosedFor && config.failClosedFor.includes(actionType);

  // If in observe mode, check API but don't enforce blocks
  const isObserve = config.mode === 'observe';

  // API Call with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const fetchUrl = `${config.baseUrl.replace(/\/$/, '')}/api/runtime/inspect`;
    const headers = {
      'Content-Type': 'application/json'
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const res = await fetch(fetchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(inspectPayload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}`);
    }

    const decisionData = await res.json();
    debugLog(`Inspection Decision: ${JSON.stringify(decisionData)}`, isDebug);

    if (decisionData.decision === 'allow') {
      log(`Action allowed directly. Score: ${decisionData.riskAssessment?.score}/100`);
      process.exit(0);
    }

    if (decisionData.decision === 'block') {
      if (isObserve) {
        log(`[OBSERVE] Action would be BLOCKED: ${decisionData.message}`);
        process.exit(0);
      }
      log(`⛔ Action BLOCKED: ${decisionData.message}`);
      process.exit(2);
    }

    if (decisionData.decision === 'requires_approval') {
      if (isObserve) {
        log(`[OBSERVE] Action would require approval: ${decisionData.message}`);
        process.exit(0);
      }

      const approvalId = decisionData.approvalId || decisionData.actionId;
      const approvalUrl = decisionData.approvalUrl || `/approveops/${approvalId}`;
      const absoluteApprovalUrl = approvalUrl.startsWith('http') ? approvalUrl : `${config.baseUrl.replace(/\/$/, '')}${approvalUrl}`;

      log(`⚠️ Action requires human approval!`);
      log(`🔗 Approval Link: ${absoluteApprovalUrl}`);

      if (client === 'codex') {
        log(`Please visit the approval link, approve the request, and retry the agent action.`);
        process.exit(2);
      }

      // Interactive Polling Loop (default for Claude Code and others supporting active wait)
      log(`Waiting for human review...`);
      let approvalStatus = 'pending';
      const pollUrl = `${config.baseUrl.replace(/\/$/, '')}/api/runtime/actions/${approvalId}`;

      while (approvalStatus === 'pending') {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        
        try {
          const pollRes = await fetch(pollUrl, { headers });
          if (pollRes.ok) {
            const pollData = await pollRes.json();
            approvalStatus = pollData.status || 'pending';
            if (approvalStatus === 'approved') {
              log(`✅ Action APPROVED! Proceeding with execution.`);
              process.exit(0);
            } else if (approvalStatus === 'rejected') {
              log(`⛔ Action REJECTED by human operator.`);
              process.exit(2);
            }
          } else {
            debugLog(`Polling status returned ${pollRes.status}`, isDebug);
          }
        } catch (pollErr) {
          debugLog(`Polling network issue: ${pollErr.message}`, isDebug);
        }
      }
    }
  } catch (err) {
    clearTimeout(timeoutId);
    log(`Warning: Policy engine inspection failed (${err.message}).`);

    if (isFailClosed) {
      log(`⛔ FAIL-CLOSED: Action blocked for security-critical type [${actionType}].`);
      process.exit(2);
    } else {
      log(`✅ FAIL-OPEN: Bypass inspection. Action allowed.`);
      process.exit(0);
    }
  }
}

main().catch((err) => {
  log(`Critical internal hook failure: ${err.message}`);
  process.exit(0); // Fail-open on extreme unhandled script crash
});
