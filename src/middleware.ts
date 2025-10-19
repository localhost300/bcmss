import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
  normalizeRole,
  roleDashboardRoutes,
  routeAccessMap,
} from "./lib/settings";
import { NextResponse } from "next/server";

const matchers = Object.keys(routeAccessMap).map((route) => ({
  matcher: createRouteMatcher([route]),
  allowedRoles: routeAccessMap[route],
}));

export default clerkMiddleware((auth, req) => {
  const { sessionClaims } = auth();

  const rawRole =
    (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role ??
    (sessionClaims?.metadata as { role?: string } | undefined)?.role ??
    (sessionClaims as { role?: string } | undefined)?.role;

  const role = normalizeRole(rawRole);

  if (!role) {
    return NextResponse.next();
  }

  const destination = roleDashboardRoutes[role];

  if (req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL(destination, req.url));
  }

  for (const { matcher, allowedRoles } of matchers) {
    if (matcher(req) && !allowedRoles.includes(role)) {
      return NextResponse.redirect(new URL(destination, req.url));
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
