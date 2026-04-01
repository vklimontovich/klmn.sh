import TelegramBot from "node-telegram-bot-api";

export const telegramClient = process.env.TELEGRAM_TOKEN ? new TelegramBot(process.env.TELEGRAM_TOKEN) : undefined;
