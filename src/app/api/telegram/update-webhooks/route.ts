import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import TelegramBot from "node-telegram-bot-api";
import assert from "node:assert";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", {
        status: 401,
      });
    }
    let host = request.nextUrl.searchParams.get("host");
    assert(host, "host is required");
    if (!host.startsWith("http")) {
      host = `https://${host}`;
    }
    while (host.endsWith("/")) {
      host = host.substring(0, host.length - 1);
    }
    const allBots = await prisma.telegramBots.findMany();
    const result = [];
    for (const bot of allBots) {

      const url = `${host}/api/telegram?bot=${bot.botHandle}&secret=${bot.webhookSecret}`;
      try {
        const updateResult = await new TelegramBot(bot.botToken).setWebHook(
          url,
        );
        result.push({
          url,
          success: updateResult,
        });
      } catch (e: any) {
        console.log(`Error updating webhook for ${bot.botHandle}`, e);
        result.push({
          url,
          error: e?.message || "Unknown error",
        });
      }
    }
    return Response.json(result);
  } catch (e: any) {
    console.log("Request error", e);
    return new Response(e?.message || "Unknown error", { status: 500 });
  }

}

