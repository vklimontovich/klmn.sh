import { getCommand, MessageHandler } from "@/lib/server/bots/index";
import {OpenAI} from "openai";
import { prisma } from "@/lib/server/prisma";
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


export const handleAiReq: MessageHandler = async ({ msg, client, isNewUser, botToken, appHost, botHandle }) => {
  const command = getCommand(msg);
  if (!msg.chat.id) {
    return;
  }
  const currentSession = await prisma.chatGPTSession.findFirst({where: {telegramUserId: msg.chat.id.toString(), closedAt: null}});
  if (command === "reset") {
    if (currentSession) {
      await prisma.chatGPTSession.update({where: {id: currentSession.id}, data: {closedAt: new Date()}});
    }
    await client.sendMessage(msg.chat.id, `Session reset`, {
      parse_mode: "HTML",
    });
    return;
  }

  await client.sendChatAction(msg.chat.id, "typing");

  const response = await openai.completions.create({
    model: "gpt-3.5-turbo", // Replace with your desired model
    prompt: msg.text!,
  });

  await client.sendMessage(msg.chat.id, `<pre>${JSON.stringify(response, null, 2)}</pre>`, {parse_mode: "HTML"});

};
