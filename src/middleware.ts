import { NextRequest, NextResponse } from "next/server";
import { Analytics } from "@/lib/analytics";

export async function middleware(request: NextRequest) {
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

  // Set cookie immediately (non-blocking)
  response.cookies.set("x-analytics-event-id", eventId, {
    httpOnly: false,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    maxAge: 60,
    path: "/",
  });

  // Fire and forget - don't await
  const analytics = new Analytics(request, response);
  analytics.registerEvent("pageView", { params: { pageUrl: pathname }, eventId }).catch((error) => {
    console.error("Failed to register pageView:", error);
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
