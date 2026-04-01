import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import TelegramBot from "node-telegram-bot-api";

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!secret) {
    return new Response("Secret is required", { status: 400 });
  }
  const attachment = await prisma.attachment.findFirst({ where: { secret } });
  if (!attachment) {
    return new Response("Attachment not found", { status: 404 });
  }

  try {
    const botInfo = (await prisma.telegramBots.findFirst({ where: { botHandle: attachment.botHandle } }))!;
    const bot = new TelegramBot(botInfo.botToken);
    const telegramFile = await bot.getFile(attachment.fileId);

    const response = await fetch(`https://api.telegram.org/file/bot${botInfo.botToken}/${telegramFile.file_path}`);

    // Check if the request was successful
    if (!response.ok) {
      console.error(`Error: ${response.statusText}: ${await response.text()}`);
      return new Response(`Error: ${response.statusText}`, { status: response.status });
    }
    let res = new NextResponse();

    const respContentType = response.headers.get("Content-Type");
    if (respContentType) {
      res.headers.set("Content-Type", respContentType);
    }
    if (attachment.filename) {
      res.headers.set("Content-Disposition", `attachment; filename="${attachment.filename}"`);
    }
    const contentRes = await fetch(`https://api.telegram.org/file/bot${botInfo.botToken}/${telegramFile.file_path}`);
    if (!contentRes.ok) {
      console.error(`Error: ${contentRes.statusText}: ${await contentRes.text()}`);
      return new Response(`Error: ${contentRes.statusText}`, { status: contentRes.status });
    }
    const content = await contentRes.arrayBuffer();
    return new Response(content, res);
  } catch (error: any) {
    console.log("Request error", error);
    return new Response(error.message, { status: 500 });
  }
}
