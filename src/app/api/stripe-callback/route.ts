import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { billing, creditsToString, getCostByUser } from "@/lib/server/billing";
import { Stripe } from "stripe";
import assert from "node:assert";
import { prisma } from "@/lib/server/prisma";
import TelegramBot from "node-telegram-bot-api";

async function getCheckoutSessionByClientReferenceId(
  clientReferenceId: string
): Promise<Stripe.Checkout.Session | undefined> {
  assert(billing);
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const sessions = await billing.checkout.sessions.list({
      limit: 100,
      starting_after: startingAfter,
    });

    const foundSession = sessions.data.find(
      (session: Stripe.Checkout.Session) => session.client_reference_id === clientReferenceId
    );

    if (foundSession) {
      return foundSession;
    }

    if (sessions.has_more) {
      startingAfter = sessions.data[sessions.data.length - 1].id;
    } else {
      hasMore = false;
    }
  }

  return undefined;
}

async function getReceiptURL(checkoutSession: Stripe.Checkout.Session, bot: TelegramBot, chatId: number) {
  assert(billing);
  if (checkoutSession.payment_intent) {
    const paymentIntent = await billing.paymentIntents.retrieve(
      typeof checkoutSession.payment_intent === "string"
        ? checkoutSession.payment_intent
        : checkoutSession.payment_intent?.id
    );
    if (paymentIntent.latest_charge) {
    }
    const charge =
      typeof paymentIntent.latest_charge === "string"
        ? await billing.charges.retrieve(paymentIntent.latest_charge)
        : paymentIntent.latest_charge;
    if (charge) {
      return charge.receipt_url;
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const cipher = req.nextUrl.searchParams.get("cipher");
    assert(billing, "Billing is not configured");
    if (!cipher) {
      return new Response("Bad Request - no JWT", {
        status: 400,
      });
    }
    const obj = jwt.verify(cipher, process.env.STRIPE_SECRET_KEY!) as any;
    if (obj.type !== "aiBotTopup") {
      return new Response(`Unknown obj type ${obj.type}`, {
        status: 400,
      });
    }

    const status = req.nextUrl.searchParams.get("status");
    const paymentId = obj.paymentId as string;
    const botHandle = obj.botHandle as string;
    assert(botHandle, `Bot handle is not defined`);
    const botInfo = await prisma.telegramBots.findFirst({ where: { botHandle } });
    const bot = new TelegramBot(botInfo?.botToken!, { polling: false });
    const telegramUserId = obj.telegramUserId as string;
    const chatId = parseInt(telegramUserId);

    if (status !== "success") {
      const checkoutSession = await getCheckoutSessionByClientReferenceId(paymentId);
      if (checkoutSession?.status === "open") {
        await billing.checkout.sessions.expire(checkoutSession.id);
      }
      const msg =
        "⚠️Your payment is cancelled. If you did it by mistake, try initiate payment once again. You can close the window";
      await bot.sendMessage(chatId, msg);

      return new Response(msg, {
        status: 200,
      });
    }

    const checkoutSession = await getCheckoutSessionByClientReferenceId(paymentId);
    if (!checkoutSession || checkoutSession.status === "expired") {
      const msg = `⚠️Payment ${paymentId} failed (status = ${
        checkoutSession?.status || "unknown"
      }). You may be using an expired payment link, or the payment was canceled. Please try using /topup command again.`;
      await bot.sendMessage(chatId, msg);
      return new Response(msg, {
        status: 200,
      });
    }
    assert(checkoutSession.status === "complete", "Unexpected checkout session status: " + checkoutSession.status);
    await prisma.aiCostsTransactions.create({
      data: {
        telegramUserId,
        type: "topup",
        credits: -(obj.credits as number),
      },
    });
    const receiptUrl = await getReceiptURL(checkoutSession, bot, chatId);
    await bot.sendMessage(
      chatId,
      `✅Your account has been topped up with <b>${creditsToString(
        obj.credits
      )}</b> credits. Your new balance is <b>${creditsToString(await getCostByUser(telegramUserId))}</b>.${
        receiptUrl ? ` <a href="${receiptUrl}">View or download your receipt</a>.` : ""
      }`,
      { parse_mode: "HTML", disable_web_page_preview: true }
    );
    return new Response("Tha payment went through, you can close the window", {
      status: 200,
    });
  } catch (e: any) {
    console.error("Request error: " + e?.message || "Unknown error", e);
    return new Response(e?.message || "Unknown error", { status: 500 });
  }
}
