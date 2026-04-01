import { NextRequest } from "next/server";
import TelegramBot from "node-telegram-bot-api";
import { createAiCommander } from "@/lib/server/bots/ai-bot";
import { botCommanderTest, testEnvBotToken } from "@/lib/server/bots/commander";
import { Stripe } from "stripe";
import { billing } from "@/lib/server/billing";
import assert from "node:assert";

async function getCheckoutSessionByClientReferenceId(
  clientReferenceId: string
): Promise<Stripe.Checkout.Session | undefined> {
  assert(billing);
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const sessions = await billing.checkout.sessions.list({
      limit: 100,
      starting_after: startingAfter,
    });

    const foundSession = sessions.data.find(
      (session: Stripe.Checkout.Session) => session.client_reference_id === clientReferenceId
    );

    if (foundSession) {
      return foundSession;
    }

    if (sessions.has_more) {
      startingAfter = sessions.data[sessions.data.length - 1].id;
    } else {
      hasMore = false;
    }
  }

  return undefined;
}

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

    //const result2 = await tester.testMessage({ text: "/model claude-2.1" });
    //const result = await tester.testMessage({ text: "/new What model are are you and what's your cut-off knowledge date" });
    //const result = await tester.testMessage({ text: "Write me an example markdown document that contains as many elements of markdown as possible" });
    //const result = await tester.testMessage({ text: "/new give me a us budget per year from 2018 to 2020 as table with following columns: revenue, expenses, deficit. Fo" });
    //const result = await tester.testMessage({ text: "What's up?" });
    //const result = await tester.testMessage({ text: "/_debugContext" });
    //const result = await tester.testMessage({ text: "What's up?" });
    const result = await tester.testMessage({ text: "/topup 5000" });
    return result;
  } catch (e: any) {
    console.log("Request error: " + e?.message || "Unknown error", e);
    return new Response(e?.message || "Unknown error", { status: 500 });
  }
}
