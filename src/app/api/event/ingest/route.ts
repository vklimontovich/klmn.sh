import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/server/prisma";
import { UAParser } from "ua-parser-js";
import { getLocationForIp } from "@/lib/server/maxmind";
import { ClientSideContextSchema } from "@/lib/analytics-types";

const UserTraitsSchema = z.object({
  email: z.string().optional(),
});

const IngestPayloadSchema = z.object({
  time: z.string().optional(),
  ip: z.string().optional(),
  eventType: z.string(),
  pageUrl: z.string().optional(),
  anonId: z.string().optional(),
  hostname: z.string().optional(),
  params: z.record(z.string(), z.any()).optional(),
  userAgentString: z.string().optional(),
  requestHeaders: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
  userId: z.string().optional(),
  userTraits: UserTraitsSchema.optional(),
  clientSideContext: ClientSideContextSchema.optional(),
});

export async function GET() {
  return NextResponse.json(z.toJSONSchema(IngestPayloadSchema));
}

function checkAuth(request: NextRequest): boolean {
  const keys = (process.env.ANALYTICS_KEYS || "").split(";").filter(Boolean);
  if (keys.length === 0) return true; // No keys configured = no auth required
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  return keys.includes(token);
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = IngestPayloadSchema.parse(body);

    // Parse request headers if it's a string
    let requestHeaders: Record<string, string> = {};
    if (typeof payload.requestHeaders === "string") {
      try {
        requestHeaders = JSON.parse(payload.requestHeaders);
      } catch {
        // Ignore parsing error
      }
    } else if (payload.requestHeaders) {
      requestHeaders = payload.requestHeaders;
    }

    // Parse user agent
    const parser = new UAParser(payload.userAgentString || undefined);
    const userAgentResult = parser.getResult();
    const userAgent = JSON.parse(JSON.stringify(userAgentResult));

    // Normalize IP
    const ip = payload.ip === "unknown" ? null : payload.ip || null;

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
      return NextResponse.json({ success: true, skipped: "bot" });
    }

    // Parse timestamp
    let timestamp: Date | undefined;
    if (payload.time) {
      try {
        timestamp = new Date(payload.time);
        if (isNaN(timestamp.getTime())) {
          timestamp = undefined;
        }
      } catch {
        timestamp = undefined;
      }
    }

    // Get event ID from header or generate new one
    const eventId = request.headers.get("x-event-id") || crypto.randomUUID();

    // Remove pageUrl from params if present
    const { pageUrl: _pageUrl, ...paramsWithoutPageUrl } = payload.params || {};
    // Remove ua from userAgent
    const { ua: _ua, ...userAgentWithoutUa } = userAgent;

    const data = {
      id: eventId,
      timestamp,
      eventType: payload.eventType,
      ip,
      location: location as any,
      pageUrl: payload.pageUrl || null,
      anonymousUserId: payload.anonId || null,
      hostname: payload.hostname || null,
      params: Object.keys(paramsWithoutPageUrl).length > 0 ? (paramsWithoutPageUrl as any) : null,
      userAgentHeader: payload.userAgentString || null,
      userAgent: userAgentWithoutUa as any,
      requestHeaders: requestHeaders as any,
      userId: payload.userId || null,
      userTraits: payload.userTraits as any || null,
      clientSideContext: payload.clientSideContext as any || null,
    };

    await prisma.analyticsEvents.create({ data });

    return NextResponse.json({ success: true, id: eventId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: error.issues }, { status: 400 });
    }
    console.error("Failed to ingest event:", error);
    return NextResponse.json({ error: "Failed to ingest event" }, { status: 500 });
  }
}

const PatchPayloadSchema = z.object({
  id: z.string(),
  clientSideContext: ClientSideContextSchema,
});

export async function PATCH(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = PatchPayloadSchema.parse(body);

    await prisma.analyticsEvents.update({
      where: { id: payload.id },
      data: { clientSideContext: payload.clientSideContext as any },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: error.issues }, { status: 400 });
    }
    console.error("Failed to patch event:", error);
    return NextResponse.json({ error: "Failed to patch event" }, { status: 500 });
  }
}
