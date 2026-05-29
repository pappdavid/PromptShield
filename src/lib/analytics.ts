import { prisma } from "./db";

export type SecurityEventType =
  | "prompt_injection_detected"
  | "mcp_scan_completed"
  | "agent_risk_assessed"
  | "auth_failure";

export interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  severity: "low" | "medium" | "high" | "critical";
  details: Record<string, unknown>;
  timestamp: string;
}

export function trackSecurityEvent(event: Omit<SecurityEvent, "timestamp">): void {
  const full: SecurityEvent = { ...event, timestamp: new Date().toISOString() };

  if (process.env.NODE_ENV !== "production") {
    console.log("[security-analytics]", JSON.stringify(full));
  }
}

export async function getRecentEvents(userId: string, limit = 20) {
  const logs = await prisma.scanLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return logs.map((log) => ({
    id: log.id,
    type: log.safe ? "scan_passed" : "prompt_injection_detected",
    severity: log.severity,
    input: log.input.substring(0, 100),
    safe: log.safe,
    detectedPatterns: log.detectedPatterns,
    timestamp: log.createdAt.toISOString(),
  }));
}
