import { Stripe } from "stripe";
import { prisma } from "@/lib/server/prisma";

export const billing = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : undefined;

export function creditsToString(credits: number): string {
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

export async function getCostByUser(telegramUserId: string): Promise<number> {
  const res = await prisma.aiCostsTransactions.aggregate({ where: { telegramUserId }, _sum: { credits: true } });
  return 1000 - (res?._sum?.credits?.toNumber() || 0);
}


