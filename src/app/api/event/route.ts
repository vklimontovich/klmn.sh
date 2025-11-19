import { NextRequest, NextResponse } from "next/server";
import { Analytics } from "@/lib/analytics";

async function handleEvent(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type");

  if (!type) {
    return NextResponse.json({ error: "Event type is required" }, { status: 400 });
  }

  const paramsString = searchParams.get("params");
  const params = paramsString ? JSON.parse(paramsString) : {};

  const response = NextResponse.json({ success: true });
  const analytics = new Analytics(request, response);

  await analytics.registerEvent(type, params);

  return response;
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
