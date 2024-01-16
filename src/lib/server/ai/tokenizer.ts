import { get_encoding, encoding_for_model } from "tiktoken";

export function tokenCounter(p: ({ text: string; content?: never } | { content: string; text?: never }) | string) {
  const text = typeof p === "string" ? p : p.text ? p.text : p.content;
  if (!text) {
    //never hapes
    return 0;
  }
  const tokens = get_encoding("cl100k_base").encode(text);
  //console.log(`Tokens of '${text}' - ${tokens.length}: ${tokens.toString()}`);
  return tokens.length;
}



