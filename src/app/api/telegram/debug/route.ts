import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", {
        status: 401,
      });
    }
    const botInfo = (await prisma.telegramBots.findFirst({ where: { botHandle: "AiAttendantBot" } }))!;
    // const msg = {
    //   message_id: 139,
    //   from: {
    //     id: 85367,
    //     is_bot: false,
    //     first_name: "Vladimir",
    //     last_name: "Klimontovich",
    //     username: "v_klmn",
    //     language_code: "en",
    //     is_premium: true,
    //   },
    //   chat: {
    //     id: 85367,
    //     first_name: "Vladimir",
    //     last_name: "Klimontovich",
    //     username: "v_klmn",
    //     type: "private",
    //   },
    //   date: 1705168694,
    //   text: "Hey, how are you?",
    // };
    // let res = await handleAiReq({
    //   msg: msg as any,
    //   client: new TelegramBot(botInfo.botToken),
    //   isNewUser: false,
    //   botToken: botInfo.botToken,
    //   appHost: "http://localhost:6401",
    //   botHandle: botInfo.botHandle!,
    // });
    // return res || Response.json({ ok: true });
    return Response.json({ ok: true });
  } catch (e: any) {
    console.log("Request error: " + e?.message || "Unknown error", e);
    return new Response(e?.message || "Unknown error", { status: 500 });
  }
}
