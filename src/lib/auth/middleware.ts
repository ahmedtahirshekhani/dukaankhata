import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware to protect admin routes
 * Redirects unauthenticated users to login
 */
export async function authMiddleware(request: NextRequest) {
  const session = await auth();
  const pathname = request.nextUrl.pathname;

  // List of protected routes that require authentication
  const protectedRoutes = ["/admin", "/dashboard"];
  
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.includes(route)
  );

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/signup", "/forgot-password", "/reset-password", "/auth/error"];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.includes(route)
  );

  // If route is protected and user is not authenticated
  if (isProtectedRoute && !session?.user) {
    const locale = pathname.split("/")[1] || "en";
    const url = new URL(`/${locale}/login`, request.nextUrl);
    return NextResponse.redirect(url);
  }

  // If user is authenticated and trying to access login/signup, redirect to dashboard
  if (isPublicRoute && session?.user) {
    const locale = pathname.split("/")[1] || "en";
    const url = new URL(`/${locale}/admin`, request.nextUrl);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const authMiddlewareConfig = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
