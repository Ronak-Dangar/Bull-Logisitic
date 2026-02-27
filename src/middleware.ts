import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = (req.auth?.user as any)?.role;

  // Public routes
  const publicRoutes = ["/login"];
  if (publicRoutes.includes(nextUrl.pathname)) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
    return NextResponse.next();
  }

  // Redirect to login if not authenticated
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Admin-only routes
  if (nextUrl.pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  // Dashboard only for ADMIN and LM
  if (nextUrl.pathname === "/dashboard" && role === "CM") {
    return NextResponse.redirect(new URL("/pickups", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|logo.png|manifest.json|icons|sw.js).*)"],
};
