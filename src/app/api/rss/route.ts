import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { createHash } from "crypto";

import sanitizeHtml from "sanitize-html";

import Parser from "rss-parser";
import { rssTelegram } from "@/lib/server/rss";
import initServerLogging from "@/lib/server/server-log";
import { handleTaskQueue, submitTask } from "@/lib/server/task-queue";
import { log } from "@/lib/server/log";

initServerLogging();

function sha256(text: string) {
  const hash = createHash("sha256");
  hash.update(text);
  return hash.digest("hex");
}

const maxMessageLength = 3000;

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const formatterVersion = 0;

function formatMessage(item: Parser.Item) {
  let content = item.content || "";
  if (content.length > maxMessageLength) {
    content = content.substring(0, maxMessageLength) + "...<a href='" + item.link + "'>(read more)</a>";
  }
  const clean = sanitizeHtml(content, {
    allowedTags: ["b", "i", "em", "strong", "a", "br", "pre"],

    allowedAttributes: {
      a: ["href"],
    },
  })
    .replaceAll("<br>", "\n")
    .replaceAll("<br/>", "\n")
    .replaceAll("<br />", "\n");
  const date = item.isoDate ? new Date(item.isoDate) : new Date();
  return `<b>${(item.title || "").trim()}</b>\n\n${clean}\n\n<i><a href="${item.link}">Posted on ${formatDate(
    date
  )}</a></i>`;
}

export type Task = {
  type: "update-message" | "create-message";
  formattedMessage: string;
  channelName: string;
  messageId?: string;
  taskKey?: string;
  itemGuid: string;
  rssFeedId: string;
  rssItemId?: string;
  contentSignature: string;
};

export async function GET(request: NextRequest) {
  if (!rssTelegram) {
    return Response.json({ ok: false, error: "Telegram not configured" });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }
  const allFeeds = await prisma.rssExport.findMany();

  const immediateTasks: Task[] = [];
  const scheduledTasks: Task[] = [];
  const messages: string[] = [];
  function logMessage(message: string, ...args: any[]) {
    messages.push(message + " " + args.join(" "));
    console.log(message, ...args);
  }

  for (const feed of allFeeds) {
    const response = await fetch(feed.rssUrl, {
      cache: "no-store",
      headers: feed.lastUpdateAt ? { "If-Modified-Since": feed.lastUpdateAt?.toUTCString() || "" } : {},
    });
    if (response.status === 304) {
      logMessage(`Feed ${feed.rssUrl} is not modified`);
      continue;
    }
    if (response.status !== 200) {
      logMessage(`Feed ${feed.rssUrl} returned status ${response.status} ${response.statusText}`);
    }
    const feedText = await response.text();
    const signature = response.headers.get("etag") || sha256(feedText);

    if (feed.lastSignature === signature) {
      logMessage(`Feed change detected ${feed.rssUrl}`);
      continue;
    }

    logMessage(`Feed change detected ${feed.rssUrl}`);

    const result = await new Parser().parseString(feedText);

    const items = [...result.items];
    items.sort((a, b) => {
      if (a.isoDate && b.isoDate) {
        return new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime();
      }
      return 0;
    });
    items.reverse();
    logMessage(`Feed ${feed.rssUrl} has ${items.length} items`);
    const guidFilter = request.nextUrl.searchParams.get("guid");

    for (const item of items) {
      const itemDescription = `"${item.title}" @ ${item.link} of ${item.isoDate}`;
      const guid = item.guid || item.link;
      if (!guid) {
        logMessage(`Item ${item.title} has no guid or link. Skipping`);
        continue;
      }
      if (guidFilter && guidFilter !== guid) {
        logMessage(`Skipping item ${itemDescription} because of filter ${guidFilter}`);
        continue;
      }
      const existingItem = await prisma.rssItem.findFirst({
        where: {
          guid,
        },
      });
      const formattedMessage = formatMessage(item);
      if (existingItem) {
        const hash = sha256(formattedMessage) + formatterVersion;
        if (existingItem.signature === hash) {
          logMessage(`Skipping existing item ${itemDescription} because of same signature`);
          continue;
        }
        logMessage(`Scheduled and update of an ${itemDescription} because of different signature`);
        scheduledTasks.push({
          type: "update-message",
          formattedMessage,
          itemGuid: guid,
          rssFeedId: feed.id,
          taskKey: `${feed.telegramChannelName}/${existingItem.channelMessageId}`,
          messageId: existingItem.channelMessageId,
          channelName: feed.telegramChannelName,
          contentSignature: hash,
          rssItemId: existingItem.id,
        });
      } else {
        logMessage(`New item ${itemDescription}, scheduling immediate task`);
        immediateTasks.push({
          itemGuid: guid,
          rssFeedId: feed.id,
          type: "create-message",
          formattedMessage,
          channelName: feed.telegramChannelName,
          contentSignature: sha256(formattedMessage),
        });
      }
    }
    await prisma.rssExport.update({
      where: {
        id: feed.id,
      },
      data: {
        lastSignature: signature,
        lastUpdateAt: new Date(),
      },
    });
  }
  console.log(
    `Parsed ${allFeeds.length} feeds, ${immediateTasks.length} immediate tasks, ${scheduledTasks.length} scheduled tasks`
  );
  for (const task of scheduledTasks) {
    await submitTask(task, { key: task.taskKey });
  }
  console.log(`Submitted ${scheduledTasks.length} scheduled tasks. Running ${immediateTasks.length} immediate tasks`);
  for (const task of immediateTasks) {
    try {
      await taskHandler(task);
    } catch (e: any) {
      console.error(`Error handling task ${JSON.stringify(task)}`, e);
    }
  }

  await handleTaskQueue(taskHandler);

  await log("rss-update", { immediateTasks: immediateTasks.length, scheduledTasks: scheduledTasks.length, messages });

  return Response.json({ ok: true, immediateTasks: immediateTasks.length, scheduledTasks: scheduledTasks.length });
}

async function taskHandler(task: Task) {
  if (task.type === "create-message") {
    const message = await rssTelegram!.sendMessage("@" + task.channelName, task.formattedMessage, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    await prisma.rssItem.create({
      data: {
        guid: task.itemGuid,
        rssExportId: task.rssFeedId,
        channelMessageId: message.message_id.toString(),
        signature: task.contentSignature,
      },
    });
  } else if (task.type === "update-message") {
    try {
      await rssTelegram!.editMessageText(task.formattedMessage, {
        chat_id: "@" + task.channelName,
        message_id: parseInt(task.messageId!),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    } catch (e: any) {
      if (e?.message?.indexOf("message is not modified") >= 0) {
        console.log(`Message ${task.messageId} is not modified, skipping`);
      } else {
        throw e;
      }
    }
    await prisma.rssItem.update({
      where: {
        id: task.rssItemId!,
      },
      data: {
        signature: task.contentSignature,
      },
    });
  }
}
