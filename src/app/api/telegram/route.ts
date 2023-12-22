import { NextRequest } from "next/server";
import { log } from "@/app/api/text-message/accept/route";
import { prisma } from "@/lib/server/prisma";
import { telegramClient } from "@/lib/server/telegram";

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

  if (
    process.env.TELEGRAM_WEBHOOK_SECRET &&
    process.env.TELEGRAM_WEBHOOK_SECRET !== request.nextUrl.searchParams.get("secret")
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const chatId = bodyJson.message?.chat.id + "";
  const existingEntry = await prisma.telegramContacts.findFirst({ where: { chatId } });

  if (!existingEntry) {
    const userId = bodyJson.message?.from?.id + "";

    await prisma.telegramContacts.create({
      data: {
        chatId: chatId,
        userId: userId,
        userName: bodyJson.message?.from?.username,
      },
    });

    if (telegramClient) {
      console.log("Sending welcome message to", chatId);
      await telegramClient.sendMessage(chatId, "Welcome! This bot will be sending you forwarded SMS messages", {
        parse_mode: "HTML",
      });
    }
  } else {
    if (telegramClient) {
      console.log("Sending message to", chatId);
      await telegramClient.sendMessage(
        chatId,
        "I'm not a real bot, I can't understand your messages. I'm here just to forward SMS messages to you",
        { parse_mode: "HTML" }
      );
    }
  }

  return Response.json({ message: "ok" });
}
