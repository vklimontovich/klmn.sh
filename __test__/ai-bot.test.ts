import { test } from "bun:test";
import { botCommanderTest, testEnvBotToken } from "@/lib/server/bots/commander";
import { createAiCommander } from "@/lib/server/bots/ai-bot";

test("test AI Bot", async () => {

  console.log(`testEnvBotToken: ${process.env.TEST_BOT_TOKEN}`)

  if (!testEnvBotToken) {
    console.log(`Skipping test message, no bot token provided`);
    return {};
  }
  const aiCommander = createAiCommander({ bot: testEnvBotToken });
  const tester = botCommanderTest({ commander: aiCommander as any, botToken: testEnvBotToken });

  // console.log(await tester.testMessage({ text: "/help" }));
  //
  // console.log(await tester.testMessage({ text: "/start" }));

  console.log(await tester.testMessage({ text: "Write me an example markdown document that contains as many elements of markdown as possible" }));
});
