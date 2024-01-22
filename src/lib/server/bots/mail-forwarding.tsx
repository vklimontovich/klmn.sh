import { getCommand, MessageHandler } from "@/lib/server/bots/index";
import TelegramBot, { Chat, Message, User } from "node-telegram-bot-api";
import { prisma } from "@/lib/server/prisma";
import { resend } from "@/lib/server/email";
import assert from "node:assert";
import { EmailForwarding } from "@prisma/client";
import { render } from "@react-email/render";
import { Hr, Html } from "@react-email/components";

export const helpMessage = `/help - display help
/status - display current settings of your email forwarding
/setup your@email.com - setup email forwarding, or change email. After email is set up, just forward messages to me and they will appear in your inbox

Found a bug or experiencing any issues? Contact @v_klmn`;

export const welcomeMessage = ({ userName }: { userName: string }) => `
👋Hi <b>${userName}</b>! 

I'm the email forwarding bot. I can forward telegram messages to email.

To get started, use one of the following commands:

${helpMessage.trim()}`;


function escapeHtml(text: string) {
  return text

    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br />");
}

function telegramJsonToHtml(messageJson: Message) {
  let htmlContent = messageJson.text || messageJson.caption || "The message contains no content";

  // Replace newline characters with HTML line breaks
  htmlContent = escapeHtml(htmlContent);

  const rawEntities = messageJson.entities || messageJson.caption_entities;
  if (rawEntities) {
    // Sort entities in reverse order to avoid messing up the indices
    const entities = rawEntities.sort((a, b) => b.offset - a.offset);

    // Apply each entity
    for (let entity of entities) {
      const start = entity.offset;
      const end = start + entity.length;
      const text = htmlContent.substring(start, end);

      switch (entity.type) {
        case "bold":
          htmlContent = replaceRange(htmlContent, start, end, `<b>${text}</b>`);
          break;
        case "italic":
          htmlContent = replaceRange(htmlContent, start, end, `<i>${text}</i>`);
          break;
        case "code":
          htmlContent = replaceRange(htmlContent, start, end, `<pre><code>${text}</code></pre>`);
          break;
        case "url":
          htmlContent = replaceRange(htmlContent, start, end, `<a href="${entity.url}">${text}</a>`);
          break;
        case "text_link":
          htmlContent = replaceRange(htmlContent, start, end, `<a href="${entity.url}">${text}</a>`);
          break;
      }
    }
  }

  return htmlContent;
}

function replaceRange(s: string, start: number, end: number, substitute: string) {
  return s.substring(0, start) + substitute + s.substring(end);
}

function getName(user?: User | Chat): string | undefined {
  if (!user) {
    return undefined;
  }
  return user.first_name && user.last_name
    ? `${user.first_name} ${user.last_name}`
    : user.first_name || user.last_name || user.username || user.id + "" || undefined;
}

type Attach = {
  filename?: string;
  secret: string;
};

async function toAttachment(
  fileId: string,
  client: TelegramBot,
  botHandle: string,
  opts: { name?: string; size?: number }
): Promise<Attach | undefined> {
  const file = await client.getFile(fileId);
  if (!file.file_size) {
    return undefined;
  }
  const secret =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
  let filename = opts.name;
  await prisma.attachment.create({
    data: {
      fileId: fileId,
      filename,
      botHandle,
      secret,
    },
  });
  return { filename, secret };
}

async function getForwardingEmail(telegramUserId: string): Promise<EmailForwarding | undefined> {
  const configuredEmails = (await prisma.emailForwarding.findMany({ where: { telegramUserId } }));
  if (!configuredEmails || configuredEmails.length === 0) {
    return undefined;
  }
  let lastConfigured = configuredEmails[0];
  for (const configured of configuredEmails) {
    if (configured.createdAt.getTime() > lastConfigured.createdAt.getTime()) {
      lastConfigured = configured;
    }
  }
  return lastConfigured;

}

