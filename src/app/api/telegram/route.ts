import { NextRequest } from "next/server";
import { log } from "@/app/api/text-message/accept/route";
import { prisma } from "@/lib/server/prisma";
import TelegramBot, { Message } from "node-telegram-bot-api";
import { allBots } from "@/lib/server/bots";

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
  let botHandle = request.nextUrl.searchParams.get("bot") || "phone1_929_264_5065_bot";
  if (botHandle.startsWith("@")) {
    botHandle = botHandle.substring(1);
  }

  const bot = await prisma.telegramBots.findFirst({ where: { botHandle } });

  if (!bot) {
    return new Response(`Bot ${botHandle} not found`, { status: 404 });
  }

  if (bot.webhookSecret !== request.nextUrl.searchParams.get("secret")) {
    return new Response(`Unauthorized. Invalid secret ${request.nextUrl.searchParams.get("secret")}`, { status: 401 });
  }

  const message = bodyJson.message as Message;

  const chatId = message.chat.id + "";
  const existingEntry = await prisma.telegramContacts.findFirst({ where: { chatId } });

  if (!existingEntry) {
    const userId = message.from?.id + "";

    await prisma.telegramContacts.create({
      data: {
        chatId: chatId,
        userId: userId,
        userName: message.from?.username,
        botHandle,
      },
    });
  }
  try {
    await allBots[botHandle].handleUpdate({
      msg: message,
      client: new TelegramBot(bot.botToken),
      isNewUser: !existingEntry,
    });
  } catch (e: any) {
    console.log(`Error handling update for ${bot.botHandle}`, e);
    return new Response(e?.message || "Unknown error", { status: 500 });
  }

  return Response.json({ message: "ok" });
}
