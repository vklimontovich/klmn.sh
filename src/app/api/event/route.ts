import { NextRequest, NextResponse } from "next/server";
import { Analytics, patchClientSideContext } from "@/lib/analytics";

function checkInternalAuth(request: NextRequest): boolean {
  const token = process.env.INTERNAL_CALLS_TOKEN;
  if (!token) return true; // No token configured = no auth required
  const headerToken = request.headers.get("x-internal-token");
  return headerToken === token;
}

async function handleEvent(request: NextRequest) {
  // Check internal auth for middleware calls
  if (!checkInternalAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type");

  if (!type) {
    return NextResponse.json({ error: "Event type is required" }, { status: 400 });
  }

  const paramsString = searchParams.get("params");
  const params = paramsString ? JSON.parse(paramsString) : {};

  // Get event ID from header if provided
  const eventId = request.headers.get("x-event-id") || undefined;

  // Parse client side context
  const cscString = searchParams.get("csc");
  let clientSideContext = null;
  if (cscString) {
    try {
      clientSideContext = JSON.parse(cscString);
    } catch (error) {
      console.warn("Failed to parse client side context:", error);
    }
  }

  const response = NextResponse.json({ success: true });
  const analytics = new Analytics(request, response);

  const id = await analytics.registerEvent(type, { params, clientSideContext, eventId });

  return NextResponse.json({ success: true, id }, { headers: response.headers });
}

export async function GET(request: NextRequest) {
  try {
    return await handleEvent(request);
  } catch (error) {
    console.error("Failed to register event:", error);
    return NextResponse.json({ error: "Failed to register event" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handleEvent(request);
  } catch (error) {
    console.error("Failed to register event:", error);
    return NextResponse.json({ error: "Failed to register event" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, clientSideContext } = body;

    if (!id) {
      return NextResponse.json({ error: "Event id is required" }, { status: 400 });
    }

    if (!clientSideContext) {
      return NextResponse.json({ error: "clientSideContext is required" }, { status: 400 });
    }

    const success = await patchClientSideContext(id, clientSideContext);
    return NextResponse.json({ success });
  } catch (error) {
    console.error("Failed to patch event:", error);
    return NextResponse.json({ error: "Failed to patch event" }, { status: 500 });
  }
}
