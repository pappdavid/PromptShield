import type { Metadata } from "next";
import { ClerkProvider, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "PromptShield — Deterministic Prompt Injection Scanner",
  description: "Protect your AI agents, LLM applications, and database inputs from prompt injection attacks with deterministic severity reports.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-background antialiased">
          <div className="relative flex min-h-screen flex-col">
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-8">
                  <Link href="/" className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent hover:opacity-90 transition-opacity">
                    PromptShield
                  </Link>
                  <nav className="flex items-center gap-6">
                    <SignedIn>
                      <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                        Dashboard
                      </Link>
                    </SignedIn>
                    <Link href="/developers" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                      Developers
                    </Link>
                  </nav>
                </div>
                <div className="flex items-center gap-4">
                  <SignedIn>
                    <UserButton afterSignOutUrl="/" />
                  </SignedIn>
                  <SignedOut>
                    <Link href="/sign-in" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
                      Sign In
                    </Link>
                  </SignedOut>
                </div>
              </div>
            </header>
            <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
