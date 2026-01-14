import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { getLocationForIp } from "@/lib/server/maxmind";

// Prisma Json fields can be either DbNull (SQL NULL) or JsonNull (JSON "null" literal).
// We need to check both when looking for empty location values.
const LOCATION_IS_NULL = {
  OR: [
    { location: { equals: Prisma.DbNull } },
    { location: { equals: Prisma.JsonNull } },
  ],
};

const BATCH_SIZE = 1000;

export async function POST(request: NextRequest) {
  try {
    const events = await prisma.analyticsEvents.findMany({
      where: {
        ...LOCATION_IS_NULL,
        ip: { not: null },
      },
      orderBy: { timestamp: "desc" },
      take: BATCH_SIZE,
      select: {
        id: true,
        ip: true,
      },
    });

    if (events.length === 0) {
      return NextResponse.json({ message: "No events to reprocess", processed: 0 });
    }

    let processed = 0;

    for (const event of events) {
      if (!event.ip) continue;

      const location = await getLocationForIp(event.ip);

      if (location) {
        await prisma.analyticsEvents.update({
          where: { id: event.id },
          data: { location: location as any },
        });
        processed++;
      }
    }

    const remaining = await prisma.analyticsEvents.count({
      where: {
        ...LOCATION_IS_NULL,
        ip: { not: null },
      },
    });

    return NextResponse.json({
      message: "Reprocessing complete",
      processed,
      remaining,
    });
  } catch (error) {
    console.error("Failed to reprocess events:", error);
    return NextResponse.json({ error: "Failed to reprocess events" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // GET returns stats only
  try {
    const nullLocationCount = await prisma.analyticsEvents.count({
      where: {
        ...LOCATION_IS_NULL,
        ip: { not: null },
      },
    });

    return NextResponse.json({
      pendingReprocess: nullLocationCount,
    });
  } catch (error) {
    console.error("Failed to get reprocess stats:", error);
    return NextResponse.json({ error: "Failed to get stats" }, { status: 500 });
  }
}
