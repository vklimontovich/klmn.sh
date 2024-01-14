import { MessageHandler } from "@/lib/server/bots/index";
import { OpenAI } from "openai";
import { prisma } from "@/lib/server/prisma";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { encode } from "gpt-tokenizer";
import { handleCommand } from "@/lib/server/bots/command-handler";
import TelegramBot, { Message } from "node-telegram-bot-api";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);
const replaceBackticksWithPre = (text: string) => {
  const pattern = /```(.*?)\n\s*(.*?)\n\s*```/gs;
  const replacement = "<pre>$2</pre>";
  return text.replace(pattern, replacement);
};

function convertMarkdownToTelegramHTML(markdownText: string): string {
  return replaceBackticksWithPre(markdownText);
}

const helpMessage = [
  `I\'m a pay-as-you go alternative to <a href="https://chat.openai.com/">ChatGPT</a>. Instead of paying $20 per month, you can pay per every request which is generally cheaper\n`,
  `Here's a commands I understand:\n`,
  `/help - this message`,
  `/new - start a new conversation`,
  `/balance - check your balance. Every new user gets $1 for free`,
  `/topup {amount in dollars} - top up your balance. You can top up your balance with any amount of money`,
  `/settings - see your current settings`,
  `/settings {setting} {value} - change your settings. Use /settings for the list of settings`,
].join("\n");

type AiSettings = {
  model: string;
  temperature: number;
};

const newOrContinueMarkup = undefined;
//   = {
//   inline_keyboard: [
//     [{ text: "New Conversation", callback_data: "/new" }, { text: "Continue Conversation", callback_data: "/new" }],
//   ],
//   one_time_keyboard: true
// };

