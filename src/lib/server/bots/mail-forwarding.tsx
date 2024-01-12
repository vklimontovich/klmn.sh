import { MessageHandler } from "@/lib/server/bots/index";
import { Chat, Message, User } from "node-telegram-bot-api";
import { prisma } from "@/lib/server/prisma";
import { resend } from "@/lib/server/email";
import assert from "node:assert";
import { render } from "@react-email/render";
import { Hr, Html } from "@react-email/components";

export const helpMessage = `/help - display help
/status - display current status of your email forwarding
/setup your@email.com - setup email forwarding, or change email

For any questions, please contact @v_klmn`;

export const welcomeMessage = ({ userName }: { userName: string }) => `
Hi <b>${userName}</b>! 

I'm the email bot. I can forward messages that you foward me to your email.

To get started, use one of the following commands:

${helpMessage.trim()}`;

function getCommand(msg: Message): string | undefined {
  if (msg.text && msg.text.startsWith("/")) {
    return msg.text.substring(1).trim();
  }
  return undefined;
}

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

  // Sort entities in reverse order to avoid messing up the indices
  if (messageJson.entities) {
    const entities = messageJson.entities.sort((a, b) => b.offset - a.offset);

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
        // Add other cases as needed
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

export const handleEmailForwardingMessage: MessageHandler = async ({ msg, client, isNewUser }) => {
  const userName = getName(msg.from) || "there";
  const forwardedFrom = getName(msg.forward_from) || getName(msg.forward_from_chat) || getName(msg.from) || "unknown";
  try {
    if (isNewUser) {
      const welcomeMessageText = welcomeMessage({
        userName: userName,
      }).trim();
      console.log(welcomeMessageText);
      try {
        await client.sendMessage(
          msg.chat.id,
          welcomeMessageText,
          { parse_mode: "HTML" }
        );
      } catch (e) {
        //
      }
    }
    const command = getCommand(msg);
    if (command?.trim() === "help") {
      await client.sendMessage(msg.chat.id, `<b>Bot commands:</b>\n\n${helpMessage}`, { parse_mode: "HTML" });
      return;
    } else if (command?.trim() === "status") {
      const currentStatus = await prisma.emailForwarding.findFirst({ where: { telegramUserId: msg.from?.id + "" } });
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
      const forwarding = await prisma.emailForwarding.findFirst({ where: { telegramUserId: msg.from?.id + "" } });
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
      }

      const fromUserHandle = msg?.forward_from?.username || msg?.forward_from_chat?.username || msg?.from?.username;

      const email = forwarding.forwardTo;
      await resend!.emails.send({
        from: `${forwardedFrom} via MailForwardingBot <noreply@mail.klmn.sh>`,
        to: email,
        subject: `Message from ${forwardedFrom}`,
        html:
          telegramJsonToHtml(msg) +
          `<br /><br />---<br /><small>This message was forwared to you from <a href="https://t.me/${fromUserHandle}">@${fromUserHandle}</a> by <a href="https://t.me/MailForwardingBot">@MailForwardingBot</a></small>`,
      });
      await client.sendMessage(msg.chat.id, `Your message was forwarded to <b>${email}</b>`, { parse_mode: "HTML" });
    }
  } catch (e: any) {
    console.error(`Error processing request`, e);
    await client.sendMessage(
      msg.chat.id,
      `Something went wrong. Please try again later or contact @v_klmn if the problem persists.\n\nMessage content: <pre>${JSON.stringify(msg, null, 2)}</pre>`,
      { parse_mode: "HTML" }
    );
    return;
  }
};
