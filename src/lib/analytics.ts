import { prisma } from "@/lib/server/prisma";
import { NextRequest, NextResponse } from "next/server";
import { omit } from "lodash";
import { UAParser } from "ua-parser-js";

function serializeToJson<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function getClientIp(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

function getLocation(request: NextRequest): any {
  const city = request.headers.get("x-vercel-ip-city")|| undefined;
  const country = request.headers.get("x-vercel-ip-country")|| undefined;
  const region = request.headers.get("x-vercel-ip-country-region")|| undefined;
  const latitude = request.headers.get("x-vercel-ip-latitude") || undefined;
  const longitude = request.headers.get("x-vercel-ip-longitude") || undefined;

  return {
    city,
    country,
    region,
    latitude,
    longitude,
  };
}

function getPortForProtocol(protocol: string, port: string): string | null {
  const portNum = parseInt(port, 10);
  if ((protocol === "https" && portNum === 443) || (protocol === "http" && portNum === 80)) {
    return null;
  }
  return port;
}

function getOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedPort = request.headers.get("x-forwarded-port");

  const protocol = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = forwardedHost || request.headers.get("host");

  // If there's a forwarded port, include it, otherwise the host may already include the port
  const port = forwardedPort && !host?.includes(":") ? getPortForProtocol(protocol, forwardedPort) : null;
  const portSuffix = port ? `:${port}` : "";

  return `${protocol}://${host}${portSuffix}`;
}

export class Analytics {
  private request: NextRequest;
  private response: NextResponse;

  constructor(request: NextRequest, response: NextResponse) {
    this.request = request;
    this.response = response;
  }

  async registerEvent(eventName: string, params: Record<string, any> = {}) {
    const ip = getClientIp(this.request);
    const location = getLocation(this.request);
    const origin = getOrigin(this.request);
    const hostname = origin.replace(/^https?:\/\//, "");
    const isSecure = origin.startsWith("https://");

    // Get or generate anonymous user ID
    const existingUserId = this.request.cookies.get("anonymous_user_id")?.value;
    const anonymousUserId = existingUserId || crypto.randomUUID();
    const isNewUser = !existingUserId;

    // Set cookie if new user
    if (isNewUser) {
      this.response.cookies.set("anonymous_user_id", anonymousUserId, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    }

    // Parse user agent
    const userAgentHeader = this.request.headers.get("user-agent");
    const parser = new UAParser(userAgentHeader || undefined);
    const userAgentResult = parser.getResult();

    // Remove functions from userAgent object
    const userAgent = serializeToJson(userAgentResult);

    const data = {
      eventType: eventName,
      ip,
      location: location as any,
      pageUrl: params.pageUrl || null,
      anonymousUserId,
      hostname,
      params: omit(params, "pageUrl") as any,
      userAgentHeader,
      userAgent: omit(userAgent, "ua") as any,
    };
    console.log("Saving event", data);
    await prisma.analyticsEvents.create({
      data: data,
    });
  }
}
