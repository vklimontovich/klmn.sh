import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import TelegramBot from "node-telegram-bot-api";
import { createAiCommander } from "@/lib/server/bots/ai-bot";
import { botCommanderTest, testEnvBotToken } from "@/lib/server/bots/commander";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", {
        status: 401,
      });
    }
    const aiCommander = createAiCommander({ bot: new TelegramBot(testEnvBotToken!, { polling: false }) });
    const tester = botCommanderTest({ commander: aiCommander as any, botToken: testEnvBotToken });

    //const result = await tester.testMessage({ text: "Write me a sample HTML page code" });
    //const result = await tester.testMessage({ text: "Write me an example markdown document that contains as many elements of markdown as possible" });
    //const result = await tester.testMessage({ text: "/new give me a us budget per year from 2018 to 2020 as table with following columns: revenue, expenses, deficit. Fo" });
    const result = await tester.testMessage({ text: "/new" });
    //const result = await tester.testMessage({ text: "What's up?" });
    //const result = await tester.testMessage({ text: "/_debugContext" });
    //const result = await tester.testMessage({ text: "What's up?" });
    return result;
  } catch (e: any) {
    console.log("Request error: " + e?.message || "Unknown error", e);
    return new Response(e?.message || "Unknown error", { status: 500 });
  }
}
