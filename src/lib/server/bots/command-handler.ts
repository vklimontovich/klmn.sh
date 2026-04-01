import TelegramBot, { Message } from "node-telegram-bot-api";

type CommandHandler<T extends string = string> = {
  [key in T]: (opts: { args: string[]; msg: Message; bot: TelegramBot }) => Promise<any>;
};

export async function handleCommand<T extends string = string>(opts: {
  msg: Message;
  handler: CommandHandler<T>;
  bot: TelegramBot;
}): Promise<{ status: "handled" | "error" | "continue"; result?: any }> {
  const text = opts.msg.text || "";
  if (text.startsWith("/")) {
    const [command, ...args] = text.substring(1).split(" ");
    if (command in opts.handler) {
      let res;
      try {
        res = await opts.handler[command as T]({ args, msg: opts.msg, bot: opts.bot });
        console.log(`Command ${command} processed with args: ${args.join(", ")}. Result: ${res}.`);
      } catch (e) {
        console.error(`Error during processing command ${command} on args: ${args.join(", ")}`, e);
        await opts.bot.sendMessage(
          opts.msg.chat.id,
          `⚠️ Sorry, we weren't able to process your command <b>${command}</b>: an internal error occurred. Please try again later, or contant @v_klmn`,
          { parse_mode: "HTML" }
        );
        return { status: "error" };
      }
      return { status: "handled", result: res };
    } else {
      await opts.bot.sendMessage(
        opts.msg.chat.id,
        `⚠️ Command <b>${command}</b> is not recognized. See /help for list of all commands`,
        { parse_mode: "HTML" }
      );
      return { status: "error" };
    }
  }
  return { status: "continue" };
}
