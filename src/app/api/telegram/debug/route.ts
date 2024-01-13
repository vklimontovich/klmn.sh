import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import TelegramBot from "node-telegram-bot-api";
import { handleEmailForwardingMessage } from "@/lib/server/bots/mail-forwarding";
import { handleAiReq } from "@/lib/server/bots/ai";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", {
        status: 401,
      });
    }
    // const botInfo = (await prisma.telegramBots.findFirst({ where: { botHandle: "DebuggerForYourBot" } }))!;
    // await new TelegramBot(botInfo.botToken).sendMessage(
    //   85367,
    //
    //   welcomeMessage({ userName: "Vladimir" }),
    //   { parse_mode: "HTML" }
    // );
    const botInfo = (await prisma.telegramBots.findFirst({ where: { botHandle: "AiAttendantBot" } }))!;

    let msg = {
      "message_id": 95,
      "from": {
        "id": 85367,
        "is_bot": false,
        "first_name": "Vladimir",
        "last_name": "Klimontovich",
        "username": "v_klmn",
        "language_code": "en",
        "is_premium": true
      },
      "chat": {
        "id": 85367,
        "first_name": "Vladimir",
        "last_name": "Klimontovich",
        "username": "v_klmn",
        "type": "private"
      },
      "date": 1705102505,
      "text": "Hey, tell me about yourself, how are you trained? Be as elaborate as possibe"
    };
    await handleAiReq({
      msg: msg as any,
      client: new TelegramBot(botInfo.botToken),
      isNewUser: false,
      botToken: botInfo.botToken,
      appHost: "http://localhost:6401",
      botHandle: botInfo.botHandle!,
    });
    return Response.json({ ok: true });
  } catch (e: any) {
    console.log("Request error: " + e?.message || "Unknown error", e);
    return new Response(e?.message || "Unknown error", { status: 500 });
  }
}
