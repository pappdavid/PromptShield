import { NextRequest, NextResponse } from "next/server";
import { trackSecurityEvent } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import {
  buildPromptReportAnalysis,
  buildPromptScanResponse,
  scanPrompt,
  type PromptScanReport,
  type PromptScanResponse,
} from "@/lib/prompt-report";

function verifyMcpSecret(request: NextRequest): boolean {
  const secret = process.env.MCP_API_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

interface McpRequest {
  tool: string;
  params?: Record<string, unknown>;
}

function detectedPatterns(report: PromptScanReport) {
  return report.findings.map((finding) => `${finding.category}:${finding.title}`);
}

async function persistScanIfUserResolved(
  userId: unknown,
  input: string,
  report: PromptScanReport
): Promise<{ id: string | null; timestamp: string }> {
  if (!userId || typeof userId !== "string") {
    return { id: null, timestamp: new Date().toISOString() };
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: userId }, { clerkId: userId }],
    },
  });

  if (!user) {
    return { id: null, timestamp: new Date().toISOString() };
  }

  const scanLog = await prisma.scanLog.create({
    data: {
      userId: user.id,
      input,
      safe: report.safe,
      detectedPatterns: detectedPatterns(report),
      aiAnalysis: JSON.stringify(buildPromptReportAnalysis(report)),
      severity: report.severity,
    },
  });

  return { id: scanLog.id, timestamp: scanLog.createdAt.toISOString() };
}

async function buildMcpReport(
  input: string,
  userId: unknown
): Promise<PromptScanResponse> {
  const report = scanPrompt(input);
  const persisted = await persistScanIfUserResolved(userId, input, report);
  return buildPromptScanResponse(report, persisted.id, persisted.timestamp);
}

function riskScore(report: PromptScanReport) {
  if (report.safe) return 0;
  const severityScore = {
    low: 10,
    medium: 40,
    high: 70,
    critical: 100,
  } satisfies Record<PromptScanReport["severity"], number>;

  return severityScore[report.severity];
}

export async function POST(request: NextRequest) {
  if (!verifyMcpSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: McpRequest;
  try {
    body = (await request.json()) as McpRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.tool || typeof body.tool !== "string") {
    return NextResponse.json({ error: "Missing 'tool' field" }, { status: 400 });
  }

  const input = body.params?.input;
  if (!input || typeof input !== "string") {
    return NextResponse.json({ error: "Missing 'params.input'" }, { status: 400 });
  }

  if (input.length > 10000) {
    return NextResponse.json({ error: "Input too long (max 10000 chars)" }, { status: 400 });
  }

  switch (body.tool) {
    case "scan_prompt": {
      const result = await buildMcpReport(input, body.params?.userId);

      if (!result.safe) {
        trackSecurityEvent({
          type: "mcp_scan_completed",
          severity: result.severity,
          details: { scanLogId: result.id, findings: result.findings, source: "mcp" },
        });
      }

      return NextResponse.json({ result });
    }

    case "assess_risk": {
      const result = await buildMcpReport(input, body.params?.userId);

      trackSecurityEvent({
        type: "agent_risk_assessed",
        severity: result.severity,
        details: { scanLogId: result.id, riskScore: riskScore(result), findings: result.findings },
      });

      return NextResponse.json({
        result: {
          ...result,
          riskScore: riskScore(result),
        },
      });
    }

    default:
      return NextResponse.json({ error: `Unknown tool: ${body.tool}` }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    product: "promptshield",
    mcp: true,
    tools: [
      {
        name: "scan_prompt",
        description: "Scan a prompt and return a severity-ranked remediation report",
        parameters: {
          input: { type: "string", description: "The prompt text to scan" },
          userId: {
            type: "string",
            description: "Optional Clerk or database user id for persisted scan history",
          },
        },
      },
      {
        name: "assess_risk",
        description: "Assess prompt risk and return the same remediation report plus riskScore",
        parameters: {
          input: { type: "string", description: "The prompt text to assess" },
          userId: {
            type: "string",
            description: "Optional Clerk or database user id for persisted scan history",
          },
        },
      },
    ],
  });
}
