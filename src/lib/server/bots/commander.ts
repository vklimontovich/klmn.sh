import TelegramBot, { Message } from "node-telegram-bot-api";
import { Simplify } from "type-fest";

export type CommandFunctionArgs<M> = {
  args: string[];
  msg: M;
};

export type CommandFunctionResponse = Response | undefined | any;

export type CommandFunction<M> = (opts: CommandFunctionArgs<M>) => Promise<CommandFunctionResponse>;

export type BotCommander<C extends string = string, M = any> = {
  $default: CommandFunction<M>;
  $descriptions?: Record<C, string>;
} & {
  [key in C]: CommandFunction<M>;
};

export type CommandDispatcher<M> = {
  dispatch: (message: M) => Promise<CommandFunctionResponse>;
};

export type RequiredTelegramCommands = "start";

async function sendErrorMessage(bot: TelegramBot, msg: TelegramBot.Message, e: any) {
  console.error(
    `Error during processing message: ${e?.message || "Unknown error"}. Message payload: ${JSON.stringify(
      msg,
      null,
      2
    )}`,
    e
  );
  await bot.sendMessage(
    msg.chat.id,
    `⚠️ Sorry, we weren't able to process your message. An internal error occurred: <code>${
      e?.message || "Unknown error"
    }</code>\n\nPlease try again later, or contant @v_klmn`,
    { parse_mode: "HTML" }
  );
}

export function telegramCommandDispatcher<C extends RequiredTelegramCommands = RequiredTelegramCommands>({
  commander,
  bot,
}: {
  commander: Simplify<BotCommander<C, Message>>;
  bot: TelegramBot;
}): CommandDispatcher<Message> {
  const _commander = commander as any;
  //patch commander to support help
  if (!_commander["help"]) {
    _commander["help"] = _commander["start"];
  }
  return {
    dispatch: async (msg: Message) => {
      const text = msg.text;
      if (text && text.startsWith("/")) {
        const [command, ...args] = text.substring(1).split(" ");
        if (command in commander) {
          let res;
          try {
            res = await commander[command as C]({ args, msg });
          } catch (e: any) {
            console.error(
              `Error during processing command ${command} on args: ${args.join(", ")}: ${
                e?.message || "Unknown error"
              }. Message: ${JSON.stringify(msg, null, 2)}`,
              e
            );
            await sendErrorMessage(bot, msg, e);
            return;
          }
          return res;
        } else {
          await bot.sendMessage(
            msg.chat.id,
            `⚠️ Command <b>${command}</b> is not recognized. See /help for list of all commands`,
            { parse_mode: "HTML" }
          );
        }
      } else {
        try {
          return await commander.$default({ args: [], msg });
        } catch (e: any) {
          await sendErrorMessage(bot, msg, e);
        }
      }
    },
  };
}

export const testEnvBotToken = process.env.TEST_BOT_TOKEN;
export const testEnvChatId = process.env.TEST_CHAT_ID;

export function botCommanderTest(opts: {
  commander: BotCommander;
  botToken?: string;
}): {
  testMessage: (msg: Partial<Message>) => Promise<any>;
} {
  return {
    testMessage: async (msg: Partial<Message>) => {
      if (!msg.chat?.id && testEnvChatId) {
        msg.chat = {...({id: parseInt(testEnvChatId), type: "private"}), ...(msg.chat || {})}
      }
      const botToken = opts.botToken || testEnvBotToken;
      if (!botToken) {
        console.log(`Skipping test message, no bot token provided`);
        return {}
      }
      const bot = new TelegramBot(botToken, { polling: false });
      return await telegramCommandDispatcher({
        commander: opts.commander as any,
        bot: bot,
      }).dispatch(msg as any);
    },
  };
}
