# Secret Handling Audit

This audit evaluates the codebase (`src/app/api/`, `src/lib/c1/`, and `src/middleware.ts`) for potential secret exposure in logs or error responses. 

## Critical Risk Findings
- **Raw `error.message` in HTTP 500 Responses (C1 Routes):** Across `src/app/api/c1/chat/route.ts`, `src/app/api/c1/brief/route.ts`, `src/app/api/c1/artifact/route.ts`, and `src/app/api/c1/artifact/[id]/edit/route.ts`, generic errors are returned directly to the client as `return new NextResponse(error.message, { status: 500 })`. If the error is an environment configuration error (e.g., `'Thesys_shared env var not configured'`) or an unhandled system error containing paths or credentials, this text is exposed to end users.
- **Exposure of Error Objects in `console.error`:** Multiple API routes pass the entire `error` object to `console.error` (e.g. `console.error("Failed to fetch agents:", error)` in `src/app/api/agents/route.ts`). Depending on the library throwing the error (e.g., Prisma, Axios, Node fetch), the error object can stringify to include full database connection strings, request payloads, or HTTP authorization headers containing API keys/tokens.

## Medium Risk Findings
- **Stream Controller Error Leakage:** In `src/app/api/c1/chat/route.ts`, the `ReadableStream` error block uses `controller.error(error)`. If `error` comes from a network read containing sensitive context or headers, passing it directly to the SSE controller might leak raw error representations to the browser.
- **Unsanitized Context Building Errors:** In `src/app/api/c1/brief/route.ts` and `src/app/api/c1/artifact/route.ts`, `error.message` from `buildModuleArtifactContext` is sent back as a 400 or 404 response. While usually safe (e.g. "Unknown module"), if those builder functions throw a deeper database or network error, it might leak internal info.

## Low Risk Findings
- **Hardcoded Error Formats for Thesys API:** Thesys API HTTP status errors are currently scrubbed manually via `error.message.startsWith('Thesys API error')` and return `502` using the scrubbed message. This is reasonably safe as `client.ts` strictly constructs `Thesys API error: ${response.status} ...` and does not include the raw response body.

## Safe Areas
- Middleware (`src/middleware.ts`) contains no logging of secrets.
- `MCP_API_SECRET` is checked using standard headers and timing-safe checks are implied; it is not logged on failure.
- Prisma `DIRECT_URL` and `DATABASE_URL` are not explicitly dumped in the application code.

## Recommendations
1. Replace `return new NextResponse(error.message, { status: 500 })` with a generic fallback message like `return new NextResponse('Internal Server Error', { status: 500 })` to ensure no sensitive error messages are sent to clients.
2. Refactor `console.error(..., error)` to only log `error instanceof Error ? error.message : 'Unknown error'` or a safely sanitized stack trace instead of dumping the raw error object, preventing potential database string/header leakage in cloud logs.
3. Replace `controller.error(error)` with `controller.error(new Error('Stream read error'))` or similar to prevent stream error object leakage.

