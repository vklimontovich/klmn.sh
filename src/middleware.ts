import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { UAParser } from "ua-parser-js";
import { getLocationForIp } from "@/lib/server/maxmind";

function getClientIp(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

function getOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  const protocol = forwardedProto || "https";
  return `${protocol}://${host}`;
}

async function registerPageView(request: NextRequest, response: NextResponse): Promise<string | null> {
  const ip = getClientIp(request);
  const origin = getOrigin(request);
  const hostname = origin.replace(/^https?:\/\//, "");
  const pageUrl = request.nextUrl.pathname;

  // Get location from MaxMind
  let location = null;
  if (ip) {
    try {
      location = await getLocationForIp(ip);
    } catch (error) {
      console.error("Failed to get location for IP:", ip, error);
    }
  }

  // Skip bot traffic
  if (location?.isBot) {
    return null;
  }

  // Get or create anonymous user ID
  const existingUserId = request.cookies.get("anonymous_user_id")?.value;
  const anonymousUserId = existingUserId || crypto.randomUUID();
  const isSecure = origin.startsWith("https://");

  if (!existingUserId) {
    response.cookies.set("anonymous_user_id", anonymousUserId, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  // Parse user agent
  const userAgentHeader = request.headers.get("user-agent");
  const parser = new UAParser(userAgentHeader || undefined);
  const { ua: _ua, ...userAgent } = JSON.parse(JSON.stringify(parser.getResult()));

  // Collect request headers
  const requestHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    requestHeaders[key] = value;
  });

  const data = {
    eventType: "pageView",
    ip,
    location: location as any,
    pageUrl,
    anonymousUserId,
    hostname,
    params: {} as any,
    userAgentHeader,
    userAgent: userAgent as any,
    requestHeaders: requestHeaders as any,
  };

  console.log(`[analytics:middleware] pageView ${pageUrl} ${ip || "no-ip"}`);
  const event = await prisma.analyticsEvents.create({ data });
  return event.id;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip non-page requests
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".") // static files
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  try {
    const eventId = await registerPageView(request, response);
    if (eventId) {
      response.cookies.set("x-analytics-event-id", eventId, {
        httpOnly: false, // Client needs to read this
        secure: request.nextUrl.protocol === "https:",
        sameSite: "lax",
        maxAge: 60, // Short-lived, just for the PATCH call
        path: "/",
      });
    }
  } catch (error) {
    console.error("Failed to register pageView in middleware:", error);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
