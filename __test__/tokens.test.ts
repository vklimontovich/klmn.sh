import { test } from "bun:test";
import { tokenCounter } from "@/lib/server/ai/tokenizer";

test("ga-enrichment", async () => {
  console.log(
    tokenCounter({ content: "What's you knowledge cut off date? And what's you exact model revision?" })
  );
});
