import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhook(.*)",
  "/api/mcp(.*)",
  "/developers(.*)",
  "/demo(.*)",
  "/api/runtime/inspect(.*)",
  "/api/runtime/actions(.*)",
  "/api/policy(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth().protect({ unauthenticatedUrl: `${new URL(request.url).origin}/sign-in` });
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
