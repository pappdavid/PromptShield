import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { inspectRuntimeAction, type RuntimeAction } from "@/lib/runtime-inspection";

const HookPayloadSchema = z.object({
  id: z.string().min(1).optional(),
  agentId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  action: z.object({
    type: z.string().min(1),
    tool: z.string().optional(),
    command: z.string().optional(),
    cwd: z.string().optional(),
  }),
});

const LegacyPayloadSchema = z.object({
  id: z.string().min(1).optional(),
  agentId: z.string().min(1),
  agentName: z.string().optional(),
  sessionId: z.string().optional(),
  actionType: z.string().min(1),
  description: z.string().optional(),
  context: z.record(z.unknown()).optional(),
  timestamp: z.string().optional(),
});

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function authorized(request: NextRequest) {
  const expectedSecret = process.env.AGENTSEC_API_SECRET ?? process.env.MCP_API_SECRET;
  if (!expectedSecret) return false;

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  return secureEqual(authorization.slice("Bearer ".length), expectedSecret);
}

function normalizePayload(body: unknown): RuntimeAction | null {
  const hookPayload = HookPayloadSchema.safeParse(body);
  if (hookPayload.success) {
    return {
      id: hookPayload.data.id ?? randomUUID(),
      agentId: hookPayload.data.agentId,
      sessionId: hookPayload.data.sessionId,
      actionType: hookPayload.data.action.type,
      tool: hookPayload.data.action.tool,
      command: hookPayload.data.action.command,
      cwd: hookPayload.data.action.cwd,
    };
  }

  const legacyPayload = LegacyPayloadSchema.safeParse(body);
  if (legacyPayload.success) {
    return {
      id: legacyPayload.data.id ?? randomUUID(),
      agentId: legacyPayload.data.agentId,
      sessionId: legacyPayload.data.sessionId,
      actionType: legacyPayload.data.actionType,
      description: legacyPayload.data.description,
      context: legacyPayload.data.context,
    };
  }

  return null;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = normalizePayload(body);
  if (!action) {
    return NextResponse.json(
      {
        error: "Invalid runtime inspection payload",
        acceptedShapes: ["AgentSec hook payload", "legacy flat payload"],
      },
      { status: 422 }
    );
  }

  return NextResponse.json(inspectRuntimeAction(action));
}

export async function GET() {
  return NextResponse.json({
    product: "promptshield",
    endpoint: "runtime-inspection",
    decisions: ["allow", "requires_approval", "block"],
    persistence: false,
    note: "requires_approval is a stateless decision; the calling client owns the approval interaction.",
  });
}
