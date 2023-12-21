import { prisma } from "@/lib/server/prisma";

export async function POST(request: Request) {
  const headersMap = Object.fromEntries(request.headers.entries());
  const bodyText = await request.text();
  let bodyJson;
  try {
    bodyJson = JSON.parse(bodyText);
  } catch (e) {
    bodyJson = { bodyText };
  }
  await prisma.log.create({
    data: {
      namespace: "twillio-webhook",
      body: {
        body: bodyJson,
        headers: headersMap,
        method: request.method,
        url: request.url,
        query: Object.fromEntries(new URL(request.url).searchParams.entries()),
      },
    },
  })
  return Response.json({ok: true});
}
