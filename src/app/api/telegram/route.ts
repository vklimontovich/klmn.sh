import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import TelegramBot, { Message } from "node-telegram-bot-api";
import { allBots } from "@/lib/server/bots";
import { log } from "@/lib/server/log";

export const maxDuration = 120;

function getHost(request: NextRequest) {
  let host: string;
  if (request.headers.get("x-forwarded-host")) {
    host = request.headers.get("x-forwarded-host")!;
  } else if (request.headers.get("host")) {
    host = request.headers.get("host")!;
  } else {
    host = request.nextUrl.host;
  }
  if (!host.startsWith("http")) {
    host = `https://${host}`;
  }
  return host;
}

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

  const message = (bodyJson.message || bodyJson.edited_message) as Message | undefined;

  if (!message) {
    //not handling messages like user joined, etc
    return Response.json({ message: "ok" });
  }

  const chatId = message.chat.id + "";
  const existingEntry = await prisma.telegramContacts.findFirst({ where: { chatId, botHandle } });
  await prisma.telegramMessages.create({
    data: {
      messageId: message.message_id + "",
      telegramUserId: chatId,
      botId: bot.id,
      botHandle,
      payload: message as any,
      mediaGroupId: message.media_group_id,
    },
  });

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
  const client = new TelegramBot(bot.botToken);
  try {
    const response = await allBots[botHandle].handleMessage({
      msg: message,
      client: client,
      isNewUser: !existingEntry,
      botToken: bot.botToken,
      appHost: getHost(request),
      botHandle,
    });
    if (response) {
      return response;
    } else {
      return Response.json({ message: "ok" });
    }
  } catch (e: any) {
    console.log(`Error handling update for ${bot.botHandle}`, e);
    await client.sendMessage(
      chatId,
      `Internal error <code>'${e?.message || "unknown error"}'</code>. Bot: ${botHandle}. Message: ${JSON.stringify(message, null, 2)} Please try again later or contact @v_klmn`
    );
    return new Response(e?.message || "Unknown error", { status: 500 });
  }
}
