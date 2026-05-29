# AgentSec Suite — Claude Code Context

## Production

- **URL:** https://promptshield-cyan.vercel.app
- **Vercel project:** `prj_gpG22iXf5Jxv0jlmiDH7wmMbqTh4` (team `team_ZhpfIRsiAC6e9byWX1PtUELx`, slug `davids-projects-3d9eb396`)
- **GitHub repo:** https://github.com/code-shame/promptshield (branch `main`)
- Deployments auto-trigger on push to `main`; build completes in ~30s

## Credentials (all in .env.local — do not commit)

- **Thesys C1 API:** Vercel shared secret named `Thesys_shared` — on Production + Preview. Code reads `process.env.Thesys_shared`. NOT `THESYS_API_KEY`.
- Clerk: development instance `relevant-octopus-21.clerk.accounts.dev`
- Vercel CLI token: `security find-generic-password -a "vercel|511b08192b045b3d" -g 2>&1 | grep password` (MCP OAuth token — works for `vercel env ls/add`)
- Jules CLI token: stored under service `jules-cli` in keychain (Google OAuth, auto-refreshed by `jules` CLI)

## Test Account

- Email: `smoketest+clerk_test@promptshield.dev`
- Password: `SmokeTest2026!`
- Clerk user ID: `user_3EErGCexR64Q5Nb6EmilHC0ZSWh`
- OTP for new-device verification: `424242` (Clerk dev test pattern)

## Common Commands

```bash
# Local dev
npm run dev

# Check all 4 gates before pushing
npm test && npm run typecheck && npm run lint && npm run build

# Push Prisma schema changes
DATABASE_URL="..." DIRECT_URL="..." npx prisma db push

# Pull env vars from Vercel
vercel env pull .env.local

# View production logs
vercel logs --limit 20

# Disable/check Vercel deployment protection
curl -X PATCH "https://api.vercel.com/v9/projects/prj_gpG22iXf5Jxv0jlmiDH7wmMbqTh4?teamId=team_ZhpfIRsiAC6e9byWX1PtUELx" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"ssoProtection": null}'
```

## Architecture

| Layer | Detail |
|-------|--------|
| Framework | Next.js 14 App Router, TypeScript, Tailwind |
| Auth | Clerk v5 (`@clerk/nextjs`) — middleware in `src/middleware.ts` |
| DB | Prisma v6 + Neon Postgres (pooled `DATABASE_URL`, direct `DIRECT_URL`) |
| Routes | `src/app/(suite)/` route group — PromptShield `[scanId]`, MCP Guard `[scanId]`, AgentMap `[id]`, ApproveOps `[approvalId]`, Security Copilot |
| C1 API | `POST /api/c1/brief` (briefings), `/api/c1/chat` (streaming copilot), `/api/c1/artifact` (reports), `/api/c1/artifact/[id]/edit` (iterative edit) |
| C1 Lib | `src/lib/c1/` — `client.ts`, `build-brief-context.ts`, `build-artifact-context.ts`, `redaction.ts` |
| Scanner | Deterministic regex rules in `src/lib/prompt-report.ts` |
| Scan API | `POST /api/scan` (Clerk session required) |
| MCP API | `POST /api/mcp` (Bearer `MCP_API_SECRET`) |

## Jules CLI (async coding agent — handles all module dev)

```bash
# Fire a new session (from promptshield repo dir)
jules new --repo code-shame/promptshield "PROMPT"

# Fire multiple parallel sessions
jules new --repo code-shame/promptshield --parallel 3 "PROMPT"

# List sessions
jules remote list --session

# Pull and apply directly
jules remote pull --session ID --apply
# OR manually with conflict resolution:
jules remote pull --session ID > /tmp/s.patch && git apply --3way --whitespace=fix /tmp/s.patch
```

- Always include `gh pr create --base main` in Jules prompts — it won't create PRs otherwise
- Jules cannot access Vercel env vars; handle Vercel/env/deploy tasks from Claude
- **Plan approval is web-only** — `Awaiting Plan Approval` sessions can only be approved at jules.google.com; no CLI command exists
- **`jules new` must be foreground** — running with `run_in_background` produces 0-byte output and silently loses the session ID

## Known Gotchas

- **Thesys env var** is named `Thesys_shared` on Vercel (shared secret) — code uses `process.env.Thesys_shared`, never `THESYS_API_KEY`
- `prisma db push` doesn't load `.env.local` — prefix with inline env vars or use `vercel env pull` first
- Clerk `currentUser()` wrapped in try/catch in `src/app/(suite)/promptshield/page.tsx` to handle RSC prefetch edge case where middleware context is not propagated
- Server actions restricted to `localhost:3000` and `promptshield-cyan.vercel.app` in `next.config.mjs`
- Clerk instance is **development** — shows "Development mode" banner, emails are real but `+clerk_test` addresses use OTP `424242`
