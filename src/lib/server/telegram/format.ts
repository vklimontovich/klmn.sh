import { MessageEntity, ParseMode } from "node-telegram-bot-api";

import { parse } from "@textlint/markdown-to-ast";
import { TxtDocumentNode, TxtImageNode } from "@textlint/ast-node-types";
import { Content, TxtNodeType } from "@textlint/ast-node-types/src/NodeType";
import { omit } from "lodash";

export type TelegramFormattedMessage = { text: string; parse_mode?: ParseMode; entities?: MessageEntity[] };

type MarkdownEntity = {
  type: TxtNodeType;
  offset: number;
  len: number;
  originalNode: any;
};
type ParserRes = {
  text: string;
  entities: MarkdownEntity[];
};

function offsetPosition(childParsed: ParserRes, number: number) {
  for (const entity of childParsed.entities) {
    entity.offset += number;
  }
}

type GlobalParsingContext = {
  depth: number;
  imgCounter: number;
}

function parseNode(node: TxtDocumentNode | Content, ctx: GlobalParsingContext = {depth: 0, imgCounter: 0}): ParserRes {
  let children = (node as any).children || [];
  let type = node.type;

  if (type === "List") {
    return {
      text: node.raw + "\n\n",
      entities: [],
    };
  } else if (type === "Table") {
    return {
      text: node.raw + "\n\n",
      entities: [{ type: "CodeBlock", len: node.raw.length, offset: 0, originalNode: node }],
    };
  } else if (type === "Image") {
    const image = node as TxtImageNode;
    const imgCounter = ++ctx.imgCounter;
    const imageTitle = image.title || image.alt;
    const text = `🖼️Pic. ${imgCounter}` + (imageTitle ? ` - ${imageTitle}` : "");
    return {
      text,
      entities: [
        { type: "Link", len: text.length, offset: 0, originalNode: node },
        { type: "Strong", len: text.length, offset: 0, originalNode: node }
      ],
    };
  }

  const childText: string[] = [];
  const childEntities: MarkdownEntity[] = [];
  let offset = 0;

  for (const child of children) {
    const childConverted = parseNode(child, {...ctx, depth: ctx.depth + 1});
    const text = childConverted.text;
    childText.push(text);
    offsetPosition(childConverted, offset);
    offset += text.length;
    childEntities.push(...childConverted.entities);
  }

  if ((node as any).value) {
    childText.push((node as any).value);
  }

  let text = childText.join("");
  let lenCorrection = 0;
  if (type === "Paragraph") {
    text = text + "\n\n";
  }
  if (type === "CodeBlock") {
    text = text + "\n\n";
    lenCorrection = -2

  }

  return {
    text: text,
    entities: [
      {
        type: type,
        offset: 0,
        len: text.length + lenCorrection,
        originalNode: omit(node, ["children", "range", "value", "raw"]),
      },
      ...childEntities,
    ],
  };
}

function getTelegramEntity(entity: MarkdownEntity): MessageEntity | undefined {
  if (entity.type === "Emphasis") {
    return {
      type: "italic",
      offset: entity.offset,
      length: entity.len,
    };
  } else if (entity.type === "Strong") {
    return {
      type: "bold",
      offset: entity.offset,
      length: entity.len,
    };
  } else if (entity.type === "Link") {
    return {
      type: "text_link",
      offset: entity.offset,
      length: entity.len,
      url: entity.originalNode.url,
    };
  } else if (entity.type === "Code") {
    return {
      type: "code",
      offset: entity.offset,
      length: entity.len,
    };
  } else if (entity.type === "CodeBlock") {
    return {
      type: "pre",
      offset: entity.offset,
      length: entity.len,
      language: entity.originalNode.lang || undefined,
    };
  }
  return undefined;
}

export function markdownToTelegram(markdown: string): TelegramFormattedMessage {
  let document: TxtDocumentNode;
  try {
    document = parse(markdown);
  } catch (e: any) {
    return {
      text: markdown,
      parse_mode: undefined,
    };
  }

  const parsed = parseNode(document);
  const telegramEntities = parsed.entities.map(getTelegramEntity).filter(Boolean) as any;

  return {
    text: parsed.text,
    entities: telegramEntities,
    parse_mode: undefined,
  };
}

export function appendLoadingIndicator(m: TelegramFormattedMessage): TelegramFormattedMessage {
  if (m.parse_mode) {
    //not supported
    return m;
  } else {
    return {
      text: m.text + "...🤔",
    };
  }
}
