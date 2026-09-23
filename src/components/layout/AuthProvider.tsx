"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";

// Seeded with the server session so nav/header render immediately (no /api/auth/session
// round-trip on load), and not refetched every time the tab/PWA regains focus.
export function AuthProvider({ session, children }: { session: Session | null; children: React.ReactNode }) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      {children}
    </SessionProvider>
  );
}