const defaultAiSettings: AiSettings = {
  model: "gpt-4",
  temperature: 0.7,
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function toCredits(number: number) {
  return number * 1000 * 1.4;
}

const pricing: Record<string, { input1k: number; output1k: number }> = {
  "gpt-3.5-turbo": {
    input1k: toCredits(0.0001),
    output1k: toCredits(0.0015),
  },
  "gpt-4": {
    input1k: toCredits(0.06),
    output1k: toCredits(0.12),
  },
  "gpt-3.5-turbo-16k": {
    input1k: toCredits(0.06 / 2),
    output1k: toCredits(0.12 / 2),
  },
};

function getPrice(model: string, tokens: number, type: "input" | "output"): number {
  const price = pricing[model] || pricing["gpt-4"];
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

export function calculateTokens(subj: string | { content: string }[] | { content: string }): number {
  if (typeof subj === "string") {
    return encode(subj).length;
  }
  if (Array.isArray(subj)) {
    return subj.reduce((acc, item) => acc + calculateTokens(item), 0);
  }
  return calculateTokens(subj.content);
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

//const oneHourMs = 1000 * 60 * 60;
const oneHourMs = 1000 * 60;

async function getChatState(telegramUserId: string): Promise<ChatState | undefined> {
  return (await prisma.aiChatState.findFirst({ where: { telegramUserId, deleteAt: null } }))?.state as any;
}

async function saveChatState(telegramUserId: string, state: ChatState): Promise<void> {
  await clearChatState(telegramUserId);
  await prisma.aiChatState.create({ data: { telegramUserId, state: state as any } });
}

async function clearChatState(telegramUserId: string): Promise<void> {
  await prisma.aiChatState.updateMany({ where: { telegramUserId, deleteAt: null }, data: { deleteAt: new Date() } });
}

export const handleAiReq: MessageHandler = async ({ msg, client, isNewUser, botToken, appHost, botHandle }) => {
  if (!msg.chat.id) {
    return;
  }
  if (!msg.text) {
    await client.sendMessage(msg.chat.id, "Sorry, I only understand text messages");
    return;
  }
  await client.sendChatAction(msg.chat.id, "typing");
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
  console.log({ currentSession: currentSession.updatedAt, lastMessageDate, now: new Date() });
  const lastChatState = await getChatState(telegramUserId);

  const commandHandlingResult = await handleCommand<
    "start" | "help" | "new" | "settings" | "balance" | "topup" | "continue"
  >({
    msg,
    bot: client,
    handler: {
      async balance(opts: { args: string[]; msg: TelegramBot.Message; bot: TelegramBot }): Promise<void> {
        await client.sendMessage(
          msg.chat.id,
          `Your current balance is <b>${creditsToString(balance)}</b> credits. Use /topup to top up your balance`,
          { parse_mode: "HTML" }
        );
      },
      async help(opts: { args: string[]; msg: TelegramBot.Message; bot: TelegramBot }): Promise<void> {
        await client.sendMessage(msg.chat.id, helpMessage, {
          parse_mode: "HTML",
        });
      },
      new: async function (opts: { args: string[]; msg: TelegramBot.Message; bot: TelegramBot }): Promise<void> {
        await prisma.aiChatSessions.update({
          where: { id: currentSession!.id },
          data: { closedAt: new Date() },
        });
        if (lastChatState?.type === "resolve_last_message") {
          await clearChatState(telegramUserId);
          await client.sendMessage(
            msg.chat.id,
            `You spent <b>${creditsToString(
              await getCostBySession(currentSession!.id)
            )}</b> credits on previous conversation. Your remaining balance is <b>${creditsToString(
              balance
            )}. Please repeat your previous message to start a new conversation`,
            { parse_mode: "HTML" }
          );
        } else {
          await client.sendMessage(
            msg.chat.id,
            `Starting a new conversation. You spent <b>${creditsToString(
              await getCostBySession(currentSession!.id)
            )}</b> credits on previous conversation. You're balance is <b>${creditsToString(balance)}</b> credits`,
            { parse_mode: "HTML" }
          );
        }
      },
      continue: async function (opts: { args: string[]; msg: TelegramBot.Message; bot: TelegramBot }): Promise<void> {
        //bogus command to continue the conversation
        await prisma.aiChatSessions.update({
          where: { id: currentSession.id },
          data: { closedAt: null },
        });
        if (lastChatState?.type === "resolve_last_message") {
          await clearChatState(telegramUserId);
          await client.sendMessage(msg.chat.id, "Please repeat your previous message to continue", {
            parse_mode: "HTML",
          });
        } else {
          await client.sendMessage(msg.chat.id, "Ok, let's continue this session", { parse_mode: "HTML" });
        }
      },
      async settings({ args, bot, msg }): Promise<void> {
        if (args.length === 0) {
          await bot.sendMessage(
            msg.chat.id,
            [
              `Your current settings are:\n`,
              ` - model: <b>${settings.model}</b>`,
              ` - temperature: <b>${settings.temperature}</b>\n`,
              `You can change them with /settings {setting} {value}\n`,
              `Available models are: ${Object.keys(pricing).join(", ")}`,
            ].join("\n"),
            { parse_mode: "HTML" }
          );
        } else if (args.length === 2) {
          const [name, value] = args;
          if (name === "model") {
            if (!Object.keys(pricing).includes(value)) {
              await client.sendMessage(
                msg.chat.id,
                `Invalid model. Available models are: ${Object.keys(pricing).join(", ")}`,
                { parse_mode: "HTML" }
              );
              return;
            }
            settings.model = value;
            await prisma.aiChatSettings.upsert({
              where: { id: currentSession!.id },
              update: { settings },
              create: { settings, telegramUserId: msg.chat.id + "" },
            });
            await client.sendMessage(msg.chat.id, `Model set to ${value}`, { parse_mode: "HTML" });
            return;
          } else if (name === "temperature") {
            const parsedValue = parseFloat(value);
            if (isNaN(parsedValue) || parsedValue < 0 || parsedValue > 1) {
              await client.sendMessage(msg.chat.id, `Invalid value. Temperature should be a number between 0 ant 1`, {
                parse_mode: "HTML",
              });
            } else {
              settings.temperature = parsedValue;
              await prisma.aiChatSettings.upsert({
                where: { id: settingsRecord!.id },
                update: { settings },
                create: { settings, telegramUserId: msg.chat.id + "" },
              });
              await client.sendMessage(msg.chat.id, `Temperature set to ${value}`, { parse_mode: "HTML" });
            }
          }
        } else {
          await client.sendMessage(msg.chat.id, `Invalid number of arguments. Use /settings {setting} {value}`, {
            parse_mode: "HTML",
          });
          return;
        }
      },
      async start({ args, bot, msg }): Promise<void> {
        await bot.sendMessage(msg.chat.id, helpMessage, {
          parse_mode: "HTML",
        });
      },
      async topup({ args, bot, msg }): Promise<void> {
        await bot.sendMessage(msg.chat.id, `Not implemented`, { parse_mode: "HTML" });
      },
    },
  });

  if (commandHandlingResult === "error" || commandHandlingResult === "handled") {
    //commander sends error message by itself
    return;
  }
  if (lastChatState && lastChatState.type === "resolve_last_message") {
    await client.sendMessage(
      msg.chat.id,
      "Please make a selection if you want to continue the conversation or start a new one by typing /continue or /new",
      { parse_mode: "HTML", reply_markup: newOrContinueMarkup }
    );
    return;
  }

  const messages = messageRecords.map(m => m.message as any);

  if (balance <= 0) {
    await client.sendMessage(
      msg.chat.id,
      `You don't have enough credits to continue. Your current balance is <b>${creditsToString(
        balance
      )}</b> credits. Use /topup to top up your balance`,
      { parse_mode: "HTML" }
    );
    return;
  }

  if (lastSessionActivity.getTime() < Date.now() - oneHourMs) {
    await client.sendMessage(
      msg.chat.id,
      `Your last activity on this chat happened <b>${dayjs().to(
        dayjs(lastSessionActivity)
      )}</b>. You might want to start a conversation with me. Use /new to start a new conversation. If you want to continue the conversation, use /continue`,
      {
        parse_mode: "HTML",
        reply_markup: newOrContinueMarkup,
      }
    );
    await saveChatState(telegramUserId, { type: "resolve_last_message", msg });
    return;
  }

  messages.push({ role: "user", content: msg.text });
  const model = settings.model;
  await prisma.aiChatMessage.create({
    data: {
      message: { role: "user", content: msg.text },
      sessionId: currentSession!.id,
    },
  });

  const intputTokens = calculateTokens(messages);
  await prisma.aiCostsTransactions.create({
    data: {
      telegramUserId,
      sessionId: currentSession.id,
      credits: getPrice(model, intputTokens, "input"),
      tokens: intputTokens,
      type: "input",
      model,
    },
  });

  const res = await openai.chat.completions.create({
    model: model,
    //max_tokens: 4096*4,
    messages,
    temperature: settings.temperature,
    stream: true,
  });

  let currentText = "";
  const sentMessage = await client.sendMessage(msg.chat.id, "I'm Thinking... 🤔", {
    parse_mode: "HTML",
  });
  let lastMessageTime = Date.now();
  const stream = OpenAIStream(res, {
    async onToken(token) {
      currentText = currentText + token;
      const sinceLastMessage = Date.now() - lastMessageTime;
      try {
        if (sinceLastMessage > 1000) {
          let messageContent = currentText + "🤔";
          try {
            await client.editMessageText(convertMarkdownToTelegramHTML(messageContent), {
              chat_id: msg.chat.id,
              message_id: sentMessage.message_id,
              parse_mode: "HTML",
            });
            await client.sendChatAction(msg.chat.id, "typing");
          } catch (e) {
            console.log("error editing message", e);
          }
          lastMessageTime = Date.now();
        }
      } catch (e) {
        console.log("error editing message", e);
      }
    },
    async onCompletion(completion) {
      const sinceLastMessage = Date.now() - lastMessageTime;
      if (sinceLastMessage < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - sinceLastMessage));
      }
      try {
        await prisma.aiChatMessage.create({
          data: {
            message: { role: "assistant", content: completion },
            sessionId: currentSession!.id,
          },
        });
        const outputTokens = calculateTokens(messages);
        await prisma.aiCostsTransactions.create({
          data: {
            telegramUserId,
            sessionId: currentSession.id,
            credits: getPrice(model, outputTokens, "output"),
            tokens: outputTokens,
            type: "output",
            model,
          },
        });
        await client.editMessageText(convertMarkdownToTelegramHTML(completion), {
          chat_id: msg.chat.id,
          message_id: sentMessage.message_id,
          parse_mode: "HTML",
        });
      } catch (e) {
        console.log("error finalizing completion", e);
      }
    },
  });

  return new StreamingTextResponse(stream);
};
