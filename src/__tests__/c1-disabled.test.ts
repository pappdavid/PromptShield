import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST as InspectPOST } from '@/app/api/runtime/inspect/route';
import { POST as BriefPOST } from '@/app/api/c1/brief/route';

// Mock Clerk
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn().mockResolvedValue({ userId: 'test-user-id' }),
  currentUser: vi.fn().mockResolvedValue({
    emailAddresses: [{ emailAddress: 'test@example.com' }],
  }),
}));

// Mock C1 Context Builders so we hit the actual client error instead of DB error
vi.mock('@/lib/c1/build-brief-context', () => ({
  buildPromptShieldBriefContext: vi.fn().mockResolvedValue('test context'),
  buildMcpGuardBriefContext: vi.fn().mockResolvedValue('test context'),
  buildAgentMapBriefContext: vi.fn().mockResolvedValue('test context'),
  buildApproveOpsBriefContext: vi.fn().mockResolvedValue('test context'),
  buildSuiteBriefContext: vi.fn().mockResolvedValue('test context'),
}));

// Mock DB
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      upsert: vi.fn().mockResolvedValue({ id: 'test-user-id', clerkId: 'test-user-id' }),
    },
    $transaction: vi.fn().mockImplementation(async (callback) => {
      const tx = {
        approvalRequest: {
          create: vi.fn().mockResolvedValue({ id: 'test-approval-id' }),
        },
        approvalAuditEvent: {
          create: vi.fn().mockResolvedValue({ id: 'test-event-id' }),
        },
      };
      return await callback(tx);
    }),
    generatedBrief: {
      findFirst: vi.fn().mockResolvedValue(null),
    }
  },
}));

function makeRequest(url: string, body: unknown, customHeaders?: Record<string, string>): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...customHeaders },
    body: JSON.stringify(body),
  });
}

const baseActionBody = {
  id: 'action-123',
  agentId: 'agent-456',
  agentName: 'TestAgent',
  actionType: 'filesystem_read',
  description: 'Reading a file',
  context: {},
  timestamp: '2026-01-01T00:00:00.000Z',
};

describe('C1-Disabled Regression Tests', () => {
  beforeEach(() => {
    vi.stubEnv('AGENTSEC_API_KEY', 'test-key');
    vi.stubEnv('Thesys_shared', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('runtime inspect works without Thesys_shared', async () => {
    // We intentionally stub Thesys_shared to be missing.
    vi.stubEnv('Thesys_shared', '');
    
    const res = await InspectPOST(makeRequest('http://localhost/api/runtime/inspect', baseActionBody, { 'Authorization': 'Bearer test-key' }));
    
    expect(res.status).toBe(200);
    const data = await res.json();
    
    // Check that it returns expected decision + policyRule + riskAssessment
    expect(data.decision).toBe('allow');
    expect(data.policyRule).toBe('allow');
    expect(data.actionId).toBe('action-123');
    expect(data.riskAssessment).toBeDefined();
    expect(data.riskAssessment.level).toBeDefined();
    expect(data.riskAssessment.score).toBeDefined();
  });

  it('runtime inspect requires_approval works without Thesys_shared', async () => {
    // We intentionally stub Thesys_shared to be missing.
    vi.stubEnv('Thesys_shared', '');
    
    const res = await InspectPOST(makeRequest('http://localhost/api/runtime/inspect', { ...baseActionBody, actionType: 'production_deploy' }, { 'Authorization': 'Bearer test-key' }));
    
    expect(res.status).toBe(200);
    const data = await res.json();
    
    // Check that it returns expected decision + policyRule
    expect(data.decision).toBe('requires_approval');
    expect(data.policyRule).toBe('requires_approval_production_deploy');
    expect(data.actionId).toBe('action-123');
    expect(data.approvalUrl).toBeDefined();
  });

  it('C1 brief fails gracefully without Thesys_shared', async () => {
    // Ensure Thesys_shared is absent
    vi.stubEnv('Thesys_shared', '');
    
    const res = await BriefPOST(makeRequest('http://localhost/api/c1/brief', { module: 'approveops', sourceId: '123' }));
    
    // The handler catches the missing env var error and returns 500 "Internal Server Error"
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toBe('Internal Server Error');
  });
});
