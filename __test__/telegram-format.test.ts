import { expect, test } from "bun:test";
import { testEnvBotToken, testEnvChatId } from "@/lib/server/bots/commander";
import TelegramBot from "node-telegram-bot-api";
import { markdownToTelegram, telegramJsonToHtml } from "@/lib/server/telegram/format";
import fs from "fs";
import path from "path";

function getTestCase(name: string): string {
  return fs.readFileSync(path.join(__dirname, `./resources/telegram-format/${name}`), "utf-8");
}

async function testMarkdown(strings: string[] | string, bot: TelegramBot) {
  const markdown = typeof strings === "string" ? strings : strings.join("");
  const text = markdownToTelegram(markdown);
  const opts = { parse_mode: text.parse_mode, entities: text.entities || {} };
  try {
    await bot.sendMessage(parseInt(testEnvChatId!), text.text, { ...opts, disable_web_page_preview: true });
  } catch (e: any) {
    console.error(`Error sending message: ${e?.message}. Msg: ${JSON.stringify({ text: text, opts }, null, 2)}`, e);
  }
}

test("markdown-to-telegram", async () => {
  if (!testEnvBotToken || !testEnvChatId) {
    console.log(`Skipping test, no env`);
    return;
  }
  const bot = new TelegramBot(testEnvBotToken, { polling: false });
  //const bold = markdownToTelegram(getTestCase("bold.md"));
  //console.log(bold);
  await testMarkdown(getTestCase("case2.md"), bot);
});

test("telegram-to-html", () => {
  const msg1 = {
    text: "Test > boldLink > test",
    entities: [
      {
        offset: 7,
        length: 8,
        type: "text_link",
        url: "https://google.com/",
      },
      {
        offset: 7,
        length: 8,
        type: "bold",
      },
      {
        offset: 18,
        length: 4,
        type: "italic",
      },
    ],
  } as any;

  const html1 = telegramJsonToHtml(msg1);
  expect(html1).toBe('Test &gt; <b><a href="https://google.com/">boldLink</a></b> &gt; <i>test</i>');
  console.log("Message has been formatted as HTML: ", html1);

  const msg2 = {
    text: "&d test",
    entities: [
      {
        offset: 1,
        length: 1,
        type: "bold",
      },
      {
        offset: 1,
        length: 1,
        type: "italic",
      },
      {
        offset: 3,
        length: 4,
        type: "code",
      },
    ],
  } as any;

  const html2 = telegramJsonToHtml(msg2);
  expect(html2).toBe('"&amp;<b><i>d</i></b> <pre><code>test</code></pre>');
  console.log("Message has been formatted as HTML: ", html2);
});
