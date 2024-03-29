import { prisma } from "@/lib/server/prisma";
import { Resend } from "resend";

import twilio from "twilio";
import TwilioSDK from "twilio";
import { NextRequest, NextResponse } from "next/server";
import { telegramClient } from "@/lib/server/telegram";
import VoiceResponse = TwilioSDK.twiml.VoiceResponse;
import { resend } from "@/lib/server/email";
import { log } from "@/lib/server/log";

const twilioClient: twilio.Twilio | undefined =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : undefined;


function isNumeric(to: string) {
  return /^\d+$/.test(to);
}

async function sendTelegramMessage(param: { to: string; text: string }) {
  if (telegramClient) {
    let chatId;
    if (isNumeric(param.to)) {
      chatId = param.to;
    } else {
      const contact = await prisma.telegramContacts.findFirst({ where: { userName: param.to } });
      if (!contact) {
        throw new Error(`Telegram contact ${param.to} not found`);
      }
      chatId = contact.userId;
    }
    await telegramClient.sendMessage(chatId, param.text, { parse_mode: "HTML" });
  }
}

async function sendEmail(param: { subject: string; from: string; to: string; text: string }) {
  if (resend) {
    await resend.emails.send({
      from: param.from,
      to: param.to,
      subject: param.subject,
      text: param.text,
    });
  }
}

async function sendTextMessage(param: { to: string; from: string; text: string }) {
  if (twilioClient) {
    await twilioClient.messages.create({
      body: param.text,
      from: param.from,
      to: param.to,
    });
  }
}

export async function POST(request: NextRequest) {
  const headersMap = Object.fromEntries([...request.headers.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  const bodyText = await request.text();
  let bodyJson;
  try {
    bodyJson = JSON.parse(bodyText);
  } catch (e) {
    bodyJson = { bodyText };
  }
  await log("incoming-http:twilio", {
    body: bodyJson,
    headers: headersMap,
    method: request.method,
    url: request.url,
    query: Object.fromEntries(
      [...new URL(request.url).searchParams.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    ),
  });

  if (!process.env.TWILIO_AUTH_TOKEN) {
    console.log("Twilio is not configured");
    return new Response(JSON.stringify({ ok: false, error: "Twilio is not configured" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const params = Object.fromEntries(
    [...new URLSearchParams(bodyText).entries()].sort((a, b) => a[0].localeCompare(b[0]))
  );

  const twilioSig = request.headers.get("x-twilio-signature");

  if (!twilioSig) {
    return new Response(JSON.stringify({ ok: false, error: "x-twilio-signature header is missing" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const fullUrl = request.url; //.replace("http://localhost:6401/", "https://klmn.sh/");
  if (!twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, twilioSig!, fullUrl, params)) {
    return new Response(JSON.stringify({ ok: false, error: "Twilio signature is invalid" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const type = request.nextUrl.searchParams.get("type");
  const to = params.To;
  const routes = await prisma.textMessageRoute.findMany({
    where: { source: to },
    select: { destination: true, type: true },
  });
  if (type === "sms") {
    const { From: from, Body: body } = params;

    const routeStatuses: Record<string, string> = {};

    for (const { destination, type } of routes) {
      if (type === "email") {
        try {
          await sendEmail({
            to: destination,
            from: `SMS Bot <noreply@mail.klmn.sh>`,
            subject: `SMS to ${to} from ${from}`,
            text: body,
          });
          routeStatuses[`${type} ${destination}`] = "ok";
        } catch (e: any) {
          routeStatuses[`${type} ${destination}`] = `error ${e?.message}`;
        }
      } else if (type === "sms") {
        try {
          await sendTextMessage({
            to: destination,
            from: to,
            text: `FWD ${from}: ${body}`,
          });
          routeStatuses[`${type} ${destination}`] = "ok";
        } catch (e: any) {
          routeStatuses[`${type} ${destination}`] = `error ${e?.message}`;
        }
      } else if (type === "telegram") {
        try {
          await sendTelegramMessage({
            to: destination,
            text: `New SMS from ${from}: ${body}`,
          });
          routeStatuses[`${type} ${destination}`] = "ok";
        } catch (e: any) {
          routeStatuses[`${type} ${destination}`] = `error ${e?.message}`;
        }
      }
    }

    await log("twillio-sms-webhook", { routeStatuses, params });

    return Response.json({ ok: true, routeStatuses });
  } else if (type === "call") {
    const { From: from } = params;
    const routeStatuses: Record<string, string> = {};
    for (const { destination, type } of routes) {
      if (type === "email") {
        try {
          await sendEmail({
            to: destination,
            from: `Call Handler Bot <noreply@mail.klmn.sh>`,
            subject: `Call to ${to} from ${from}`,
            text: `${from} tried to call ${to}. Full call data:\n ${JSON.stringify(params, null, 2)}`,
          });
          routeStatuses[`${type} ${destination}`] = "ok";
        } catch (e: any) {
          routeStatuses[`${type} ${destination}`] = `error ${e?.message}`;
        }
      } else if (type === "sms") {
        try {
          await sendTextMessage({
            to: destination,
            from: to,
            text: `Missed call from ${from}. Full details in email`,
          });
          routeStatuses[`${type} ${destination}`] = "ok";
        } catch (e: any) {
          routeStatuses[`${type} ${destination}`] = `error ${e?.message}`;
        }
      } else if (type === "telegram") {
        try {
          await sendTelegramMessage({
            to: destination,
            text: `Got a call from ${from}. Full details:\n<pre>${JSON.stringify(params, null, 2)}</pre>`,
          });
          routeStatuses[`${type} ${destination}`] = "ok";
        } catch (e: any) {
          routeStatuses[`${type} ${destination}`] = `error ${e?.message}`;
        }
      }
    }
    const twiml = new VoiceResponse();

    twiml.say(
      { voice: "Polly.Joey", language: "en-US" },
      "Hello, you've reached Vladimir Klimontovich. I'm currently unavailable to take your call. Text me if you need anything, and I'll get back to you as soon as possible. Thank you!"
    );
    twiml.hangup();
    return new Response(twiml.toString(), {
      headers: {
        "Content-Type": "text/xml",
      },
    });
  } else {
    return new NextResponse("Invalid type", { status: 400 });
  }
}
