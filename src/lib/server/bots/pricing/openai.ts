import { toCredits } from "@/lib/server/bots/pricing/index";

export type Model = { input1k: number; output1k: number, api: "openai" | "antropic" };
export const models: Record<string, Model> = {
  "gpt-3.5-turbo-1106": {
    api: "openai",
    input1k: toCredits(0.001),
    output1k: toCredits(0.002),
  },
  "gpt-4": {
    api: "openai",
    input1k: toCredits(0.03),
    output1k: toCredits(0.06),
  },
  //see https://www-files.anthropic.com/production/images/model_pricing_july2023.pdf
  "claude-instant-1.2": {
    api: "antropic",
    input1k: toCredits(1.63/1000),
    output1k: toCredits(5.51/1000),
  },
  "claude-2": {
    api: "antropic",
    input1k: toCredits(11.02/1000),
    output1k: toCredits(32.68/1000),
  },
  "claude-2.1": {
    api: "antropic",
    input1k: toCredits(11.02/1000),
    output1k: toCredits(32.68/1000),
  },
};