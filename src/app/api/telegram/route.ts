import { NextRequest } from "next/server";
import { log } from "@/app/api/text-message/accept/route";

export async function POST(request: NextRequest) {
  const headersMap = Object.fromEntries([...request.headers.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  const bodyText = await request.text();
  let bodyJson;
  try {
    bodyJson = JSON.parse(bodyText);
  } catch (e) {
    bodyJson = { bodyText };
  }
  await log("incoming-http:telegram", {
    body: bodyJson,
    headers: headersMap,
    method: request.method,
    url: request.url,
    query: Object.fromEntries(
      [...new URL(request.url).searchParams.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    ),
  });
  return Response.json({ message: "ok" });
}
