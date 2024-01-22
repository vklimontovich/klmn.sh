import { Message, MessageEntity, ParseMode } from "node-telegram-bot-api";

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
};

function parseNode(
  node: TxtDocumentNode | Content,
  ctx: GlobalParsingContext = { depth: 0, imgCounter: 0 }
): ParserRes {
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
        { type: "Strong", len: text.length, offset: 0, originalNode: node },
      ],
    };
  }

  const childText: string[] = [];
  const childEntities: MarkdownEntity[] = [];
  let offset = 0;

  for (const child of children) {
    const childConverted = parseNode(child, { ...ctx, depth: ctx.depth + 1 });
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
    lenCorrection = -2;
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
    text: parsed.text.trim(),
    entities: telegramEntities,
    parse_mode: undefined,
  };
}

export function appendLoadingIndicator(m: TelegramFormattedMessage): TelegramFormattedMessage {
  if (m.parse_mode) {
    //not supported
    return m;
  } else {
    const postfix = `Still thinking... 🤔`;
    return {
      text: `${m.text}\n\n${postfix}`,
      entities: [
        ...(m.entities || []),
        {
          type: "italic",
          offset: m.text.length + 2,
          length: postfix.length,
        },
      ],
    };
  }
}

export function telegramJsonToHtml(
  messageJson: Pick<Message, "text" | "caption" | "entities" | "caption_entities">
): string {
  function escapeHtml(text: string) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/\n/g, "<br />");
  }

  let htmlContent = messageJson.text || messageJson.caption || "The message contains no content";

  const replacementTable: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
    "\n": "<br />",
  };

  const rawEntities = messageJson.entities || messageJson.caption_entities || [];
  let _newContent = "";

  function offset(entities: MessageEntity[], fromPos: number, delta: number) {
    for (let entity of entities) {
      if (entity.offset >= fromPos) {
        entity.offset += delta;
      }
    }
  }

  for (let idx = 0; idx < htmlContent.length; idx++) {
    const char = htmlContent[idx];
    if (replacementTable[char]) {
      _newContent += replacementTable[char];
      offset(rawEntities, idx, replacementTable[char].length - 1);
    }
  }

  // Sort entities in reverse order to avoid messing up the indices
  const entities = rawEntities.sort((a, b) => b.offset - a.offset);

  htmlContent = escapeHtml(htmlContent);
  type Insertion = {
    position: number;
    insert: string;
    priority: number;
  };
  const insertions: Insertion[] = [];
  // Apply each entity
  for (let entity of entities) {
    const start = entity.offset;
    const end = start + entity.length;

    switch (entity.type) {
      case "bold":
        insertions.push({ position: start, insert: "<b>", priority: 1 });
        insertions.push({ position: end, insert: "</b>", priority: -1 });
        break;
      case "italic":
        insertions.push({ position: start, insert: "<i>", priority: 2 });
        insertions.push({ position: end, insert: "</i>", priority: -2 });
        break;
      case "code":
        insertions.push({ position: start, insert: "<pre><code>", priority: 3 });
        insertions.push({ position: end, insert: "</code></pre>", priority: -3 });
        break;
      case "url":
        insertions.push({ position: start, insert: `<a href="${entity.url}">`, priority: 4 });
        insertions.push({ position: end, insert: `</a>`, priority: -4 });
        break;
      case "text_link":
        insertions.push({ position: start, insert: `<a href="${entity.url}">`, priority: 5 });
        insertions.push({ position: end, insert: `</a>`, priority: -5 });
        break;
    }
    // Replace newline characters with HTML line breaks
  }
  insertions.sort((a, b) => {
    const res = a.position - b.position;
    return res === 0 ? a.priority - b.priority : res;
  });
  console.log(insertions);
  const newContent: string[] = [];

  let pos = 0;
  for (let insertion of insertions) {
    newContent.push(htmlContent.slice(pos, insertion.position));
    newContent.push(insertion.insert);
    pos = insertion.position;
  }
  return newContent.join("");
}
