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
    const botInfo = (await prisma.telegramBots.findFirst({ where: { botHandle: "MailForwardingBot" } }))!;

    let msg = {
      message_id: 85,
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
      date: 1705098140,
      document: {
        file_name: "Green_Card_letter-tony_costanoavc.com.pdf",
        mime_type: "application/pdf",
        thumbnail: {
          file_id: "AAMCAgADGQEAA1VlobucrUnzm7_enJgmnFQSPahTEQAC-DwAArtNEEk1u_QRfNdAgAEAB20AAzQE",
          file_unique_id: "AQAD-DwAArtNEEly",
          file_size: 20681,
          width: 247,
          height: 320,
        },
        thumb: {
          file_id: "AAMCAgADGQEAA1VlobucrUnzm7_enJgmnFQSPahTEQAC-DwAArtNEEk1u_QRfNdAgAEAB20AAzQE",
          file_unique_id: "AQAD-DwAArtNEEly",
          file_size: 20681,
          width: 247,
          height: 320,
        },
        file_id: "BQACAgIAAxkBAANVZaG7nK1J85u_3pyYJpxUEj2oUxEAAvg8AAK7TRBJNbv0EXzXQIA0BA",
        file_unique_id: "AgAD-DwAArtNEEk",
        file_size: 436940,
      },
      caption: "BlaBlaBla",
    };
    await handleEmailForwardingMessage({
      msg: msg as any,
      client: new TelegramBot(botInfo.botToken),
      isNewUser: false,
      botToken: botInfo.botToken,
      appHost: "http://localhost:6401",
      botHandle: "MailForwardingBot",
    });
    return Response.json({ ok: true });
  } catch (e: any) {
    console.log("Request error: " + e?.message || "Unknown error", e);
    return new Response(e?.message || "Unknown error", { status: 500 });
  }
}
