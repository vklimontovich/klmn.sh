import { BotCommander } from "@/lib/server/bots/commander";
import TelegramBot, { Message } from "node-telegram-bot-api";
import { prisma } from "@/lib/server/prisma";
import { AiChatSessions } from "@prisma/client";
import { openaiPricing } from "@/lib/server/bots/pricing/openai";
import dayjs from "dayjs";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { tokenCounter } from "@/lib/server/ai/tokenizer";
import { OpenAI } from "openai";
import { appendLoadingIndicator, markdownToTelegram } from "@/lib/server/telegram/format";
import relativeTime from "dayjs/plugin/relativeTime";
import { omit } from "lodash";

dayjs.extend(relativeTime);

type AiSettings = {
  model: string;
  temperature: number;
  verbose: boolean;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


function getPrice(model: string, tokens: number, type: "input" | "output"): number {
  const price = openaiPricing[model] || openaiPricing["gpt-4"];
  return price[`${type}1k`] * (tokens / 1000);
}

async function getCostBySession(sessionId: string): Promise<number> {
  const res = await prisma.aiCostsTransactions.aggregate({ where: { sessionId }, _sum: { credits: true } });
  return res?._sum?.credits || 0;
}

async function getCostByUser(telegramUserId: string): Promise<number> {
  const res = await prisma.aiCostsTransactions.aggregate({ where: { telegramUserId }, _sum: { credits: true } });
  return 1000 - (res?._sum?.credits || 0);
}

function creditsToString(credits: number): string {
  if (credits === 0) {
    return "0";
  } else if (credits < 0.1) {
    return credits.toFixed(4);
  } else if (credits < 100) {
    return credits.toFixed(2);
  } else {
    return credits.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
}


async function getCurrentSession(telegramUserId: string) {
  return (
    (await prisma.aiChatSessions.findFirst({
      where: { telegramUserId, closedAt: null },
    })) ||
    (await prisma.aiChatSessions.create({
      data: {
        telegramUserId,
      },
    }))
  );
}

export type ChatState = {
  type: "resolve_last_message";
  msg: Message;
};

const defaultAiSettings: AiSettings = {
  model: "gpt-4",
  temperature: 0.7,
  verbose: false,
};

export type MessageContext = {
  telegramUserId: string;
  userSettings: AiSettings;
  currentSession: AiChatSessions;
  balance: number;
  lastSessionActivity: Date;
  lastChatState?: ChatState;
  lastMessageDate: Date;
};

async function getChatState(telegramUserId: string): Promise<ChatState | undefined> {
  return (await prisma.aiChatState.findFirst({ where: { telegramUserId, deleteAt: null } }))?.state as any;
}

async function createMessageContext(msg: Message): Promise<MessageContext> {
  const telegramUserId = msg.chat.id + "";
  const settingsRecord = await prisma.aiChatSettings.findFirst({ where: { telegramUserId } });
  const settings: AiSettings = { ...((settingsRecord?.settings as any) || defaultAiSettings) };

  const currentSession = await getCurrentSession(telegramUserId);
  const balance = await getCostByUser(telegramUserId);
  const messageRecords = await prisma.aiChatMessage.findMany({
    where: { sessionId: currentSession.id },
    orderBy: { createdAt: "asc" },
  });
  const lastMessageDate = messageRecords
    .map(m => m.createdAt)
    .reduce((acc, item) => (item.getTime() > acc.getTime() ? item : acc), new Date(0));
  const lastSessionActivity =
    currentSession.updatedAt.getTime() > lastMessageDate.getTime() ? currentSession.updatedAt : lastMessageDate;
  const lastChatState = await getChatState(telegramUserId);
  const result = {
    telegramUserId,
    userSettings: settings,
    currentSession,
    balance,
    lastSessionActivity,
    lastChatState,
    lastMessageDate,
    now: new Date(),
  };
  return result;
}

function removeCommand(text: string) {
  return text.startsWith("/new") ? text.substring(4).trim() : text;
}


async function clearChatState(telegramUserId: string): Promise<void> {
  await prisma.aiChatState.updateMany({ where: { telegramUserId, deleteAt: null }, data: { deleteAt: new Date() } });
}

function generateHelp(commander: Required<Pick<BotCommander, "$descriptions">>): string {
  return Object.entries(commander.$descriptions || {})
    .map(([command, description]) => `/${command} - ${description}`)
    .join("\n");
}

const oneHourMs = 1000 * 60 * 60;

async function saveChatState(telegramUserId: string, state: ChatState): Promise<void> {
  await clearChatState(telegramUserId);
  await prisma.aiChatState.create({ data: { telegramUserId, state: state as any } });
}


async function handlePrompt(ctx: MessageContext, msg: { text?: string }, bot: TelegramBot) {
  const chatId = parseInt(ctx.telegramUserId);
  if (!msg.text) {
    await bot.sendMessage(chatId, `I can handle only text messages so far`, { parse_mode: "HTML" });
    return
  }
  const messageRecords = await prisma.aiChatMessage.findMany({
    where: { sessionId: ctx.currentSession.id },
    orderBy: { createdAt: "asc" },
  });
  const messages = messageRecords.map(m => m.message as any);

  if (ctx.balance <= 0) {
    await bot.sendMessage(
      chatId,
      `You don't have enough credits to continue. Your current balance is <b>${creditsToString(
        ctx.balance
      )}</b> credits. Use /topup to top up your balance`,
      { parse_mode: "HTML" }
    );
    return;
  }
  if (ctx.lastSessionActivity.getTime() < Date.now() - oneHourMs) {
    await bot.sendMessage(
      chatId,
      `Your last activity on this chat happened <b>${dayjs().to(
        dayjs(ctx.lastSessionActivity)
      )}</b>. You might want to start a conversation with me. Use /new to start a new conversation. If you want to continue the conversation, use /continue`,
      {
        parse_mode: "HTML",
      }
    );
    await saveChatState(ctx.telegramUserId, { type: "resolve_last_message", msg: msg as any });
    return;
  }

  const content = removeCommand(msg.text);

  messages.push({ role: "user", content });
  const model = ctx.userSettings.model;
  await prisma.aiChatMessage.create({
    data: {
      message: { role: "user", content },
      sessionId: ctx.currentSession.id,
    },
  });

  const intputTokens = messages.map(m => tokenCounter(m.content)).reduce((acc, item) => acc + item, 0);
  await prisma.aiCostsTransactions.create({
    data: {
      telegramUserId: ctx.telegramUserId,
      sessionId: ctx.currentSession.id,
      credits: getPrice(model, intputTokens, "input"),
      tokens: intputTokens,
      type: "input",
      model,
    },
  });

  const res = await openai.chat.completions.create({
    model,
    //max_tokens: 4096*4,
    messages,
    temperature: ctx.userSettings.temperature,
    stream: true,
  });

  let currentText = "";
  const sentMessage = await bot.sendMessage(chatId, "<i>I'm thinking... 🤔</i>", {
    parse_mode: "HTML",
  });
  let lastMessageTime = Date.now();
  const stream = OpenAIStream(res, {
    async onToken(token) {
      currentText = currentText + token;
      const sinceLastMessage = Date.now() - lastMessageTime;
      if (sinceLastMessage > 1000) {
        try {
          const formattedMessage = appendLoadingIndicator(markdownToTelegram(currentText));
          await bot.editMessageText(formattedMessage.text, {
            chat_id: chatId,
            message_id: sentMessage.message_id,
            parse_mode: formattedMessage.parse_mode,
            entities: formattedMessage.entities,
          } as any);
          await bot.sendChatAction(chatId, "typing");
        } catch (e) {
          console.warn("error editing message", e);
        }
        lastMessageTime = Date.now();
      }
    },
    async onCompletion(completion) {
      const sinceLastMessage = Date.now() - lastMessageTime;
      if (sinceLastMessage < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - sinceLastMessage));
      }

      try {
        const outputMessage = await prisma.aiChatMessage.create({
          data: {
            message: { role: "assistant", content: completion },
            sessionId: ctx.currentSession.id,
          },
        });
        const outputTokens = tokenCounter(completion);
        await prisma.aiCostsTransactions.create({
          data: {
            telegramUserId: ctx.telegramUserId,
            sessionId: ctx.currentSession.id,
            credits: getPrice(model, outputTokens, "output"),
            tokens: outputTokens,
            type: "output",
            model,
          },
        });
        try {
          const formattedMessage = markdownToTelegram(completion);
          await bot.editMessageText(formattedMessage.text, {
            chat_id: chatId,
            message_id: sentMessage.message_id,
            entities: formattedMessage.entities || [],
            parse_mode: formattedMessage.parse_mode,
          } as any);
        } catch (e: any) {
          console.error("Error sending final message, sending a error message", e);
          await bot.sendMessage(
            chatId,
            `Unfortunatelly, I can't display message, telegram has some issues with formatting the message. Message id <code>${outputMessage.id}</code>. Error: <code>${e?.message}</code>`,
            {
              parse_mode: "HTML",
            }
          );
        }
        if (ctx.userSettings.verbose) {
          function format(price: number) {
            if (price < 10) {
              return price.toFixed(2);
            } else {
              return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
            }
          }

          const inputCredits = getPrice(model, outputTokens, "input");
          const outputCredits = getPrice(model, outputTokens, "output");
          await bot.sendMessage(
            chatId,
            [
              `🤖 Prompt stat:\n`,
              `<code>output=${outputTokens}, input=${intputTokens}</code>`,
              `<code>outputCredits=${format(outputCredits)}, inputCredits=${format(
                inputCredits
              )}, totalCredits=${format(inputCredits + outputCredits)}</code>`,
              `<code>historicMessages=${messageRecords.length}</code>`,
            ].join("\n"),
            {
              parse_mode: "HTML",
            }
          );
        }
      } catch (e) {
        console.error("error finalizing completion", e);
      }
    },
  });

  return new StreamingTextResponse(stream);
}

