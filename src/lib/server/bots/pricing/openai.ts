import { toCredits } from "@/lib/server/bots/pricing/index";

export const openaiPricing: Record<string, { input1k: number; output1k: number }> = {
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