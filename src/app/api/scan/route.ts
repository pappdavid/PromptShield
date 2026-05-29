import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { trackSecurityEvent } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { buildPromptReportAnalysis, buildPromptScanResponse, scanPrompt } from "@/lib/prompt-report";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { input?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = body.input;
  if (!input || typeof input !== "string") {
    return NextResponse.json({ error: "Missing 'input' field" }, { status: 400 });
  }

  if (input.length > 10000) {
    return NextResponse.json({ error: "Input too long (max 10000 chars)" }, { status: 400 });
  }

  const report = scanPrompt(input);
  const analysis = buildPromptReportAnalysis(report);
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? `${userId}@clerk.dev`;
  const detectedPatterns = report.findings.map(
    (finding) => `${finding.category}:${finding.title}`
  );

  try {
    const user = await prisma.user.upsert({
      where: { clerkId: userId },
      update: { email },
      create: { clerkId: userId, email },
    });

    const scanLog = await prisma.scanLog.create({
      data: {
        userId: user.id,
        input,
        safe: report.safe,
        detectedPatterns,
        aiAnalysis: JSON.stringify(analysis),
        severity: report.severity,
      },
    });

    if (!report.safe) {
      trackSecurityEvent({
        type: "prompt_injection_detected",
        userId: user.id,
        severity: report.severity,
        details: { scanLogId: scanLog.id, findings: report.findings },
      });
    }

    return NextResponse.json(
      buildPromptScanResponse(report, scanLog.id, scanLog.createdAt.toISOString())
    );
  } catch (error) {
    console.error("Failed to persist prompt scan", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to save scan report" }, { status: 500 });
  }
}
