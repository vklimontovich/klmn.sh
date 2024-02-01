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
  const msg4 = {
    text: 'Here is a formula you can use in Google Sheets to calculate the USD to RUB exchange rate for a given date:\n\n```\n=GOOGLEFINANCE("CURRENCY:USDRUB", "price", DATE(year, month, day))\n```\n\nWhere:\n\n- `YEAR` is the 4-digit year for the date you want the exchange rate for \n- `MONTH` is the month number (1-12)\n- `DAY` is the day of the month\n\nFor example, to get the USD to RUB exchange rate for January 1st, 2023, you would use:\n\n```\n=GOOGLEFINANCE("CURRENCY:USDRUB", "price", DATE(2023, 1, 1))\n```\n\nThis fetches the historical exchange rate for that currency pair on that exact date from Google Finance.\n\nYou can then use that returned exchange rate in further calculations to convert USD values to RUB.\n\nSo it allows you to lookup historical exchange rates directly in Google Sheets using the GOOGLEFINANCE function.',
  };
  const markdown = markdownToTelegram(msg4.text);
  console.log(markdown);
  await testMarkdown(msg4.text, bot);
});

test("telegram-to-html", () => {
  const msg1 = {
    text: "Test > boldLink > test test2",
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
  expect(html1).toBe('Test &gt; <b><a href="https://google.com/">boldLink</a></b> &gt; <i>test</i> test2');
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
  expect(html2).toBe('&amp;<b><i>d</i></b> <pre><code>test</code></pre>');
  console.log("Message has been formatted as HTML: ", html2);

  const msg3 = {
    text: "@callmeshura test test test",
    entities: [
      {
        offset: 0,
        length: 12,
        type: "mention",
      },
    ],
  } as any;
  const html3 = telegramJsonToHtml(msg3);
  console.log("Message has been formatted as HTML: ", html3);
  expect(html3).toBe('@callmeshura test test test');

  const msg4 = {
    "text": "Most modern browsers use the Happy Eyeballs algorithm; they try all addresses at once and stick with the one which replies fastest. This is implemented entirely within the app and cannot be influenced by the OS. (Note that the algorithm is sometimes tweaked to give a head start to IPv6 or IPv4 in case they both give similar results.)\n\nOlder browsers and many other programs try all addresses one by one, sorted according to a default address selection algorithm, which usually prefers native IPv6 over native IPv4 over automatic v6 tunnels. This ordering is usually implemented in the OS (e.g. gai.conf), and programs don't sort addresses manually.\nhttps://superuser.com/questions/1199129/how-web-browser-determines-when-to-use-ipv4-or-ipv6-to-connect-to-the-destinatio",
    "entities": [
      {
        "offset": 651,
        "length": 120,
        "type": "url"
      }
    ],
    "link_preview_options": {
      "url": "https://superuser.com/questions/1199129/how-web-browser-determines-when-to-use-ipv4-or-ipv6-to-connect-to-the-destinatio"
    }
  } as any;

  const html4 = telegramJsonToHtml(msg4);
  console.log("Message has been formatted as HTML: ", html4);


});
