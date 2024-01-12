import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import TelegramBot from "node-telegram-bot-api";

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    if (!code) {
      return new Response("Code is required", { status: 400 });
    }
    const setup = await prisma.emailForwarding.findFirst({ where: { confirmationCode: code } });
    if (!setup) {
      return new Response("Invalid code", { status: 404 });
    } else {
      await prisma.emailForwarding.update({
        where: { id: setup.id },
        data: { confirmed: new Date() },
      });

      await prisma.emailForwarding.deleteMany({
        where: {
          forwardTo: setup.forwardTo,
          NOT: {
            id: setup.id,
          },
        },
      });

      //const botHandle = "DebuggerForYourBot";
      const botHandle = "MailForwardingBot";
      const botInfo = (await prisma.telegramBots.findFirst({ where: { botHandle } }))!;

      const bot = new TelegramBot(botInfo.botToken);
      await bot.sendMessage(
        setup.telegramUserId,
        `Email <b>${setup.forwardTo}</b> is confirmed, you can forward messages to me now`,
        {
          parse_mode: "HTML",
        }
      );
      return new Response("Email is confirmed, you can close this page", { status: 200 });
    }
  } catch (e: any) {
    console.log("Request error", e);
    return new Response(e?.message || "Unknown error", { status: 500 });
  }
}
