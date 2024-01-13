import { getCommand, MessageHandler } from "@/lib/server/bots/index";
import { OpenAI } from "openai";
import { prisma } from "@/lib/server/prisma";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { encode } from "gpt-tokenizer";

const replaceBackticksWithPre = text => {
  const pattern = /```(.*?)\n\s*(.*?)\n\s*```/gs;
  const replacement = "<pre>$2</pre>";
  return text.replace(pattern, replacement);
};
const markup = 1.2;

function convertMarkdownToTelegramHTML(markdownText: string): string {
  return replaceBackticksWithPre(markdownText);
}

const helpMessage = [
  `I\'m a pay-as-you go alternative to <a href="https://chat.openai.com/">ChatGPT</a>. Instead of paying $20 per month, you can pay per every request which is generally cheaper\n`,
  `Here's a commands I understand:\n`,
  `/help - this message`,
  `/reset - reset current conversation. It makes sense to do it before discussing a new topic`,
  `/balance - check your balance. Every new user gets $1 for free`,
  `/topup {amount in dollars} - top up your balance. You can top up your balance with any amount of money`,
  `/settings - see your current settings`,
  `/settings {setting} {value} - change your settings. Use /settings for the list of settings`,
].join("\n");

type AiSettings = {
  model: string;
  temperature: number;
};

const defaultAiSettings: AiSettings = {
  model: "gpt-4",
  temperature: 0.7,
};
// Example usage

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pricing = {
  "gpt-3.5-turbo": {
    input1k: 0.0001,
    output1k: 0.0015,
  },
  "gpt-4": {
    input1k: 0.06,
    output1k: 0.12,
  },
  "gpt-3.5-turbo-16k": {
    input1k: 0.06 / 2,
    output1k: 0.12 / 2,
  },
} as const;

export const handleAiReq: MessageHandler = async ({ msg, client, isNewUser, botToken, appHost, botHandle }) => {
  const { command, args } = getCommand(msg);
  if (!msg.chat.id) {
    return;
  }
  if (!msg.text) {
    await client.sendMessage(msg.chat.id, "Sorry, I only understand text messages");
    return;
  }
  let currentSession = await prisma.aiChatSessions.findFirst({
    where: { telegramUserId: msg.chat.id + "", closedAt: null },
  });
  const settingsRecord = await prisma.aiChatSettings.findFirst({ where: { telegramUserId: currentSession?.id } });
  const settings: AiSettings = { ...(settingsRecord?.settings || defaultAiSettings) };

  if (!currentSession) {
    currentSession = await prisma.aiChatSessions.create({
      data: {
        telegramUserId: msg.chat.id + "",
      },
    });
  }
  const balance =
    1 -
    (await prisma.aiChatMessage.aggregate({ where: { sessionId: currentSession.id }, _sum: { price: true } }))._sum
      .price *
      markup;
  if (command === "help" || command === "start") {
    await client.sendMessage(msg.chat.id, helpMessage, {
      parse_mode: "HTML",
    });
    return;
  } else if (command === "reset") {
    await prisma.aiChatSessions.update({
      where: { id: currentSession.id },
      data: { closedAt: new Date() },
    });
    const sum = await prisma.aiChatMessage.aggregate({
      where: { sessionId: currentSession.id },
      _sum: { price: true },
    });
    const spent = (sum._sum.price || 0) * markup;
    await client.sendMessage(
      msg.chat.id,
      `Conversation has been reset. You spent <b>$${spent.toFixed(
        spent < 1 && spent > 0 ? 4 : 2
      )}</b> on this conversation`,
      { parse_mode: "HTML" }
    );
    return;
  } else if (command === "balance") {
    await client.sendMessage(msg.chat.id, `Your balance is: <b>$${balance.toFixed(2)}</b> on this conversation`, {
      parse_mode: "HTML",
    });
    return;
  } else if (command === "topup") {
    await client.sendMessage(msg.chat.id, `Not implemented`, { parse_mode: "HTML" });
  } else if (command === "settings") {
    if (args.length === 0) {
      await client.sendMessage(
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
      return;
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
          create: { settings, telegramUserId: msg.chat.id + ""}
        });
        await client.sendMessage(msg.chat.id, `Model set to ${value}`, { parse_mode: "HTML" });
        return;
      } else if (name === "temperature") {
        const parsedValue = parseFloat(value);
        if (isNaN(parsedValue) || parsedValue < 0 || parsedValue > 1) {
          await client.sendMessage(msg.chat.id, `Invalid value. Temperature should be a number between 0 ant 1`, {
            parse_mode: "HTML",
          });
          return;
        }
        settings.temperature = parsedValue;
        await prisma.aiChatSettings.upsert({
          where: { id: settingsRecord!.id },
          update: { settings },
          create: { settings, telegramUserId: msg.chat.id + ""}
        });
        await client.sendMessage(msg.chat.id, `Temperature set to ${value}`, { parse_mode: "HTML" });
        return;
      }
      return;
    } else {
      await client.sendMessage(msg.chat.id, `Invalid number of arguments. Use /settings {setting} {value}`, {
        parse_mode: "HTML",
      });
      return;
    }
  } else {
    const messages = (
      await prisma.aiChatMessage.findMany({ where: { sessionId: currentSession.id }, orderBy: { createdAt: "asc" } })
    ).map(m => m.message as any);

    messages.push({ role: "user", content: msg.text });
    const tokens = encode(msg.text);
    const model = settings.model;
    await prisma.aiChatMessage.create({
      data: {
        message: { role: "user", content: msg.text },
        sessionId: currentSession!.id,
        tokens: tokens.length,
        price: ((pricing[model] || pricing["gpt-4"]).input1k * tokens.length) / 1000,
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
    await client.sendChatAction(msg.chat.id, "typing");
    let lastMessageTime = Date.now();
    const stream = OpenAIStream(res, {
      async onToken(token) {
        currentText = currentText + token;
        const sinceLastMessage = Date.now() - lastMessageTime;
        try {
          if (sinceLastMessage > 1000) {
            let messageContent = currentText + "🤔";
            // await client.editMessageText(convertMarkdownToTelegramHTML(messageContent), {
            //   chat_id: msg.chat.id,
            //   message_id: sentMessage.message_id,
            //   parse_mode: "HTML",
            // });
            await client.sendChatAction(msg.chat.id, "typing");
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
          const tiktokens = encode(completion);
          await prisma.aiChatMessage.create({
            data: {
              message: { role: "assistant", content: completion },
              sessionId: currentSession!.id,
              tokens: tiktokens.length,
              price: ((pricing[model] || pricing["gpt-4"]).output1k * tokens.length) / 1000,
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
  }
};
