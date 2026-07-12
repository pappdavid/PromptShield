export type RuntimeDecision = "allow" | "requires_approval" | "block";
export type RuntimeRiskLevel = "low" | "medium" | "high" | "critical";

export interface RuntimeAction {
  id: string;
  agentId: string;
  sessionId?: string;
  actionType: string;
  tool?: string;
  command?: string;
  cwd?: string;
  description?: string;
  context?: Record<string, unknown>;
}

export interface RuntimeInspectionResult {
  decision: RuntimeDecision;
  actionId: string;
  policyRule: {
    id: string;
    description: string;
  };
  riskAssessment: {
    level: RuntimeRiskLevel;
    reasons: string[];
  };
}

const APPROVAL_ACTION_TYPES = new Set([
  "production_deploy",
  "database_migration",
  "env_secret_access",
  "customer_data_export",
  "github_write",
  "db_write",
  "file_edit",
  "mcp_tool",
]);

const READ_ONLY_ACTION_TYPES = new Set([
  "filesystem_read",
  "documentation_search",
  "status_check",
]);

const destructivePatterns: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /(?:^|[;&|]\s*)(?:sudo\s+)?rm\s+-(?=[a-z]*r)(?=[a-z]*f)[a-z]+\s+(?:--\s+)?(?:\/\*?|~\/?\*?|\.\/?\*?)(?:\s|$)/i,
    reason: "destructive recursive deletion",
  },
  {
    pattern: /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sh|bash)\b/i,
    reason: "remote script execution",
  },
  {
    pattern: /\b(?:drop|truncate)\s+table\b/i,
    reason: "destructive database operation",
  },
  {
    pattern: /\b(?:cat|printenv|env)\b[^\n]*(?:\.env|secret|token|credential)[^\n]*(?:https?:\/\/|webhook)/i,
    reason: "credential exfiltration pattern",
  },
];

const approvalPatterns: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bgit\s+push\b/i, reason: "remote repository mutation" },
  { pattern: /\b(?:deploy|release|rollback)\b/i, reason: "deployment operation" },
  { pattern: /\b(?:prisma\s+migrate|database\s+migration|schema\s+migration)\b/i, reason: "database migration" },
  { pattern: /\b(?:write|modify|delete|remove|rename|chmod)\b/i, reason: "state-changing operation" },
];

const readOnlyShellPatterns = [
  /^git\s+(?:status|diff|log|show|branch)(?:\s|$)/i,
  /^npm\s+(?:test|run\s+(?:lint|typecheck|type-check|build))(?:\s|$)/i,
  /^(?:ls|pwd|grep|find)(?:\s|$)/i,
];

function combinedText(action: RuntimeAction) {
  return [action.actionType, action.tool, action.command, action.description]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function actionTextFields(action: RuntimeAction) {
  return [action.command, action.description].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );
}

export function inspectRuntimeAction(action: RuntimeAction): RuntimeInspectionResult {
  const text = combinedText(action);
  const fields = actionTextFields(action);
  const destructive = destructivePatterns.find(({ pattern }) =>
    fields.some((field) => pattern.test(field))
  );

  if (destructive) {
    return {
      decision: "block",
      actionId: action.id,
      policyRule: {
        id: "runtime.block.destructive",
        description: "Block locally recognizable destructive or exfiltration actions.",
      },
      riskAssessment: {
        level: "critical",
        reasons: [destructive.reason],
      },
    };
  }

  const approvalReasons = approvalPatterns
    .filter(({ pattern }) => pattern.test(text))
    .map(({ reason }) => reason);

  if (APPROVAL_ACTION_TYPES.has(action.actionType) || approvalReasons.length > 0) {
    return {
      decision: "requires_approval",
      actionId: action.id,
      policyRule: {
        id: "runtime.approval.state-change",
        description: "Require human approval for remote, privileged, or state-changing actions.",
      },
      riskAssessment: {
        level: "high",
        reasons: approvalReasons.length > 0 ? Array.from(new Set(approvalReasons)) : [`sensitive action type: ${action.actionType}`],
      },
    };
  }

  const command = action.command?.trim() ?? "";
  if (READ_ONLY_ACTION_TYPES.has(action.actionType) || readOnlyShellPatterns.some((pattern) => pattern.test(command))) {
    return {
      decision: "allow",
      actionId: action.id,
      policyRule: {
        id: "runtime.allow.read-only",
        description: "Allow recognized read-only inspection and verification actions.",
      },
      riskAssessment: {
        level: "low",
        reasons: ["recognized read-only action"],
      },
    };
  }

  return {
    decision: "requires_approval",
    actionId: action.id,
    policyRule: {
      id: "runtime.approval.unknown",
      description: "Require approval when an action cannot be proven read-only.",
    },
    riskAssessment: {
      level: "medium",
      reasons: ["unrecognized action defaults to human review"],
    },
  };
}
