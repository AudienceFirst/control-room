import { auth } from "@/auth";
import { NextResponse } from "next/server";

const DASHBOARD_PUBLIC_PREFIX = "/d/";

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  const isAuthenticated = !!req.auth;
  const isAuthPage = pathname.startsWith("/auth");
  const isPublicDashboard = pathname.startsWith(DASHBOARD_PUBLIC_PREFIX);

  if (isPublicDashboard) {
    const res = NextResponse.next();
    const origin = req.nextUrl.origin;
    const frameAncestors = [
      origin,
      "https://app.hubspot.com",
      "https://app-eu1.hubspot.com",
    ]
      .filter(Boolean)
      .join(" ");
    res.headers.set(
      "Content-Security-Policy",
      `frame-ancestors 'self' ${frameAncestors}`
    );
    return res;
  }

  if (!isAuthenticated && !isAuthPage) {
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }

  if (isAuthenticated && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|public).*)"],
};
