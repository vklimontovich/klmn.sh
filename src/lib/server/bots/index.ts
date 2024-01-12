import TelegramBot, { Message } from "node-telegram-bot-api";
import { telegramClient } from "@/lib/server/telegram";
import { handleEmailForwardingMessage } from "@/lib/server/bots/mail-forwarding";

export type MessageHandler = (opts: { msg: Message; client: TelegramBot; isNewUser: boolean }) => Promise<void>;
export type TelegramBotHandler = {
  handleMessage: MessageHandler;
};

export const allBots: Record<string, TelegramBotHandler> = {
  phone1_929_264_5065_bot: {
    handleMessage: async ({ msg, client, isNewUser }) => {
      if (isNewUser) {
        await client.sendMessage(msg.chat.id, "Welcome! This bot will be sending you forwarded SMS messages", {
          parse_mode: "HTML",
        });
      } else {
        await client.sendMessage(
          msg.chat.id,
          "I'm not a real bot, I can't understand your messages. I'm here just to forward SMS messages to you",
          { parse_mode: "HTML" }
        );
      }
    },
  },
  MailForwardingBot: {
    handleMessage: handleEmailForwardingMessage,
  },
  DebuggerForYourBot: {
    handleMessage: async ({ msg, client }) => {
      await client.sendMessage(msg.chat.id, `<pre>${JSON.stringify(msg, null, 2)}</pre>`, {
        parse_mode: "HTML",
      });
    },
  },
};
