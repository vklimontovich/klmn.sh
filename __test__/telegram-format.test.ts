import { test } from "bun:test";
import { testEnvBotToken, testEnvChatId } from "@/lib/server/bots/commander";
import TelegramBot from "node-telegram-bot-api";
import { markdownToTelegram } from "@/lib/server/telegram/format";
import fs from "fs";
import path from "path";


function getTestCase(name: string): string {
  return  fs.readFileSync(path.join(__dirname, `./resources/telegram-format/${name}`), 'utf-8');
}

async function testMarkdown(strings: string[] | string, bot: TelegramBot) {
  const markdown = typeof strings === "string" ? strings : strings.join("");
  const text = markdownToTelegram(markdown);
  const opts = { parse_mode: text.parse_mode, entities: text.entities || {} };
  try {
    await bot.sendMessage(parseInt(testEnvChatId!), text.text, {...opts, disable_web_page_preview: true});
  } catch (e: any) {
    console.error(`Error sending message: ${e?.message}. Msg: ${JSON.stringify({text: text, opts}, null, 2)}`, e);
  }

}

test("telegram-format", async () => {
  if (!testEnvBotToken || !testEnvChatId) {
    console.log(`Skipping test, no env`);
    return;
  }
  const bot = new TelegramBot(testEnvBotToken, { polling: false });
  //const bold = markdownToTelegram(getTestCase("bold.md"));
  //console.log(bold);
  await testMarkdown(getTestCase("case2.md"), bot);
});