function getSettingsString(userSettings: AiSettings) {
  return Object.entries(omit(userSettings, "model"))
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
}

export function createAiCommander({
  bot: _bot,
}: {
  bot: TelegramBot | string;
}): BotCommander<"start" | "new" | "continue" | "balance" | "topup" | "model" | "_debugContext" | "pricing", Message> {
  const $descriptions = {
    start: "Display help message",
    new: "Reset previous conversation with AI assistant and start a new one",
    continue: "Continue conversation",
    balance: "Show current balance",
    topup: "Topup balance",
    model: "Change model or model settings",
    pricing: "Show pricing",
    _debugContext: "Show debug info",
  };
  const bot = typeof _bot === "string" ? new TelegramBot(_bot) : _bot;

  return {
    $descriptions,
    _debugContext: async ({ msg }) => {
      const ctx = await createMessageContext(msg);
      await bot.sendMessage(msg.chat.id, `<pre>${JSON.stringify(ctx, null, 2)}</pre>`, { parse_mode: "HTML" });
    },
    start: async ({ msg }) => {
      await bot.sendMessage(
        msg.chat.id,
        [
          `👋 I'm a cost-effective alternative to ChatGPT, offering a <i>pay-per-request</i> service instead of a fixed $20 monthly fee. For most uses-case, it's cheaper\n`,
          `Billing is based on a credit system. You'll receive <b>1,000</b> credits as a complimentary welcome bonus, generally sufficient for 5-10 conversations. To purchase more credits, simply use the /topup command.\n`,
          `Here's a commands I understand:\n`,
          generateHelp({ $descriptions }),
        ].join("\n"),
        { parse_mode: "HTML" }
      );
    },
    new: async ({ msg, args }) => {
      let ctx = await createMessageContext(msg);
      await prisma.aiChatSessions.update({
        where: { id: ctx.currentSession.id },
        data: { closedAt: new Date() },
      });
      //read context once again to get an updated activity time
      ctx = await createMessageContext(msg);
      const creditCosts = await getCostBySession(ctx.currentSession.id);
      const spentMessage =
        creditCosts > 0 ? `You spent <b>${creditsToString(creditCosts)}</b> credits on previous conversation.` : "";
      if (args.length > 0) {
        //do not notify about previous conversation if it there's args
        return await handlePrompt(ctx, { text: args.join(" ") }, bot);
      } else if (ctx.lastChatState?.type === "resolve_last_message") {
        await clearChatState(ctx.telegramUserId);
        return await handlePrompt(ctx, ctx.lastChatState.msg, bot);
      } else {
        await bot.sendMessage(msg.chat.id, [`Type your message to start conversation`].filter(Boolean).join(" "), {
          parse_mode: "HTML",
        });
      }
    },
    continue: async ({ msg }) => {
      const ctx = await createMessageContext(msg);
      //bogus command to update lastUpdated for aiChatSessions
      await prisma.aiChatSessions.update({
        where: { id: ctx.currentSession.id },
        data: { closedAt: null },
      });
      if (ctx.lastChatState?.type === "resolve_last_message") {
        return await handlePrompt(ctx, ctx.lastChatState.msg, bot);
      } else {
        await bot.sendMessage(msg.chat.id, "Ok, let's continue this session", { parse_mode: "HTML" });
      }
    },
    balance: async ({ msg }) => {
      const ctx = await createMessageContext(msg);
      await bot.sendMessage(
        msg.chat.id,
        `Your current balance is <b>${creditsToString(ctx.balance)}</b> credits. Use /topup to top up your balance`,
        { parse_mode: "HTML" }
      );
    },
    topup: async ({ msg }) => {
      throw new Error(`Not implemented`);
    },
    pricing: async ({ msg, args }) => {
      function format(input1k: number) {
        if (input1k < 10) {
          return input1k.toFixed(2);
        } else {
          return input1k.toLocaleString("en-US", { maximumFractionDigits: 0 });
        }
      }

      await bot.sendMessage(
        msg.chat.id,
        [
          `💸 Here's my pricing info:\n`,
          ...Object.entries(openaiPricing).map(([model, { input1k, output1k }]) => {
            return ` - <b>${model}</b>: ${format(input1k)} credits per 1k tokens input, ${format(
              output1k
            )} credits per 1k tokens output`;
          }),
        ].join("\n"),
        { parse_mode: "HTML" }
      );
    },
    model: async ({ msg, args }) => {
      const ctx = await createMessageContext(msg);
      if (args.length === 0) {
        await bot.sendMessage(
          msg.chat.id,
          [
            `Current model: <b>${ctx.userSettings.model}</b>. Settings: ${getSettingsString(ctx.userSettings)}\n`,
            `Use \`/model model-name\`  to set a model. Available models: ${Object.keys(openaiPricing).join(", ")}\n`,
            `Use \`/model param value\` to set a parameter. Available parameters: temperature.`,
          ].join("\n"),
          { parse_mode: "HTML" }
        );
      } else if (args.length === 1) {
        const newModel = args[0];
        if (!(newModel in openaiPricing)) {
          await bot.sendMessage(
            msg.chat.id,
            `Unknown model <b>${newModel}</b>. Available models: ${Object.keys(openaiPricing).join(", ")}`,
            { parse_mode: "HTML" }
          );
          return;
        } else {
          const newSettings = { ...ctx.userSettings, ...{ model: newModel } };
          await prisma.aiChatSettings.updateMany({
            where: { telegramUserId: ctx.telegramUserId },
            data: { settings: newSettings },
          });
          await bot.sendMessage(msg.chat.id, `✅ Model was updated to <b>${newModel}</b>`, { parse_mode: "HTML" });
          return;
        }
      } else if (args.length == 2) {
        const [key, value] = args;
        if (key === "temperature") {
          const parsed = parseFloat(value);
          if (isNaN(parsed) || parsed < 0 || parsed > 1) {
            await bot.sendMessage(msg.chat.id, `❌Invalid value for temperature: <b>${value}</b>`, {
              parse_mode: "HTML",
            });
          } else {
            const newSettings = { ...ctx.userSettings, ...{ temperature: parsed } };
            await prisma.aiChatSettings.updateMany({
              where: { telegramUserId: ctx.telegramUserId },
              data: { settings: newSettings },
            });
            await bot.sendMessage(
              msg.chat.id,
              `✅Temperature set to <b>${parsed}</b>. New settings: ${getSettingsString(newSettings)}`,
              {
                parse_mode: "HTML",
              }
            );
          }
        } else if (key === "verbose") {
          const val = Boolean(value);
          const newSettings = { ...ctx.userSettings, ...{ verbose: val } };
          await prisma.aiChatSettings.updateMany({
            where: { telegramUserId: ctx.telegramUserId },
            data: { settings: newSettings },
          });
          await bot.sendMessage(
            msg.chat.id,
            `✅Verbosity set to <b>${val}</b>. New settings: ${getSettingsString(newSettings)}`,
            {
              parse_mode: "HTML",
            }
,          );
        } else {
          await bot.sendMessage(msg.chat.id, `❌Unknown parameter: <b>${key}</b>`, {
            parse_mode: "HTML",
          });
        }
      }
    },
    $default: async ({ msg }) => {
      const ctx = await createMessageContext(msg);
      return await handlePrompt(ctx, msg, bot);
    },
  };
}
