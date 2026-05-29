"use client";

import { useState } from "react";
import type { PromptFinding, PromptSeverity } from "@/lib/prompt-report";

interface ScanResult {
  id: string;
  safe: boolean;
  severity: PromptSeverity;
  findings: PromptFinding[];
  remediation: string[];
  summary: string;
  timestamp: string;
}

function severityClass(severity: PromptSeverity) {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-800 ring-red-200";
    case "high":
      return "bg-orange-100 text-orange-800 ring-orange-200";
    case "medium":
      return "bg-yellow-100 text-yellow-800 ring-yellow-200";
    default:
      return "bg-green-100 text-green-800 ring-green-200";
  }
}

export function ScanForm() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) {
      setError("Paste a prompt before scanning.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Scan failed");
        return;
      }

      const data: ScanResult = await res.json();
      setResult(data);
    } catch {
      setError("Network error while scanning the prompt.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleScan} className="space-y-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a prompt to scan for injection attacks..."
          className="min-h-36 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          rows={6}
          maxLength={10000}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{input.length}/10000 characters</p>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? "Scanning..." : "Scan Prompt"}
          </button>
        </div>
      </form>

      {loading && (
        <div className="mt-4 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          Scanning prompt and preparing remediation report...
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && !result && (
        <div className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No scan report yet. Paste a prompt and run a scan to see findings, severity, and remediation.
        </div>
      )}

      {result && (
        <div
          className={`mt-4 rounded-lg border p-4 text-sm ${
            result.safe ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium">{result.safe ? "Prompt is safe" : "Injection detected"}</p>
              <p className="mt-1 text-muted-foreground">{result.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Scan ID {result.id} - {new Date(result.timestamp).toLocaleString()}
              </p>
            </div>
            <span
              className={`w-fit rounded-full px-2 py-1 text-xs font-medium capitalize ring-1 ${severityClass(
                result.severity
              )}`}
            >
              {result.severity}
            </span>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <p className="font-medium">Findings</p>
              {result.findings.length === 0 ? (
                <p className="mt-1 text-muted-foreground">No prompt-injection findings detected.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {result.findings.map((finding, i) => (
                    <div key={`${finding.category}-${i}`} className="rounded-md border bg-background/70 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="font-medium">{finding.title}</p>
                        <span
                          className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ${severityClass(
                            finding.severity
                          )}`}
                        >
                          {finding.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-xs uppercase text-muted-foreground">{finding.category.replaceAll("_", " ")}</p>
                      <p className="mt-2 break-words text-muted-foreground">{finding.evidence}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="font-medium">Remediation</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                {result.remediation.map((step, i) => (
                  <li key={`${step}-${i}`}>{step}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
