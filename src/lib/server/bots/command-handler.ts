import TelegramBot, { Message } from "node-telegram-bot-api";

type CommandHandler<T extends string = string> = {
  [key in T]: (opts: { args: string[]; msg: Message; bot: TelegramBot }) => Promise<void>;
};

export async function handleCommand<T extends string = string>(opts: {
  msg: Message;
  handler: CommandHandler<T>;
  bot: TelegramBot;
}): Promise<"handled" | "error" | "continue"> {
  const text = opts.msg.text || "";
  if (text.startsWith("/")) {
    const [command, ...args] = text.substring(1).split(" ");
    if (command in opts.handler) {
      try {
        await opts.handler[command as T]({ args, msg: opts.msg, bot: opts.bot });
      } catch (e) {
        console.error(`Error during processing command ${command} on args: ${args.join(", ")}`, e);
        await opts.bot.sendMessage(
          opts.msg.chat.id,
          `⚠️ Sorry, we weren't able to process your command <b>${command}</b>: an internal error occurred. Please try again later, or contant @v_klmn`,
          { parse_mode: "HTML" }
        );
        return "error";
      }
      return "handled";
    } else {
      await opts.bot.sendMessage(
        opts.msg.chat.id,
        `⚠️ Command <b>${command}</b> is not recognized. See /help for list of all commands`,
        { parse_mode: "HTML" }
      );
      return "error";
    }
  }
  return "continue";
}
