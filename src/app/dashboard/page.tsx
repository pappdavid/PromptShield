import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import type { PromptReportAnalysis, PromptSeverity } from "@/lib/prompt-report";
import { ScanForm } from "./scan-form";

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

export default async function PromptShieldPage() {
  let user;
  try {
    user = await currentUser();
  } catch {
    redirect("/sign-in");
  }
  if (!user) redirect("/sign-in");

  const email = user.emailAddresses[0]?.emailAddress ?? `${user.id}@clerk.dev`;
  let dashboardError: string | null = null;
  let recentScans: Array<{
    id: string;
    input: string;
    safe: boolean;
    severity: string;
    aiAnalysis: string | null;
    createdAt: Date;
  }> = [];
  let stats = {
    totalScans: 0,
    threatsBlocked: 0,
  };

  try {
    const dbUser = await prisma.user.upsert({
      where: { clerkId: user.id },
      update: { email },
      create: {
        clerkId: user.id,
        email,
      },
    });

    const [scans, totalScans, threatsBlocked] = await Promise.all([
      prisma.scanLog.findMany({
        where: { userId: dbUser.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.scanLog.count({ where: { userId: dbUser.id } }),
      prisma.scanLog.count({ where: { userId: dbUser.id, safe: false } }),
    ]);

    recentScans = scans;
    stats = { totalScans, threatsBlocked };
  } catch (error) {
    console.error("Failed to load dashboard scan history", error);
    dashboardError = "Scan history is unavailable. New scans may also fail until the database is reachable.";
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Security Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Scan prompt inputs and review threat logs</p>
        </div>
      </div>

      <div className="w-full space-y-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border p-5 bg-card">
            <p className="text-sm font-medium text-muted-foreground">Total Scans</p>
            <p className="text-3xl font-bold tracking-tight mt-1">{stats.totalScans}</p>
          </div>
          <div className="rounded-xl border p-5 bg-card">
            <p className="text-sm font-medium text-muted-foreground">Threats Blocked</p>
            <p className="text-3xl font-bold tracking-tight mt-1 text-destructive">{stats.threatsBlocked}</p>
          </div>
          <div className="rounded-xl border p-5 bg-card">
            <p className="text-sm font-medium text-muted-foreground">Safe Rate</p>
            <p className="text-3xl font-bold tracking-tight mt-1 text-green-500">
              {stats.totalScans > 0
                ? `${Math.round(((stats.totalScans - stats.threatsBlocked) / stats.totalScans) * 100)}%`
                : "-"}
            </p>
          </div>
        </div>

        {dashboardError && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {dashboardError}
          </div>
        )}

        <section className="bg-card rounded-xl border p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span>🛡️</span> Scan a New Prompt
          </h2>
          <ScanForm />
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span>📋</span> Recent Scan History
          </h2>
          {recentScans.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground bg-muted/10">
              No scans yet. Run a prompt scan above to build your remediation history.
            </div>
          ) : (
            <div className="space-y-3">
              {recentScans.map((scan) => {
                const analysis = parseAnalysis(scan.aiAnalysis);

                return (
                  <Link
                    key={scan.id}
                    href={`/dashboard/${scan.id}`}
                    className="block rounded-xl border p-4 bg-card hover:bg-muted/30 transition-all shadow-sm hover:shadow"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold font-mono text-foreground bg-muted/50 inline-block px-2 py-0.5 rounded mb-2 max-w-full">
                          {scan.input.substring(0, 80)}...
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {analysis?.summary ??
                            (scan.safe
                              ? "No prompt-injection indicators were detected."
                              : "Injection indicators detected.")}
                        </p>
                      </div>
                      <span
                        className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${severityClass(
                          scan.severity
                        )}`}
                      >
                        {scan.safe ? "Safe" : scan.severity}
                      </span>
                    </div>
                    {analysis?.remediation && analysis.remediation.length > 0 && (
                      <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5 border-t pt-2 mt-2">
                        <span className="font-semibold text-foreground">Remediation:</span> 
                        <span className="truncate">{analysis.remediation[0]}</span>
                      </p>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-3 flex items-center justify-between border-t pt-2 border-dashed">
                      <span>ID: {scan.id}</span>
                      <span>{new Date(scan.createdAt).toLocaleString()}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
