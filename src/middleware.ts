import { NextRequest, NextResponse, NextFetchEvent } from "next/server";
import { createPageViewCall } from "@/lib/internal-api-call";

function getOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  const protocol = forwardedProto || "https";
  return `${protocol}://${host}`;
}

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  // Skip non-page requests
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const eventId = crypto.randomUUID();
  const origin = getOrigin(request);

  // Set header for server components to read
  response.headers.set("x-analytics-event-id", eventId);

  // Fire and forget with waitUntil
  event.waitUntil(createPageViewCall(origin, pathname, eventId)());

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
