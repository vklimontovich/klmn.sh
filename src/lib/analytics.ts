import { prisma } from "@/lib/server/prisma";
import { NextRequest, NextResponse } from "next/server";
import { UAParser } from "ua-parser-js";
import { getLocationForIp } from "@/lib/server/maxmind";
import { ClientSideContext, ClientSideContextSchema } from "@/lib/analytics-types";

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

  async registerEvent(
    eventName: string,
    opts: {
      params?: Record<string, any>;
      clientSideContext?: ClientSideContext | null;
      eventId?: string;
    } = {}
  ) {
    const { params = {}, clientSideContext, eventId } = opts;
    const ip = getClientIp(this.request);
    const origin = getOrigin(this.request);
    const hostname = origin.replace(/^https?:\/\//, "");
    const isSecure = origin.startsWith("https://");

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
      console.log("Skipping bot traffic from IP:", ip);
      return null;
    }

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

    // Collect all request headers
    const requestHeaders: Record<string, string> = {};
    this.request.headers.forEach((value, key) => {
      requestHeaders[key] = value;
    });

    // Validate client side context if provided
    let validatedCsc: ClientSideContext | null = null;
    if (clientSideContext) {
      try {
        validatedCsc = ClientSideContextSchema.parse(clientSideContext);
      } catch (error) {
        console.warn("Invalid client side context, ignoring:", error);
      }
    }

    const id = eventId || crypto.randomUUID();
    const data = {
      id,
      eventType: eventName,
      ip,
      location: location as any,
      pageUrl: params.pageUrl || null,
      anonymousUserId,
      hostname,
      params: (({ pageUrl: _, ...rest }) => rest)(params) as any,
      userAgentHeader,
      userAgent: (({ ua: _, ...rest }) => rest)(userAgent) as any,
      requestHeaders: requestHeaders as any,
      clientSideContext: validatedCsc as any,
    };
    console.log(`[analytics] ${eventName} ${params.pageUrl || hostname} ${ip || "no-ip"}`);
    await prisma.analyticsEvents.create({ data });
    return id;
  }

  static async patchClientSideContext(id: string, clientSideContext: ClientSideContext): Promise<boolean> {
    let validatedCsc: ClientSideContext | null = null;
    try {
      validatedCsc = ClientSideContextSchema.parse(clientSideContext);
    } catch (error) {
      console.warn("Invalid client side context, ignoring:", error);
      return false;
    }

    await prisma.analyticsEvents.update({
      where: { id },
      data: { clientSideContext: validatedCsc as any },
    });
    return true;
  }
}
