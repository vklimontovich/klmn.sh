import { toCredits } from "@/lib/server/bots/pricing/index";

export const openaiPricing: Record<string, { input1k: number; output1k: number }> = {
  "gpt-3.5-turbo-1106": {
    input1k: toCredits(0.0010),
    output1k: toCredits(0.0020),
  },
  "gpt-4": {
    input1k: toCredits(0.03),
    output1k: toCredits(0.06),
  },
};