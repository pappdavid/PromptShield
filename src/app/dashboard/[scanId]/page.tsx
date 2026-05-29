import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import type { PromptReportAnalysis, PromptSeverity } from "@/lib/prompt-report";

export const dynamic = "force-dynamic";

function parseAnalysis(value: string | null): PromptReportAnalysis | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as PromptReportAnalysis;
  } catch {
    return null;
  }
}

function severityClass(severity: string) {
  switch (severity as PromptSeverity) {
    case "critical":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "high":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    case "medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    default:
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  }
}

export default async function PromptShieldScanPage({ params }: { params: { scanId: string } }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  if (!user) {
    redirect("/sign-in");
  }

  const scan = await prisma.scanLog.findUnique({
    where: { id: params.scanId, userId: user.id },
  });

  if (!scan) {
    notFound();
  }

  const analysis = parseAnalysis(scan.aiAnalysis);
  const patterns = scan.detectedPatterns || [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-4"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2 h-4 w-4"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Scan {scan.id.substring(0, 8)}</h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${severityClass(
              scan.severity
            )}`}
          >
            {scan.safe ? "Safe" : scan.severity}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date(scan.createdAt).toLocaleString()}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="rounded-lg border p-4 bg-card shadow-sm">
            <h2 className="font-semibold mb-3 text-lg">Input Prompt</h2>
            <pre className="p-4 bg-muted rounded-md overflow-auto text-sm whitespace-pre-wrap font-mono max-h-[500px]">
              {scan.input}
            </pre>
          </div>

          {!scan.safe && patterns.length > 0 && (
            <div className="rounded-lg border p-4 bg-card shadow-sm">
              <h2 className="font-semibold mb-3 text-lg">Detected Patterns</h2>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {patterns.map((pattern: string, i: number) => (
                  <li key={i}>{pattern}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {analysis && (
            <div className="rounded-lg border p-4 bg-card shadow-sm">
              <h2 className="font-semibold mb-3 text-lg">Remediation Report</h2>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium text-muted-foreground">Summary</h4>
                  <p className="mt-1 text-foreground font-medium">{analysis.summary}</p>
                </div>
                {analysis.findings && analysis.findings.length > 0 && (
                  <div>
                    <h4 className="font-medium text-muted-foreground mb-2">Findings</h4>
                    <div className="space-y-2">
                      {analysis.findings.map((finding, i: number) => (
                        <div key={i} className="rounded-md border p-3 bg-muted/30">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground">{finding.title}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${severityClass(finding.severity)}`}>
                              {finding.severity}
                            </span>
                          </div>
                          {finding.evidence && (
                            <p className="mt-2 text-xs font-mono bg-muted p-2 rounded overflow-auto whitespace-pre-wrap">
                              {finding.evidence}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.remediation && analysis.remediation.length > 0 && (
                  <div>
                    <h4 className="font-medium text-muted-foreground">Remediation Steps</h4>
                    <ul className="mt-2 list-disc list-inside space-y-1 text-muted-foreground">
                      {analysis.remediation.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
