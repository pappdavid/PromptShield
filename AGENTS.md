# PromptShield — Agent Instructions

## Repo overview

This is **PromptShield**, a SaaS product generated from the `saas-core` factory.

- Preset: `agentsec-mvp`
- Modules: auth.clerk, db.postgres.prisma, ai.core, ai.output-wrapper, security.analytics, security.prompt-injection, mcp.rest
- Factory manifest: `.saas-core/product-manifest.json`

## Key patterns

- Auth is handled by Clerk (`@clerk/nextjs`). Use `currentUser()` or `auth()` in server components.
- Database is Prisma + Supabase. Schema lives in `prisma/schema.prisma`.
- AI actions live in `src/lib/ai.ts`. Extend the `runAiAction()` function for product logic.
- All API routes are in `src/app/api/`.
- Dashboard pages live in `src/app/(dashboard)/`.

## Do not

- Do not modify the `saas-core` repository — changes here stay in this repo only.
- Do not add env keys without documenting them in `.env.example`.
- Do not bypass Clerk auth in server components or API routes.
- Do not merge without passing `npm run typecheck` and `npm run lint`.

## PR requirements

- Describe which modules were extended
- Include `npm run typecheck` and `npm run lint` output in the PR body
- Call out any new env vars added

---

## Workteam Orchestration Protocol

Claude Code is the **orchestrator**. All feature implementation delegated externally.

| Role | Agent | Handles |
|------|-------|---------|
| Orchestrator | Claude Code | Task design, review, merge decisions |
| Remote PRs | Jules (Gemini) | GitHub issue-to-PR, UI pages, docs |
| Local logic | GitHub Copilot CLI (claude-sonnet-4.6) | Pure logic, API routes, tests |

**Rules:**
- No native Claude Code subagents. Delegation via `jules new` or `copilot -p` only.
- Every task has bounded file scope. Do not modify files outside your assigned task scope.
- C1 (Thesys) is optional everywhere — deterministic fallback must work without it.
- See `.agentsec/TASK_BOARD.md` for wave plan and `.agentsec/FIRST_WAVE_STATUS.md` for status.
