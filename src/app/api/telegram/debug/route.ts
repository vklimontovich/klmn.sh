import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import TelegramBot from "node-telegram-bot-api";
import { handleEmailForwardingMessage } from "@/lib/server/bots/mail-forwarding";

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
    const botInfo = (await prisma.telegramBots.findFirst({ where: { botHandle: "DebuggerForYourBot" } }))!;

    let msg = {
      message_id: 57,
      from: {
        id: 85367,
        is_bot: false,
        first_name: "Vladimir",
        last_name: "Klimontovich",
        username: "v_klmn",
        language_code: "en",
        is_premium: true,
      },
      chat: {
        id: 85367,
        first_name: "Vladimir",
        last_name: "Klimontovich",
        username: "v_klmn",
        type: "private",
      },
      date: 1705094159,
      forward_origin: {
        type: "channel",
        chat: {
          id: -1001118976998,
          title: "Babchenko",
          username: "babchenko77",
          type: "channel",
        },
        message_id: 9040,
        date: 1705094121,
      },
      forward_from_chat: {
        id: -1001118976998,
        title: "Babchenko",
        username: "babchenko77",
        type: "channel",
      },
      forward_from_message_id: 9040,
      forward_date: 1705094121,
      video: {
        duration: 16,
        width: 512,
        height: 560,
        file_name: "IMG_5763.MP4",
        mime_type: "video/mp4",
        thumbnail: {
          file_id: "AAMCAgADGQEAAzlloawPyeD-QhAwLQOSJ8qh2zKeDgACrUAAApY4EEmqOuP6zkJ3ygEAB20AAzQE",
          file_unique_id: "AQADrUAAApY4EEly",
          file_size: 10188,
          width: 293,
          height: 320,
        },
        thumb: {
          file_id: "AAMCAgADGQEAAzlloawPyeD-QhAwLQOSJ8qh2zKeDgACrUAAApY4EEmqOuP6zkJ3ygEAB20AAzQE",
          file_unique_id: "AQADrUAAApY4EEly",
          file_size: 10188,
          width: 293,
          height: 320,
        },
        file_id: "BAACAgIAAxkBAAM5ZaGsD8ng_kIQMC0DkifKodsyng4AAq1AAAKWOBBJqjrj-s5Cd8o0BA",
        file_unique_id: "AgADrUAAApY4EEk",
        file_size: 1439185,
      },
      caption:
        "А вот это прям хорошо. Плешка. Российский ЭКОНОМИЧЕСКИЙ Университет им. Плеханова. Стабильно в ТОП-10. \nВ добрый путь.",
    };
    await handleEmailForwardingMessage({
      msg: msg as any,
      client: new TelegramBot(botInfo.botToken),
      isNewUser: false,
    });
    return Response.json({ ok: true });
  } catch (e: any) {
    console.log("Request error: " + e?.message || "Unknown error", e);
    return new Response(e?.message || "Unknown error", { status: 500 });
  }
}