export const handleEmailForwardingMessage: MessageHandler = async ({
  msg,
  client,
  appHost,
  botHandle,
}) => {
  const userName = getName(msg.from) || "there";
  const forwardedFrom = getName(msg.forward_from) || getName(msg.forward_from_chat) || getName(msg.from) || "unknown";
  const {command} = getCommand(msg);
  try {
    if (command === "start") {
      const welcomeMessageText = welcomeMessage({
        userName: userName,
      }).trim();
      console.log(welcomeMessageText);
      await client.sendMessage(msg.chat.id, welcomeMessageText, { parse_mode: "HTML" });
      return;
    }
    if (command?.trim() === "help") {
      await client.sendMessage(msg.chat.id, `<b>🚀I understand following commands </b>\n\n${helpMessage}\n\nHappy forwarding!`, { parse_mode: "HTML" });
      return;
    } else if (command?.trim() === "status") {
      const currentStatus = await getForwardingEmail(msg.from?.id + "");
      if (!currentStatus) {
        await client.sendMessage(
          msg.chat.id,
          "You haven't setup email forwarding yet. Use `/setup your@email.com` command to do so.",
          { parse_mode: "HTML" }
        );
        return;
      } else if (!currentStatus.confirmed) {
        await client.sendMessage(
          msg.chat.id,
          `You set up email forwarding to <b>${currentStatus.forwardTo}</b>, but haven't confirmed it yet. If you didn't receive a confirmation email or need a new confirmation code, please run \`setup your@email.com\` command once again`,
          { parse_mode: "HTML" }
        );
      } else {
        await client.sendMessage(
          msg.chat.id,
          `You set up email forwarding to <b>${currentStatus.forwardTo}</b> and confirmed it. You can change your email by running \`/setup\` command once again`,
          { parse_mode: "HTML" }
        );
      }
    } else if (command?.startsWith("setup")) {
      const email = msg.text?.split(" ")[1];
      if (!email) {
        await client.sendMessage(msg.chat.id, `Please specify email, e.g. \`/setup your@email.com`, {
          parse_mode: "HTML",
        });
      } else {
        assert(resend, "Emails are not configured");
        const confirmationCode = Math.random().toString(36).substring(2, 15);
        await prisma.emailForwarding.create({
          data: {
            telegramUserId: msg.from?.id + "",
            forwardTo: email,
            secret: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
            confirmationCode: confirmationCode,
          },
        });
        const confirmationLink = `https://klmn.sh/api/telegram/email-confirm?code=${confirmationCode}`;
        await resend.emails.send({
          from: `MailForwardingBot for Telegram <noreply@mail.klmn.sh>`,
          to: email,

          subject: "Confirm email forwarding for telegram bot",
          html: render(
            <Html lang="en">
              👋 Hi, {userName}! <br />
              <br />
              Please confirm your email address by clicking the link below. <br />
              <br />
              <a href={confirmationLink}>{confirmationLink}</a>
              <Hr />
              Truly yours, <br />
              <a href="https://t.me/MailForwardingBot">MailForwardingBot</a>
            </Html>
          ),
        });
        await client.sendMessage(
          msg.chat.id,
          `I sent you a confirmation email to <b>${email}</b>. After email is confirmed, I will start forwarding emails to it. If you didn't receive a confirmation email or need a new confirmation code, please run \`/setup\` command once again`,
          { parse_mode: "HTML" }
        );
      }
    } else if (command !== undefined) {
      await client.sendMessage(
        msg.chat.id,
        `I can't understand your message. Use /help to display help. Your message: ${msg.text}`,
        { parse_mode: "HTML" }
      );
    } else {
      const forwarding = await getForwardingEmail(msg.from?.id + "");
      if (!forwarding) {
        await client.sendMessage(
          msg.chat.id,
          "You haven't setup email forwarding yet. Use `/setup your@email.com` command to do so.",
          { parse_mode: "HTML" }
        );
        return;
      }
      if (!forwarding.confirmed) {
        await client.sendMessage(
          msg.chat.id,
          "You haven't confirmed email forwarding yet. Please check your email for confirmation link. If you didn't receive a confirmation email or need a new confirmation code, please run `/setup your@email.com` command once again.",
          { parse_mode: "HTML" }
        );
        return;
      }

      const fromUserHandle = msg?.forward_from?.username || msg?.forward_from_chat?.username || msg?.from?.username;
      const attachments: (Attach | undefined)[] = [];
      if (msg?.document) {
        attachments.push(
          await toAttachment(msg.document.file_id, client, botHandle, {
            name: msg.document.file_name,
            size: msg.document.file_size,
          })
        );
      }
      if (msg?.video_note) {
        attachments.push(
          await toAttachment(msg.video_note.file_id, client, botHandle, {
            name: "Video Note.mp4",
            size: msg.video_note.file_size,
          })
        );
      }
      if (msg?.video) {
        attachments.push(
          await toAttachment(msg.video.file_id, client, botHandle, {
            name: "Video Note.mp4",
            size: msg.video.file_size,
          })
        );
      }
      if (msg?.photo) {
        const maxPhoto = msg.photo.reduce((a, b) => ((a.file_size || 0) > (b.file_size || 0) ? a : b));
        attachments.push(
          await toAttachment(maxPhoto.file_id, client, botHandle, { name: "Photo.jpg", size: maxPhoto.file_size })
        );
      }

      const email = forwarding.forwardTo;
      await resend!.emails.send({
        from: `${forwardedFrom} via MailForwardingBot <noreply@mail.klmn.sh>`,
        to: email,
        subject: `Message from ${forwardedFrom}`,
        html:
          telegramJsonToHtml(msg) +
          `<br /><br />---<br /><small>This message was forwared to you from <a href="https://t.me/${fromUserHandle}">@${fromUserHandle}</a> by <a href="https://t.me/MailForwardingBot">@MailForwardingBot</a></small>`,
        attachments: attachments
          .filter(a => !!a)
          .map(a => ({
            filename: a!.filename,
            path: `${appHost}/api/telegram/download?secret=${a!.secret}`,
          })),
        headers: {
          "X-Entity-Ref-ID": Math.random().toString(36).substring(2, 15),
        },
      });
      await client.sendMessage(msg.chat.id, `📧Your message has been forwarded to <b>${email}</b>!`, { parse_mode: "HTML" });
    }
  } catch (e: any) {
    console.error(`Error processing request`, e);
    await client.sendMessage(
      msg.chat.id,
      `Something went wrong. Please try again later or contact @v_klmn if the problem persists.\n\nMessage content:<pre>${JSON.stringify(
        msg,
        null,
        2
      )}</pre>.\n\nError:\n\n<pre>${e?.message || "Unknown error"}</pre>`,
      { parse_mode: "HTML" }
    );
    return;
  }
};
