export type PromptSeverity = "low" | "medium" | "high" | "critical";

export interface PromptFinding {
  category:
    | "instruction_override"
    | "role_hijacking"
    | "jailbreak"
    | "system_prompt_exfiltration"
    | "data_exfiltration"
    | "tool_misuse";
  title: string;
  severity: PromptSeverity;
  evidence: string;
  remediation: string;
}

export interface PromptScanReport {
  safe: boolean;
  severity: PromptSeverity;
  findings: PromptFinding[];
  remediation: string[];
  summary: string;
}

export interface PromptReportAnalysis {
  summary: string;
  remediation: string[];
  findings: Array<Pick<PromptFinding, "category" | "title" | "severity" | "evidence">>;
}

export interface PromptScanResponse extends PromptScanReport {
  id: string | null;
  timestamp: string;
}

const RULES: Array<{
  category: PromptFinding["category"];
  title: string;
  severity: PromptSeverity;
  patterns: RegExp[];
  remediation: string;
}> = [
  {
    category: "instruction_override",
    title: "Instruction override attempt",
    severity: "high",
    patterns: [
      /ignore ((all|previous|above)\s+){0,2}instructions?/i,
      /disregard ((all|previous|above)\s+){0,2}instructions?/i,
      /forget (everything|your instructions|your system prompt)/i,
    ],
    remediation: "Reject or quarantine prompts that ask the model to ignore or replace trusted instructions.",
  },
  {
    category: "role_hijacking",
    title: "Role hijacking attempt",
    severity: "medium",
    patterns: [/you are now/i, /act as (an? )?(dan|unrestricted|evil|malicious|developer|system)/i],
    remediation: "Keep the model anchored to the server-side system role and strip untrusted role reassignment text.",
  },
  {
    category: "jailbreak",
    title: "Jailbreak marker",
    severity: "high",
    patterns: [/jailbreak/i, /developer mode/i, /do anything now/i, /<\|[^|>]*\|>/],
    remediation: "Reject jailbreak markers and require a human review before forwarding similar prompts to an agent.",
  },
  {
    category: "system_prompt_exfiltration",
    title: "System prompt exfiltration",
    severity: "critical",
    patterns: [/system prompt/i, /\[\[[^\]]*system[^\]]*\]\]/i, /hidden instructions?/i],
    remediation: "Remove requests to reveal system prompts, hidden instructions, policies, or private chain-of-thought.",
  },
  {
    category: "data_exfiltration",
    title: "Data exfiltration request",
    severity: "critical",
    patterns: [
      /\b(?:reveal|show|print|return|send|upload|post|forward|exfiltrate|leak|steal|extract)\b.{0,100}\b(?:secrets?|api keys?|passwords?|access tokens?|credentials?)\b/i,
      /\b(?:secrets?|api keys?|passwords?|access tokens?|credentials?)\b.{0,100}\b(?:send|upload|post|forward|to|via)\b.{0,80}(?:https?:\/\/\S+|webhook)/i,
    ],
    remediation: "Block outbound data transfer instructions and require allowlisted destinations for agent outputs.",
  },
  {
    category: "tool_misuse",
    title: "Unsafe tool-use instruction",
    severity: "high",
    patterns: [/run (a )?(shell|command|script)/i, /delete (all|the|production)/i, /drop table/i],
    remediation: "Route tool-use requests through permission checks and require approval for destructive actions.",
  },
];

const severityRank: Record<PromptSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function highestSeverity(findings: PromptFinding[]): PromptSeverity {
  return findings.reduce<PromptSeverity>(
    (highest, finding) =>
      severityRank[finding.severity] > severityRank[highest] ? finding.severity : highest,
    "low"
  );
}

function excerpt(input: string, pattern: RegExp) {
  const match = input.match(pattern);
  if (!match?.index && match?.index !== 0) return pattern.toString();
  const start = Math.max(0, match.index - 24);
  const end = Math.min(input.length, match.index + match[0].length + 24);
  return input.slice(start, end).trim();
}

export function scanPrompt(input: string): PromptScanReport {
  const findings: PromptFinding[] = [];

  for (const rule of RULES) {
    const matchedPattern = rule.patterns.find((pattern) => pattern.test(input));
    if (!matchedPattern) continue;

    findings.push({
      category: rule.category,
      title: rule.title,
      severity: rule.severity,
      evidence: excerpt(input, matchedPattern),
      remediation: rule.remediation,
    });
  }

  const remediation =
    findings.length === 0
      ? ["No remediation required."]
      : Array.from(new Set(findings.map((finding) => finding.remediation)));
  const severity = highestSeverity(findings);

  return {
    safe: findings.length === 0,
    severity,
    findings,
    remediation,
    summary:
      findings.length === 0
        ? "No prompt-injection indicators were detected."
        : `${findings.length} finding${findings.length === 1 ? "" : "s"} detected. Highest severity: ${severity}.`,
  };
}

export function buildPromptReportAnalysis(report: PromptScanReport): PromptReportAnalysis {
  return {
    summary: report.summary,
    remediation: report.remediation,
    findings: report.findings.map((finding) => ({
      category: finding.category,
      title: finding.title,
      severity: finding.severity,
      evidence: finding.evidence,
    })),
  };
}

export function buildPromptScanResponse(
  report: PromptScanReport,
  id: string | null,
  timestamp: string
): PromptScanResponse {
  return {
    id,
    safe: report.safe,
    severity: report.severity,
    findings: report.findings,
    remediation: report.remediation,
    summary: report.summary,
    timestamp,
  };
}
