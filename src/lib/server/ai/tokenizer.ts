import {encode} from "gpt-tokenizer";

export function tokenCounter(p: ({ text: string; content?: never } | { content: string; text?: never }) | string) {
  const text = typeof p === "string" ? p : p.text ? p.text : p.content;
  if (!text) {
    //never hapes
    return 0;
  }
  return encode(text).length;
}



