import { describe, it, expect } from 'vitest';
import { createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';

// Mirror the exact public route list from src/middleware.ts
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhook(.*)',
  '/api/mcp(.*)',
  '/developers(.*)',
  '/demo(.*)',
  '/api/runtime/inspect(.*)',
  '/api/runtime/actions(.*)',
]);

function req(path: string) {
  return new NextRequest(`http://localhost:3000${path}`);
}

describe('public routes', () => {
  it('/ is public', () => expect(isPublicRoute(req('/'))).toBe(true));
  it('/sign-in is public', () => expect(isPublicRoute(req('/sign-in'))).toBe(true));
  it('/sign-in/sso-callback is public', () => expect(isPublicRoute(req('/sign-in/sso-callback'))).toBe(true));
  it('/sign-up is public', () => expect(isPublicRoute(req('/sign-up'))).toBe(true));
  it('/demo is public', () => expect(isPublicRoute(req('/demo'))).toBe(true));
  it('/developers is public', () => expect(isPublicRoute(req('/developers'))).toBe(true));
  it('/api/runtime/inspect is public', () => expect(isPublicRoute(req('/api/runtime/inspect'))).toBe(true));
  it('/api/runtime/actions/abc123 is public', () => expect(isPublicRoute(req('/api/runtime/actions/abc123'))).toBe(true));
  it('/api/webhook/clerk is public', () => expect(isPublicRoute(req('/api/webhook/clerk'))).toBe(true));
  it('/api/mcp/anything is public', () => expect(isPublicRoute(req('/api/mcp/anything'))).toBe(true));
});

describe('protected routes', () => {
  it('/observability is protected', () => expect(isPublicRoute(req('/observability'))).toBe(false));
  it('/approveops is protected', () => expect(isPublicRoute(req('/approveops'))).toBe(false));
  it('/promptshield is protected', () => expect(isPublicRoute(req('/promptshield'))).toBe(false));
  it('/mcpguard is protected', () => expect(isPublicRoute(req('/mcpguard'))).toBe(false));
  it('/agentmap is protected', () => expect(isPublicRoute(req('/agentmap'))).toBe(false));
});
