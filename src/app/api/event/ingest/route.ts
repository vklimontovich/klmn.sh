import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/server/prisma";
import { UAParser } from "ua-parser-js";
import { omit } from "lodash";
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

export async function POST(request: NextRequest) {
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

    const data = {
      timestamp,
      eventType: payload.eventType,
      ip,
      location: location as any,
      pageUrl: payload.pageUrl || null,
      anonymousUserId: payload.anonId || null,
      hostname: payload.hostname || null,
      params: payload.params ? (omit(payload.params, "pageUrl") as any) : null,
      userAgentHeader: payload.userAgentString || null,
      userAgent: omit(userAgent, "ua") as any,
      requestHeaders: requestHeaders as any,
      userId: payload.userId || null,
      userTraits: payload.userTraits as any || null,
      clientSideContext: payload.clientSideContext as any || null,
    };

    await prisma.analyticsEvents.create({
      data,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: error.issues }, { status: 400 });
    }
    console.error("Failed to ingest event:", error);
    return NextResponse.json({ error: "Failed to ingest event" }, { status: 500 });
  }
}
